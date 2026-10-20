import React, { useEffect, useMemo, useRef, useState } from "react";
import { Save } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import DatePickerButton from "../shared/DatePickerButton";
import ShiftSelect from "./ShiftSelect";
import ReportFigures from "./ReportFigures";
import PlannedPartsCard from "./PlannedPartsCard";
import PreviousReportsCard from "./PreviousReportsCard";
import { SHIFT_DEFS } from "../Planning/planningData";
import { loadPlan } from "../Planning/planStorage";
import { listReports, loadReport, saveReport } from "./reportStorage";
import { reportTotals } from "./reportMath";
import { SAMPLE_COATED, SAMPLE_PREVIOUS } from "./reportData";
import { addDays, formatDateTimeDots, toIsoDate } from "../shared/shiftFormat";
import "../Planning/shiftPlan.css";
import "./productionReport.css";

// The shift running right now (Nacht before 06:00 and from 22:00).
const currentShiftId = (now = new Date()) => {
  const h = now.getHours();
  return h >= 6 && h < 14 ? "frueh" : h >= 14 && h < 22 ? "spaet" : "nacht";
};

const NOTES_MAX = 1000;

// The coated pieces / notes for a day and shift: the saved report, or for
// a new one the sample values (Früh only) and nothing entered elsewhere.
const startingReport = (iso, shiftId, rows) => {
  const saved = loadReport(iso, shiftId);
  if (saved) return { coated: saved.coated, notes: saved.notes ?? "", savedAt: saved.savedAt };
  const sample = SAMPLE_COATED[shiftId] ?? {};
  const coated = Object.fromEntries(rows.map((row) => [row.id, sample[row.part] ?? null]));
  return { coated, notes: "", savedAt: null };
};

// Previous Reports: the saved ones plus the sample rows (a saved report for
// the same day and shift replaces its sample row), newest first.
const buildPrevious = () => {
  const today = new Date();
  const saved = listReports().map((r) => ({ ...r, saved: true }));
  const sample = SAMPLE_PREVIOUS.map((s) => ({ ...s, iso: toIsoDate(addDays(today, s.dayOffset)), saved: false })).filter(
    (s) => !saved.some((r) => r.iso === s.iso && r.shift === s.shift)
  );
  const order = (id) => SHIFT_DEFS.findIndex((s) => s.id === id);
  return [...saved, ...sample].sort((a, b) => b.iso.localeCompare(a.iso) || order(b.shift) - order(a.shift));
};

// Shift Planning > Production Report: enter the pieces actually coated for
// the parts planned in one shift (planned pieces come from that day's Shift
// Planning plan), see the totals, and save the report with optional notes.
// Reports are kept in this browser until there is a backend (reportStorage.js).
const ProductionReport = () => {
  const { t } = useTranslation();
  const [date, setDate] = useState(() => new Date());
  const [shiftId, setShiftId] = useState(() => currentShiftId());
  const iso = toIsoDate(date);

  const rows = useMemo(
    () =>
      loadPlan(iso).parts.map((part) => ({
        id: part.id,
        part: part.part,
        name: part.name,
        line: part.line,
        planned: part.plan[shiftId] || 0,
      })),
    [iso, shiftId]
  );

  const [report, setReport] = useState(() => startingReport(iso, shiftId, rows));
  const [dirty, setDirty] = useState(false);
  const [previous, setPrevious] = useState(buildPrevious);
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(null);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const totals = reportTotals(rows, report.coated);
  const shift = SHIFT_DEFS.find((s) => s.id === shiftId);

  const showNotice = (text, tone) => {
    clearTimeout(noticeTimer.current);
    setNotice({ text, tone });
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  };

  // Switching day or shift loads that report; unsaved entries are only
  // dropped after a confirmation.
  const switchTo = (nextDate, nextShiftId) => {
    if (dirty && !window.confirm(t("shiftReport.discardConfirm"))) return;
    const nextIso = toIsoDate(nextDate);
    const nextRows = loadPlan(nextIso).parts.map((part) => ({ id: part.id, part: part.part, planned: part.plan[nextShiftId] || 0 }));
    setDate(nextDate);
    setShiftId(nextShiftId);
    setReport(startingReport(nextIso, nextShiftId, nextRows));
    setDirty(false);
    setNotice(null);
  };

  const handleSave = () => {
    if (rows.length === 0) return;
    if (totals.open > 0 && !window.confirm(t("shiftReport.saveOpenConfirm", { count: totals.open }))) return;
    const savedAt = new Date().toISOString();
    const ok = saveReport(iso, shiftId, {
      coated: report.coated,
      notes: report.notes.trim(),
      savedAt,
      planned: totals.planned,
      coatedTotal: totals.coated,
    });
    if (!ok) {
      showNotice(t("shiftReport.saveFailed"), "warn");
      return;
    }
    setReport((prev) => ({ ...prev, savedAt }));
    setDirty(false);
    setPrevious(buildPrevious());
    showNotice(t("shiftReport.saved_notice", { shift: shift.name }), "ok");
  };

  return (
    <main className="sp-page prep-page">
      <div className="sp-header">
        <div className="sp-heading">
          <h2 className="sp-title">{t("shiftReport.title")}</h2>
          <p className="sp-subtitle">{t("shiftReport.subtitle")}</p>
        </div>
        <div className="prep-header-fields">
          <DatePickerButton value={date} onChange={(next) => switchTo(next, shiftId)} label={t("shiftReport.date")} />
          <ShiftSelect value={shiftId} onChange={(next) => switchTo(date, next)} />
        </div>
      </div>

      <ReportFigures totals={totals} />

      <div className="prep-layout">
        <PlannedPartsCard
          shiftName={shift.name}
          rows={rows}
          coated={report.coated}
          totals={totals}
          onChange={(id, qty) => {
            setReport((prev) => ({ ...prev, coated: { ...prev.coated, [id]: qty } }));
            setDirty(true);
          }}
        />

        <aside className="prep-side">
          <PreviousReportsCard
            reports={previous}
            current={{ iso, shift: shiftId }}
            onOpen={(rowIso, rowShift) => {
              const [y, m, d] = rowIso.split("-").map(Number);
              switchTo(new Date(y, m - 1, d), rowShift);
            }}
          />

          <section className="sp-card prep-notes">
            <label htmlFor="prep-notes" className="sp-card-title">
              {t("shiftReport.notesTitle")}
            </label>
            <textarea
              id="prep-notes"
              value={report.notes}
              maxLength={NOTES_MAX}
              placeholder={t("shiftReport.notesPlaceholder")}
              onChange={(event) => {
                setReport((prev) => ({ ...prev, notes: event.target.value }));
                setDirty(true);
              }}
            />
            <p className="prep-notes-count">
              {report.notes.length} / {NOTES_MAX}
            </p>
          </section>

          <button type="button" className="prep-save" onClick={handleSave} disabled={rows.length === 0}>
            <Save size={16} />
            {t("shiftReport.save")}
          </button>
          <p className={`prep-save-state ${dirty ? "is-dirty" : ""}`} aria-live="polite">
            {dirty
              ? t("shiftReport.unsaved")
              : report.savedAt
                ? t("shiftReport.lastSaved", { date: formatDateTimeDots(new Date(report.savedAt)) })
                : t("shiftReport.notSaved")}
          </p>
          {notice && <p className={`splan-notice splan-notice--${notice.tone} prep-notice`}>{notice.text}</p>}
        </aside>
      </div>
    </main>
  );
};

export default ProductionReport;
