// Best-fit image layout for the Prüfbericht's paired photos — shared by the
// on-screen preview (TestReportPreview.jsx) and the Word export
// (buildTestReportDocx.js) so the two never decide a pair's layout
// differently. Everything here is pure: it takes aspect ratios (width /
// height) and returns geometry, no DOM, no docx.

// A photo is "wide" past roughly 3:2 — two 4:3 or 3:2 test-part photos still
// sit side by side cleanly (that's the common case in the reference report),
// only genuinely landscape 16:10+ shots trigger stacking.
const WIDE_RATIO = 1.55;
// A near-panorama takes a whole row on its own.
const PANORAMA_RATIO = 2.2;
// Gap between cells in a photo box — shared by the auto layout below and
// the manual-resize geometry, so a resized image's bounds line up with the
// same column width the auto layout would have given it.
const GAP = 10;

// How many columns a pair of images should use: 2 = side by side, 1 =
// stacked one per row. Rules, in order:
//   - either image a panorama            -> 1 (it dominates a row alone)
//   - both images wide (landscape)       -> 1 ("if both are wide, stack one per row")
//   - one wide + one compact (mismatch)  -> 1 ("landscape on top, square below")
//   - both compact but very different    -> 1 (a 3:2 next to a portrait letterboxes badly)
//   - both compact and similar in shape  -> 2 ("if both fit side-by-side, do that")
export function pairColumns(ratioA, ratioB) {
  const a = ratioA || 1.4;
  const b = ratioB || 1.4;
  if (a >= PANORAMA_RATIO || b >= PANORAMA_RATIO) return 1;
  const wideA = a >= WIDE_RATIO;
  const wideB = b >= WIDE_RATIO;
  if (wideA && wideB) return 1;
  if (wideA !== wideB) return 1;
  const spread = Math.max(a, b) / Math.min(a, b);
  return spread <= 1.5 ? 2 : 1;
}

// When a pair is stacked, the wider (more landscape) image goes on top.
// Stable: equal ratios keep their given order.
export function orderStacked(items, ratioOf) {
  return items
    .map((item, index) => ({ item, index, ratio: ratioOf(item) || 1.4 }))
    .sort((x, y) => y.ratio - x.ratio || x.index - y.index)
    .map((x) => x.item);
}

// How many columns a group of N images uses: 1 image -> 1, 2 images -> what
// pairColumns() decided, 3+ images -> always a 2-wide grid (rows of 2).
export function groupColumns(ratios) {
  if (ratios.length <= 1) return 1;
  if (ratios.length === 2) return pairColumns(ratios[0], ratios[1]);
  return 2;
}

// Pixel geometry for one photo box, given the content-column width, the
// column count (from groupColumns()), and each image's ratio in render
// order. Returns { columns, gap, cells: [{ width, height }] } — the
// on-screen preview applies these as inline styles so the offscreen
// measuring pass sees real heights; the Word export converts the same
// numbers to twips. Heights are clamped so one oddly-proportioned photo
// can't blow out a page.
export function photoBoxGeometry(contentWidthPx, columns, ratios) {
  const safe = (r) => (Number.isFinite(r) && r > 0 ? r : 1.4);
  const clampH = (h, hi) => Math.max(110, Math.min(hi, Math.round(h)));
  const n = ratios.length;

  if (columns >= 2 && n >= 2) {
    const cellW = (contentWidthPx - GAP) / 2;
    const cells = [];
    for (let i = 0; i < n; i += 2) {
      const rowRatios = ratios.slice(i, i + 2).map(safe);
      // One shared height per row — fit the taller image (smaller ratio) so
      // neither is cropped; the wider one letterboxes within that height.
      const minR = Math.min(...rowRatios);
      const maxR = Math.max(...rowRatios);
      // Portrait pairs get a taller row (they're naturally tall); a portrait
      // paired with something landscape-ish gets a middling row; multi-row
      // grids get shorter rows the more of them there are, so a 6-photo
      // group can't run off the page.
      let rowMax;
      if (n > 4) rowMax = 160;
      else if (n > 2) rowMax = 195;
      else if (maxR <= 1.05) rowMax = 330;
      else if (minR < 0.85) rowMax = 270;
      else rowMax = 250;
      const height = clampH(cellW / minR, rowMax);
      // Each image's own width at that shared height — NOT a flat cellW for
      // both. Forcing every cell to the full column width regardless of its
      // own ratio meant a letterboxed image (object-fit: contain shrinking
      // it to fit) rendered visibly narrower/shorter than its own frame —
      // the frame's declared box, not what was actually painted — which is
      // exactly what put the resize handle (anchored to the frame's own
      // corner) floating in that empty margin instead of on the photo.
      rowRatios.forEach((r) => cells.push({ width: Math.min(Math.round(height * r), Math.round(cellW)), height }));
    }
    return { columns: 2, gap: GAP, cells };
  }

  // Single column: every image spans its own row. Width is always derived
  // from the height actually used (after any clamp) and that image's own
  // ratio — never forced to the full content width — for the same reason
  // as the 2-column case above: a height-clamped photo that still claimed
  // the full box width would letterbox inside its own frame, stranding the
  // resize handle off in the resulting gap instead of on the image.
  return {
    columns: 1,
    gap: GAP,
    cells: ratios.map((raw) => {
      const r = safe(raw);
      const solo = n === 1;
      const height = clampH(contentWidthPx / r, solo ? 280 : 300);
      const width = Math.min(Math.round(height * r), Math.round(contentWidthPx));
      return { width, height };
    }),
  };
}

// =============================================================================
// MANUAL RESIZE + ALIGNMENT — a user dragging one photo's corner handle, or
// picking left/center/right for it, inside its own table cell in the
// preview — same idea as resizing/aligning an inline picture inside a Word
// table cell. Layout (which photos share a row, side-by-side vs. stacked)
// is never touched by either of these — only that one photo's own size and
// its position *within its own cell* — this is resize + in-cell alignment,
// never free repositioning onto the page.
// =============================================================================

// A manual resize can shrink a photo down to this fraction of whatever size
// it would have rendered at automatically (never to nothing); growing has
// no fixed ceiling of its own — applyResizeScale's width clamp against the
// cell's real max width is what actually stops it from overlapping a
// neighboring photo.
export const MIN_RESIZE_SCALE = 0.3;
// Safety cap so a very tall (portrait) photo dragged out to its column's
// full width still can't grow tall enough to blow out a page on its own.
const MAX_RESIZED_HEIGHT_PX = 560;

// The full width available to one image's own cell — the same number the
// auto layout above already uses per column, exposed standalone so the
// resize handle's drag bounds and the manual-size calculation below both
// agree with it exactly.
export function cellMaxWidth(contentWidthPx, columns) {
  return columns === 2 ? (contentWidthPx - GAP) / 2 : contentWidthPx;
}

// The size ONE photo would render at automatically, fit within a
// width/height box while preserving its aspect ratio — the exact "shrink
// to fit" rule both renderers' own auto-layout already follows
// independently (the preview's photoBoxGeometry above, and the Word
// export's bitmapToImageRun). Exposed here so a manual resize's scale can
// be computed relative to THIS SAME baseline in whichever renderer is
// applying it, rather than an absolute fraction of column width — an
// absolute fraction was the earlier design, and it diluted a modest
// on-screen resize into a barely-visible change in the Word export, since
// the export's column is Word's real ~6.3in printed content width,
// noticeably narrower than the preview's on-screen approximation of a
// page. A scale relative to each renderer's own auto size instead means "50%
// smaller" reads as 50% smaller in both places, regardless of that
// underlying pixel-scale difference.
export function fitWithin(ratio, maxWidth, maxHeight) {
  const r = Number.isFinite(ratio) && ratio > 0 ? ratio : 1.4;
  let width = maxWidth;
  let height = width / r;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * r;
  }
  return { width, height };
}

// Turns a manual resize (a SCALE relative to the photo's own auto-computed
// size — see fitWithin above) into concrete pixel dimensions, preserving
// the photo's true aspect ratio exactly (a corner-drag in Word never
// distorts the picture either). Still bounded by the cell's real max
// width, so scaling up can never grow a photo into its neighbor's space.
export function applyResizeScale(autoWidth, autoHeight, scale, cellMaxWidthPx) {
  const s = Math.max(MIN_RESIZE_SCALE, scale);
  const ratio = autoWidth / autoHeight;
  let width = Math.min(cellMaxWidthPx, autoWidth * s);
  let height = width / ratio;
  if (height > MAX_RESIZED_HEIGHT_PX) {
    height = MAX_RESIZED_HEIGHT_PX;
    width = height * ratio;
  }
  return { width: Math.round(width), height: Math.round(height) };
}

// Where a photo sits within its own cell once it's narrower than the
// cell's full width — never a position on the page, only inside its own
// table box, matching a real Word table cell's left/center/right picture
// alignment. "left" is the default (unset override), matching how a plain
// block element sits before any alignment choice is made.
export const IMAGE_ALIGN_VALUES = ["left", "center", "right"];

// The stable identity a resize/alignment override is keyed by — an
// uploaded photo's objectPath, or (before it's ever been saved) its
// temporary blob: URL. Shared by the preview (reading/writing overrides)
// and TestReport.jsx (re-keying an override from its blob: URL to its real
// objectPath the moment Save actually uploads that photo).
export const imageKey = (image) => image?.objectPath || image?.url || null;
