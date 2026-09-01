import gc
import io
import math

import fitz  # PyMuPDF
from PIL import Image, ImageOps

# Pillow's default decompression-bomb guard (~179 megapixels) exists to stop
# a tiny malicious file from claiming a huge pixel count and exhausting
# memory on decode. It's tuned for arbitrary untrusted internet uploads —
# a genuine high-DPI large-format engineering drawing scan (this app's
# actual use case) can easily and legitimately exceed it, which is exactly
# what happened here. The MAX_FILE_SIZE_BYTES cap in main.py (30 MB) is
# this app's real bound on decode cost, so the pixel-count guard is raised
# generously rather than disabled outright — still a real ceiling, just one
# sized for real scans instead of arbitrary web uploads.
Image.MAX_IMAGE_PIXELS = 400_000_000

# Below this size on the longest edge, a page already reads fine as one
# image — tiling would just add API calls for no benefit.
TILE_THRESHOLD_PX = 1900

# Target size of one tile's longest edge. Kept close to TILE_THRESHOLD_PX so
# tiles stay near-native resolution instead of being squeezed down — this is
# the fix for small title-block/BOM text being crushed into unreadable mush
# when a large sheet was previously downscaled as a single 2200px image.
TILE_TARGET_PX = 1600

# Tiles overlap their neighbors so a value that straddles a tile boundary
# (e.g. "T=3mm" split across two tiles) is never cut in half.
TILE_OVERLAP_RATIO = 0.12

# Hard caps so one drawing's image count (and API cost) stays bounded even
# for very large sheets or multi-page PDFs. MAX_PAGES was originally 3,
# sized for "several sheets of one drawing" — too low for a real
# multi-part RFQ/quote-request PDF (a cover page + one page per
# independently-quoted part), where a 4th+ page was being silently
# dropped at render time with no error, before the model ever saw it.
# Raised generously; still bounded so a pathological huge PDF can't run
# away with cost.
#
# Briefly lowered to 6/3 to fit the old free-tier hosting's 512MB memory
# cap (every page/tile is a large PNG held in memory at once — see
# convert_to_image_pages — and a long multi-page PDF at the higher caps
# was pushing past that limit and getting the whole process OOM-killed
# mid-request). Restored to the full 12/4 now that hosting has moved to
# Cloud Run with 2GB RAM; the explicit image-closing/gc.collect() cleanup
# added alongside that fix stays regardless — it's a pure win with no
# accuracy or resolution trade-off either way.
MAX_TILES_PER_PAGE = 4
MAX_PAGES = 12

# No tile/overview is ever upscaled past this — comfortably above
# TILE_TARGET_PX, only relevant for unusually huge source scans.
SAFETY_MAX_EDGE_PX = 3200

# A dedicated, near-native-resolution crop of the bottom-right corner —
# where this app's real drawings (VW/EDAG-style, and DIN/ISO title-block
# convention generally) put the title block. Added on top of the regular
# grid tiles rather than folded into them: a generic grid tile covering
# that quadrant is still shared with a lot of empty drawing-view space,
# diluting the resolution actually available to the small, dense
# title-block text within it. Confirmed live on a realistic large test
# drawing: a 2x2-grid bottom-right tile (~3200px) still produced a
# digit-level OCR error (13268 misread as 13208) and a dropped character
# in the part number — this crop is sized to the corner alone, so it stays
# much closer to native pixel density for the same edge-length cap.
TITLE_BLOCK_CROP_WIDTH_FRACTION = 0.32
TITLE_BLOCK_CROP_HEIGHT_FRACTION = 0.28
TITLE_BLOCK_CROP_MAX_EDGE_PX = 3200

# Higher-DPI PDF rendering than a plain viewer would use, so the raster we
# tile from already has enough detail for small text before we even crop it.
PDF_VIEWPORT_SCALE = 3.5

_PDF_MIME_TYPES = {"application/pdf"}
_TIFF_MIME_TYPES = {"image/tiff", "image/x-tiff"}
_SUPPORTED_IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


def detect_file_kind(original_name: str, mimetype: str) -> str | None:
    ext = (original_name.rsplit(".", 1)[-1] if "." in original_name else "").lower()

    if mimetype in _PDF_MIME_TYPES or ext == "pdf":
        return "pdf"
    if mimetype in _TIFF_MIME_TYPES or ext in ("tif", "tiff"):
        return "tiff"
    if mimetype in _SUPPORTED_IMAGE_MIME_TYPES or ext in ("png", "jpg", "jpeg", "webp"):
        return "image"
    return None


# Python's built-in round() uses banker's rounding (round-half-to-even —
# round(2.5) == 2), but JS's Math.round() always rounds half up
# (Math.round(2.5) === 3). The tile-grid math below is a direct port of
# fileProcessing.js's Math.round() calls, so it needs this to actually
# match — otherwise some image dimensions would produce a different tile
# grid (and therefore different crop regions) than the Node backend did.
def _js_round(value: float) -> int:
    return math.floor(value + 0.5)


def _to_png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _resize_within(image: Image.Image, target_edge: int) -> Image.Image:
    # Mirrors sharp's resize({fit:"inside", withoutEnlargement:true}) — only
    # ever downscales, preserves aspect ratio, never upscales past the
    # image's own native size.
    longest = max(image.width, image.height)
    if longest <= target_edge:
        return image
    scale = target_edge / longest
    new_size = (max(1, _js_round(image.width * scale)), max(1, _js_round(image.height * scale)))
    return image.resize(new_size, Image.LANCZOS)


# Turns one raster page/drawing into a labeled overview + (for large
# sheets) a grid of overlapping high-resolution crops, so the model can read
# both the overall layout and the fine print in the title block / BOM at
# close to native resolution. This is deliberately generic grid tiling, not
# a template that assumes where information lives on the sheet.
#
# `max_images` (optional) caps the total images this page can produce
# (overview + tiles combined) — some providers hard-cap images per request
# (e.g. Groq's qwen/qwen3.6-27b rejects a request over 3 images, but the
# default tiling below can produce up to 5: 1 overview + 4 tiles). Rather
# than tiling normally and then discarding crops to fit — which would
# silently drop coverage of whatever region the discarded tile held — the
# grid itself is computed smaller so the *whole* drawing still gets covered,
# just with fewer, larger tiles (some resolution traded for full coverage).
def _tile_image(original_bytes: bytes, max_images: int | None = None) -> list[dict]:
    with Image.open(io.BytesIO(original_bytes)) as raw:
        # Normalize EXIF orientation once, up front, so every crop below
        # operates on the same already-rotated image — tile coordinates
        # always line up with what PIL reports as width/height.
        base = ImageOps.exif_transpose(raw.convert("RGB"))

    # Everything from here on explicitly closes each PIL Image as soon as
    # its bytes are extracted (rather than waiting on Python's own garbage
    # collector), and the whole thing is wrapped in try/finally so `base`
    # itself is always released no matter which path returns below —
    # meaningful on the free-tier hosting's 512MB memory cap, where a large
    # scan's full-resolution pixel buffer is the single biggest thing this
    # function holds. Doesn't change what gets extracted or at what
    # resolution, purely how promptly the memory for it is freed.
    try:
        width, height = base.size
        if not width or not height:
            raise RuntimeError("Could not read the uploaded drawing's image dimensions.")

        images: list[dict] = []

        # Overview first: whole drawing, only modestly downscaled, so the model
        # has global context (layout, where the BOM/title block sit relative to
        # each other) before it looks at any close-up tile.
        overview_edge = min(max(width, height), 2048)
        overview = _resize_within(base, overview_edge)
        images.append({"label": "Full drawing (overview)", "data": _to_png_bytes(overview)})
        if overview is not base:
            overview.close()

        # Reserve one slot for the overview already added above; the rest of
        # the budget is what the tile grid is allowed to use. None means no
        # provider-imposed cap — use the normal default.
        max_tiles = MAX_TILES_PER_PAGE if max_images is None else max(0, max_images - 1)

        longest_edge = max(width, height)
        if longest_edge <= TILE_THRESHOLD_PX or max_tiles == 0:
            # Either already small enough that the overview above kept full
            # native detail (no downscale happened), or the image budget has no
            # room left for tiles at all — either way, no tiles needed/possible.
            return images

        cols = max(1, _js_round(width / TILE_TARGET_PX))
        rows = max(1, _js_round(height / TILE_TARGET_PX))
        while cols * rows > max_tiles:
            if cols >= rows:
                cols -= 1
            else:
                rows -= 1
            cols = max(1, cols)
            rows = max(1, rows)

        tile_width = math.ceil(width / cols)
        tile_height = math.ceil(height / rows)
        overlap_x = _js_round(tile_width * TILE_OVERLAP_RATIO)
        overlap_y = _js_round(tile_height * TILE_OVERLAP_RATIO)

        for row in range(rows):
            for col in range(cols):
                left = max(0, col * tile_width - overlap_x)
                top = max(0, row * tile_height - overlap_y)
                right = min(width, (col + 1) * tile_width + overlap_x)
                bottom = min(height, (row + 1) * tile_height + overlap_y)

                extract_width = right - left
                extract_height = bottom - top
                if extract_width <= 0 or extract_height <= 0:
                    continue

                tile_edge = min(max(extract_width, extract_height), SAFETY_MAX_EDGE_PX)
                crop = base.crop((left, top, right, bottom))
                resized = _resize_within(crop, tile_edge)

                images.append(
                    {
                        "label": f"High-resolution region — row {row + 1}/{rows}, column {col + 1}/{cols}",
                        "data": _to_png_bytes(resized),
                    }
                )
                if resized is not crop:
                    resized.close()
                crop.close()

        # Dedicated bottom-right title-block crop — see TITLE_BLOCK_CROP_*
        # above for why this exists on top of the grid tiles. Only added when
        # there's budget for it under a provider's per-request image cap, if
        # one is set (max_images is None — the normal/current case — always
        # has room).
        tiles_used = cols * rows
        if max_images is None or (1 + tiles_used) < max_images:
            crop_left = max(0, width - _js_round(width * TITLE_BLOCK_CROP_WIDTH_FRACTION))
            crop_top = max(0, height - _js_round(height * TITLE_BLOCK_CROP_HEIGHT_FRACTION))
            title_block_crop = base.crop((crop_left, crop_top, width, height))
            crop_edge = min(max(title_block_crop.width, title_block_crop.height), TITLE_BLOCK_CROP_MAX_EDGE_PX)
            resized_title_block = _resize_within(title_block_crop, crop_edge)
            images.append(
                {
                    "label": "High-resolution title block region (bottom-right corner)",
                    "data": _to_png_bytes(resized_title_block),
                }
            )
            if resized_title_block is not title_block_crop:
                resized_title_block.close()
            title_block_crop.close()

        return images
    finally:
        base.close()
        gc.collect()


# Converts an uploaded drawing (PDF / TIFF / PNG / JPEG / WEBP) into a flat,
# labeled list of PNG images ready to send to the vision model: one
# overview (+ high-res tiles if the sheet is large) per page. A PDF may
# contain several sheets of the same drawing, so every page up to
# MAX_PAGES is included so the model can cross-reference a value on one
# page (e.g. a title block) against another (e.g. a BOM).
#
# `max_images` (optional): a hard per-request image cap, for a provider
# that enforces one — no caller currently sets this (OpenAI has no such
# cap; this app has always sent up to ~15 images per multi-page PDF
# without issue), but the mechanism is kept since a future provider swap
# may need it again. When set, the budget is split evenly across pages
# (every page still gets at least its own overview) and each page's own
# tile grid is sized down to fit within its share — see _tile_image's
# docstring for why that's better than tiling normally and discarding
# crops afterward.
def convert_to_image_pages(buffer: bytes, kind: str, max_images: int | None = None) -> list[dict]:
    if kind == "pdf":
        doc = fitz.open(stream=buffer, filetype="pdf")
        try:
            page_count = min(len(doc), MAX_PAGES)
            if page_count == 0:
                raise RuntimeError("Could not render any pages from the uploaded PDF.")

            per_page_budget = max(1, max_images // page_count) if max_images else None

            matrix = fitz.Matrix(PDF_VIEWPORT_SCALE, PDF_VIEWPORT_SCALE)
            images: list[dict] = []
            for page_index in range(page_count):
                page = doc[page_index]
                pixmap = page.get_pixmap(matrix=matrix)
                page_png_bytes = pixmap.tobytes("png")
                # PyMuPDF's own high-DPI raster buffer for this page — no
                # longer needed once its PNG bytes are extracted above, and
                # freeing it before _tile_image (which opens ANOTHER large
                # in-memory copy from those bytes) keeps peak memory from
                # stacking page-on-page across a multi-page PDF.
                pixmap = None

                page_images = _tile_image(page_png_bytes, max_images=per_page_budget)
                prefix = f"Page {page_index + 1} — " if page_count > 1 else ""
                for image in page_images:
                    images.append({"label": f"{prefix}{image['label']}", "data": image["data"]})
                page_png_bytes = None
                gc.collect()
            return images
        finally:
            doc.close()

    # TIFF and standard raster images both go through the same tiling
    # pipeline — Pillow reads TIFF natively, same as PNG/JPEG/WEBP.
    return _tile_image(buffer, max_images=max_images)
