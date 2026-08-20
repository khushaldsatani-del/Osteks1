import re
from email import policy
from email.parser import BytesParser

import extract_msg
import html2text

# Storage-only: this module's only job is turning a raw .eml/.msg buffer
# into structured fields + attachment bytes for the database. Nothing here
# ever calls an AI model — see main.py's /api/emails/upload, which stores
# whatever this returns and never passes it to services/gemini_client.py.

_BARE_LINK_RE = re.compile(r"<https?://\S+?>")


# Outlook's plain-text rendering of an HTML signature turns icon-only
# social/site links (LinkedIn, Instagram, a website logo — anything with no
# visible label) into a bare "<url>" token, since there's no link text left
# to show once the icon is gone. That's signature decoration, not content
# the sender actually wrote, so it's stripped for display. Called at read
# time (services/emails_repo.py), not at parse time — the stored body_text
# stays verbatim/faithful to the original; only what's shown gets cleaned,
# so this also fixes emails that were already stored before this existed.
def strip_bare_link_artifacts(text: str) -> str:
    if not text:
        return text
    cleaned = _BARE_LINK_RE.sub("", text)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r"\n[ \t]*\n[ \t]*\n+", "\n\n", cleaned)
    return cleaned.strip()


def _html_to_text(html_content) -> str:
    if isinstance(html_content, bytes):
        html_content = html_content.decode("utf-8", errors="replace")
    converter = html2text.HTML2Text()
    converter.ignore_links = True
    converter.ignore_images = True
    converter.body_width = 0
    return converter.handle(html_content)


def parse_eml_buffer(buffer: bytes) -> dict:
    message = BytesParser(policy=policy.default).parsebytes(buffer)

    subject = str(message.get("subject") or "")
    from_ = str(message.get("from") or "")
    to = str(message.get("to") or "")
    cc = str(message.get("cc") or "")
    date_header = message.get("date")
    date = date_header.datetime if date_header else None

    body_text = _extract_body_text(message)
    attachments = _extract_attachments(message)

    return {
        "subject": subject,
        "from": from_,
        "to": to,
        "cc": cc,
        "date": date,
        "body_text": body_text.strip(),
        "attachments": attachments,
    }


def _extract_body_text(message) -> str:
    plain_part = message.get_body(preferencelist=("plain",))
    if plain_part is not None:
        return plain_part.get_content()

    html_part = message.get_body(preferencelist=("html",))
    if html_part is not None:
        return _html_to_text(html_part.get_content())

    return ""


def _extract_attachments(message) -> list[dict]:
    attachments = []
    for part in message.iter_attachments():
        content = part.get_content()
        if isinstance(content, str):
            content = content.encode("utf-8")

        filename = part.get_filename() or "attachment"
        attachments.append(
            {
                "filename": filename,
                "content_type": part.get_content_type() or "application/octet-stream",
                "buffer": content,
                "size": len(content),
            }
        )
    return attachments


# Outlook's native binary export/drag-and-drop format (a completely
# different OLE2 compound-file format from .eml's plain MIME text) — parsed
# into the exact same shape parse_eml_buffer returns, so callers don't need
# to care which format they got.
def parse_msg_buffer(buffer: bytes) -> dict:
    msg = extract_msg.openMsg(buffer)
    try:
        body_text = (msg.body or "").strip()
        if not body_text and msg.htmlBody:
            body_text = _html_to_text(msg.htmlBody).strip()

        attachments = []
        for attachment in msg.attachments:
            # Outlook marks embedded/inline content (signature logos, social
            # icons — referenced by the HTML body via cid:...) as hidden
            # from the end user — skip those, they aren't real attachments.
            if attachment.hidden:
                continue

            data = attachment.data
            if not isinstance(data, (bytes, bytearray)):
                # An embedded .msg-in-.msg (e.g. a forwarded email) — not a
                # file, so nothing meaningful to store as one.
                continue

            filename = attachment.getFilename() or "attachment"
            attachments.append(
                {
                    "filename": filename,
                    "content_type": attachment.mimetype or "application/octet-stream",
                    "buffer": bytes(data),
                    "size": len(data),
                }
            )

        return {
            "subject": msg.subject or "",
            "from": msg.sender or "",
            "to": msg.to or "",
            "cc": msg.cc or "",
            "date": msg.date,
            "body_text": body_text,
            "attachments": attachments,
        }
    finally:
        msg.close()


def parse_email_buffer(buffer: bytes, is_msg: bool = False) -> dict:
    return parse_msg_buffer(buffer) if is_msg else parse_eml_buffer(buffer)


def detect_email_kind(filename: str, content_type: str) -> str | None:
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    if ext == "eml" or content_type == "message/rfc822":
        return "eml"
    if ext == "msg" or content_type == "application/vnd.ms-outlook":
        return "msg"
    return None
