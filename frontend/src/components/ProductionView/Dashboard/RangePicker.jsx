import React, { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { RANGE_PRESETS, formatDots, parseIso, presetRange, toIso } from "./backlogMath";

// The dashboard's date filter: one compact button showing the range in
// force; it opens a small panel with the presets on the left (4 weeks ...
// All) and a calendar on the right. Preset and calendar stay in sync -
// a preset marks its days on the calendar, picking days by hand makes it
// "Custom". Click a start day, then an end day. Nothing reaches the chart
// until Apply; Clear filter goes back to the default view.
//
// Days outside the stored data (before the first / after the newest day)
// can't be picked.

const pad = (n) => String(n).padStart(2, "0");
const sameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

// Monday-first weekday initials in the page language ("Mo", "Tu" / "Mo", "Di")
const weekdayNames = (language) => {
  const locale = language === "DE" ? "de-DE" : "en-GB";
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 0, 5 + i).toLocaleDateString(locale, { weekday: "short" }).replace(".", "").slice(0, 2),
  );
};

const shortRange = (from, to) => {
  const a = parseIso(from);
  const b = parseIso(to);
  if (from === to) return formatDots(b);
  const sameYear = a.getFullYear() === b.getFullYear();
  return `${pad(a.getDate())}.${pad(a.getMonth() + 1)}.${sameYear ? "" : a.getFullYear()} – ${formatDots(b)}`;
};

const RangePicker = ({ firstDate, lastDate, range, applied, defaultLabel, onApply, onClear }) => {
  const { t, language } = useTranslation();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null); // { preset, from, to }
  const [picking, setPicking] = useState(false); // start picked, waiting for the end
  const [hover, setHover] = useState(null);
  const [month, setMonth] = useState(() => monthStart(parseIso(range.to)));

  const openPanel = () => {
    setDraft({ preset: applied?.preset ?? "", from: range.from, to: range.to });
    setPicking(false);
    setMonth(monthStart(parseIso(range.to)));
    setOpen(true);
  };

  // close on a click outside or Escape
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => !rootRef.current?.contains(event.target) && setOpen(false);
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choosePreset = (preset) => {
    const next = presetRange(preset, firstDate, lastDate);
    setDraft({ preset, ...next });
    setPicking(false);
    setMonth(monthStart(parseIso(next.to)));
  };

  const chooseDay = (iso) => {
    if (!picking) {
      setDraft({ preset: "custom", from: iso, to: iso });
      setPicking(true);
      return;
    }
    setDraft((prev) => (iso < prev.from ? { preset: "custom", from: iso, to: prev.from } : { ...prev, preset: "custom", to: iso }));
    setPicking(false);
    setHover(null);
  };

  const apply = () => {
    onApply({ preset: draft.preset || "custom", from: draft.from, to: draft.to });
    setOpen(false);
  };
  const clear = () => {
    onClear();
    setOpen(false);
  };

  // the band shown on the calendar - while picking, it follows the mouse
  let bandFrom = draft?.from;
  let bandTo = draft?.to;
  if (open && picking && hover) {
    bandFrom = hover < draft.from ? hover : draft.from;
    bandTo = hover < draft.from ? draft.from : hover;
  }

  const days = [];
  const gridStart = new Date(month);
  gridStart.setDate(1 - ((month.getDay() + 6) % 7));
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    days.push(d);
  }
  const canPrev = toIso(monthStart(month)) > firstDate;
  const canNext = toIso(new Date(month.getFullYear(), month.getMonth() + 1, 0)) < lastDate;
  // Apply is live once the selection differs from what the chart shows
  // (in the default view, picking any preset counts as a change)
  const changed =
    draft &&
    (applied
      ? draft.from !== applied.from || draft.to !== applied.to
      : draft.preset !== "" || draft.from !== range.from || draft.to !== range.to);
  const triggerLabel = applied ? t(`backlog.preset_${applied.preset}`) : defaultLabel;
  const monthTitle = month.toLocaleDateString(language === "DE" ? "de-DE" : "en-US", { month: "long", year: "numeric" });

  return (
    <div className="rp" ref={rootRef}>
      <div className="rp-bar">
        <button type="button" className={`rp-trigger ${open ? "is-open" : ""}`} onClick={() => (open ? setOpen(false) : openPanel())} aria-expanded={open}>
          <CalendarDays size={15} />
          <span className={`rp-tag ${applied ? "is-applied" : ""}`}>{triggerLabel}</span>
          <span className="rp-dates">{shortRange(range.from, range.to)}</span>
          <ChevronDown size={14} className="rp-chevron" />
        </button>
        {applied && (
          <button type="button" className="rp-clear-x" onClick={onClear} title={t("backlog.clearHint")} aria-label={t("backlog.clear")}>
            <X size={14} />
          </button>
        )}
      </div>

      {open && draft && (
        <div className="rp-panel" role="dialog" aria-label={t("backlog.range")}>
          <div className="rp-body">
            <ul className="rp-presets">
              {RANGE_PRESETS.map((p) => (
                <li key={p}>
                  <button type="button" className={draft.preset === p ? "is-active" : ""} onClick={() => choosePreset(p)}>
                    {t(`backlog.preset_${p}`)}
                  </button>
                </li>
              ))}
              <li>
                <span className={`rp-custom ${draft.preset === "custom" ? "is-active" : ""}`}>{t("backlog.preset_custom")}</span>
              </li>
            </ul>

            <div className="rp-cal">
              <div className="rp-cal-head">
                <button type="button" className="rp-nav" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} disabled={!canPrev} aria-label={t("backlog.prevMonth")}>
                  <ChevronLeft size={15} />
                </button>
                <span className="rp-month">{monthTitle}</span>
                <button type="button" className="rp-nav" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} disabled={!canNext} aria-label={t("backlog.nextMonth")}>
                  <ChevronRight size={15} />
                </button>
              </div>
              <div className="rp-grid" onMouseLeave={() => setHover(null)}>
                {weekdayNames(language).map((name) => (
                  <span key={name} className="rp-wd">
                    {name}
                  </span>
                ))}
                {days.map((d) => {
                  const iso = toIso(d);
                  const disabled = iso < firstDate || iso > lastDate;
                  const inBand = bandFrom && iso >= bandFrom && iso <= bandTo;
                  const cls = [
                    "rp-day",
                    !sameMonth(d, month) && "is-outside",
                    inBand && "in-range",
                    iso === bandFrom && "is-start",
                    iso === bandTo && "is-end",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button
                      key={iso}
                      type="button"
                      className={cls}
                      disabled={disabled}
                      onClick={() => chooseDay(iso)}
                      onMouseEnter={() => picking && setHover(iso)}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rp-foot">
            <span className="rp-foot-range">
              {picking ? t("backlog.pickEnd") : shortRange(draft.from, draft.to)}
            </span>
            <button type="button" className="rp-btn rp-btn--ghost" onClick={clear} disabled={!applied}>
              {t("backlog.clear")}
            </button>
            <button type="button" className="rp-btn rp-btn--primary" onClick={apply} disabled={picking || !changed}>
              {t("backlog.apply")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RangePicker;
