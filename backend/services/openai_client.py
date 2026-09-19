import asyncio
import base64
import json
import os
import random
import time
from types import SimpleNamespace

from openai import (
    APIConnectionError,
    APIStatusError,
    AsyncOpenAI,
    AuthenticationError,
    RateLimitError,
)

from prompts.extraction_prompt import (
    CANDIDATE_EXTRACTION_SYSTEM_PROMPT,
    VALIDATION_SYSTEM_PROMPT,
    build_candidate_extraction_user_text,
    build_validation_user_text,
)
from prompts.email_extraction_prompt import (
    EMAIL_CANDIDATE_EXTRACTION_SYSTEM_PROMPT,
    EMAIL_VALIDATION_SYSTEM_PROMPT,
    build_email_candidate_user_text,
    build_email_validation_user_text,
)
from services.norm_text import normalize_ofl_designation

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured. Copy backend/.env.example to backend/.env and add your key.")

    global _client
    if _client is None:
        # max_retries=0: retry behavior is handled explicitly by _with_retry
        # below (consistent, logged backoff), not silently by the SDK.
        _client = AsyncOpenAI(api_key=api_key, max_retries=0)
    return _client


def _model_name() -> str:
    return os.environ.get("OPENAI_MODEL", "gpt-5-mini")


# gpt-5-mini is a reasoning model — "thinking" happens as hidden
# reasoning_tokens drawn from the same completion-token budget as the
# visible answer, the same trade-off Gemini's thinking_config has. Exposed
# via env so token spend is tunable without a code change: "minimal" skips
# reasoning entirely (cheapest, least accurate on hard-to-read drawings),
# up to "high" (most thorough, most expensive). Verified live against the
# real API — all four levels ("minimal", "low", "medium", "high") work.
def _reasoning_effort() -> str:
    return os.environ.get("OPENAI_REASONING_EFFORT", "medium")


# Separate budgets per stage, matching the original Gemini config: stage 2
# does more reasoning (the critical-field checklist) than stage 1's plain
# enumeration, so it's allowed to default to the same generous ceiling
# rather than a smaller one that risks truncating mid-checklist. 16384 (not
# 8192) — confirmed live that hidden reasoning tokens are drawn from this
# same budget before the visible answer, and 8192 was not enough headroom
# once a drawing needs several high-resolution regions: at
# reasoning_effort=high it was entirely consumed by reasoning with zero
# tokens left for output (a hard truncation error), and at the default
# "medium" the same crowding was silently cutting fields from the
# candidate list rather than erroring.
def _max_tokens_stage1() -> int:
    return int(os.environ.get("OPENAI_MAX_TOKENS_STAGE1", "16384"))


def _max_tokens_stage2() -> int:
    return int(os.environ.get("OPENAI_MAX_TOKENS_STAGE2", "16384"))


# RateLimitError (429) is worth retrying — usually a short-lived per-minute
# limit. InternalServerError (5xx) is OpenAI's own infrastructure having a
# bad moment. APIConnectionError is the SDK never getting an HTTP response
# at all (DNS hiccup, dropped TCP connection, a momentary network blip
# during a large multi-image request) — surfaced to users as the generic
# "Connection error." message; a single brief network hiccup is exactly as
# worth one retry as an overloaded server is, so this is retried the same
# way, not left to fail the whole extraction immediately. Auth/permission/
# bad-request errors are not retryable.
def _is_retryable_error(error: Exception) -> bool:
    if isinstance(error, RateLimitError):
        return True
    if isinstance(error, APIStatusError) and error.status_code >= 500:
        return True
    if isinstance(error, APIConnectionError):
        return True
    return False


# retries=1: one real second chance before giving up, not the drawn-out
# multi-retry backoff that made a genuinely overloaded Gemini take 1-4
# minutes to finally fail (see gemini_client.py's history, before this
# provider swap) — same lesson applied here from the start.
async def _with_retry(fn, retries: int = 1, base_delay_ms: int = 1500):
    attempt = 0
    while True:
        try:
            return await fn()
        except Exception as error:  # noqa: BLE001 - re-raised below when not retryable
            if attempt >= retries or not _is_retryable_error(error):
                raise
            delay_ms = base_delay_ms * (2**attempt) + random.random() * 300
            print(
                f"OpenAI request failed ({type(error).__name__}), retrying in {round(delay_ms)}ms "
                f"(attempt {attempt + 1}/{retries})..."
            )
            await asyncio.sleep(delay_ms / 1000)
            attempt += 1


# Same JSON Schema this app already used for Gemini's/Groq's structured
# stage-1 output, expressed as a plain JSON Schema dict (OpenAI's
# response_format takes standard JSON Schema, verified live against the
# real API with strict:true).
_CANDIDATE_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "candidates": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "field": {
                        "type": "string",
                        "description": (
                            "partNumber | partName | material | materialGrade | materialStandard | "
                            "sheetThickness | weight | surfaceTreatment | coatingThickness | surfaceArea | "
                            "specificWeight | annualQuantity | contractDuration | sop | specialNote"
                        ),
                    },
                    "value": {"type": "string", "description": "Reading, decimal comma normalized to a point."},
                    "exactText": {"type": "string", "description": "Literal printed text, unmodified."},
                    "context": {"type": "string", "description": "Surrounding label/text."},
                    "location": {"type": "string", "description": "Where on the drawing this appears."},
                    "primaryComponent": {
                        "type": "boolean",
                        "description": "True only if this clearly belongs to the main/primary part.",
                    },
                    "partGroup": {
                        "type": "string",
                        "description": (
                            "Which independent part this belongs to when the source describes several "
                            "separate parts (e.g. its part number, or 'Page 3') — use 'single' when the "
                            "whole source is one part/assembly."
                        ),
                    },
                },
                "required": [
                    "field",
                    "value",
                    "exactText",
                    "context",
                    "location",
                    "primaryComponent",
                    "partGroup",
                ],
                "additionalProperties": False,
            },
        },
    },
    "required": ["candidates"],
    "additionalProperties": False,
}


# Structured output for the email-only path's validation stage — an array
# of parts (usually one) instead of free text, so the caller can split
# genuinely separate components into separate Calculation slots (see
# services/email_extraction.py). Every field is nullable-string: OpenAI's
# strict JSON Schema mode requires every property to be listed in
# "required", so "not established" is expressed as a null value rather than
# an omitted key.
_EMAIL_PART_FIELDS = [
    "partNumber",
    "partName",
    "material",
    "materialGrade",
    "materialStandard",
    "sheetThickness",
    "weight",
    "surfaceArea",
    "surfaceTreatment",
    "coatingThickness",
    "specificWeight",
    "annualQuantity",
    "contractDuration",
    "sop",
    "specialNote",
]

_EMAIL_PARTS_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "parts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {field: {"type": ["string", "null"]} for field in _EMAIL_PART_FIELDS},
                "required": _EMAIL_PART_FIELDS,
                "additionalProperties": False,
            },
        },
    },
    "required": ["parts"],
    "additionalProperties": False,
}


# Interleaves a text label before each image, same convention the
# Gemini/Groq clients used, so the model knows which page/region of the
# drawing it's looking at (labels come from file_processing.py's tiling).
def _image_content_parts(images: list[dict]) -> list[dict]:
    parts = []
    for image in images:
        parts.append({"type": "text", "text": f"--- {image['label']} ---"})
        b64 = base64.b64encode(image["data"]).decode("ascii")
        parts.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}})
    return parts


def _log_usage(stage: str, response) -> None:
    usage = response.usage
    if usage is None:
        return
    reasoning = getattr(usage.completion_tokens_details, "reasoning_tokens", None) if usage.completion_tokens_details else None
    print(
        f"OpenAI {stage} usage - prompt: {usage.prompt_tokens}, completion: {usage.completion_tokens}"
        f"{f' (reasoning: {reasoning})' if reasoning else ''}, total: {usage.total_tokens}"
    )


# Same request, same parameters, same final answer as a plain
# chat.completions.create() — but delivered as a stream so the caller can
# be told, live, how many output chunks (≈ tokens) have arrived so far. Only
# used when a progress callback is supplied (the /api/extract-stream
# endpoint); every other caller keeps the original non-streaming call
# untouched. Returns an object with the same attributes the callers below
# read from a normal response (.usage, .choices[0].finish_reason,
# .choices[0].message.content), so nothing downstream needs to know which
# path produced it.
#
# Note the reasoning model's hidden "thinking" tokens are never streamed —
# on_tokens only starts firing once the model begins writing its visible
# answer, which is why the progress bar treats "output has started" as a
# separate, later phase of each stage rather than a continuous 0-100% count.
async def _stream_chat_completion(client: AsyncOpenAI, on_tokens, **kwargs):
    stream = await client.chat.completions.create(stream=True, stream_options={"include_usage": True}, **kwargs)
    parts: list[str] = []
    finish_reason = None
    usage = None
    count = 0
    last_emit = 0.0
    async for chunk in stream:
        if chunk.usage is not None:
            usage = chunk.usage
        if not chunk.choices:
            continue
        choice = chunk.choices[0]
        delta = choice.delta.content if choice.delta else None
        if delta:
            parts.append(delta)
            count += 1
            now = time.monotonic()
            if now - last_emit >= 0.4:
                on_tokens(count)
                last_emit = now
        if choice.finish_reason:
            finish_reason = choice.finish_reason
    on_tokens(count)
    return SimpleNamespace(
        usage=usage,
        choices=[SimpleNamespace(finish_reason=finish_reason, message=SimpleNamespace(content="".join(parts)))],
    )


async def _run_candidate_extraction(client: AsyncOpenAI, model: str, images: list[dict], on_tokens=None) -> dict:
    async def call():
        request = dict(
            model=model,
            messages=[
                {"role": "system", "content": CANDIDATE_EXTRACTION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [*_image_content_parts(images), {"type": "text", "text": build_candidate_extraction_user_text()}],
                },
            ],
            reasoning_effort=_reasoning_effort(),
            max_completion_tokens=_max_tokens_stage1(),
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "candidate_extraction", "schema": _CANDIDATE_JSON_SCHEMA, "strict": True},
            },
        )
        if on_tokens is not None:
            return await _stream_chat_completion(client, on_tokens, **request)
        return await client.chat.completions.create(**request)

    response = await _with_retry(call)
    _log_usage("stage 1 (candidate extraction)", response)

    finish_reason = response.choices[0].finish_reason if response.choices else None
    if finish_reason == "length":
        raise RuntimeError(
            "Stage 1 (candidate extraction) ran out of output tokens before finishing — the drawing may be unusually complex."
        )

    raw = (response.choices[0].message.content or "").strip() if response.choices else ""
    if not raw:
        raise RuntimeError("Stage 1 (candidate extraction) returned an empty response.")

    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise RuntimeError("Stage 1 (candidate extraction) returned malformed JSON.") from error


async def _run_validation(client: AsyncOpenAI, model: str, images: list[dict], candidates: list, on_tokens=None) -> str:
    async def call():
        request = dict(
            model=model,
            messages=[
                {"role": "system", "content": VALIDATION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [*_image_content_parts(images), {"type": "text", "text": build_validation_user_text(candidates)}],
                },
            ],
            reasoning_effort=_reasoning_effort(),
            max_completion_tokens=_max_tokens_stage2(),
        )
        if on_tokens is not None:
            return await _stream_chat_completion(client, on_tokens, **request)
        return await client.chat.completions.create(**request)

    response = await _with_retry(call)
    _log_usage("stage 2 (validation)", response)

    finish_reason = response.choices[0].finish_reason if response.choices else None
    if finish_reason == "length":
        raise RuntimeError("Stage 2 (validation) ran out of output tokens before finishing — the drawing may be unusually complex.")

    text = (response.choices[0].message.content or "").strip() if response.choices else ""
    if not text:
        raise RuntimeError("Stage 2 (validation) returned an empty response.")
    return normalize_ofl_designation(text)


# Same two-stage design the app has used from the start (candidate
# extraction, then validation against a checklist) — same prompts, same
# images, just called through OpenAI's chat.completions instead of
# Gemini's generateContent. See prompts/extraction_prompt.py's own
# docstring for why two stages instead of one single-shot read.
#
# `on_event` (optional) receives real progress events as they happen —
# {"type": "stage", "stage": 1|2, "state": "start"|"done", "seconds": ...}
# and {"type": "tokens", "stage": 1|2, "count": n} while a stage's visible
# answer is streaming in. Passing it switches both calls to their streaming
# form; omitting it (the plain /api/extract endpoint) keeps the original
# behavior exactly.
async def extract_drawing_info(images: list[dict], on_event=None) -> str:
    client = _get_client()
    model = _model_name()

    if on_event is None:
        candidate_result = await _run_candidate_extraction(client, model, images)
        return await _run_validation(client, model, images, candidate_result.get("candidates", []))

    on_event({"type": "stage", "stage": 1, "state": "start"})
    started = time.monotonic()
    candidate_result = await _run_candidate_extraction(
        client, model, images, lambda count: on_event({"type": "tokens", "stage": 1, "count": count})
    )
    stage1_seconds = round(time.monotonic() - started, 1)
    print(f"OpenAI stage 1 (candidate extraction) took {stage1_seconds}s")
    on_event({"type": "stage", "stage": 1, "state": "done", "seconds": stage1_seconds})

    on_event({"type": "stage", "stage": 2, "state": "start"})
    started = time.monotonic()
    summary = await _run_validation(
        client, model, images, candidate_result.get("candidates", []),
        lambda count: on_event({"type": "tokens", "stage": 2, "count": count}),
    )
    stage2_seconds = round(time.monotonic() - started, 1)
    print(f"OpenAI stage 2 (validation) took {stage2_seconds}s")
    on_event({"type": "stage", "stage": 2, "state": "done", "seconds": stage2_seconds})
    return summary


async def _run_email_candidate_extraction(
    client: AsyncOpenAI, model: str, email_text: str, images: list[dict], on_tokens=None
) -> dict:
    async def call():
        request = dict(
            model=model,
            messages=[
                {"role": "system", "content": EMAIL_CANDIDATE_EXTRACTION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": build_email_candidate_user_text(email_text)},
                        *_image_content_parts(images),
                    ],
                },
            ],
            reasoning_effort=_reasoning_effort(),
            max_completion_tokens=_max_tokens_stage1(),
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "email_candidate_extraction", "schema": _CANDIDATE_JSON_SCHEMA, "strict": True},
            },
        )
        if on_tokens is not None:
            return await _stream_chat_completion(client, on_tokens, **request)
        return await client.chat.completions.create(**request)

    response = await _with_retry(call)
    _log_usage("email stage 1 (candidate extraction)", response)

    finish_reason = response.choices[0].finish_reason if response.choices else None
    if finish_reason == "length":
        raise RuntimeError("Stage 1 (candidate extraction) ran out of output tokens before finishing — the email may be unusually long.")

    raw = (response.choices[0].message.content or "").strip() if response.choices else ""
    if not raw:
        raise RuntimeError("Stage 1 (candidate extraction) returned an empty response.")

    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise RuntimeError("Stage 1 (candidate extraction) returned malformed JSON.") from error


async def _run_email_validation(
    client: AsyncOpenAI, model: str, email_text: str, images: list[dict], candidates: list, on_tokens=None
) -> list[dict]:
    async def call():
        request = dict(
            model=model,
            messages=[
                {"role": "system", "content": EMAIL_VALIDATION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": build_email_validation_user_text(email_text, candidates)},
                        *_image_content_parts(images),
                    ],
                },
            ],
            reasoning_effort=_reasoning_effort(),
            max_completion_tokens=_max_tokens_stage2(),
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "email_validated_parts", "schema": _EMAIL_PARTS_JSON_SCHEMA, "strict": True},
            },
        )
        if on_tokens is not None:
            return await _stream_chat_completion(client, on_tokens, **request)
        return await client.chat.completions.create(**request)

    response = await _with_retry(call)
    _log_usage("email stage 2 (validation)", response)

    finish_reason = response.choices[0].finish_reason if response.choices else None
    if finish_reason == "length":
        raise RuntimeError("Stage 2 (validation) ran out of output tokens before finishing — the email may be unusually long.")

    raw = (response.choices[0].message.content or "").strip() if response.choices else ""
    if not raw:
        raise RuntimeError("Stage 2 (validation) returned an empty response.")

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as error:
        raise RuntimeError("Stage 2 (validation) returned malformed JSON.") from error

    return parsed.get("parts", [])


# Email-only calculation source (see services/email_extraction.py) — same
# two-stage design as extract_drawing_info, adapted for email subject/body
# text plus optional embedded images, and returning structured per-part
# JSON instead of one free-text summary so the caller can split genuinely
# separate components into separate Calculation slots.
#
# `on_event` (optional) works exactly as in extract_drawing_info above —
# real per-stage start/done + live token events; omitting it keeps the
# original non-streaming behavior.
async def extract_calculation_from_email(email_text: str, images: list[dict], on_event=None) -> list[dict]:
    client = _get_client()
    model = _model_name()

    if on_event is None:
        candidate_result = await _run_email_candidate_extraction(client, model, email_text, images)
        return await _run_email_validation(client, model, email_text, images, candidate_result.get("candidates", []))

    on_event({"type": "stage", "stage": 1, "state": "start"})
    started = time.monotonic()
    candidate_result = await _run_email_candidate_extraction(
        client, model, email_text, images, lambda count: on_event({"type": "tokens", "stage": 1, "count": count})
    )
    stage1_seconds = round(time.monotonic() - started, 1)
    print(f"OpenAI email stage 1 (candidate extraction) took {stage1_seconds}s")
    on_event({"type": "stage", "stage": 1, "state": "done", "seconds": stage1_seconds})

    on_event({"type": "stage", "stage": 2, "state": "start"})
    started = time.monotonic()
    parts = await _run_email_validation(
        client, model, email_text, images, candidate_result.get("candidates", []),
        lambda count: on_event({"type": "tokens", "stage": 2, "count": count}),
    )
    stage2_seconds = round(time.monotonic() - started, 1)
    print(f"OpenAI email stage 2 (validation) took {stage2_seconds}s")
    on_event({"type": "stage", "stage": 2, "state": "done", "seconds": stage2_seconds})
    return parts


# Translates a raw OpenAI/SDK error into one consistent user-facing
# message, used by /api/extract's error handler.
def describe_extraction_error(error: Exception, fallback_prefix: str = "Could not process this file.") -> dict:
    is_config_error = isinstance(error, AuthenticationError) or "OPENAI_API_KEY" in str(error)
    is_quota_exceeded = isinstance(error, APIStatusError) and (
        error.status_code == 429 and "insufficient_quota" in str(error).lower()
        or "credit_balance_exhausted" in str(error).lower()
    )
    is_rate_limited = isinstance(error, RateLimitError) and not is_quota_exceeded
    is_transient_overload = is_rate_limited or (isinstance(error, APIStatusError) and error.status_code >= 500)

    if is_config_error:
        message = str(error)
    elif is_quota_exceeded:
        message = (
            "Your OpenAI account has no remaining credits. Add credits at "
            "https://platform.openai.com/settings/organization/billing to continue."
        )
    elif is_transient_overload:
        message = "The AI model is currently overloaded and didn't recover after a few retries. Please try again in a minute."
    else:
        message = f"{fallback_prefix} {error or 'Unknown error.'}"

    return {
        "message": message,
        "is_config_error": is_config_error,
        "is_quota_exceeded": is_quota_exceeded,
        "is_transient_overload": is_transient_overload,
    }
