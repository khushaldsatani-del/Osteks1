import io

from PIL import Image, ImageOps

from services import openai_client

# Orchestration for the email-only calculation source (main.py's
# /api/extract-email). Deliberately NOT in email_processing.py — that
# module's own doc comment says parsing never calls an AI model, and this
# file's whole job is to do exactly that, so keeping them separate keeps
# that comment true and the storage/AI boundary easy to see at a glance.

# Below this, an "image" attachment is almost always a tracking pixel or a
# tiny inline icon, not a genuine engineering screenshot — skip it rather
# than spend a vision-model image slot on it.
_MIN_ATTACHMENT_BYTES = 3 * 1024

# Cost control: a real calculation-relevant screenshot count per email is
# small; this is a generous ceiling, not a typical case.
_MAX_EMAIL_IMAGES = 6

_MAX_EMAIL_IMAGE_EDGE_PX = 2048

_NOT_SPECIFIED = "Not specified in email"

# Fields that always get their own line, using "Not specified in email"
# when null — mirrors the drawing pipeline's single-part OUTPUT FORMAT
# convention exactly, so the existing frontend parser
# (extractionParser.js's parseExtractionSummary/parseOfferDetailsFields,
# and its NOT_SPECIFIED regex) needs zero changes to understand these
# lines.
_ALWAYS_PRESENT_FIELDS = [
    ("partNumber", "Part Number"),
    ("partName", "Part Name"),
    ("material", "Material"),
    ("materialGrade", "Material Grade"),
    ("materialStandard", "Material Standard"),
    ("sheetThickness", "Sheet Thickness"),
    ("weight", "Weight"),
    ("surfaceTreatment", "Surface Treatment"),
    ("coatingThickness", "Coating Thickness"),
    ("specificWeight", "Specific Weight"),
]

# Fields whose line is omitted entirely when absent — same convention the
# drawing pipeline already uses for Annual Quantity.
_OMIT_IF_ABSENT_FIELDS = [
    ("surfaceArea", "Surface Area"),
    ("annualQuantity", "Annual Quantity"),
    ("contractDuration", "Contract Duration"),
    ("sop", "SOP"),
    ("specialNote", "Notes"),
]


def _normalize_image_attachments(attachments: list[dict]) -> list[dict]:
    candidates = [
        attachment
        for attachment in attachments
        if (attachment.get("content_type") or "").lower().startswith("image/") and attachment.get("size", 0) >= _MIN_ATTACHMENT_BYTES
    ]

    kept_attachments = candidates[:_MAX_EMAIL_IMAGES]
    total = len(kept_attachments)

    images: list[dict] = []
    for index, attachment in enumerate(kept_attachments):
        try:
            with Image.open(io.BytesIO(attachment["buffer"])) as raw:
                normalized = ImageOps.exif_transpose(raw.convert("RGB"))
        except Exception:  # noqa: BLE001 - not a decodable image, skip it rather than fail the whole email
            continue

        longest = max(normalized.width, normalized.height)
        if longest > _MAX_EMAIL_IMAGE_EDGE_PX:
            scale = _MAX_EMAIL_IMAGE_EDGE_PX / longest
            new_size = (max(1, round(normalized.width * scale)), max(1, round(normalized.height * scale)))
            normalized = normalized.resize(new_size, Image.LANCZOS)

        buffer = io.BytesIO()
        normalized.save(buffer, format="PNG")
        # A filename alone (Outlook's auto-generated "image006.png" etc.)
        # carries no positional meaning and doesn't tell the model which
        # named section of the body text an image belongs to — confirmed
        # against a real 4-part customer email where the model correctly
        # received all 4 embedded images (verified independently) but
        # still only differentiated 3 parts, having no way to line up
        # "the 4th image" with "the 4th named component" other than
        # implicit list order. An explicit "Embedded image N of TOTAL"
        # label — cross-referenced against an explicit prompt instruction
        # to use exactly this position — gives it that correspondence.
        images.append(
            {
                "label": f"Embedded image {index + 1} of {total} (in the order they appear in the email)",
                "data": buffer.getvalue(),
            }
        )

    return images


def _build_email_text(parsed_email: dict) -> str:
    date = parsed_email.get("date")
    lines = [
        f"Subject: {parsed_email.get('subject') or '(no subject)'}",
        f"From: {parsed_email.get('from') or '(unknown sender)'}",
        f"Date: {date.isoformat() if date else '(unknown date)'}",
        "",
        parsed_email.get("body_text") or "(empty body)",
    ]
    return "\n".join(lines)


def _render_part_summary(part: dict) -> str:
    lines = []
    for key, label in _ALWAYS_PRESENT_FIELDS:
        value = (part.get(key) or "").strip()
        lines.append(f"{label}: {value or _NOT_SPECIFIED}")
    for key, label in _OMIT_IF_ABSENT_FIELDS:
        value = (part.get(key) or "").strip()
        if value:
            lines.append(f"{label}: {value}")
    return "\n".join(lines)


# A bare partNumber/partName/material label alone (e.g. a fastener/
# sub-component the Steckbrief only names in passing, like "Attachment
# parts: Rivernut 6893772 BLIONDNIETMUTTER SKM8 ZNNIV SI") is not enough to
# justify its own Calculation slot — none of the app's pricing formula can
# run without at least one of these, so a part with only a name/material
# string produces a near-blank tab with nothing to actually calculate.
# Deliberately excludes "material"/"materialGrade" — a designation string
# alone (confirmed against a real customer Steckbrief that named a
# referenced rivet-nut this way) isn't itself calculation data, only a
# label; the density it can be matched to is only useful paired with a
# weight/thickness this list already requires.
_CALCULATION_RELEVANT_FIELDS = [
    "sheetThickness",
    "weight",
    "surfaceArea",
    "coatingThickness",
    "specificWeight",
]


def _has_calculation_relevant_value(part: dict) -> bool:
    return any((part.get(key) or "").strip() for key in _CALCULATION_RELEVANT_FIELDS)


# Top-level entry point used by main.py's /api/extract-email. Returns the
# same {"summary": str, "meta": dict} shape /api/extract already returns,
# one entry per genuinely distinct part/component found — capped at
# max_parts to match the frontend's fixed 4-slot workspace (main.py's
# MAX_IMAGE_SLOTS). Returns [] if nothing calculation-relevant was found;
# never fabricates a placeholder part.
async def extract_calculation_from_email(parsed_email: dict, max_parts: int = 4) -> list[dict]:
    email_text = _build_email_text(parsed_email)
    images = _normalize_image_attachments(parsed_email.get("attachments") or [])

    parts = await openai_client.extract_calculation_from_email(email_text, images)

    results = []
    for part in parts:
        if not _has_calculation_relevant_value(part):
            continue
        results.append(part)
        if len(results) >= max(1, max_parts):
            break

    return [
        {
            "summary": _render_part_summary(part),
            "meta": {
                "fileName": f"Email — {(part.get('partName') or '').strip() or f'Part {index + 1}'}",
                "fileKind": "email",
                "partsFound": len(results),
            },
        }
        for index, part in enumerate(results)
    ]
