import React, { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, LoaderCircle, Printer, Sparkles } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import DatePickerButton from "../shared/DatePickerButton";
import ShiftSummary from "./ShiftSummary";
import PartsPlanningCard from "./PartsPlanningCard";
import WaitingListCard from "./WaitingListCard";
import PrintShiftSheets from "./PrintShiftSheets";
import { emptyShiftPlan } from "./planningData";
import { autoPlan } from "./planningMath";
import { loadPlan, savePlan } from "./planStorage";
import { exportPlanXlsx } from "./exportPlanXlsx";
import { formatNumber, toIsoDate } from "../shared/shiftFormat";
import "./shiftPlan.css";

// Shift Planning > Shift Planning: the chosen day's plan - shift capacity
// cards, the parts table (pieces per Früh / Spät / Nacht), and the waiting
// list of ordered parts not planned yet. Auto-plan fills open quantities
// into free capacity; the plan exports to Excel and prints as one sheet per
// shift. Each day's plan is kept in this browser (planStorage.js).
const ShiftPlan = () => {
  const { t, language } = useTranslation();
  const [date, setDate] = useState(() => new Date());
  const [plan, setPlan] = useState(() => ({ iso: toIsoDate(new Date()), ...loadPlan(toIsoDate(new Date())) }));
  const [notice, setNotice] = useState(null);
  const [exporting, setExporting] = useState(false);
  const noticeTimer = useRef(null);

  useEffect(() => {
    savePlan(plan.iso, plan);
  }, [plan]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const showNotice = (text, tone = "ok") => {
    clearTimeout(noticeTimer.current);
    setNotice({ text, tone });
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  };

  const changeDate = (next) => {
    setDate(next);
    const iso = toIsoDate(next);
    setPlan({ iso, ...loadPlan(iso) });
  };

  const updateParts = (fn) => setPlan((prev) => ({ ...prev, parts: fn(prev.parts) }));

  const handleAutoPlan = () => {
    const result = autoPlan(plan.parts);
    if (result.placed === 0 && result.left === 0) {
      showNotice(t("shiftPlan.autoPlanNothing"), "info");
      return;
    }
    setPlan((prev) => ({ ...prev, parts: result.parts }));
    const vars = { count: formatNumber(language, result.placed), left: formatNumber(language, result.left) };
    showNotice(result.left > 0 ? t("shiftPlan.autoPlanPartial", vars) : t("shiftPlan.autoPlanDone", vars), result.left > 0 ? "warn" : "ok");
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportPlanXlsx({ parts: plan.parts, waiting: plan.waiting, date, t });
    } catch {
      showNotice(t("shiftPlan.exportFailed"), "warn");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="sp-page splan-page">
      <div className="sp-header">
        <div className="sp-heading">
          <h2 className="sp-title">{t("shiftPlan.title")}</h2>
          <p className="sp-subtitle">{t("shiftPlan.subtitle")}</p>
        </div>
        <div className="splan-header-actions">
          <DatePickerButton value={date} onChange={changeDate} />
          <button type="button" className="splan-btn splan-btn--solid" onClick={handleAutoPlan}>
            <Sparkles size={15} />
            {t("shiftPlan.autoPlan")}
          </button>
          <button type="button" className="splan-btn" onClick={handleExport} disabled={exporting}>
            {exporting ? <LoaderCircle size={15} className="splan-spin" /> : <FileSpreadsheet size={15} className="splan-excel-icon" />}
            {t("shiftPlan.exportExcel")}
          </button>
          <button type="button" className="splan-btn" onClick={() => window.print()}>
            <Printer size={15} />
            {t("shiftPlan.printSheets")}
          </button>
        </div>
      </div>

      <div className="splan-notice-slot" aria-live="polite">
        {notice && <p className={`splan-notice splan-notice--${notice.tone}`}>{notice.text}</p>}
      </div>

      <ShiftSummary parts={plan.parts} />

      <PartsPlanningCard
        parts={plan.parts}
        onChangeQty={(id, shiftId, qty) =>
          updateParts((parts) => parts.map((p) => (p.id === id ? { ...p, plan: { ...p.plan, [shiftId]: qty } } : p)))
        }
        onReorder={(from, to) =>
          updateParts((parts) => {
            const next = [...parts];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next;
          })
        }
        onMoveToWaiting={(id) =>
          setPlan((prev) => {
            const part = prev.parts.find((p) => p.id === id);
            if (!part) return prev;
            const { part: partNo, name, line, orderQty, price } = part;
            return {
              ...prev,
              parts: prev.parts.filter((p) => p.id !== id),
              waiting: [...prev.waiting, { id: part.id, part: partNo, name, line, orderQty, price, dueOffset: null }],
            };
          })
        }
        onRemove={(id) => updateParts((parts) => parts.filter((p) => p.id !== id))}
        onAddPart={(part) =>
          updateParts((parts) => [...parts, { id: `n${Date.now()}`, orderQty: 0, plan: emptyShiftPlan(), ...part }])
        }
      />

      <WaitingListCard
        waiting={plan.waiting}
        date={date}
        onAddToPlan={(id) =>
          setPlan((prev) => {
            const item = prev.waiting.find((w) => w.id === id);
            if (!item) return prev;
            const { part, name, line, orderQty, price } = item;
            return {
              ...prev,
              waiting: prev.waiting.filter((w) => w.id !== id),
              parts: [...prev.parts, { id: item.id, part, name, line, orderQty, price, plan: emptyShiftPlan() }],
            };
          })
        }
      />

      <PrintShiftSheets parts={plan.parts} date={date} />
    </main>
  );
};

export default ShiftPlan;
