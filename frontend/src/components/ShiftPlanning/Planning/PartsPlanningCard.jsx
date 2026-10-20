import React, { useMemo, useState } from "react";
import { FileOutput, GripVertical, Plus, Search, Trash2 } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ShiftCard from "../shared/ShiftCard";
import QtyInput from "./QtyInput";
import AddPartForm from "./AddPartForm";
import { PLAN_LINES, SHIFT_DEFS } from "./planningData";
import { openQty, orderValue, planTotal, planTotals } from "./planningMath";
import { formatMoney, formatNumber } from "../shared/shiftFormat";

const lineName = (id) => PLAN_LINES.find((line) => line.id === id)?.name ?? id;

// "Noch nicht geliefert": red when order quantity is still unplanned,
// amber (negative) when more is planned than ordered, "-" without an order.
const OpenCell = ({ value }) => {
  const { t, language } = useTranslation();
  if (value === null) return <span className="splan-muted">-</span>;
  if (value > 0) return <span className="splan-pill splan-pill--red">{formatNumber(language, value)}</span>;
  if (value < 0)
    return (
      <span className="splan-pill splan-pill--amber" title={t("shiftPlan.overPlanned", { count: formatNumber(language, -value) })}>
        {formatNumber(language, value)}
      </span>
    );
  return formatNumber(language, 0);
};

// The day's plan: one row per part with its Früh / Spät / Nacht pieces.
// Rows can be reordered by their grip (drag, or arrow keys when focused),
// moved back to the waiting list or removed; totals cover every row.
const PartsPlanningCard = ({ parts, onChangeQty, onReorder, onMoveToWaiting, onRemove, onAddPart }) => {
  const { t, language } = useTranslation();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const filtering = query.trim() !== "";
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter((part) => `${part.part} ${part.name}`.toLowerCase().includes(q));
  }, [parts, query]);
  const totals = planTotals(parts);

  const moveBy = (id, step) => {
    const from = parts.findIndex((p) => p.id === id);
    const to = from + step;
    if (from < 0 || to < 0 || to >= parts.length) return;
    onReorder(from, to);
    requestAnimationFrame(() => document.querySelector(`[data-grip="${id}"]`)?.focus());
  };

  const dropOn = (targetId) => {
    if (dragId && dragId !== targetId) {
      onReorder(
        parts.findIndex((p) => p.id === dragId),
        parts.findIndex((p) => p.id === targetId)
      );
    }
    setDragId(null);
    setOverId(null);
  };

  return (
    <ShiftCard
      className="splan-card"
      title={t("shiftPlan.partsTitle")}
      actions={
        <div className="splan-toolbar">
          <label className="splan-search">
            <Search size={14} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("shiftPlan.search")}
              aria-label={t("shiftPlan.search")}
            />
          </label>
          <button type="button" className="splan-btn splan-btn--outline-teal" onClick={() => setAdding(true)} disabled={adding}>
            <Plus size={15} />
            {t("shiftPlan.addPart")}
          </button>
        </div>
      }
    >
      {adding && (
        <AddPartForm
          existingParts={parts}
          onCancel={() => setAdding(false)}
          onAdd={(part) => {
            onAddPart(part);
            setAdding(false);
          }}
        />
      )}

      <div className="sp-table-wrap">
        <table className="sp-table splan-table">
          <thead>
            <tr>
              <th className="splan-grip-col">
                <span className="splan-sr-only">{t("shiftPlan.colOrder")}</span>
              </th>
              <th>{t("shiftPlan.colPartNo")}</th>
              <th>{t("shiftPlan.colName")}</th>
              <th className="splan-center">{t("shiftPlan.colLine")}</th>
              <th className="sp-num">{t("shiftPlan.colOrderQty")}</th>
              {SHIFT_DEFS.map((shift) => (
                <th key={shift.id} className="splan-center splan-shift-col">
                  {shift.name}
                  <span>{t("shiftPlan.pieces")}</span>
                </th>
              ))}
              <th className="sp-num">
                {t("shiftPlan.colPlanTotal")}
                <span>{t("shiftPlan.pieces")}</span>
              </th>
              <th className="splan-center">
                {t("shiftPlan.colOpen")}
                <span>{t("shiftPlan.pieces")}</span>
              </th>
              <th className="sp-num">{t("shiftPlan.colPrice")}</th>
              <th className="sp-num">{t("shiftPlan.colValue")}</th>
              <th className="splan-center">{t("shiftPlan.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9 + SHIFT_DEFS.length} className="splan-empty">
                  {parts.length ? t("shiftPlan.noMatches") : t("shiftPlan.noParts")}
                </td>
              </tr>
            ) : (
              rows.map((part) => {
                const label = part.name ? `${part.part} ${part.name}` : part.part;
                return (
                  <tr
                    key={part.id}
                    className={`${dragId === part.id ? "is-dragging" : ""} ${overId === part.id && dragId !== part.id ? "is-drop-target" : ""}`}
                    onDragOver={(event) => {
                      if (!dragId) return;
                      event.preventDefault();
                      setOverId(part.id);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      dropOn(part.id);
                    }}
                  >
                    <td className="splan-grip-col">
                      <button
                        type="button"
                        className="splan-grip"
                        data-grip={part.id}
                        draggable={!filtering}
                        disabled={filtering}
                        aria-label={t("shiftPlan.dragHandle", { part: part.part })}
                        title={filtering ? t("shiftPlan.dragDisabled") : t("shiftPlan.dragHint")}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", part.id);
                          const row = event.currentTarget.closest("tr");
                          if (row) event.dataTransfer.setDragImage(row, 20, row.offsetHeight / 2);
                          setDragId(part.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverId(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                            event.preventDefault();
                            moveBy(part.id, event.key === "ArrowUp" ? -1 : 1);
                          }
                        }}
                      >
                        <GripVertical size={14} />
                      </button>
                    </td>
                    <td className="splan-part">{part.part}</td>
                    <td>
                      {part.name || <span className="splan-muted">-</span>}
                      {!part.orderQty && (
                        <span className="splan-tag" title={t("shiftPlan.noOrderTitle")}>
                          {t("shiftPlan.noOrder")}
                        </span>
                      )}
                    </td>
                    <td className="splan-center">
                      <span className={`splan-line splan-line--${part.line}`}>{lineName(part.line)}</span>
                    </td>
                    <td className="sp-num">{part.orderQty ? formatNumber(language, part.orderQty) : <span className="splan-muted">-</span>}</td>
                    {SHIFT_DEFS.map((shift) => (
                      <td key={shift.id} className="splan-center">
                        <QtyInput
                          value={part.plan[shift.id] || 0}
                          onChange={(qty) => onChangeQty(part.id, shift.id, qty)}
                          label={t("shiftPlan.qtyLabel", { shift: shift.name, part: label })}
                        />
                      </td>
                    ))}
                    <td className="sp-num splan-strong">{formatNumber(language, planTotal(part))}</td>
                    <td className="splan-center">
                      <OpenCell value={openQty(part)} />
                    </td>
                    <td className="sp-num">{formatMoney(language, part.price)}</td>
                    <td className="sp-num splan-strong">
                      {part.orderQty ? formatMoney(language, orderValue(part)) : <span className="splan-muted">-</span>}
                    </td>
                    <td className="splan-center">
                      <div className="splan-actions">
                        <button
                          type="button"
                          className="splan-icon-btn"
                          onClick={() => onMoveToWaiting(part.id)}
                          aria-label={t("shiftPlan.moveToWaitingFor", { part: part.part })}
                          title={t("shiftPlan.moveToWaiting")}
                        >
                          <FileOutput size={15} />
                        </button>
                        <button
                          type="button"
                          className="splan-icon-btn splan-icon-btn--danger"
                          onClick={() => {
                            if (window.confirm(t("shiftPlan.deleteConfirm", { part: part.part }))) onRemove(part.id);
                          }}
                          aria-label={t("shiftPlan.deletePartFor", { part: part.part })}
                          title={t("shiftPlan.deletePart")}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td colSpan={3}>{t("shiftPlan.total")}</td>
              <td className="sp-num">{formatNumber(language, totals.orderQty)}</td>
              {SHIFT_DEFS.map((shift) => (
                <td key={shift.id} className="splan-center">
                  {formatNumber(language, totals.perShift[shift.id])}
                </td>
              ))}
              <td className="sp-num">{formatNumber(language, totals.plan)}</td>
              <td className="splan-center">
                {totals.open > 0 ? (
                  <span className="splan-pill splan-pill--red">{formatNumber(language, totals.open)}</span>
                ) : (
                  formatNumber(language, 0)
                )}
              </td>
              <td className="sp-num">-</td>
              <td className="sp-num">{formatMoney(language, totals.value)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {filtering && <p className="splan-note">{t("shiftPlan.filtered", { shown: rows.length, total: parts.length })}</p>}
    </ShiftCard>
  );
};

export default PartsPlanningCard;
