import { PLAN_LINES, SHIFT_DEFS } from "./planningData";
import { openQty, orderValue, planTotal } from "./planningMath";
import { addDays, formatDateDots, toIsoDate } from "../shared/shiftFormat";

// "Export to Excel": the day's plan (one row per part, with totals) and the
// waiting list as two sheets, Arial 10, column headers in the page's
// language. exceljs is loaded only when the button is used.

const FONT = { name: "Arial", size: 10 };
const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE1F7F3" } };
const TOTAL_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F5F9" } };
const BORDER = { style: "thin", color: { argb: "FFD5DAE3" } };
const lineName = (id) => PLAN_LINES.find((line) => line.id === id)?.name ?? id;

const styleTable = (sheet, headerRow, lastRow) => {
  for (let r = headerRow; r <= lastRow; r += 1) {
    sheet.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { ...FONT, bold: r === headerRow || cell.font?.bold };
      cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
      if (r === headerRow) {
        cell.fill = HEADER_FILL;
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      }
    });
  }
  sheet.getRow(headerRow).height = 30;
};

export async function exportPlanXlsx({ parts, waiting, date, t }) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const pieces = t("shiftPlan.pieces");

  // --- Plan sheet ---
  const sheet = workbook.addWorksheet(t("shiftPlan.sheetPlan"), { views: [{ state: "frozen", ySplit: 3 }] });
  sheet.getCell("A1").value = `${t("shiftPlan.title")} - ${formatDateDots(date)}`;
  sheet.getCell("A1").font = { ...FONT, size: 13, bold: true };

  const header = [
    t("shiftPlan.colPartNo"),
    t("shiftPlan.colName"),
    t("shiftPlan.colLine"),
    t("shiftPlan.colOrderQty"),
    ...SHIFT_DEFS.map((shift) => `${shift.name} ${pieces}`),
    `${t("shiftPlan.colPlanTotal")} ${pieces}`,
    `${t("shiftPlan.colOpen")} ${pieces}`,
    t("shiftPlan.colPrice"),
    t("shiftPlan.colValue"),
  ];
  sheet.getRow(3).values = header;
  parts.forEach((part) => {
    sheet.addRow([
      part.part,
      part.name,
      lineName(part.line),
      part.orderQty || null,
      ...SHIFT_DEFS.map((shift) => part.plan[shift.id] || 0),
      planTotal(part),
      openQty(part),
      part.price,
      part.orderQty ? orderValue(part) : null,
    ]);
  });

  // Totals as formulas, so the sheet stays right when someone edits it.
  const first = 4;
  const last = 3 + parts.length;
  const col = (index) => sheet.getColumn(index).letter;
  const sum = (index) => (parts.length ? { formula: `SUM(${col(index)}${first}:${col(index)}${last})` } : 0);
  const totalRow = sheet.addRow([
    t("shiftPlan.total"),
    null,
    null,
    sum(4),
    ...SHIFT_DEFS.map((_, i) => sum(5 + i)),
    sum(5 + SHIFT_DEFS.length),
    parts.length ? { formula: `SUMIF(${col(6 + SHIFT_DEFS.length)}${first}:${col(6 + SHIFT_DEFS.length)}${last},">0")` } : 0,
    null,
    sum(8 + SHIFT_DEFS.length),
  ]);
  totalRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { ...FONT, bold: true };
    cell.fill = TOTAL_FILL;
  });

  styleTable(sheet, 3, totalRow.number);
  const widths = [14, 18, 8, 13, ...SHIFT_DEFS.map(() => 11), 13, 14, 12, 15];
  widths.forEach((width, i) => {
    const column = sheet.getColumn(i + 1);
    column.width = width;
    if (i >= 3) column.numFmt = i >= 3 + SHIFT_DEFS.length + 2 ? "#,##0.00" : "#,##0";
  });

  // --- Waiting list sheet ---
  const wait = workbook.addWorksheet(t("shiftPlan.sheetWaiting"), { views: [{ state: "frozen", ySplit: 1 }] });
  wait.getRow(1).values = [
    t("shiftPlan.colPartNo"),
    t("shiftPlan.colName"),
    t("shiftPlan.colLine"),
    t("shiftPlan.colOrderQty"),
    t("shiftPlan.colPrice"),
    t("shiftPlan.colValue"),
    t("shiftPlan.colDueDate"),
    t("shiftPlan.colReason"),
  ];
  waiting.forEach((item) => {
    const reason = item.dueOffset == null ? "removed" : item.dueOffset <= 0 ? "overdue" : "dueSoon";
    wait.addRow([
      item.part,
      item.name,
      lineName(item.line),
      item.orderQty || null,
      item.price,
      item.orderQty ? item.orderQty * item.price : null,
      item.dueOffset == null ? "" : formatDateDots(addDays(date, item.dueOffset)),
      t(`shiftPlan.reason_${reason}`),
    ]);
  });
  styleTable(wait, 1, 1 + waiting.length);
  [14, 18, 8, 13, 12, 15, 12, 16].forEach((width, i) => {
    wait.getColumn(i + 1).width = width;
  });
  wait.getColumn(4).numFmt = "#,##0";
  wait.getColumn(5).numFmt = "#,##0.00";
  wait.getColumn(6).numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${t("shiftPlan.fileName")}_${toIsoDate(date)}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
