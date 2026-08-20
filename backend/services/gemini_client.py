import asyncio
import json
import os
import random
import re

from google import genai
from google.genai import errors, types

from prompts.extraction_prompt import (
    CANDIDATE_EXTRACTION_SYSTEM_PROMPT,
    VALIDATION_SYSTEM_PROMPT,
    build_candidate_extraction_user_text,
    build_validation_user_text,
)

_client: genai.Client | None = None


# A 429 can mean two very different things from the Gemini API: a
# short-lived per-minute rate limit (worth retrying — it clears in
# seconds) or a RESOURCE_EXHAUSTED daily/quota cap (retrying is pointless —
# it will not clear until the quota window resets, so hammering it just
# burns more of the same limited quota on doomed requests).
def is_quota_exceeded_error(error: Exception) -> bool:
    if not isinstance(error, errors.ClientError):
        return False
    haystack = f"{error.status or ''} {error.message or ''}"
    return bool(re.search(r"RESOURCE_EXHAUSTED|quota", haystack, re.IGNORECASE))


# The SDK raises ServerError for any 5xx (including 503 "model is currently
# experiencing high demand", which is common and usually resolves within
# seconds) and ClientError for 4xx, which includes transient 429 rate-limit
# responses. A quota-exceeded 429 is excluded here (see
# is_quota_exceeded_error) since it isn't transient. Everything else (bad
# request, auth failure, etc.) is not worth retrying.
def _is_retryable_error(error: Exception) -> bool:
    if isinstance(error, errors.ServerError):
        return True
    if isinstance(error, errors.ClientError) and error.code == 429:
        return not is_quota_exceeded_error(error)
    return False


async def _with_retry(fn, retries: int = 3, base_delay_ms: int = 1500):
    attempt = 0
    while True:
        try:
            return await fn()
        except Exception as error:  # noqa: BLE001 - re-raised below when not retryable
            if attempt >= retries or not _is_retryable_error(error):
                raise
            delay_ms = base_delay_ms * (2**attempt) + random.random() * 300
            print(
                f"Gemini request failed ({type(error).__name__}), retrying in {round(delay_ms)}ms "
                f"(attempt {attempt + 1}/{retries})..."
            )
            await asyncio.sleep(delay_ms / 1000)
            attempt += 1


def _get_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured. Copy backend-python/.env.example to backend-python/.env and add your key."
        )

    global _client
    if _client is None:
        _client = genai.Client(api_key=api_key)
    return _client


def _model_name() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-flash-latest")


# Enforced via Gemini's structured output so stage 1 always returns
# well-formed candidates instead of hoping the model's prose parses cleanly.
_CANDIDATE_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "candidates": types.Schema(
            type=types.Type.ARRAY,
            items=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "field": types.Schema(
                        type=types.Type.STRING,
                        description=(
                            "partNumber | partName | material | materialGrade | materialStandard | "
                            "sheetThickness | weight | surfaceTreatment | coatingThickness | specificWeight"
                        ),
                    ),
                    "value": types.Schema(type=types.Type.STRING, description="Reading, decimal comma normalized to a point."),
                    "exactText": types.Schema(type=types.Type.STRING, description="Literal printed text, unmodified."),
                    "context": types.Schema(type=types.Type.STRING, description="Surrounding label/text."),
                    "location": types.Schema(type=types.Type.STRING, description="Where on the drawing this appears."),
                    "primaryComponent": types.Schema(
                        type=types.Type.BOOLEAN,
                        description="True only if this clearly belongs to the main/primary part.",
                    ),
                },
                required=["field", "value", "exactText", "context", "location", "primaryComponent"],
            ),
        ),
    },
    required=["candidates"],
)


# Interleaves a text label before each image so the model knows which page
# or region of the drawing it's looking at (labels come from
# file_processing.py's tiling, e.g. "Page 1 — High-resolution region — row
# 1/2, column 2/2").
def _build_image_parts(images: list[dict]) -> list:
    parts = []
    for image in images:
        parts.append(f"--- {image['label']} ---")
        parts.append(types.Part.from_bytes(data=image["data"], mime_type="image/png"))
    return parts


async def _run_candidate_extraction(client: genai.Client, model: str, images: list[dict]) -> dict:
    async def call():
        return await client.aio.models.generate_content(
            model=model,
            contents=[*_build_image_parts(images), build_candidate_extraction_user_text()],
            config=types.GenerateContentConfig(
                system_instruction=CANDIDATE_EXTRACTION_SYSTEM_PROMPT,
                temperature=0.1,
                # Gemini 2.5's internal "thinking" tokens are drawn from the
                # same max_output_tokens budget as the visible response — an
                # unbounded thinking budget can silently eat the whole
                # budget and truncate the actual JSON before it's written,
                # so both are set generously and explicitly here rather
                # than left on their (much smaller) defaults.
                max_output_tokens=8192,
                thinking_config=types.ThinkingConfig(thinking_budget=1024),
                response_mime_type="application/json",
                response_schema=_CANDIDATE_SCHEMA,
            ),
        )

    response = await _with_retry(call)

    finish_reason = response.candidates[0].finish_reason if response.candidates else None
    if finish_reason == types.FinishReason.MAX_TOKENS:
        raise RuntimeError(
            "Stage 1 (candidate extraction) ran out of output tokens before finishing — the drawing may be unusually complex."
        )

    raw = (response.text or "").strip()
    if not raw:
        raise RuntimeError("Stage 1 (candidate extraction) returned an empty response.")

    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise RuntimeError("Stage 1 (candidate extraction) returned malformed JSON.") from error


async def _run_validation(client: genai.Client, model: str, images: list[dict], candidates: list) -> str:
    async def call():
        return await client.aio.models.generate_content(
            model=model,
            contents=[*_build_image_parts(images), build_validation_user_text(candidates)],
            config=types.GenerateContentConfig(
                system_instruction=VALIDATION_SYSTEM_PROMPT,
                temperature=0.1,
                # Stage 2 does real reasoning (the critical-field checklist)
                # before committing to an answer, so it gets a larger
                # thinking allowance than stage 1 — both draw from
                # max_output_tokens, so that's raised to match.
                max_output_tokens=8192,
                thinking_config=types.ThinkingConfig(thinking_budget=2048),
            ),
        )

    response = await _with_retry(call)

    finish_reason = response.candidates[0].finish_reason if response.candidates else None
    if finish_reason == types.FinishReason.MAX_TOKENS:
        raise RuntimeError(
            "Stage 2 (validation) ran out of output tokens before finishing — the drawing may be unusually complex."
        )

    text = (response.text or "").strip()
    if not text:
        raise RuntimeError("Stage 2 (validation) returned an empty response.")
    return text


# `images` is [{"label": str, "data": bytes(PNG)}, ...] covering every
# page/region of the drawing (see file_processing.py).
#
# Runs a two-stage pass instead of one single-shot read:
#   Stage 1 (candidate extraction) enumerates every plausible value per
#   field with its exact printed text, context and location — it is not
#   allowed to resolve conflicts yet.
#   Stage 2 (validation) is handed back those candidates plus the same
#   images, applies the priority/conflict rules and a critical-field
#   checklist, and only then commits to a final value — defaulting to
#   "Not specified on drawing" wherever it can't confidently attribute a
#   value to the primary component.
#
# This targets a specific failure mode: a single-shot read silently
# "corrects" a hard-to-read identifier toward a more common one it has seen
# more often in training (e.g. DX53D -> DC04, Ofl-x633 -> Ofl-x630) instead
# of reporting what is actually printed on the drawing.
async def extract_drawing_info(images: list[dict]) -> str:
    client = _get_client()
    model = _model_name()

    candidate_result = await _run_candidate_extraction(client, model, images)
    return await _run_validation(client, model, images, candidate_result.get("candidates", []))


# Translates a raw Gemini/SDK error into one consistent user-facing
# message, used by /api/extract's error handler.
def describe_extraction_error(error: Exception, fallback_prefix: str = "Could not process this file.") -> dict:
    is_config_error = "GEMINI_API_KEY" in str(error)
    is_quota_exceeded = is_quota_exceeded_error(error)
    is_transient_overload = not is_quota_exceeded and (
        isinstance(error, errors.ServerError) or (isinstance(error, errors.ClientError) and error.code == 429)
    )

    if is_config_error:
        message = str(error)
    elif is_quota_exceeded:
        message = (
            "Your Gemini API key has hit its request quota (the free tier allows a limited number of requests per day). "
            "Wait for it to reset, or use a key with a higher quota/billing enabled. "
            "See https://ai.google.dev/gemini-api/docs/rate-limits."
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
