import React, { memo, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ShiftCard from "../../ShiftPlanning/shared/ShiftCard";
import { CATEGORIES, formatAmount, formatPercent, periodRange } from "./backlogMath";

// The chart's numbers as a table, collapsed by default, with an Excel
// export of exactly what is shown (exceljs is loaded only when Export is
// used, like the Shift Plan export). One row per period, newest first:
// each value the period's average per working day, "Working days" how
// many were averaged. Single days are deliberately not listed - the real
// daily numbers are in the workbook, the app shows only averages.

const FONT = { name: "Arial", size: 10 };
const BORDER = { style: "thin", color: { argb: "FFD5DAE3" } };

const sumRow = (values) => values.ktl + values.pulver + values.schaeumen;
const withChange = (rows) =>
  rows.map((row, i) => {
    const prev = rows[i - 1];
    return { ...row, change: prev && prev.total ? row.total / prev.total - 1 : null };
  });

async function exportXlsx(rows, t, title) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(t("backlog.sheetName"), { views: [{ state: "frozen", ySplit: 3 }] });
  sheet.getCell("A1").value = title;
  sheet.getCell("A1").font = { ...FONT, size: 13, bold: true };
  const header = [
    t("backlog.colPeriod"),
    t("backlog.colRange"),
    t("backlog.colDays"),
    ...CATEGORIES.map((c) => `${c.label} (T€)`),
    `${t("backlog.colTotal")} (T€)`,
    t("backlog.colChange"),
  ];
  sheet.addRow([]);
  sheet.addRow(header);
  const addRow = (row) =>
    sheet.addRow([
      row.label,
      row.range,
      row.days,
      ...CATEGORIES.map((c) => Math.round(row.values[c.key])),
      Math.round(row.total),
      row.change == null ? "" : Math.round(row.change * 1000) / 1000,
    ]);
  rows.forEach(addRow);
  const last = sheet.rowCount;
  for (let r = 3; r <= last; r += 1) {
    sheet.getRow(r).eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { ...FONT, bold: r === 3 };
      cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
      if (r === 3) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEBFF" } };
      if (r > 3 && col >= 4 && col <= 7) cell.numFmt = "#,##0";
      if (r > 3 && col === 8) cell.numFmt = "+0.0%;-0.0%;0.0%";
    });
  }
  sheet.columns.forEach((column, i) => {
    column.width = [16, 24, 8, 13, 13, 13, 13, 12][i] ?? 12;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.replace(/[^\w.-]+/g, "_")}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const BacklogTable = ({ periods, labels, exportTitle }) => {
  const { t, language } = useTranslation();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const rows = withChange(
    periods.map((period, i) => ({
      key: period.key,
      label: labels[i],
      range: periodRange(period),
      days: period.dayCount,
      values: period,
      total: sumRow(period),
    })),
  ).reverse();

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportXlsx(rows, t, exportTitle);
    } finally {
      setExporting(false);
    }
  };

  const cells = (row) => (
    <>
      <td className="sp-num">{row.days}</td>
      {CATEGORIES.map((c) => (
        <td key={c.key} className="sp-num">
          {formatAmount(language, row.values[c.key])}
        </td>
      ))}
      <td className="sp-num pv-strong">{formatAmount(language, row.total)}</td>
    </>
  );

  return (
    <ShiftCard
      className={open ? "" : "sp-card--collapsed"}
      heading={
        <button type="button" className="bl-collapse" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <ChevronDown size={16} className={open ? "is-open" : ""} />
          <span>
            <span className="sp-card-title">{t("backlog.tableTitle")}</span>
            <span className="sp-card-subtitle">{t("backlog.tableSubtitle", { count: rows.length })}</span>
          </span>
        </button>
      }
      actions={
        <button type="button" className="pv-btn pv-btn--ghost pv-btn--small" onClick={handleExport} disabled={exporting || rows.length === 0}>
          <Download size={14} />
          {t("backlog.export")}
        </button>
      }
    >
      {open && (
        <div className="sp-table-wrap pv-scroll">
          <table className="sp-table pv-table">
            <thead>
              <tr>
                <th>{t("backlog.colPeriod")}</th>
                <th>{t("backlog.colRange")}</th>
                <th className="sp-num">{t("backlog.colDays")}</th>
                {CATEGORIES.map((c) => (
                  <th key={c.key} className="sp-num">
                    {c.label}
                  </th>
                ))}
                <th className="sp-num">{t("backlog.colTotal")}</th>
                <th className="sp-num">{t("backlog.colChange")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="pv-strong">{row.label}</td>
                  <td>{row.range}</td>
                  {cells(row)}
                  <td className={`sp-num ${row.change < 0 ? "sp-negative" : ""}`}>
                    {row.change == null ? "–" : `${row.change > 0 ? "+" : row.change < 0 ? "−" : ""}${formatPercent(language, Math.abs(row.change), 1)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ShiftCard>
  );
};

// memo: hovering the chart re-renders the dashboard, not this table
export default memo(BacklogTable);
