import mimetypes
import os
import uuid

from google.auth.exceptions import DefaultCredentialsError
from google.cloud import storage
from google.cloud.exceptions import NotFound

_client: storage.Client | None = None

# Everything a test report ever uploads lives under this one prefix — keeps
# the bucket usable for other things later without a naming collision, and
# makes "delete every object for report N" a simple prefix match if ever
# needed outside the per-image tracking test_report_images already gives us.
_OBJECT_PREFIX = "test-reports"


def _bucket_name() -> str:
    name = os.environ.get("GCS_BUCKET_NAME")
    if not name:
        raise RuntimeError(
            "GCS_BUCKET_NAME is not configured. Add it to backend/.env "
            "(see .env.example) once the bucket exists."
        )
    return name


# Lazy, same pattern as db.py's get_pool() — a Client() call reads
# Application Default Credentials at construction time (the attached
# service account on Cloud Run; a local `gcloud auth application-default
# login` or GOOGLE_APPLICATION_CREDENTIALS key file in dev), so building it
# eagerly at import time would fail startup in any environment that hasn't
# set that up yet, even if nothing ever ends up calling this module.
def _get_client() -> storage.Client:
    global _client
    if _client is None:
        try:
            # On Cloud Run, the project is auto-detected from the instance
            # metadata server, so this is a no-op there. Locally, "gcloud
            # auth application-default login" saves a personal-account
            # credential with no project attached to it (unlike a
            # service-account key, which carries one) — without this,
            # storage.Client() raises "Project was not passed and could
            # not be determined from the environment" even though auth
            # itself succeeded. GOOGLE_CLOUD_PROJECT is optional precisely
            # so Cloud Run's own auto-detection is never overridden by an
            # unset env var there.
            _client = storage.Client(project=os.environ.get("GOOGLE_CLOUD_PROJECT"))
        except DefaultCredentialsError as error:
            # Re-raised as RuntimeError (same type _bucket_name() raises
            # for the other half of setup) so every caller — the three
            # routes in main.py — only ever needs one except clause to
            # turn "GCS isn't set up yet" into a clear response instead of
            # the generic 500 handler's opaque "Unexpected server error."
            raise RuntimeError(
                "No Google Cloud credentials found. Locally, run "
                "`gcloud auth application-default login` once, or set "
                "GOOGLE_APPLICATION_CREDENTIALS in backend/.env to a "
                "service-account key file — see backend/README.md's "
                "'Google Cloud Storage setup' section. On Cloud Run this "
                "is automatic and shouldn't happen."
            ) from error
    return _client


def _extension_for(filename: str | None, content_type: str | None) -> str:
    if filename and "." in filename:
        return filename.rsplit(".", 1)[-1].lower()
    guessed = mimetypes.guess_extension(content_type or "") or ""
    return guessed.lstrip(".") or "bin"


# Uploads one image for one report and returns its object path (never a
# URL — see download_bytes() below for how a photo actually gets displayed:
# proxied through the backend rather than fetched directly from GCS).
# `slot` is a free-form, frontend-chosen key purely for readability in the
# bucket browser and for test_report_images' own bookkeeping — never
# parsed here.
def upload_image(report_id: int, slot: str, data: bytes, content_type: str | None, filename: str | None) -> dict:
    ext = _extension_for(filename, content_type)
    object_path = f"{_OBJECT_PREFIX}/{report_id}/{slot}-{uuid.uuid4().hex}.{ext}"

    bucket = _get_client().bucket(_bucket_name())
    blob = bucket.blob(object_path)
    blob.upload_from_string(data, content_type=content_type or "application/octet-stream")

    return {
        "objectPath": object_path,
        "contentType": content_type or "application/octet-stream",
        "fileSize": len(data),
        "originalFilename": filename,
    }


# The bucket is private (these are internal test-documentation photos, not
# public assets) — the backend proxies reads through itself rather than
# handing out a signed URL for the browser to fetch directly. Same "stream
# the bytes back" pattern email_attachments downloads already use for
# BYTEA columns; the difference here is only where the bytes come from.
#
# A signed URL was the original design, but generate_signed_url() needs an
# RSA private key to sign with — a real service-account key file has one,
# but neither a personal `gcloud auth application-default login` (used for
# local dev here) nor a Compute Engine/Cloud Run metadata-server credential
# does, so both environments would additionally need the caller granted
# "Service Account Token Creator" on the signing service account just to
# route signing through the IAM API instead. Proxying avoids that whole
# extra IAM setup — the backend's existing Storage Object Admin role is
# already everything it needs to read an object directly.
def download_bytes(object_path: str) -> tuple[bytes, str]:
    bucket = _get_client().bucket(_bucket_name())
    blob = bucket.blob(object_path)
    blob.reload()  # fetches metadata (content_type) without downloading the body twice
    data = blob.download_as_bytes()
    return data, blob.content_type or "application/octet-stream"


def delete_object(object_path: str) -> None:
    bucket = _get_client().bucket(_bucket_name())
    try:
        bucket.blob(object_path).delete()
    except NotFound:
        # Already gone (e.g. a retried delete, or the object was somehow
        # cleaned up out of band) — deleting is idempotent, not an error.
        pass
