import React from "react";
import { ChevronDown, CircleCheck, CircleMinus, CircleX, TriangleAlert } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { formatNumber } from "../shared/shiftFormat";

const CHECK_ICONS = { ok: CircleCheck, warn: TriangleAlert, bad: CircleX, skip: CircleMinus };

// The four check lines for one checked file, each { tone, text }.
const buildChecks = (entry, t, language) => {
  const wrongFormat = entry.status === "invalidFormat";
  const unreadable = entry.status === "unreadable";
  const notChecked = wrongFormat || unreadable;
  const k = (key, vars) => t(`shiftUpload.${key}`, vars);

  return [
    wrongFormat ? { tone: "bad", text: k("checkFormatBad") } : { tone: "ok", text: k("checkFormatOk") },
    notChecked
      ? { tone: "skip", text: k("checkColumnsSkipped") }
      : entry.missing.length
        ? { tone: "warn", text: k("checkColumnsMissing", { columns: entry.missing.join(", ") }) }
        : { tone: "ok", text: k("checkColumnsOk") },
    wrongFormat
      ? { tone: "skip", text: k("checkStructureSkipped") }
      : unreadable
        ? { tone: "bad", text: k("checkStructureUnreadable") }
        : entry.status === "noData"
          ? { tone: "warn", text: k("checkStructureNoData") }
          : { tone: "ok", text: k("checkStructureOk") },
    notChecked
      ? { tone: "skip", text: k("checkRows", { rows: "-" }) }
      : { tone: entry.rows > 0 ? "ok" : "warn", text: k("checkRows", { rows: formatNumber(language, entry.rows) }) },
  ];
};

// "File validation" box under the current file: the check lines on the
// left, the columns found in the file's header row on the right (required
// columns the file lacks are added as "missing" chips).
const ValidationPanel = ({ entry, open, onToggle }) => {
  const { t, language } = useTranslation();
  const checks = buildChecks(entry, t, language);

  return (
    <div className={`supl-validation ${open ? "" : "is-closed"}`}>
      <button type="button" className="supl-validation-toggle" onClick={onToggle} aria-expanded={open}>
        <span>{t("shiftUpload.validationTitle")}</span>
        <ChevronDown size={16} className="supl-validation-chevron" />
      </button>

      {open && (
        <div className="supl-validation-body">
          <ul className="supl-checks">
            {checks.map((check, index) => {
              const Icon = CHECK_ICONS[check.tone];
              return (
                <li key={index} className={`supl-check supl-check--${check.tone}`}>
                  <Icon size={16} />
                  <span>{check.text}</span>
                </li>
              );
            })}
          </ul>

          <div className="supl-columns">
            <p className="supl-columns-title">{t("shiftUpload.detectedColumns")}</p>
            {entry.columns.length || entry.missing.length ? (
              <div className="supl-chips">
                {entry.columns.map((column, index) => (
                  <span key={`${column}-${index}`} className="supl-chip">
                    {column}
                  </span>
                ))}
                {entry.missing.map((column) => (
                  <span key={`missing-${column}`} className="supl-chip supl-chip--missing" title={t("shiftUpload.missingColumn")}>
                    {column} · {t("shiftUpload.missingColumn")}
                  </span>
                ))}
              </div>
            ) : (
              <p className="supl-columns-empty">{t("shiftUpload.noColumns")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidationPanel;
