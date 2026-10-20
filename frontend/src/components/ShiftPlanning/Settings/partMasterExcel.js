import { PLAN_LINES } from "../Planning/planningData";
import { TEAMS } from "./settingsData";

// Excel import / template for the part master data. Columns are matched by
// name (ignoring case, spaces, dots, dashes and underscores), in English or
// German, so a re-ordered or re-labelled sheet still imports.

const normalize = (text) =>
  String(text ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/[\s_.-]+/g, "");

const COLUMN_ALIASES = {
  part: ["teilnr", "teilenummer", "partnumber", "partno", "part"],
  name: ["partname", "bezeichnung", "name", "teilename"],
  line: ["line", "linie"],
  perRack: ["piecesperrack", "stueckprogestell", "stkprogestell", "perrack", "rack"],
  team: ["team"],
};

const TEMPLATE_HEADER = ["Teil-Nr.", "Part Name", "Line", "Pieces per Rack", "Team"];

const download = (buffer, fileName) => {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const cellText = (cell) => String(cell?.text ?? "").trim();

// "Download Template": the header row, two example rows and a short guide.
export async function downloadPartTemplate(t) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(t("shiftSettings.templateSheet"));
  sheet.addRow(TEMPLATE_HEADER);
  sheet.addRow(["T01234", "Halter", "KTL", 20, "Team 1"]);
  sheet.addRow(["T05678", "Deckel", "Pulver", 15, "Team 2"]);
  sheet.columns.forEach((column, i) => {
    column.width = [14, 22, 10, 16, 10][i];
  });
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { name: "Arial", size: 10, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE1F7F3" } };
  });
  for (let r = 2; r <= 3; r += 1) {
    sheet.getRow(r).eachCell((cell) => {
      cell.font = { name: "Arial", size: 10, color: { argb: "FF667085" } };
    });
  }
  const guide = workbook.addWorksheet(t("shiftSettings.templateGuideSheet"));
  [
    t("shiftSettings.templateGuide1"),
    t("shiftSettings.templateGuide2", { lines: PLAN_LINES.map((l) => l.name).join(", ") }),
    t("shiftSettings.templateGuide3", { teams: TEAMS.join(", ") }),
    t("shiftSettings.templateGuide4"),
  ].forEach((line) => {
    guide.addRow([line]).getCell(1).font = { name: "Arial", size: 10 };
  });
  guide.getColumn(1).width = 90;
  download(await workbook.xlsx.writeBuffer(), `${t("shiftSettings.templateFile")}.xlsx`);
}

// "Import from Excel": reads the first sheet, finds the header row (one of
// the first 10 rows containing a Teil-Nr. column) and returns the parsed
// parts plus the rows it had to skip and why.
export async function readPartsFromExcel(file) {
  if (!/\.xlsx$/i.test(file.name)) return { error: "format" };
  let sheet;
  try {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    sheet = workbook.worksheets.find((ws) => ws.actualRowCount > 0);
  } catch {
    return { error: "unreadable" };
  }
  if (!sheet) return { error: "empty" };

  let headerRow = null;
  const columns = {};
  for (let r = 1; r <= Math.min(10, sheet.rowCount) && headerRow === null; r += 1) {
    const row = sheet.getRow(r);
    const found = {};
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = Object.keys(COLUMN_ALIASES).find((k) => COLUMN_ALIASES[k].includes(normalize(cellText(cell))));
      if (key && !found[key]) found[key] = col;
    });
    if (found.part) {
      headerRow = r;
      Object.assign(columns, found);
    }
  }
  if (headerRow === null) return { error: "noHeader" };
  if (!columns.line) return { error: "noLine" };

  const parts = [];
  const skipped = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const get = (key) => (columns[key] ? cellText(row.getCell(columns[key])) : "");
    const part = get("part");
    if (!part) return;
    const lineText = normalize(get("line"));
    const line = PLAN_LINES.find((l) => normalize(l.name) === lineText || l.id === lineText)?.id;
    if (!line) {
      skipped.push({ row: rowNumber, part, reason: "line" });
      return;
    }
    const perRack = Number(get("perRack").replace(/[^\d]/g, "")) || 0;
    const teamText = get("team");
    const teamNo = teamText.match(/\d+/)?.[0];
    const team = TEAMS.find((name) => normalize(name) === normalize(teamText) || (teamNo && name === `Team ${teamNo}`)) ?? "";
    parts.push({ part, name: get("name"), line, perRack, team });
  });
  return { parts, skipped };
}
