// Checks an uploaded ERP / ZWZ file in the browser: is it an Excel file,
// can it be read, which columns does its header row have, are the required
// ones there, and how many data rows follow. Uses exceljs (already used for
// the 8D Excel export), loaded only when a file is actually checked.
//
// exceljs reads .xlsx only - an old-format .xls file is accepted by the
// picker but reported as "not readable", with a hint to save it as .xlsx.

const EXCEL_NAME = /\.(xlsx|xls)$/i;

// "Teil Nr", "teil_nr" and "TEIL-NR" all count as "Teil_Nr".
const normalize = (text) => String(text).toLowerCase().replace(/[\s_.-]+/g, "");

const rowTexts = (row) => {
  const texts = [];
  row.eachCell({ includeEmpty: false }, (cell) => {
    const text = String(cell.text ?? "").trim();
    if (text) texts.push(text);
  });
  return texts;
};

export async function validateExcelFile(file, requiredColumns) {
  const empty = { columns: [], missing: [], rows: 0 };
  if (!EXCEL_NAME.test(file.name)) return { ...empty, status: "invalidFormat" };

  let sheet;
  try {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    sheet = workbook.worksheets.find((ws) => ws.actualRowCount > 0) ?? workbook.worksheets[0];
  } catch {
    return { ...empty, status: "unreadable" };
  }
  if (!sheet) return { ...empty, status: "unreadable" };

  // Header row: the first of the top 10 rows with at least two filled cells
  // (exports sometimes start with a title line).
  let headerRowNumber = null;
  let columns = [];
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r += 1) {
    const texts = rowTexts(sheet.getRow(r));
    if (texts.length >= 2) {
      headerRowNumber = r;
      columns = texts;
      break;
    }
  }
  if (headerRowNumber === null) return { ...empty, status: "noData" };

  let rows = 0;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > headerRowNumber && rowTexts(row).length > 0) rows += 1;
  });

  const present = new Set(columns.map(normalize));
  const missing = requiredColumns.filter((column) => !present.has(normalize(column)));
  const status = missing.length ? "missingColumns" : rows === 0 ? "noData" : "valid";
  return { columns, missing, rows, status };
}
