import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
} from "docx";

// The 8D-Bericht as an editable Word document, mirroring the View Report
// preview (ViewReport.jsx / viewReport.css) page for page: same header and
// footer on every page, the same sections in the same order, and a page
// break before exactly the section that starts each new page in the
// preview, so a one-page preview gives a one-page document.
//
// Geometry comes from the preview's CSS pixels (96px = 1in = 1440 twips).
// Font sizes are the preview's pixel sizes converted to points and rounded
// DOWN to Word's half-point steps, so the document never needs more room
// than the preview did.
//
// All sections of one page are rows of ONE Word table built on a shared
// column grid (GRID_PERCENT): separate tables would need a paragraph between
// them, which shows as a gap in the frame. Every vertical line used by any
// section is a boundary in that grid; each cell spans the grid columns it
// covers.

const px = (n) => Math.round(n * 15);
const halfPt = (cssPx) => Math.floor(cssPx * 1.5); // px -> half-points, rounded down

const FONT = "Arial";
const SYMBOL_FONT = "Segoe UI Symbol";
const PAGE_W = convertMillimetersToTwip(210);
const PAGE_H = convertMillimetersToTwip(297);
const MARGIN_SIDE = px(42);
const CONTENT_W = PAGE_W - MARGIN_SIDE * 2;

// Column boundaries (percent of the content width) of every section:
// general table 14.5 / 36 / 61.5 / 87, "parts affected" 27, check lines
// 32.8 / 49, action sections 49 / 61.5 / 74.6, feedback 27 / 61.5,
// failure descriptions 36.
const GRID_PERCENT = [14.5, 12.5, 5.8, 3.2, 13, 12.5, 13.1, 12.4, 13];
const GRID = (() => {
  const cols = GRID_PERCENT.map((p) => Math.round((CONTENT_W * p) / 100));
  cols[cols.length - 1] += CONTENT_W - cols.reduce((a, b) => a + b, 0);
  return cols;
})();
const ALL = GRID.length;

const SIZE = {
  general: halfPt(7.2),
  body: halfPt(7),
  tick: halfPt(6.4),
  checkTick: halfPt(6.2),
  delivery: halfPt(5.8),
  title: halfPt(12.5),
  subtitle: halfPt(9),
  disclaimer: halfPt(7),
  header: halfPt(17),
  footer: halfPt(8),
};

const HEAVY = { style: BorderStyle.SINGLE, size: 12, color: "000000" }; // 2px
const THIN = { style: BorderStyle.SINGLE, size: 6, color: "000000" }; // 1px
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const BORDER = { heavy: HEAVY, thin: THIN, none: NONE };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };

// ---------------------------------------------------------------- text ---

const run = (text, opts = {}) =>
  new TextRun({
    text,
    font: opts.font || FONT,
    size: opts.size || SIZE.body,
    bold: opts.bold,
    italics: opts.italic,
    color: opts.color,
  });

const para = (children, opts = {}) =>
  new Paragraph({
    children: Array.isArray(children) ? children : [children],
    alignment: opts.align,
    tabStops: opts.tabs,
    spacing: { before: opts.before || 0, after: opts.after || 0 },
  });

// One paragraph per line of a multi-line value; an empty value still gives
// one (empty) paragraph, which a table cell requires.
const lines = (text, opts = {}) => {
  const parts = (text || "").split("\n");
  return parts.map((line, i) =>
    para(run(line, opts), { align: opts.align, before: i === 0 ? opts.before : 0, after: i === parts.length - 1 ? opts.after : 0 })
  );
};

// German line, then the English line in italics (the form's label style).
const label = (de, en, opts = {}) => [
  para(run(de, opts), { align: opts.align }),
  para(run(en, { ...opts, italic: true }), { align: opts.align }),
];

const tick = (checked, text, size) => [
  run(checked ? "☑" : "☐", { font: SYMBOL_FONT, size: size + 2 }),
  run(` ${text}`, { size }),
];
const TAB = () => new TextRun({ text: "\t", font: FONT });

// --------------------------------------------------------------- table ---

// A row spec: { cells: [{ span, children, vAlign, margins, noLeft }], height,
// bottom: "heavy" | "thin" | "none" }. The row's top line is the previous
// row's bottom line, so both sides of every horizontal edge agree (Word
// otherwise picks whichever side it likes). noLeft drops the vertical line
// on a cell's left edge (cells that only exist to place text, e.g. the
// tick boxes beside a question).
const pageTable = (rows) => {
  let prevBottom = "heavy";
  const tableRows = rows.map((row) => {
    const top = prevBottom;
    prevBottom = row.bottom || "heavy";
    let col = 0;
    const cells = row.cells.map((cell, index) => {
      const width = GRID.slice(col, col + cell.span).reduce((a, b) => a + b, 0);
      col += cell.span;
      const isLast = index === row.cells.length - 1;
      const nextNoLeft = !isLast && row.cells[index + 1].noLeft;
      return new TableCell({
        columnSpan: cell.span,
        width: { size: width, type: WidthType.DXA },
        verticalAlign: cell.vAlign || VerticalAlign.CENTER,
        margins: cell.margins || { top: px(2), bottom: px(2), left: px(3), right: px(3) },
        borders: {
          top: BORDER[top],
          bottom: BORDER[row.bottom || "heavy"],
          left: index === 0 ? HEAVY : cell.noLeft ? NONE : HEAVY,
          right: isLast ? HEAVY : nextNoLeft ? NONE : HEAVY,
        },
        children: cell.children,
      });
    });
    if (col !== ALL) throw new Error(`8D docx: a row spans ${col} of ${ALL} grid columns`);
    return new TableRow({
      height: row.height ? { value: px(row.height), rule: HeightRule.ATLEAST } : undefined,
      cantSplit: true,
      children: cells,
    });
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: GRID,
    layout: TableLayoutType.FIXED,
    rows: tableRows,
  });
};

const TOP = VerticalAlign.TOP;

// ------------------------------------------------------------ sections ---

const generalRows = (g) => {
  const S = SIZE.general;
  const lbl = (de, en, align) => ({ span: 1, children: label(de, en, { size: S, align }) });
  const val = (text, span, align, bold) => ({ span, children: lines(text, { size: S, align, bold }) });
  const C = AlignmentType.CENTER;
  const pair = (de, en, value, de2, en2, value2) => ({
    height: 31,
    cells: [lbl(de, en), val(value, 3), { span: 2, children: label(de2, en2, { size: S }) }, val(value2, 3, C)],
  });
  return [
    pair("Bericht Nr. des Kunden:", "Customer – Reference:", g.customerReferenceNumber, "Bericht Nr. Osteks GmbH:", "Report No. Osteks GmbH:", g.reportNo),
    pair("Artikel-Nr. Kunde:", "Customer Item No:", g.customerItemNo, "Reklamationsdatum:", "Complaint Date:", g.complaintDate),
    pair("Artikel Nr. Osteks:", "Supplier Item No.:", g.supplierItemNo, "8D-Startdatum:", "8D Start Date:", g.startDate),
    pair("Bezeichnung:", "Part name:", g.partName, "8D-Statusdatum:", "8D Status Date:", g.statusDate),
    { height: 31, cells: [lbl("Kunde / Standort:", "Customer / location:"), val(g.customerLocation, 3), val("", 2), val("", 3)] },
    {
      height: 31,
      cells: [
        lbl("Reklamierte Stückzahl:", "Number of rejected parts:"),
        val(g.rejectedPartsCount, 3, C, true),
        { span: 2, children: label("Ansprechpartner Osteks:", "Supplier Contact:", { size: S }) },
        { span: 2, children: label("Abteilung:", "Department:", { size: S }) },
        lbl("Tel. Nr.:", "Phone No.:"),
      ],
    },
    {
      height: 31,
      cells: [
        lbl("Beanstandung:", "Complaint:", C),
        {
          span: 3,
          children: [
            para(tick(g.complaintStatus === "accepted", "akzeptiert / ", SIZE.tick).concat(run("accepted", { size: SIZE.tick, italic: true }))),
            para(tick(g.complaintStatus === "rejected", "abgelehnt / ", SIZE.tick).concat(run("rejected", { size: SIZE.tick, italic: true })), { before: px(3) }),
          ],
        },
        val(g.supplierContact, 2, C),
        val(g.department, 2),
        val(g.phoneNo, 1),
      ],
    },
  ];
};

const teamRows = (d3) => [
  {
    height: 18,
    cells: [{
      span: ALL,
      children: [para([run("1.Team: Name / Abteilung / Telefon / e-mail:", { bold: true }), run("Team: Name / Department / Phone / e-mail", { bold: true, italic: true })])],
    }],
  },
  {
    height: 46,
    cells: [{
      span: ALL,
      vAlign: TOP,
      margins: { top: px(10), bottom: px(11), left: px(3), right: px(3) },
      children: lines(d3.team.join("\n")),
    }],
  },
];

const failureRows = (d3) => [
  {
    height: 32,
    cells: [
      { span: 4, children: [para([run("2.1. Problembeschreibungen Kunde / ", { bold: true }), run("Failure Description Customer:", { bold: true, italic: true })])] },
      { span: 5, children: [para([run("2.2. Problembeschreibung Osteks / ", { bold: true }), run("Failure Description Osteks:", { bold: true, italic: true })])] },
    ],
  },
  { height: 32, cells: [{ span: 4, children: lines(d3.customerFailure) }, { span: 5, children: lines(d3.osteksFailure) }] },
];

const affectedRows = (d3) => {
  const T = SIZE.tick;
  const ticksPara = (state, withSorted) =>
    para(
      [
        ...tick(state.answer === "no", "Nein / No", T),
        TAB(),
        ...tick(state.answer === "yes", "Ja / Yes", T),
        ...(withSorted ? [TAB(), ...tick(state.sorted, "Teile sortiert / Parts sorted", T)] : []),
      ],
      { tabs: [{ type: TabStopType.LEFT, position: px(46) }, { type: TabStopType.LEFT, position: px(90) }] }
    );
  const question = (de, en) => ({ span: 2, children: [para([run(`${de} / `), run(en, { italic: true })])] });
  // Delivery note / quantity: labels right-aligned on a tab, value after.
  const deliveryTab = [{ type: TabStopType.RIGHT, position: Math.round(CONTENT_W * 0.06) + px(140) }];
  const deliveryLine = (text, value) =>
    para([TAB(), run(text, { size: SIZE.delivery }), run(` ${value || ""}`, { size: SIZE.delivery })], { tabs: deliveryTab });
  return [
    { height: 19, bottom: "thin", cells: [question("Lagerbestand betroffen", "parts in stock affected ?"), { span: 7, noLeft: true, children: [ticksPara(d3.stock, true)] }] },
    { height: 19, bottom: "thin", cells: [question("Umlaufbestände betroffen", "in-process parts affected ?"), { span: 7, noLeft: true, children: [ticksPara(d3.inProcess, true)] }] },
    {
      height: 30,
      cells: [
        question("Ausgelieferte Teile betroffen", "shipped parts affected ?"),
        { span: 3, noLeft: true, children: [ticksPara(d3.shipped, false)] },
        { span: 4, noLeft: true, children: [deliveryLine("Lieferschein Nr. / Delivery Note No:", d3.deliveryNoteNo), deliveryLine("Menge / Quantity:", d3.quantity)] },
      ],
    },
  ];
};

// Sections 3, 5, 6, 7: heading row, then one row per entry (the last one
// tall enough that an empty section keeps its size), no lines in between.
const actionRows = (headingRuns, entries, completionLabel) => {
  const head = (de, en) => [para(run(de)), para(run(en, { italic: true }))];
  const rows = [
    {
      bottom: "none",
      cells: [
        { span: 5, vAlign: TOP, margins: { top: px(2), bottom: px(12), left: px(3), right: px(3) }, children: headingRuns },
        { span: 1, vAlign: TOP, margins: { top: px(2), bottom: px(12), left: px(3), right: px(3) }, children: head("Verantwortlich:", "Person in charge:") },
        { span: 1, vAlign: TOP, margins: { top: px(2), bottom: px(12), left: px(3), right: px(3) }, children: head("Termin:", "Due date:") },
        { span: 2, vAlign: TOP, margins: { top: px(2), bottom: px(12), left: px(3), right: px(3) }, children: head("Erledigungsdatum:", completionLabel) },
      ],
    },
  ];
  const list = entries.length ? entries : [{ action: "", person: "", due: "", done: "" }];
  list.forEach((entry, index) => {
    const last = index === list.length - 1;
    const m = { top: 0, bottom: last ? px(4) : px(1), left: px(3), right: px(3) };
    rows.push({
      height: last ? 22 : undefined,
      bottom: last ? "heavy" : "none",
      cells: [
        { span: 5, vAlign: TOP, margins: m, children: lines(entry.action) },
        { span: 1, vAlign: TOP, margins: m, children: lines(entry.person) },
        { span: 1, vAlign: TOP, margins: m, children: lines(entry.due) },
        { span: 2, vAlign: TOP, margins: m, children: lines(entry.done) },
      ],
    });
  });
  return rows;
};

const boldDeEn = (de, en, enOnOwnLine) =>
  enOnOwnLine
    ? [para(run(de, { bold: true })), para(run(en, { bold: true, italic: true }))]
    : [para([run(de, { bold: true }), run(en, { bold: true, italic: true })])];

const rootCauseRows = (d8) => [
  {
    height: 40,
    cells: [{
      span: ALL,
      vAlign: TOP,
      children: [para([run("4. Fehlerursache(n) / ", { bold: true }), run("Root cause(s):", { bold: true, italic: true })], { after: px(14) }), ...lines(d8.rootCause)],
    }],
  },
];

const CHECK_LINES = [
  { key: "fmeaCheck", de: "FMEA-Überprüfung / ", en: "FMEA-check:", note: "Begründung no/nr:" },
  { key: "fmeaUpdate", de: "Aktualisierung erforderlich/ ", en: "FMEA-update:", note: "Begründung no/nr:", last: true },
  { key: "controlPlan", de: "Produktionslenkungsplan aktualisiert / ", en: "Control plan-update:" },
  { key: "inspectionPlan", de: "Prüfplan aktualisiert / ", en: "inspection plan-update:" },
  { key: "otherProcesses", de: "Sind andere Prozesse, Produkte betroffen", en: "Are other processes, products concerned:", stacked: true, last: true },
];

const checkRows = (checks) =>
  CHECK_LINES.map((line) => {
    const state = checks[line.key] || {};
    const T = SIZE.checkTick;
    const question = line.stacked
      ? [para(run(line.de)), para(run(line.en, { italic: true }))]
      : [para([run(line.de), run(line.en, { italic: true })])];
    const value = (state.text || "").trim();
    const note = line.note ? `${line.note}${value ? ` ${value}` : ""}` : value;
    return {
      height: 17,
      bottom: line.last ? "heavy" : "none",
      cells: [
        { span: 3, children: question },
        {
          span: 2,
          noLeft: true,
          children: [
            para(
              [...tick(state.answer === "no", "Nein / No", T), TAB(), ...tick(state.answer === "yes", "Ja / Yes", T), TAB(), ...tick(state.answer === "na", "nr", T)],
              { tabs: [{ type: TabStopType.LEFT, position: px(44) }, { type: TabStopType.LEFT, position: px(90) }] }
            ),
          ],
        },
        { span: 2, children: lines(note) },
        { span: 2, children: [para(run(""))] },
      ],
    };
  });

const feedbackRows = (d8) => [
  { height: 18, cells: [{ span: ALL, children: [para([run("8: Feedback "), run("We congratulate the team.", { italic: true })])] }] },
  {
    height: 52,
    cells: [
      {
        span: 2,
        vAlign: TOP,
        children: [
          para(run("Abschlussdatum / Verifiziert:")),
          para(run("Date of closure / Verified:", { italic: true })),
          para(run(d8.closureDate || ""), { before: px(9), after: px(5) }),
        ],
      },
      {
        span: 4,
        vAlign: TOP,
        children: [
          para([run("Name des Verantwortlichen, "), run("Name of person in charge:", { italic: true })]),
          ...lines(d8.closurePerson, { before: px(9), after: px(5) }),
          para(run("Dieses Dokument wurde datentechnisch erstellt und ist ohne Unterschrift gültig")),
        ],
      },
      {
        span: 3,
        vAlign: TOP,
        children: [
          para(run("Dieser 8D-Bericht gilt als bestätigt und angenommen, wenn kein Einspruch innerhalb von 5 Arbeitstagen erfolgt.")),
          para(
            run("This 8D-Report will be regarded as accepted, should no rejection take place within 5 working days after receipt of the document.", { italic: true }),
            { before: px(10) }
          ),
        ],
      },
    ],
  },
];

const DISCLAIMER =
  "Vorsorglich weisen wir darauf hin, dass die Firma Osteks, Haftung und Schadenersatz aufgrund von Sachmängeln oder positiver Vertragsverletzung, ausschließlich im Rahmen der gesetzlichen Bestimmungen übernehmen. Kosten für Nacharbeiten oder Sortierungen, welche im Rahmen von Nacherfüllungen durch unsere Kunden oder Dritte durchgeführt wurden, werden von der Firma Osteks nur übernommen, wenn vorher eine schriftliche Zustimmung durch einen Verantwortlichen der Osteks GmbH erfolgt ist. Pauschalen, die dem allgemeinen Geschäftsrisiko-entsprechen, werden nicht übernommen";

// ---------------------------------------------------------------- build ---

// `pageStartKeys`: block keys (ViewReport's blocks) that open a new page in
// the preview. `pageCount`: the preview's number of pages, printed as the
// footer's "von N" (a fixed number rather than a NUMPAGES field, which Word
// often doesn't refresh when a downloaded file opens in Protected View -
// same reasoning as the Test Report export).
export async function buildEightDDocx({ g, d3, d8, pageStartKeys = [], pageCount = 1 }) {
  const sections = [
    { key: "general", rows: generalRows(g) },
    { key: "team", rows: teamRows(d3) },
    { key: "failures", rows: failureRows(d3) },
    { key: "affected", rows: affectedRows(d3) },
    {
      key: "containment",
      rows: actionRows([para([run("3 Sofortmaßnahme(n) / ", { bold: true }), run("Containment Action(s):", { bold: true, italic: true })])], d3.actions, "Completion date:"),
    },
    { key: "rootCause", rows: rootCauseRows(d8) },
    { key: "suggested", rows: actionRows(boldDeEn("5 Vorgeschlagene Abstellmaßnahmen /", "Corrective actions suggested:", true), d8.suggested, "Completion date") },
    { key: "implemented", rows: actionRows(boldDeEn("6. Eingeführte Abstellmaßnahmen. / ", "Corrective actions introduced:"), d8.implemented, "Completion date") },
    {
      key: "preventive",
      rows: [
        ...actionRows(boldDeEn("7. Maßnahmen zur Verhinderung von Wiederholfehlern/", "Preventive actions:", true), d8.preventive, "Completion date"),
        ...checkRows(d8.checks || {}),
      ],
    },
    { key: "feedback", rows: feedbackRows(d8), after: [para(run(DISCLAIMER, { size: SIZE.disclaimer }), { before: px(12) })] },
  ];

  // Group sections into pages exactly as the preview did.
  const pages = [[]];
  sections.forEach((section) => {
    if (pageStartKeys.includes(section.key) && pages[pages.length - 1].length) pages.push([]);
    pages[pages.length - 1].push(section);
  });

  const body = [
    para(run("8D-Bericht", { size: SIZE.title, bold: true }), { before: px(22) }),
    para(run("Concern & Corrective Action Report", { size: SIZE.subtitle, italic: true }), { before: px(5), after: px(12) }),
  ];
  pages.forEach((pageSections, index) => {
    if (index > 0) {
      body.push(new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: px(14) }, children: [run("", { size: 2 })] }));
    }
    body.push(pageTable(pageSections.flatMap((section) => section.rows)));
    pageSections.forEach((section) => (section.after || []).forEach((p) => body.push(p)));
  });

  const header = new Header({
    children: [
      para(run("OSTEKS GMBH", { size: SIZE.header, bold: true, color: "9C9C9C" }), { align: AlignmentType.RIGHT, after: px(4) }),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W],
        layout: TableLayoutType.FIXED,
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: CONTENT_W, type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: "A6A6A6", color: "auto" },
                margins: { top: px(5), bottom: px(5), left: 0, right: 0 },
                borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
                children: [para(run("WERTE SCHAFFEN OHNE VERSCHWENDUNG", { size: SIZE.header, color: "FFFFFF" }), { align: AlignmentType.CENTER })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const third = Math.round(CONTENT_W / 3);
  const footerCell = (children, align, width) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      children: [new Paragraph({ alignment: align, children })],
    });
  const footer = new Footer({
    children: [
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [third, third, CONTENT_W - third * 2],
        layout: TableLayoutType.FIXED,
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              footerCell([run("QMD F3-0102", { size: SIZE.footer })], AlignmentType.LEFT, third),
              footerCell([run("Rev.Nr.: 3 vom 28.11.2018", { size: SIZE.footer })], AlignmentType.CENTER, third),
              footerCell(
                [
                  run("Seite ", { size: SIZE.footer }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SIZE.footer }),
                  run(` von ${pageCount}`, { size: SIZE.footer }),
                ],
                AlignmentType.RIGHT,
                CONTENT_W - third * 2
              ),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: SIZE.body } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: {
              top: px(98),
              bottom: px(40),
              left: MARGIN_SIDE,
              right: MARGIN_SIDE,
              header: px(40),
              footer: px(18),
            },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children: body,
      },
    ],
  });

  return Packer.toBlob(doc);
}
