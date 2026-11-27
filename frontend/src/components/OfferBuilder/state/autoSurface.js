import { ktlAreaFromWeight } from "../engine/ktl";
import { pulverAreaFromWeight } from "../engine/pulver";

// The surface fills itself from weight and thickness (and, for Powder, the
// material) - the user's wish, so "Use from weight" need not be clicked.
// A filled-in surface follows those values (`surfaceAuto: true`) until
// someone types their own; that one is never touched again. A part saved
// before this existed counts as filled in by hand when it has a surface,
// so a stored offer keeps its value.

export const SURFACE_FIELD = { ktl: "surfaceMm2", pulver: "surfaceCm2" };

// As "Use from weight" writes it: KTL in whole mm², Powder in whole cm².
export const surfaceFromWeight = (process, part, settings) => {
  const mm2 = process === "ktl" ? ktlAreaFromWeight(part, settings) : pulverAreaFromWeight(part, settings);
  if (!(mm2 > 0) || !Number.isFinite(mm2)) return null;
  return String(Math.round(process === "ktl" ? mm2 : mm2 / 100));
};

export const isAutoSurface = (process, part) =>
  part.surfaceAuto === true || (part.surfaceAuto == null && !String(part[SURFACE_FIELD[process]] ?? "").trim());

// `changes` are the part's latest edits: a surface in them that is not
// marked automatic was typed (or read from the drawing) and stays as it is.
export function withAutoSurface(process, part, settings, changes = {}) {
  const field = SURFACE_FIELD[process];
  const next = field in changes && !("surfaceAuto" in changes) ? { ...part, surfaceAuto: false } : part;
  if (!isAutoSurface(process, next)) return next;
  const value = surfaceFromWeight(process, next, settings);
  if (value == null) return next.surfaceAuto === true && next[field] !== "" ? { ...next, [field]: "" } : next;
  return next[field] === value && next.surfaceAuto === true ? next : { ...next, [field]: value, surfaceAuto: true };
}
