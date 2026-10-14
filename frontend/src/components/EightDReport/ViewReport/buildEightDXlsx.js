// The 8D-Bericht as an Excel workbook, laid out like the company's own
// "QMD F3-0102 8D-Report" sheet: one worksheet "8D Report" in Page Layout
// view, a grey "WERTE SCHAFFEN OHNE VERSCHWENDUNG" banner row that repeats
// at the top of every printed page, "OSTEKS GMBH" in the page header,
// "QMD F3-0102 / Rev.Nr.: 3 vom 28.11.2018 / Seite X von Y" in the page
// footer, and the form as bordered, merged cells - so the downloaded file
// can be edited and printed straight from Excel.
//
// Sections and column positions follow the View Report preview and the
// Word export (buildEightDDocx.js): the same nine-column grid, so every
// vertical line of every section lands on a real column edge.
//
// The whole report prints on ONE A4 page. The builder measures the finished
// sheet and stores the exact print scale that fits it on one page - a
// stored scale is what Excel's Page Layout view actually shows, whereas its
// "fit to page" option is only applied when printing and left the sheet
// split across pages on screen.
//
// ExcelJS is loaded only when the button is used (it is large and nothing
// else needs it).

const FONT = "Arial";
const SYMBOL_FONT = "Segoe UI Symbol";

// Same column boundaries as the Word export (percent of the form width).
const GRID_PERCENT = [14.5, 12.5, 5.8, 3.2, 13, 12.5, 13.1, 12.4, 13];
// Excel column-width units for the whole form (one unit ~7px). Wide enough
// that the long texts wrap onto few lines, which keeps the form short; the
// stored print scale then shrinks the whole sheet onto one A4 page.
const TOTAL_WIDTH = 150;
const COL_WIDTHS = GRID_PERCENT.map((p) => Math.round(((TOTAL_WIDTH * p) / 100) * 10) / 10);
const ALL = COL_WIDTHS.length;

// Page margins in inches (A4 is 8.27" x 11.69").
const MARGIN = { left: 0.3, right: 0.3, top: 0.85, bottom: 0.6 };

const SIZE = { body: 8, tick: 6.5, delivery: 6.5, title: 12, subtitle: 9, banner: 16 };

const HEAVY = { style: "medium", color: { argb: "FF000000" } };
const THIN = { style: "thin", color: { argb: "FF000000" } };
const BORDER = { heavy: HEAVY, thin: THIN, none: undefined };

const font = (opts = {}) => ({
  name: opts.symbol ? SYMBOL_FONT : FONT,
  size: opts.size || SIZE.body,
  bold: !!opts.bold,
  italic: !!opts.italic,
  color: { argb: "FF000000" },
});

// ------------------------------------------------------------- content ---

// A cell's content is a list of text runs; "\n" inside a run is a line
// break. These helpers build the run lists.
const t = (text, opts = {}) => ({ text: text || "", ...opts });
const label = (de, en, opts = {}) => [t(`${de}\n`, opts), t(en, { ...opts, italic: true })];
const tick = (checked, text, size) => [t(checked ? "☑" : "☐", { symbol: true, size: size + 1 }), t(` ${text}`, { size })];
const gap = (size) => t("     ", { size });

// Rough height a cell's text needs, in points, so rows are tall enough
// without Excel's auto-fit (which doesn't work on merged cells).
const neededHeight = (runs, widthUnits) => {
  const size = Math.max(...runs.map((r) => r.size || SIZE.body));
  // One width unit is ~7px; an average Arial character is ~0.52em wide.
  const charsPerLine = Math.max(8, (widthUnits * 7) / (size * (96 / 72) * 0.52));
  const text = runs.map((r) => r.text).join("");
  const lines = text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return lines * size * 1.32 + 7;
};

// ------------------------------------------------------------ sections ---
// A row: { min (points), bottom: "heavy" | "thin" | "none", cells: [{ span,
// runs, align, vAlign, noLeft }] } - the same model as the Word export.

const generalRows = (g) => {
  const C = "center";
  const v = (text, span, align, bold) => ({ span, runs: [t(text, { bold })], align });
  const pair = (de, en, value, de2, en2, value2) => ({
    min: 30,
    cells: [{ span: 1, runs: label(de, en) }, v(value, 3, C), { span: 2, runs: label(de2, en2) }, v(value2, 3, C)],
  });
  return [
    pair("Bericht Nr. des Kunden:", "Customer – Reference:", g.customerReferenceNumber, "Bericht Nr. Osteks GmbH:", "Report No. Osteks GmbH:", g.reportNo),
    pair("Artikel-Nr. Kunde:", "Customer Item No:", g.customerItemNo, "Reklamationsdatum:", "Complaint Date:", g.complaintDate),
    pair("Artikel Nr. Osteks:", "Supplier Item No.:", g.supplierItemNo, "8D-Startdatum:", "8D Start Date:", g.startDate),
    pair("Bezeichnung:", "Part name:", g.partName, "8D-Statusdatum:", "8D Status Date:", g.statusDate),
    { min: 30, cells: [{ span: 1, runs: label("Kunde / Standort:", "Customer / location:") }, v(g.customerLocation, 3, C), v("", 2), v("", 3)] },
    {
      min: 30,
      cells: [
        { span: 1, runs: label("Reklamierte Stückzahl:", "Number of rejected parts:") },
        v(g.rejectedPartsCount, 3, C, true),
        { span: 2, runs: label("Ansprechpartner Osteks:", "Supplier Contact:") },
        { span: 2, runs: label("Abteilung:", "Department:") },
        { span: 1, runs: label("Tel. Nr.:", "Phone No.:") },
      ],
    },
    {
      min: 30,
      cells: [
        { span: 1, runs: label("Beanstandung:", "Complaint:"), align: C },
        {
          span: 3,
          runs: [
            ...tick(g.complaintStatus === "accepted", "akzeptiert / ", SIZE.tick),
            t("accepted\n", { size: SIZE.tick, italic: true }),
            ...tick(g.complaintStatus === "rejected", "abgelehnt / ", SIZE.tick),
            t("rejected", { size: SIZE.tick, italic: true }),
          ],
        },
        v(g.supplierContact, 2, C),
        v(g.department, 2),
        v(g.phoneNo, 1),
      ],
    },
  ];
};

const teamRows = (d3) => [
  { min: 18, cells: [{ span: ALL, runs: [t("1.Team: Name / Abteilung / Telefon / e-mail:", { bold: true }), t("Team: Name / Department / Phone / e-mail", { bold: true, italic: true })] }] },
  // A blank line above and below the members, as on the form.
  { min: 46, cells: [{ span: ALL, runs: [t(`\n${d3.team.join("\n")}\n`)] }] },
];

const failureRows = (d3) => [
  {
    min: 30,
    cells: [
      { span: 4, runs: [t("2.1. Problembeschreibungen Kunde / ", { bold: true }), t("Failure Description Customer:", { bold: true, italic: true })] },
      { span: 5, runs: [t("2.2. Problembeschreibung Osteks / ", { bold: true }), t("Failure Description Osteks:", { bold: true, italic: true })] },
    ],
  },
  { min: 34, cells: [{ span: 4, runs: [t(d3.customerFailure)] }, { span: 5, runs: [t(d3.osteksFailure)] }] },
];

const affectedRows = (d3) => {
  const T = SIZE.tick;
  const ticks = (state, withSorted) => [
    ...tick(state.answer === "no", "Nein / No", T),
    gap(T),
    ...tick(state.answer === "yes", "Ja / Yes", T),
    ...(withSorted ? [gap(T), ...tick(state.sorted, "Teile sortiert / Parts sorted", T)] : []),
  ];
  const q = (de, en) => ({ span: 2, runs: [t(`${de} / `), t(en, { italic: true })] });
  return [
    { min: 19, bottom: "thin", cells: [q("Lagerbestand betroffen", "parts in stock affected ?"), { span: 7, noLeft: true, runs: ticks(d3.stock, true) }] },
    { min: 19, bottom: "thin", cells: [q("Umlaufbestände betroffen", "in-process parts affected ?"), { span: 7, noLeft: true, runs: ticks(d3.inProcess, true) }] },
    {
      min: 30,
      cells: [
        q("Ausgelieferte Teile betroffen", "shipped parts affected ?"),
        { span: 3, noLeft: true, runs: ticks(d3.shipped, false) },
        {
          span: 2,
          noLeft: true,
          align: "right",
          runs: [t("Lieferschein Nr. / Delivery Note No:\nMenge / Quantity:", { size: SIZE.delivery })],
        },
        { span: 2, noLeft: true, runs: [t(`${d3.deliveryNoteNo || ""}\n${d3.quantity || ""}`, { size: SIZE.delivery })] },
      ],
    },
  ];
};

// Sections 3, 5, 6, 7: heading row, then one row per entry with no lines in
// between; the last row closes the section.
const actionRows = (heading, entries, completionLabel) => {
  const head = (de, en) => [t(`${de}\n`), t(en, { italic: true })];
  const rows = [
    {
      min: 30,
      bottom: "none",
      cells: [
        { span: 5, vAlign: "top", runs: heading },
        { span: 1, vAlign: "top", runs: head("Verantwortlich:", "Person in charge:") },
        { span: 1, vAlign: "top", runs: head("Termin:", "Due date:") },
        { span: 2, vAlign: "top", runs: head("Erledigungsdatum:", completionLabel) },
      ],
    },
  ];
  const list = entries.length ? entries : [{ action: "", person: "", due: "", done: "" }];
  list.forEach((entry, index) => {
    const last = index === list.length - 1;
    rows.push({
      min: last ? 20 : 13,
      bottom: last ? "heavy" : "none",
      cells: [
        { span: 5, vAlign: "top", runs: [t(entry.action)] },
        { span: 1, vAlign: "top", runs: [t(entry.person)] },
        { span: 1, vAlign: "top", runs: [t(entry.due)] },
        { span: 2, vAlign: "top", runs: [t(entry.done)] },
      ],
    });
  });
  return rows;
};

const CHECK_LINES = [
  { key: "fmeaCheck", de: "FMEA-Überprüfung / ", en: "FMEA-check:", note: "Begründung no/nr:" },
  { key: "fmeaUpdate", de: "Aktualisierung erforderlich/ ", en: "FMEA-update:", note: "Begründung no/nr:", last: true },
  { key: "controlPlan", de: "Produktionslenkungsplan aktualisiert / ", en: "Control plan-update:" },
  { key: "inspectionPlan", de: "Prüfplan aktualisiert / ", en: "inspection plan-update:" },
  { key: "otherProcesses", de: "Sind andere Prozesse, Produkte betroffen\n", en: "Are other processes, products concerned:", last: true },
];

const checkRows = (checks) =>
  CHECK_LINES.map((line) => {
    const state = checks[line.key] || {};
    const T = SIZE.tick;
    const value = (state.text || "").trim();
    return {
      min: line.key === "otherProcesses" ? 26 : 18,
      bottom: line.last ? "heavy" : "none",
      cells: [
        { span: 3, runs: [t(line.de), t(line.en, { italic: true })] },
        {
          span: 2,
          noLeft: true,
          runs: [...tick(state.answer === "no", "Nein / No", T), gap(T), ...tick(state.answer === "yes", "Ja / Yes", T), gap(T), ...tick(state.answer === "na", "nr", T)],
        },
        { span: 2, runs: [t(line.note ? `${line.note}${value ? ` ${value}` : ""}` : value)] },
        { span: 2, runs: [t("")] },
      ],
    };
  });

const feedbackRows = (d8) => [
  { min: 18, cells: [{ span: ALL, runs: [t("8: Feedback "), t("We congratulate the team.", { italic: true })] }] },
  {
    min: 56,
    cells: [
      { span: 2, vAlign: "top", runs: [...label("Abschlussdatum / Verifiziert:", "Date of closure / Verified:"), t(`\n\n${d8.closureDate || ""}`)] },
      {
        span: 4,
        vAlign: "top",
        runs: [
          t("Name des Verantwortlichen, "),
          t("Name of person in charge:", { italic: true }),
          t(`\n\n${d8.closurePerson || ""}\n`),
          t("Dieses Dokument wurde datentechnisch erstellt und ist ohne Unterschrift gültig"),
        ],
      },
      {
        span: 3,
        vAlign: "top",
        runs: [
          t("Dieser 8D-Bericht gilt als bestätigt und angenommen, wenn kein Einspruch innerhalb von 5 Arbeitstagen erfolgt.\n\n"),
          t("This 8D-Report will be regarded as accepted, should no rejection take place within 5 working days after receipt of the document.", { italic: true }),
        ],
      },
    ],
  },
];

const DISCLAIMER =
  "Vorsorglich weisen wir darauf hin, dass die Firma Osteks, Haftung und Schadenersatz aufgrund von Sachmängeln oder positiver Vertragsverletzung, ausschließlich im Rahmen der gesetzlichen Bestimmungen übernehmen. Kosten für Nacharbeiten oder Sortierungen, welche im Rahmen von Nacherfüllungen durch unsere Kunden oder Dritte durchgeführt wurden, werden von der Firma Osteks nur übernommen, wenn vorher eine schriftliche Zustimmung durch einen Verantwortlichen der Osteks GmbH erfolgt ist. Pauschalen, die dem allgemeinen Geschäftsrisiko-entsprechen, werden nicht übernommen";

// ---------------------------------------------------------------- build ---

// Same inputs as buildEightDDocx: the printed values of the three steps.
// (Excel's text is larger than the preview's, so its pages break on their
// own measurements below, not on the preview's page split.)
export async function buildEightDXlsx({ g, d3, d8 }) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OSTEKS GmbH";
  const sheet = workbook.addWorksheet("8D Report", {
    views: [{ style: "pageLayout", showGridLines: false, zoomScale: 100 }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: false,
      scale: 100, // replaced below with the measured one-page scale
      horizontalCentered: true,
      margins: { left: MARGIN.left, right: MARGIN.right, top: MARGIN.top, bottom: MARGIN.bottom, header: 0.3, footer: 0.25 },
    },
    headerFooter: {
      oddHeader: '&R&"Arial,Bold"&16&K9C9C9COSTEKS GMBH',
      oddFooter: '&L&"Arial"&8QMD F3-0102&C&"Arial"&8Rev.Nr.: 3 vom 28.11.2018&R&"Arial"&8Seite &P von &N',
    },
  });
  sheet.columns = COL_WIDTHS.map((width) => ({ width }));

  // Banner across the top of the form + a gap row.
  sheet.mergeCells(1, 1, 1, ALL);
  const banner = sheet.getCell(1, 1);
  banner.value = "WERTE SCHAFFEN OHNE VERSCHWENDUNG";
  banner.font = { name: FONT, size: SIZE.banner, color: { argb: "FFFFFFFF" } };
  banner.alignment = { horizontal: "center", vertical: "middle" };
  banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFA6A6A6" } };
  sheet.getRow(1).height = 30;
  sheet.getRow(2).height = 10;

  let rowNo = 3;
  const textRow = (text, opts, height) => {
    sheet.mergeCells(rowNo, 1, rowNo, ALL);
    const cell = sheet.getCell(rowNo, 1);
    cell.value = text;
    cell.font = font(opts);
    cell.alignment = { vertical: "middle", wrapText: true };
    sheet.getRow(rowNo).height = height;
    rowNo += 1;
  };
  textRow("8D-Bericht", { size: SIZE.title, bold: true }, 20);
  textRow("Concern & Corrective Action Report", { size: SIZE.subtitle, italic: true }, 16);
  sheet.getRow(rowNo).height = 6;
  rowNo += 1;

  const sections = [
    { key: "general", rows: generalRows(g) },
    { key: "team", rows: teamRows(d3) },
    { key: "failures", rows: failureRows(d3) },
    { key: "affected", rows: affectedRows(d3) },
    { key: "containment", rows: actionRows([t("3 Sofortmaßnahme(n) / ", { bold: true }), t("Containment Action(s):", { bold: true, italic: true })], d3.actions, "Completion date:") },
    { key: "rootCause", rows: [{ min: 40, cells: [{ span: ALL, vAlign: "top", runs: [t("4. Fehlerursache(n) / ", { bold: true }), t("Root cause(s):", { bold: true, italic: true }), t(`\n\n${d8.rootCause || ""}`)] }] }] },
    { key: "suggested", rows: actionRows([t("5 Vorgeschlagene Abstellmaßnahmen /\n", { bold: true }), t("Corrective actions suggested:", { bold: true, italic: true })], d8.suggested, "Completion date") },
    { key: "implemented", rows: actionRows([t("6. Eingeführte Abstellmaßnahmen. / ", { bold: true }), t("Corrective actions introduced:", { bold: true, italic: true })], d8.implemented, "Completion date") },
    {
      key: "preventive",
      rows: [
        ...actionRows([t("7. Maßnahmen zur Verhinderung von Wiederholfehlern/\n", { bold: true }), t("Preventive actions:", { bold: true, italic: true })], d8.preventive, "Completion date"),
        ...checkRows(d8.checks || {}),
      ],
    },
    { key: "feedback", rows: feedbackRows(d8) },
  ];

  let prevBottom = "heavy";
  sections.forEach((section) => {
    section.rows.forEach((row) => {
      const top = prevBottom;
      const bottom = row.bottom || "heavy";
      prevBottom = bottom;
      let col = 1;
      let height = row.min || 15;
      row.cells.forEach((cell, index) => {
        const first = col;
        const last = col + cell.span - 1;
        col = last + 1;
        if (cell.span > 1) sheet.mergeCells(rowNo, first, rowNo, last);
        const target = sheet.getCell(rowNo, first);
        const runs = cell.runs.filter((r) => r.text !== "" || cell.runs.length === 1);
        target.value = runs.length > 1 || runs.some((r) => r.bold || r.italic || r.symbol || r.size)
          ? { richText: runs.map((r) => ({ text: r.text, font: font(r) })) }
          : runs[0]?.text || "";
        target.font = font();
        target.alignment = { horizontal: cell.align || "left", vertical: cell.vAlign || "middle", wrapText: true, indent: 0 };

        const widthUnits = COL_WIDTHS.slice(first - 1, last).reduce((a, b) => a + b, 0);
        height = Math.max(height, neededHeight(runs, widthUnits));

        const isLastCell = index === row.cells.length - 1;
        const nextNoLeft = !isLastCell && row.cells[index + 1].noLeft;
        for (let c = first; c <= last; c += 1) {
          sheet.getCell(rowNo, c).border = {
            top: BORDER[top],
            bottom: BORDER[bottom],
            left: c === first ? (index === 0 ? HEAVY : cell.noLeft ? undefined : HEAVY) : undefined,
            right: c === last ? (isLastCell ? HEAVY : nextNoLeft ? undefined : HEAVY) : undefined,
          };
        }
      });
      if (col - 1 !== ALL) throw new Error(`8D xlsx: a row spans ${col - 1} of ${ALL} columns`);
      sheet.getRow(rowNo).height = Math.round(height);
      rowNo += 1;
    });
  });

  // Closing disclaimer under the form, after a small gap.
  sheet.getRow(rowNo).height = 8;
  rowNo += 1;
  sheet.mergeCells(rowNo, 1, rowNo, ALL);
  const disclaimer = sheet.getCell(rowNo, 1);
  disclaimer.value = DISCLAIMER;
  disclaimer.font = font({ size: 7.5 });
  disclaimer.alignment = { vertical: "top", wrapText: true };
  sheet.getRow(rowNo).height = neededHeight([t(DISCLAIMER, { size: 7.5 })], TOTAL_WIDTH);

  sheet.pageSetup.printArea = `A1:${String.fromCharCode(64 + ALL)}${rowNo}`;

  // One-page scale. Sheet size in points: a column of width w is about
  // w * 7 + 5 pixels wide (Excel adds a few pixels of padding per column),
  // 1px = 0.75pt; row heights are already in points. The scale is the
  // largest whole percent that fits both the A4 printable width and height,
  // minus a small margin for Excel's own rounding.
  const sheetWidthPt = COL_WIDTHS.reduce((sum, w) => sum + (w * 7 + 5) * 0.75, 0);
  let sheetHeightPt = 0;
  for (let r = 1; r <= rowNo; r += 1) sheetHeightPt += sheet.getRow(r).height || 15;
  const printableWidthPt = (8.27 - MARGIN.left - MARGIN.right) * 72;
  const printableHeightPt = (11.69 - MARGIN.top - MARGIN.bottom) * 72;
  const fit = Math.min(printableWidthPt / sheetWidthPt, printableHeightPt / sheetHeightPt);
  sheet.pageSetup.scale = Math.max(10, Math.min(100, Math.floor(fit * 100) - 2));

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
