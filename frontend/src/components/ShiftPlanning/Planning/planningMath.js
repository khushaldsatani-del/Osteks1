import { SHIFT_DEFS } from "./planningData";

// Pieces planned for a part over all shifts.
export const planTotal = (part) => SHIFT_DEFS.reduce((sum, shift) => sum + (part.plan[shift.id] || 0), 0);

// Order quantity not yet planned ("Noch nicht geliefert"). Negative when
// more is planned than ordered; null for a part without an order.
export const openQty = (part) => (part.orderQty ? part.orderQty - planTotal(part) : null);

export const orderValue = (part) => (part.orderQty || 0) * part.price;

// Pieces planned per shift over all parts.
export const shiftTotals = (parts) =>
  Object.fromEntries(SHIFT_DEFS.map((shift) => [shift.id, parts.reduce((sum, part) => sum + (part.plan[shift.id] || 0), 0)]));

export const planTotals = (parts) => {
  const perShift = shiftTotals(parts);
  return {
    orderQty: parts.reduce((sum, part) => sum + (part.orderQty || 0), 0),
    perShift,
    plan: Object.values(perShift).reduce((sum, n) => sum + n, 0),
    open: parts.reduce((sum, part) => sum + Math.max(0, openQty(part) ?? 0), 0),
    value: parts.reduce((sum, part) => sum + orderValue(part), 0),
  };
};

// Auto-plan: puts every part's open quantity, top to bottom, into the shift
// with the most free capacity left (splitting it when one shift cannot take
// all of it). Already planned quantities are never moved.
export const autoPlan = (parts) => {
  const used = shiftTotals(parts);
  const free = Object.fromEntries(SHIFT_DEFS.map((shift) => [shift.id, Math.max(0, shift.capacity - used[shift.id])]));
  let placed = 0;
  let left = 0;

  const next = parts.map((part) => {
    let open = openQty(part) ?? 0;
    if (open <= 0) return part;
    const plan = { ...part.plan };
    while (open > 0) {
      const target = SHIFT_DEFS.reduce((best, shift) => (free[shift.id] > free[best.id] ? shift : best), SHIFT_DEFS[0]);
      if (free[target.id] <= 0) break;
      const add = Math.min(open, free[target.id]);
      plan[target.id] = (plan[target.id] || 0) + add;
      free[target.id] -= add;
      open -= add;
      placed += add;
    }
    left += open;
    return { ...part, plan };
  });

  return { parts: next, placed, left };
};
