import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { FileDown, FileSpreadsheet, FileType2, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ProgressButton from "../../TestReport/PreviewExport/ProgressButton";
import { buildEightDDocx } from "./buildEightDDocx";
import { buildEightDXlsx } from "./buildEightDXlsx";
import "./viewReport.css";

const A4_PAGE_WIDTH_PX = 794;
const A4_PAGE_HEIGHT_PX = 1123;
// Vertical page layout used by the pagination: content starts below the
// sheet's top padding (.ed-doc-page) plus the header, and must end above the
// footer (pinned 18px from the bottom, ~10px tall) with a small gap. A block
// that opens a continuation page gets a top rule and some space under the
// header (.ed-doc-block--page-start), which costs PAGE_START_EXTRA_PX.
const PAGE_PADDING_TOP_PX = 40;
const CONTENT_BOTTOM_PX = 1083;
const PAGE_START_EXTRA_PX = 18;

// Manual zoom range and step, as a fraction of the sheet's true size.
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;
const clampZoom = (value) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));

// Date fields hold text: a date as "dd.mm.yyyy", or a calendar week such
// as "KW34", printed as entered. A "yyyy-mm-dd" value (how dates were stored
// before calendar weeks were allowed) is still converted to dd.mm.yyyy.
const formatDateDots = (value) => {
  const text = (value || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  return iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : text;
};

// A bilingual cell label exactly as printed on the form: German line, then
// English line in italics. Fixed document wording, deliberately not run through the
// app's EN/DE translations (same rule as Test Report's own document).
const Label = ({ de, en }) => (
  <>
    <span className="ed-doc-label-line">{de}</span>
    <span className="ed-doc-label-line ed-doc-en">{en}</span>
  </>
);

const Tick = ({ checked, children }) => (
  <span className="ed-doc-tick">
    <span className="ed-doc-tick-box">{checked && <span className="ed-doc-tick-mark" />}</span>
    {children}
  </span>
);

// One "... betroffen?" line: German / English question, then its tick boxes
// at fixed positions so the three lines' boxes sit in the same columns.
const AffectedLine = ({ de, en, answer, sorted, children }) => (
  <div className="ed-doc-affected-line">
    <span className="ed-doc-affected-question">
      {de} / <span className="ed-doc-en">{en}</span>
    </span>
    <span className="ed-doc-affected-ticks">
      <Tick checked={answer === "no"}>Nein / No</Tick>
      <Tick checked={answer === "yes"}>Ja / Yes</Tick>
      {sorted !== undefined && <Tick checked={sorted}>Teile sortiert / Parts sorted</Tick>}
    </span>
    {children}
  </div>
);

// One numbered action section (3, 5, 6 or 7): a heading row (section
// heading, then the person / due date / completion date column headings),
// then one table row per entry. Entries are separate rows rather than lines
// in one cell so an entry's person and dates stay level with its action even
// when the action text wraps. With no entries one empty row keeps the
// section's printed height. Only the section's last row draws a rule.
// An empty cell holds a non-breaking space: the PDF capture misplaces the
// text of the cell below a truly empty one (seen as a date dropping a line).
const EMPTY_ENTRY = { action: "", person: "", due: "", done: "" };
const ActionSection = ({ heading, rows, completionLabel = "Completion date" }) => {
  const entries = rows.length ? rows : [EMPTY_ENTRY];
  return (
    <>
      <tr className="ed-doc-open-row ed-doc-action-head">
        <td className="ed-doc-top">
          <span className="ed-doc-heading">{heading}</span>
        </td>
        <td className="ed-doc-top">
          Verantwortlich:
          <span className="ed-doc-label-line ed-doc-en">Person in charge:</span>
        </td>
        <td className="ed-doc-top">
          Termin:
          <span className="ed-doc-label-line ed-doc-en">Due date:</span>
        </td>
        <td className="ed-doc-top">
          Erledigungsdatum:
          <span className="ed-doc-label-line ed-doc-en">{completionLabel}</span>
        </td>
      </tr>
      {entries.map((row, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <tr key={index} className={index < entries.length - 1 ? "ed-doc-open-row ed-doc-action-entry" : "ed-doc-action-entry ed-doc-action-last"}>
          <td className="ed-doc-top">{row.action || " "}</td>
          <td className="ed-doc-top">{row.person || " "}</td>
          <td className="ed-doc-top">{row.due || " "}</td>
          <td className="ed-doc-top">{row.done || " "}</td>
        </tr>
      ))}
    </>
  );
};

// One Nein / Ja / nr question line of the FMEA and follow-up groups. `last`
// marks the group's final line, the only one that draws a rule below it.
// `note` is the wording printed in the middle column (the FMEA lines'
// "Begruendung no/nr:"); the right-hand column is always blank.
const CheckLine = ({ de, en, stacked, answer, note, value, last }) => (
  <tr className={last ? "" : "ed-doc-open-row"}>
    <td>
      <span className="ed-doc-check">
        <span className="ed-doc-check-question">
          {de}
          {stacked ? <span className="ed-doc-label-line ed-doc-en">{en}</span> : <span className="ed-doc-en"> {en}</span>}
        </span>
        <span className="ed-doc-check-ticks">
          <Tick checked={answer === "no"}>Nein / No</Tick>
          <Tick checked={answer === "yes"}>Ja / Yes</Tick>
          <Tick checked={answer === "na"}>nr</Tick>
        </span>
      </span>
    </td>
    <td>
      {note}
      {note && value ? ` ${value}` : value}
    </td>
    <td />
  </tr>
);

// Step 4 — the printed 8D-Bericht, one A4 sheet, built from what was
// entered in the earlier steps. The general-information table (step 1)
// and the 3D block (step 2) are filled from the wizard; the 8D block is
// laid out but still prints empty. PDF, Word and Excel
// downloads all work.
const ViewReport = ({ generalInfo, threeDInfo, eightDInfo, onSaveRecord }) => {
  const { t } = useTranslation();

  // Sheet size on screen. By default the sheet is fitted to the surface's
  // width (an A4 sheet is wider than a phone), never above true size; the
  // zoom buttons / Ctrl+wheel replace that with a manual scale until the
  // percentage button resets it to "fit" again.
  const surfaceRef = useRef(null);
  const [pageScale, setPageScale] = useState(1);
  const [manualZoom, setManualZoom] = useState(null);
  const pageScaleRef = useRef(pageScale);
  useEffect(() => {
    pageScaleRef.current = pageScale;
  }, [pageScale]);
  const zoomBy = (delta) => setManualZoom((prev) => clampZoom((prev ?? pageScaleRef.current) + delta));

  // Ctrl + mouse wheel (and trackpad pinch, which browsers report the same
  // way) zooms the sheet instead of the whole browser page. Registered by
  // hand because it must be a non-passive listener to cancel the default.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return undefined;
    const onWheel = (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
    };
    surface.addEventListener("wheel", onWheel, { passive: false });
    return () => surface.removeEventListener("wheel", onWheel);
  }, []);
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || typeof ResizeObserver === "undefined") return undefined;
    const update = () => {
      const style = getComputedStyle(surface);
      const available = surface.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const next = Math.min(1, Math.max(0.2, available / A4_PAGE_WIDTH_PX));
      setPageScale((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  const g = generalInfo;

  // Step 2's state, shaped for printing. A team member prints as
  // "Name/Department/Phone/E-mail" on one line; rows left completely empty
  // are skipped, and so are containment-action rows with nothing in them.
  // Step 3's state, shaped for printing: sections 4 to 8, including section
  // 7's check lines. Section 8's Remarks field has no place on the printed
  // form, so it is not printed.
  const toPrintedAction = (row) => ({
    action: row.action.trim(),
    person: row.person.trim(),
    due: formatDateDots(row.dueDate),
    done: formatDateDots(row.completionDate),
  });
  const hasContent = (row) => row.action.trim() || row.person.trim() || row.dueDate || row.completionDate;
  const d8 = {
    rootCause: eightDInfo.rootCause,
    suggested: eightDInfo.correctiveActions.filter(hasContent).map(toPrintedAction),
    implemented: eightDInfo.implementedActions.filter(hasContent).map(toPrintedAction),
    preventive: eightDInfo.preventiveActions.filter(hasContent).map(toPrintedAction),
    // Section 7's Nein / Ja / nr lines, keyed like the wizard's check rows
    // (fmeaCheck, fmeaUpdate, controlPlan, inspectionPlan, otherProcesses):
    // answer "no" / "yes" / "na" ticks the matching box, text prints beside.
    checks: eightDInfo.checks,
    closureDate: formatDateDots(eightDInfo.closureDate),
    closurePerson: eightDInfo.closurePerson.trim(),
  };

  const d3 = {
    team: threeDInfo.team
      .map((member) => [member.name, member.department, member.phone, member.email].map((part) => part.trim()))
      .filter((parts) => parts.some(Boolean))
      .map((parts) => parts.join("/")),
    customerFailure: threeDInfo.customerFailure,
    osteksFailure: threeDInfo.osteksFailure,
    stock: threeDInfo.affected.stock,
    inProcess: threeDInfo.affected.inProcess,
    shipped: threeDInfo.affected.shipped,
    deliveryNoteNo: threeDInfo.deliveryNoteNo,
    quantity: threeDInfo.quantity,
    actions: threeDInfo.actions
      .filter((row) => row.action.trim() || row.person.trim() || row.dueDate || row.completionDate)
      .map((row) => ({
        action: row.action.trim(),
        person: row.person.trim(),
        due: formatDateDots(row.dueDate),
        done: formatDateDots(row.completionDate),
      })),
  };

  // The PDF is a picture of the sheet exactly as shown, so the sheet has to
  // be at its true A4 size while it is captured: the on-screen scale is
  // switched off for the capture and restored afterwards.
  const pageRefs = useRef([]);
  const [capturing, setCapturing] = useState(false);
  // File name is the Osteks report no.; characters Windows forbids in file
  // names are replaced, and an empty one falls back to a default.
  const fileBaseName = () => (g.reportNo || "").trim().replace(/[\\/:*?"<>|]+/g, "-") || "8D-Bericht";

  const handleDownloadPdf = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      // Two frames so the un-zoomed layout is really painted before
      // html2canvas reads it.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      // 3x and lossless PNG: small black text stays crisp and fully black
      // instead of being softened to grey by JPEG compression.
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      for (let index = 0; index < pages.length; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        const canvas = await html2canvas(pageRefs.current[index], { scale: 3, backgroundColor: "#ffffff" });
        if (index > 0) pdf.addPage("a4", "portrait");
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
      }
      pdf.save(`${fileBaseName()}.pdf`);
    } finally {
      setCapturing(false);
    }
  };

  // The page header (company + banner), printed at the top of every sheet.
  const pageHeader = (
    <header className="ed-doc-header">
      <div className="ed-doc-company">OSTEKS GMBH</div>
      <div className="ed-doc-banner">WERTE SCHAFFEN OHNE VERSCHWENDUNG</div>
    </header>
  );

  // The document as an ordered list of blocks that each must stay whole on
  // one page - one block per numbered section, never split. The pagination effect below fills sheets with them in order
  // and starts a new sheet when the next block would run into the footer.
  const blocks = [
    {
      key: "general",
      node: (
        <>
                <h1 className="ed-doc-title">8D-Bericht</h1>
                <p className="ed-doc-subtitle">Concern &amp; Corrective Action Report</p>

                <table className="ed-doc-table">
                  <colgroup>
                    <col style={{ width: "14.5%" }} />
                    <col style={{ width: "21.5%" }} />
                    <col style={{ width: "25.5%" }} />
                    <col style={{ width: "25.5%" }} />
                    <col style={{ width: "13%" }} />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td><Label de="Bericht Nr. des Kunden:" en="Customer – Reference:" /></td>
                      <td>{g.customerReferenceNumber}</td>
                      <td><Label de="Bericht Nr. Osteks GmbH:" en="Report No. Osteks GmbH:" /></td>
                      <td colSpan={2} className="ed-doc-center">{g.reportNo}</td>
                    </tr>
                    <tr>
                      <td><Label de="Artikel-Nr. Kunde:" en="Customer Item No:" /></td>
                      <td>{g.customerItemNo}</td>
                      <td><Label de="Reklamationsdatum:" en="Complaint Date:" /></td>
                      <td colSpan={2} className="ed-doc-center">{formatDateDots(g.complaintDate)}</td>
                    </tr>
                    <tr>
                      <td><Label de="Artikel Nr. Osteks:" en="Supplier Item No.:" /></td>
                      <td>{g.supplierItemNo}</td>
                      <td><Label de="8D-Startdatum:" en="8D Start Date:" /></td>
                      <td colSpan={2} className="ed-doc-center">{formatDateDots(g.startDate)}</td>
                    </tr>
                    <tr>
                      <td><Label de="Bezeichnung:" en="Part name:" /></td>
                      <td>{g.partName}</td>
                      <td><Label de="8D-Statusdatum:" en="8D Status Date:" /></td>
                      <td colSpan={2} className="ed-doc-center">{formatDateDots(g.statusDate)}</td>
                    </tr>
                    <tr>
                      <td><Label de="Kunde / Standort:" en="Customer / location:" /></td>
                      <td>{g.customerLocation}</td>
                      <td />
                      <td colSpan={2} />
                    </tr>
                    <tr>
                      <td><Label de="Reklamierte Stückzahl:" en="Number of rejected parts:" /></td>
                      <td className="ed-doc-center ed-doc-strong">{g.rejectedPartsCount}</td>
                      <td><Label de="Ansprechpartner Osteks:" en="Supplier Contact:" /></td>
                      <td><Label de="Abteilung:" en="Department:" /></td>
                      <td><Label de="Tel. Nr.:" en="Phone No.:" /></td>
                    </tr>
                    <tr>
                      <td className="ed-doc-center"><Label de="Beanstandung:" en="Complaint:" /></td>
                      <td>
                        <Tick checked={g.complaintStatus === "accepted"}>
                          <span>
                            akzeptiert / <span className="ed-doc-en">accepted</span>
                          </span>
                        </Tick>
                        <Tick checked={g.complaintStatus === "rejected"}>
                          <span>
                            abgelehnt / <span className="ed-doc-en">rejected</span>
                          </span>
                        </Tick>
                      </td>
                      <td className="ed-doc-center">{g.supplierContact}</td>
                      <td>{g.department}</td>
                      <td>{g.phoneNo}</td>
                    </tr>
                  </tbody>
                </table>
        </>
      ),
    },
    {
      key: "team",
      node: (
        <>
                <table className="ed-doc-table ed-doc-table--joined ed-doc-table--body">
                  <tbody>
                    <tr>
                      <td className="ed-doc-heading">
                        1.Team: Name / Abteilung / Telefon / e-mail:
                        <span className="ed-doc-en">Team: Name / Department / Phone / e-mail</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="ed-doc-top ed-doc-team">{d3.team.join("\n")}</td>
                    </tr>
                  </tbody>
                </table>
        </>
      ),
    },
    {
      key: "failures",
      node: (
        <>
                <table className="ed-doc-table ed-doc-table--joined ed-doc-table--body">
                  <colgroup>
                    <col style={{ width: "36.2%" }} />
                    <col style={{ width: "63.8%" }} />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td className="ed-doc-heading ed-doc-tall">
                        2.1. Problembeschreibungen Kunde / <span className="ed-doc-en">Failure Description Customer:</span>
                      </td>
                      <td className="ed-doc-heading ed-doc-tall">
                        2.2. Problembeschreibung Osteks / <span className="ed-doc-en">Failure Description Osteks:</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="ed-doc-tall">{d3.customerFailure}</td>
                      <td className="ed-doc-tall">{d3.osteksFailure}</td>
                    </tr>
                  </tbody>
                </table>
        </>
      ),
    },
    {
      key: "affected",
      node: (
        <>
                <div className="ed-doc-affected">
                  <AffectedLine
                    de="Lagerbestand betroffen"
                    en="parts in stock affected ?"
                    answer={d3.stock.answer}
                    sorted={d3.stock.sorted}
                  />
                  <AffectedLine
                    de="Umlaufbestände betroffen"
                    en="in-process parts affected ?"
                    answer={d3.inProcess.answer}
                    sorted={d3.inProcess.sorted}
                  />
                  <AffectedLine de="Ausgelieferte Teile betroffen" en="shipped parts affected ?" answer={d3.shipped.answer}>
                    <span className="ed-doc-delivery">
                      <span className="ed-doc-delivery-labels">
                        <span>Lieferschein Nr. / Delivery Note No:</span>
                        <span>Menge / Quantity:</span>
                      </span>
                      <span className="ed-doc-delivery-values">
                        <span>{d3.deliveryNoteNo}</span>
                        <span>{d3.quantity}</span>
                      </span>
                    </span>
                  </AffectedLine>
                </div>
        </>
      ),
    },
    {
      key: "containment",
      node: (
        <>
                <table className="ed-doc-table ed-doc-table--joined ed-doc-table--body">
                  <colgroup>
                    <col style={{ width: "49%" }} />
                    <col style={{ width: "12.8%" }} />
                    <col style={{ width: "12.8%" }} />
                    <col style={{ width: "25.4%" }} />
                  </colgroup>
                  <tbody>
                    <ActionSection
                      rows={d3.actions}
                      completionLabel="Completion date:"
                      heading={
                        <>
                          3 Sofortmaßnahme(n) / <span className="ed-doc-en">Containment Action(s):</span>
                        </>
                      }
                    />
                  </tbody>
                </table>
        </>
      ),
    },
    {
      key: "rootCause",
      node: (
        <>
                <table className="ed-doc-table ed-doc-table--joined ed-doc-table--body">
                  <tbody>
                    <tr>
                      <td className="ed-doc-top ed-doc-root-cause">
                        <span className="ed-doc-cell-head ed-doc-heading">
                          4. Fehlerursache(n) / <span className="ed-doc-en">Root cause(s):</span>
                        </span>
                        {d8.rootCause}
                      </td>
                    </tr>
                  </tbody>
                </table>
        </>
      ),
    },
    {
      key: "suggested",
      node: (
        <>
              <table className="ed-doc-table ed-doc-table--joined ed-doc-table--body">
                <colgroup>
                  <col style={{ width: "49%" }} />
                  <col style={{ width: "12.8%" }} />
                  <col style={{ width: "12.8%" }} />
                  <col style={{ width: "25.4%" }} />
                </colgroup>
                <tbody>
                  <ActionSection
                    rows={d8.suggested}
                    heading={
                      <>
                        5 Vorgeschlagene Abstellmaßnahmen /
                        <span className="ed-doc-label-line ed-doc-en">Corrective actions suggested:</span>
                      </>
                    }
                  />
                </tbody>
              </table>
        </>
      ),
    },
    {
      key: "implemented",
      node: (
        <>
              <table className="ed-doc-table ed-doc-table--joined ed-doc-table--body">
                <colgroup>
                  <col style={{ width: "49%" }} />
                  <col style={{ width: "12.8%" }} />
                  <col style={{ width: "12.8%" }} />
                  <col style={{ width: "25.4%" }} />
                </colgroup>
                <tbody>
                  <ActionSection
                    rows={d8.implemented}
                    heading={
                      <>
                        6. Eingeführte Abstellmaßnahmen. / <span className="ed-doc-en">Corrective actions introduced:</span>
                      </>
                    }
                  />
                </tbody>
              </table>
        </>
      ),
    },
    {
      key: "preventive",
      node: (
        <>
              <table className="ed-doc-table ed-doc-table--joined ed-doc-table--body">
                <colgroup>
                  <col style={{ width: "49%" }} />
                  <col style={{ width: "12.8%" }} />
                  <col style={{ width: "12.8%" }} />
                  <col style={{ width: "25.4%" }} />
                </colgroup>
                <tbody>
                  <ActionSection
                    rows={d8.preventive}
                    heading={
                      <>
                        7. Maßnahmen zur Verhinderung von Wiederholfehlern/
                        <span className="ed-doc-label-line ed-doc-en">Preventive actions:</span>
                      </>
                    }
                  />
                </tbody>
              </table>
              {/* The FMEA and follow-up lines belong to section 7 (they sit in
                  its card in the wizard), so they share its block and always
                  move between pages together with it. */}
                <table className="ed-doc-table ed-doc-table--joined ed-doc-table--body ed-doc-table--checks">
                  <colgroup>
                    <col style={{ width: "49%" }} />
                    <col style={{ width: "25.6%" }} />
                    <col style={{ width: "25.4%" }} />
                  </colgroup>
                  <tbody>
                    <CheckLine
                      de="FMEA-Überprüfung /"
                      en="FMEA-check:"
                      answer={d8.checks.fmeaCheck?.answer}
                      note="Begründung no/nr:"
                      value={d8.checks.fmeaCheck?.text}
                    />
                    <CheckLine
                      de="Aktualisierung erforderlich/"
                      en="FMEA-update:"
                      answer={d8.checks.fmeaUpdate?.answer}
                      note="Begründung no/nr:"
                      value={d8.checks.fmeaUpdate?.text}
                      last
                    />
                    <CheckLine
                      de="Produktionslenkungsplan aktualisiert /"
                      en="Control plan-update:"
                      answer={d8.checks.controlPlan?.answer}
                      value={d8.checks.controlPlan?.text}
                    />
                    <CheckLine
                      de="Prüfplan aktualisiert /"
                      en="inspection plan-update:"
                      answer={d8.checks.inspectionPlan?.answer}
                      value={d8.checks.inspectionPlan?.text}
                    />
                    <CheckLine
                      de="Sind andere Prozesse, Produkte betroffen"
                      en="Are other processes, products concerned:"
                      stacked
                      answer={d8.checks.otherProcesses?.answer}
                      value={d8.checks.otherProcesses?.text}
                      last
                    />
                  </tbody>
                </table>
        </>
      ),
    },
    {
      key: "feedback",
      node: (
        <>
                <table className="ed-doc-table ed-doc-table--joined ed-doc-table--body ed-doc-table--feedback">
                  <colgroup>
                    <col style={{ width: "27%" }} />
                    <col style={{ width: "34.6%" }} />
                    <col style={{ width: "38.4%" }} />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td colSpan={3}>
                        8: Feedback <span className="ed-doc-en">We congratulate the team.</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="ed-doc-top ed-doc-feedback">
                        <span className="ed-doc-label-line">Abschlussdatum / Verifiziert:</span>
                        <span className="ed-doc-label-line ed-doc-en">Date of closure / Verified:</span>
                        <span className="ed-doc-feedback-value">{d8.closureDate}</span>
                      </td>
                      <td className="ed-doc-top ed-doc-feedback">
                        <span className="ed-doc-label-line">
                          Name des Verantwortlichen, <span className="ed-doc-en">Name of person in charge:</span>
                        </span>
                        <span className="ed-doc-feedback-value">{d8.closurePerson}</span>
                        <span className="ed-doc-label-line">
                          Dieses Dokument wurde datentechnisch erstellt und ist ohne Unterschrift gültig
                        </span>
                      </td>
                      <td className="ed-doc-top ed-doc-feedback">
                        <span className="ed-doc-label-line">
                          Dieser 8D-Bericht gilt als bestätigt und angenommen, wenn kein Einspruch innerhalb von 5
                          Arbeitstagen erfolgt.
                        </span>
                        <span className="ed-doc-label-line ed-doc-en ed-doc-feedback-gap">
                          This 8D-Report will be regarded as accepted, should no rejection take place within 5 working days
                          after receipt of the document.
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p className="ed-doc-disclaimer">
                  Vorsorglich weisen wir darauf hin, dass die Firma Osteks, Haftung und Schadenersatz aufgrund von Sachmängeln
                  oder positiver Vertragsverletzung, ausschließlich im Rahmen der gesetzlichen Bestimmungen übernehmen. Kosten
                  für Nacharbeiten oder Sortierungen, welche im Rahmen von Nacherfüllungen durch unsere Kunden oder Dritte
                  durchgeführt wurden, werden von der Firma Osteks nur übernommen, wenn vorher eine schriftliche Zustimmung
                  durch einen Verantwortlichen der Osteks GmbH erfolgt ist. Pauschalen, die dem allgemeinen
                  Geschäftsrisiko-entsprechen, werden nicht übernommen
                </p>
        </>
      ),
    },
  ];

  // Measured pagination. Read each block's real height from
  // the offscreen measuring sheet and fill pages top to bottom; a block that
  // doesn't fit opens the next page (which then repeats the header and
  // footer). Runs whenever the printed data changes; the pages only update
  // when the split actually changes.
  const headerMeasureRef = useRef(null);
  const blockRefs = useRef([]);
  const [pages, setPages] = useState(() => [blocks.map((_, index) => index)]);
  useLayoutEffect(() => {
    const header = headerMeasureRef.current;
    if (!header) return;
    const top = PAGE_PADDING_TOP_PX + header.offsetHeight;
    const next = [];
    let current = [];
    let y = top;
    blocks.forEach((_, index) => {
      const height = blockRefs.current[index]?.offsetHeight ?? 0;
      if (current.length && y + height > CONTENT_BOTTOM_PX) {
        next.push(current);
        current = [];
        y = top + PAGE_START_EXTRA_PX;
      }
      current.push(index);
      y += height;
    });
    next.push(current);
    setPages((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    // The blocks are built from these three props alone, so their heights
    // can only change when one of them does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generalInfo, threeDInfo, eightDInfo]);

  // Word and Excel exports: the same content, split into pages exactly
  // where the preview splits them (the first block of every page after the
  // first).
  const exportInput = () => ({
    g: {
      ...g,
      complaintDate: formatDateDots(g.complaintDate),
      startDate: formatDateDots(g.startDate),
      statusDate: formatDateDots(g.statusDate),
    },
    d3,
    d8,
    pageStartKeys: pages.slice(1).map((page) => blocks[page[0]]?.key).filter(Boolean),
    pageCount: pages.length,
  });

  const saveBlob = (blob, extension) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileBaseName()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadWord = async () => saveBlob(await buildEightDDocx(exportInput()), "docx");
  const handleDownloadExcel = async () => saveBlob(await buildEightDXlsx(exportInput()), "xlsx");

  // Every download also saves the report (creates its 8D Report Overview
  // record the first time, updates it afterwards). The file is produced
  // first, so a failed save never costs the user the download; the save
  // error still reaches the button, which then shows its error state.
  const downloadAndSave = (download) => async () => {
    await download();
    await onSaveRecord?.();
  };

  const viewScale = manualZoom ?? pageScale;
  const scale = capturing ? 1 : viewScale;

  return (
    <div className="ed-doc-wrap">
      <div className="ed-doc-toolbar">
        <div className="ed-doc-zoom">
          <button
            type="button"
            className="ed-doc-zoom-btn"
            onClick={() => zoomBy(-ZOOM_STEP)}
            disabled={viewScale <= ZOOM_MIN}
            aria-label={t("eightD.zoomOut")}
            title={t("eightD.zoomOut")}
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            className="ed-doc-zoom-value"
            onClick={() => setManualZoom(null)}
            title={t("eightD.zoomReset")}
          >
            {Math.round(viewScale * 100)}%
          </button>
          <button
            type="button"
            className="ed-doc-zoom-btn"
            onClick={() => zoomBy(ZOOM_STEP)}
            disabled={viewScale >= ZOOM_MAX}
            aria-label={t("eightD.zoomIn")}
            title={t("eightD.zoomIn")}
          >
            <ZoomIn size={15} />
          </button>
        </div>

        <div className="ed-doc-downloads">
          <ProgressButton
            icon={FileDown}
            idleLabel={t("eightD.downloadPdf")}
            doneLabel={t("eightD.downloaded")}
            errorLabel={t("eightD.downloadError")}
            onRun={downloadAndSave(handleDownloadPdf)}
            className="eightd-btn eightd-btn--solid"
          />
          <ProgressButton
            icon={FileSpreadsheet}
            idleLabel={t("eightD.downloadExcel")}
            doneLabel={t("eightD.downloaded")}
            errorLabel={t("eightD.downloadError")}
            onRun={downloadAndSave(handleDownloadExcel)}
            className="eightd-btn eightd-btn--solid"
          />
          <ProgressButton
            icon={FileType2}
            idleLabel={t("eightD.downloadWord")}
            doneLabel={t("eightD.downloaded")}
            errorLabel={t("eightD.downloadError")}
            onRun={downloadAndSave(handleDownloadWord)}
            className="eightd-btn eightd-btn--solid"
          />
        </div>
      </div>

      <div className="ed-doc-surface" ref={surfaceRef}>
        {pages.map((pageBlocks, pageIndex) => (
          // Each sheet is scaled with a transform (which animates smoothly);
          // its wrapper takes the scaled size so the surface scrolls over
          // exactly the visible sheets.
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={pageIndex}
            className={`ed-doc-zoomer ${capturing ? "ed-doc-zoomer--capturing" : ""}`}
            style={{ width: A4_PAGE_WIDTH_PX * scale, height: A4_PAGE_HEIGHT_PX * scale }}
          >
            <div
              className={`ed-doc-page ${capturing ? "ed-doc-page--capturing" : ""}`}
              ref={(el) => {
                pageRefs.current[pageIndex] = el;
              }}
              style={{ transform: scale === 1 ? "none" : `scale(${scale})` }}
            >
              {pageHeader}
              {pageBlocks.map((blockIndex, position) => (
                <div
                  key={blocks[blockIndex].key}
                  className={`ed-doc-block ${pageIndex > 0 && position === 0 ? "ed-doc-block--page-start" : ""}`}
                >
                  {blocks[blockIndex].node}
                </div>
              ))}
              <footer className="ed-doc-footer">
                <span>QMD F3-0102</span>
                <span>Rev.Nr.: 3 vom 28.11.2018</span>
                <span>
                  Seite {pageIndex + 1} von {pages.length}
                </span>
              </footer>
            </div>
          </div>
        ))}
      </div>

      {/* Offscreen measuring sheet: the header and every block at true A4
          width, never shown, so the pagination effect can read each block's
          real height. */}
      <div className="ed-doc-page ed-doc-page--measure" aria-hidden="true">
        <div className="ed-doc-block" ref={headerMeasureRef}>
          {pageHeader}
        </div>
        {blocks.map((block, index) => (
          <div
            key={block.key}
            className="ed-doc-block"
            ref={(el) => {
              blockRefs.current[index] = el;
            }}
          >
            {block.node}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ViewReport;
