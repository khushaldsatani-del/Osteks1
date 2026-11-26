import React from "react";
import { Pin, X } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { CATEGORIES, formatAmount, formatPercent, sumOf } from "./backlogMath";

// The category selector beside the chart (or, on narrow screens, a row of
// chips above it - variant="chips"). Each category toggles its series;
// "All categories" turns every one back on; the last selected one can't be
// turned off. Shares and values are for the active period - hovered,
// pinned, or else the newest one - each an average per working day; the
// shares are of the SELECTED categories' total, so two selected categories
// always add up to 100%.

const CategoryPanel = ({ variant = "panel", period, previous, periodLabel, periodRange, selected, pinned, onToggle, onSelectAll, onUnpin }) => {
  const { t, language } = useTranslation();
  const allSelected = selected.length === CATEGORIES.length;
  const total = sumOf(period, selected);
  // Averages compare even when a week is still running (2 of 5 days).
  const previousTotal = previous && period ? sumOf(previous, selected) : null;
  const change = previousTotal ? total / previousTotal - 1 : null;

  const toggle = (key) => {
    if (selected.includes(key)) {
      if (selected.length > 1) onToggle(selected.filter((k) => k !== key));
    } else {
      onToggle(CATEGORIES.map((c) => c.key).filter((k) => k === key || selected.includes(k)));
    }
  };

  if (variant === "chips") {
    return (
      <div className="bl-chips">
        <div className="bl-chips-period">
          <span className="bl-chips-label">
            {pinned && <Pin size={11} />} {periodLabel}
          </span>
          <span className="bl-chips-total">{formatAmount(language, total)} T€</span>
        </div>
        <div className="bl-chips-list">
          <button type="button" className={`bl-all bl-all--chip ${allSelected ? "is-active" : ""}`} onClick={onSelectAll}>
            <span className="bl-all-dot" />
            {t("backlog.allCategories")}
          </button>
          {CATEGORIES.map((c) => {
            const on = selected.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                className={`bl-chip ${on ? "is-on" : ""}`}
                onClick={() => toggle(c.key)}
                aria-pressed={on}
                style={{ "--cat": c.color }}
              >
                <span className="bl-dot" />
                {c.label}
                {on && total > 0 && <span className="bl-chip-share">{formatPercent(language, (period?.[c.key] ?? 0) / total)}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <aside className="bl-panel">
      <div className="bl-panel-period">
        <div className="bl-panel-period-top">
          <span className="bl-panel-period-label">{periodLabel}</span>
          {pinned && (
            <button type="button" className="bl-unpin" onClick={onUnpin} title={t("backlog.unpin")} aria-label={t("backlog.unpin")}>
              <Pin size={11} />
              <X size={11} />
            </button>
          )}
        </div>
        <span className="bl-panel-period-range">{periodRange}</span>
        {period && <span className="bl-panel-period-range">{t("backlog.averageOfDays", { count: period.dayCount })}</span>}
        <span className="bl-panel-total">{formatAmount(language, total)} T€</span>
        {change != null && Number.isFinite(change) && (
          <span className={`bl-change ${change > 0 ? "is-up" : change < 0 ? "is-down" : ""}`}>
            {change > 0 ? "▲" : change < 0 ? "▼" : "•"} {formatPercent(language, Math.abs(change), 1)} {t("backlog.vsPrevious")}
          </span>
        )}
      </div>

      <button type="button" className={`bl-all ${allSelected ? "is-active" : ""}`} onClick={onSelectAll}>
        <span className="bl-all-dot" />
        {t("backlog.allCategories")}
      </button>

      <ul className="bl-cats">
        {CATEGORIES.map((c) => {
          const on = selected.includes(c.key);
          const value = period?.[c.key] ?? 0;
          return (
            <li key={c.key}>
              <button
                type="button"
                className={`bl-cat ${on ? "is-on" : ""}`}
                onClick={() => toggle(c.key)}
                aria-pressed={on}
                style={{ "--cat": c.color }}
              >
                <span className="bl-dot" />
                <span className="bl-cat-text">
                  <span className="bl-cat-name">{c.label}</span>
                  <span className="bl-cat-share">{on && total > 0 ? formatPercent(language, value / total) : "–"}</span>
                </span>
                <span className="bl-cat-value">{formatAmount(language, value)} T€</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="bl-panel-hint">{t(pinned ? "backlog.hintPinned" : "backlog.hint")}</p>
    </aside>
  );
};

export default CategoryPanel;
