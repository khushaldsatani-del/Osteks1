// Status of one part: open (nothing entered yet) | ok | less | more.
export const rowStatus = (planned, coated) =>
  coated == null ? "open" : coated === planned ? "ok" : coated < planned ? "less" : "more";

// Totals for the figures and the Total row. A part with nothing entered
// counts as 0 coated. `completed` counts coated pieces only up to each
// part's planned quantity, so extra pieces of one part never hide a
// shortfall of another; completion is null when nothing is planned.
export const reportTotals = (rows, coated) => {
  const planned = rows.reduce((sum, row) => sum + row.planned, 0);
  const coatedTotal = rows.reduce((sum, row) => sum + (coated[row.id] ?? 0), 0);
  const completed = rows.reduce((sum, row) => sum + Math.min(coated[row.id] ?? 0, row.planned), 0);
  return {
    planned,
    coated: coatedTotal,
    difference: coatedTotal - planned,
    completed,
    completion: planned ? Math.round((completed / planned) * 100) : null,
    open: rows.filter((row) => coated[row.id] == null).length,
  };
};
