import React, { useRef, useState } from "react";
import { FileText, Download, FileType2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  LETTERHEAD,
  RETURN_ADDRESS,
  RECIPIENT_LINES,
  CONTACT_ROWS,
  getTodayDateLine,
  HEADING_ROWS,
  SALUTATION,
  INTRO_LINES,
  SPEC_FIELD_ROWS,
  PAGE1_DISCLAIMER,
  PAGE2_BOLD_PARAGRAPHS,
  TERMS_ROWS,
  CLOSING_LINE,
} from "./docPreviewContent";
import { buildDocxBlob } from "./buildDocx";
import "./docPreview.css";

// Layout, spacing and field order match the reference "Angebot" PDF exactly.
// Most content is still static sample data from docPreviewContent.js.
// Projekt, the recipient address, and Angebot Nr. are wired to real Firma
// Information values (via the `firmaInfo` prop), falling back to the static
// sample whenever the corresponding field hasn't been filled in yet, so the
// preview never looks half-empty by default. The pricing/details block is
// different on purpose: it's driven entirely by `offerDetailsRows` (already
// ordered and filtered to non-empty fields by OfferDetails) with no static
// fallback — a partially-filled Offer Details form shows partial rows here,
// not placeholder sample rows for the rest.
const DocPreview = ({ firmaInfo = {}, offerDetailsRows = [] }) => {
  const [specMode, setSpecMode] = useState("with");
  const [downloading, setDownloading] = useState(false);
  const surfaceRef = useRef(null);

  // Address is entered as one line per line of the address (a textarea, not
  // a single-line input, specifically so this split is possible) — falls
  // back to the static sample recipient block until something's typed.
  const recipientLines = firmaInfo.address?.trim()
    ? firmaInfo.address
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : RECIPIENT_LINES;

  const headingRows = [
    ["Projekt", firmaInfo.companyName?.trim() ? firmaInfo.companyName : HEADING_ROWS[0][1]],
    ["Angebot Nr.", firmaInfo.offerNumber?.trim() ? firmaInfo.offerNumber : HEADING_ROWS[1][1]],
  ];

  const dateLine = getTodayDateLine();

  // PDF export rasterizes the actual rendered pages — a PDF is expected to
  // be a faithful visual snapshot, so a screenshot-per-page is the right
  // tool here and guarantees pixel-for-pixel match with the preview.
  // JPEG at high quality instead of PNG — lossless PNG of a full
  // anti-aliased text page runs to 10+ MB per page; JPEG compresses the
  // mostly-white page down to a few hundred KB with no visible quality loss.
  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const pageEls = surfaceRef.current.querySelectorAll(".dp-page");
      const pdf = new jsPDF({ unit: "px", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();

      let index = 0;
      for (const pageEl of pageEls) {
        // eslint-disable-next-line no-await-in-loop
        const canvas = await html2canvas(pageEl, { scale: 2, backgroundColor: "#ffffff" });
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        if (index > 0) pdf.addPage();
        pdf.addImage(dataUrl, "JPEG", 0, 0, pdfWidth, pdfHeight);
        index += 1;
      }

      pdf.save("Angebot.pdf");
    } finally {
      setDownloading(false);
    }
  };

  // Doc export builds a real .docx binary (via the `docx` library), not a
  // picture of the page or an HTML approximation — the header/footer are
  // genuine OOXML section headers, so Word repeats them on every page by
  // construction, and the file opens as actual editable text.
  const handleDownloadDoc = async () => {
    const blob = await buildDocxBlob(specMode, { recipientLines, headingRows, offerDetailsRows });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Angebot.docx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="docpreview-card">
      <div className="docpreview-card-header">
        <span className="docpreview-card-icon">
          <FileText size={16} />
        </span>
        <h3 className="docpreview-card-title">Document Preview</h3>

        <div className="docpreview-actions">
          <button type="button" className="docpreview-btn" onClick={handleDownloadDoc}>
            <FileType2 size={14} />
            Download as Doc
          </button>

          <button
            type="button"
            className="docpreview-btn docpreview-btn--solid"
            onClick={handleDownloadPdf}
            disabled={downloading}
          >
            <Download size={14} />
            Download as PDF
          </button>
        </div>
      </div>

      <div className="docpreview-spec-toggle">
        <label className="docpreview-radio">
          <input
            type="radio"
            name="docpreview-spec"
            checked={specMode === "with"}
            onChange={() => setSpecMode("with")}
          />
          With Specification
        </label>

        <label className="docpreview-radio">
          <input
            type="radio"
            name="docpreview-spec"
            checked={specMode === "without"}
            onChange={() => setSpecMode("without")}
          />
          Without Specification
        </label>
      </div>

      <div className="docpreview-surface" ref={surfaceRef}>
        {/* ===================== PAGE 1 ===================== */}
        <div className="dp-page">
          <div className="dp-letterhead">
            <div className="dp-letterhead-company">{LETTERHEAD.company}</div>
            <div className="dp-letterhead-sub">{LETTERHEAD.sub}</div>
          </div>

          <div className="dp-return-address">{RETURN_ADDRESS}</div>

          <div className="dp-recipient">
            {recipientLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>

          <div className="dp-contact">
            {CONTACT_ROWS.map(([label, value]) => (
              <div key={label}>
                {label}
                <span>{value}</span>
              </div>
            ))}
          </div>

          <div className="dp-date">{dateLine}</div>

          {headingRows.map(([label, value]) => (
            <div className="dp-heading-row" key={label}>
              <span className="dp-heading-label">{label}</span>
              <span>{value}</span>
            </div>
          ))}

          <p className="dp-salutation">{SALUTATION}</p>

          <p className="dp-para">
            {INTRO_LINES.map((line, i) => (
              <React.Fragment key={line}>
                {i > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </p>

          {specMode === "with" && (
            <div className="dp-fieldlist">
              {SPEC_FIELD_ROWS.map(([label, lines]) => (
                <div className="dp-field-row" key={label}>
                  <span className="dp-field-label">{label}</span>
                  <span className="dp-field-value">
                    {lines.map((line, i) => (
                      <React.Fragment key={line}>
                        {i > 0 && <br />}
                        {line}
                      </React.Fragment>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}

          {offerDetailsRows.length > 0 && (
            <div className="dp-pricing-block">
              {offerDetailsRows.map(([label, value]) => (
                <div className="dp-pricing-row" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          )}

          <p className="dp-para dp-bold">{PAGE1_DISCLAIMER}</p>

          <div className="dp-page-number">1</div>
        </div>

        {/* ===================== PAGE 2 ===================== */}
        <div className="dp-page">
          <div className="dp-letterhead dp-letterhead--small">
            <div className="dp-letterhead-company dp-letterhead-company--small">{LETTERHEAD.company}</div>
            <div className="dp-letterhead-sub">{LETTERHEAD.sub}</div>
          </div>

          {PAGE2_BOLD_PARAGRAPHS.map((text, i) => (
            <p className={`dp-para dp-bold ${i === 0 ? "dp-para--first" : ""}`} key={text}>
              {text}
            </p>
          ))}

          <div className="dp-fieldlist dp-fieldlist--terms">
            {TERMS_ROWS.map(([label, value]) => (
              <div className="dp-field-row" key={label}>
                <span className="dp-field-label">{label}</span>
                <span className="dp-field-value">{value}</span>
              </div>
            ))}
          </div>

          <p className="dp-para">{CLOSING_LINE}</p>

          <div className="dp-page-number">2</div>
        </div>
      </div>
    </div>
  );
};

export default DocPreview;
