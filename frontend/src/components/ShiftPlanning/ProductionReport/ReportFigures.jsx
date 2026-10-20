import React from "react";
import { ChartColumn, CircleCheckBig, ClipboardList, Target } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { formatNumber } from "../shared/shiftFormat";

// The four figures above the table: planned, coated, difference and
// completion. Completion counts coated pieces only up to each part's
// planned quantity, so extra pieces of one part never hide a shortfall of
// another. Shown as a plain figure - no chart.
const ReportFigures = ({ totals }) => {
  const { t, language } = useTranslation();
  const n = (value) => formatNumber(language, value);
  const pcs = t("shiftReport.pcs");
  const diffTone = totals.difference < 0 ? "red" : totals.difference > 0 ? "green" : "muted";

  const figures = [
    { id: "planned", icon: ClipboardList, tone: "teal", label: t("shiftReport.plannedTotal"), value: n(totals.planned), unit: pcs },
    { id: "coated", icon: CircleCheckBig, tone: "green", label: t("shiftReport.coatedTotal"), value: n(totals.coated), unit: pcs },
    {
      id: "difference",
      icon: ChartColumn,
      tone: "red",
      label: t("shiftReport.difference"),
      value: `${totals.difference > 0 ? "+" : ""}${n(totals.difference)}`,
      unit: pcs,
      valueTone: diffTone,
    },
    {
      id: "completion",
      icon: Target,
      tone: "teal",
      label: t("shiftReport.completion"),
      value: totals.completion == null ? "-" : `${totals.completion}%`,
      note: `${n(totals.completed)} / ${n(totals.planned)} ${pcs}`,
      hint: t("shiftReport.completionHint"),
    },
  ];

  return (
    <div className="sp-figures">
      {figures.map((f) => {
        const Icon = f.icon;
        return (
          <div key={f.id} className="sp-card sp-figure" title={f.hint}>
            <span className={`sp-figure-icon sp-figure-icon--${f.tone}`}>
              <Icon size={22} />
            </span>
            <div className="sp-figure-text">
              <p className="sp-figure-label">{f.label}</p>
              <p className={`sp-figure-value ${f.valueTone ? `sp-figure-value--${f.valueTone}` : ""}`}>
                {f.value}
                {f.unit && <span>{f.unit}</span>}
              </p>
              {f.note && <p className="sp-figure-note">{f.note}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ReportFigures;
