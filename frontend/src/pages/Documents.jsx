import React, { useEffect, useMemo, useState } from "react";

import UploadFile from "../components/Upload/UploadFile";
import EmailAttach from "../components/Upload/EmailAttach";
import UploadedFilesTable from "../components/Upload/UploadedFilesTable";
import ExtractionPreview from "../components/Extraction/ExtractionPreview";
import Calculation from "../components/Calculation/Calculation";
import { parseOfferDetailsFields } from "../components/Calculation/extractionParser";
import OfferDetails from "../components/OfferDetails/OfferDetails";
import DocPreview from "../components/DocPreview/DocPreview";
import { BACKEND_URL } from "../config";

const Documents = ({ onDocumentsChanged }) => {
  // Schichtdicke, Jahresmenge, Preis Beschichtung and Preis Maskierung in
  // Offer Details mirror Extracted Details / Pricing Analysis in
  // Calculation — this holds the latest values so both sections stay equal.
  const [syncedOfferFields, setSyncedOfferFields] = useState({});

  // Temporary: result of the backend drawing-extraction call, triggered by
  // UploadFile whenever a file is selected/dropped. See backend/README.md.
  const [extraction, setExtraction] = useState({ status: "idle", fileName: "", summary: "", error: "" });

  // The database row id for the document created right after a successful
  // extraction (see handleExtractionResult) — null until then. EmailAttach
  // only becomes usable once this exists (an email can only be linked to an
  // already-created document), and Calculation's Save updates this same row
  // rather than creating a new one.
  const [documentId, setDocumentId] = useState(null);

  // Company Name / Address / Offer Number from Firma Information, fed into
  // Document Preview's Projekt / recipient address / Angebot Nr.
  const [firmaInfo, setFirmaInfo] = useState({});

  // Offer Details' filled-in fields (label/value pairs, already ordered and
  // filtered to non-empty ones by OfferDetails itself), fed into Document
  // Preview's pricing/details block.
  const [offerDetailsRows, setOfferDetailsRows] = useState([]);

  // Teilebezeichnung / Zeichnungsnummer / Lackiervorschrift in Offer Details
  // auto-fill from the AI extraction's Part Name / Part Number / Surface
  // Treatment — parsed straight from the extraction summary, not sourced
  // from Calculation like syncedOfferFields above.
  const extractedOfferFields = useMemo(
    () => parseOfferDetailsFields(extraction.summary),
    [extraction.summary]
  );

  // Uploaded Files table — one row per successful extraction in this
  // session. The underlying record is DB-backed (see handleExtractionResult
  // below); this local list just drives the workspace widget's display.
  const [uploadedFiles, setUploadedFiles] = useState([]);

  useEffect(() => {
    if (extraction.status !== "success") return;

    const parsed = parseOfferDetailsFields(extraction.summary);
    const today = new Date();
    const uploadedDate = [
      String(today.getDate()).padStart(2, "0"),
      String(today.getMonth() + 1).padStart(2, "0"),
      today.getFullYear(),
    ].join("-");

    setUploadedFiles((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        fileName: extraction.fileName,
        norm: parsed.lackiervorschrift || "—",
        drawingNumber: parsed.zeichnungsnummer || "—",
        uploadedDate,
      },
    ]);
  }, [extraction.status, extraction.summary, extraction.fileName]);

  // Calculation's Save button updates (never re-creates) the document row
  // that was created right after extraction succeeded. If somehow no
  // document exists yet (Save clicked before any upload), one is created
  // first so Save always works exactly as it did before the database was
  // wired in.
  const handleCalculationSave = async (payload) => {
    const parsed = parseOfferDetailsFields(extraction.summary);
    const fields = {
      fileName: extraction.fileName || "Untitled",
      extractionSummary: extraction.summary || null,
      norm: parsed.lackiervorschrift || "—",
      customerName: firmaInfo.companyName || "—",
      customerNumber: firmaInfo.offerNumber || "—",
      pricePerStk: Number(payload.kalkulierterPreis) || 0,
      annualQuantity: Number(payload.quantity) || 0,
      firmaInfo,
      calculationData: payload,
      offerDetailsRows,
    };

    try {
      let id = documentId;
      if (!id) {
        const created = await fetch(`${BACKEND_URL}/api/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: fields.fileName, extractionSummary: fields.extractionSummary }),
        }).then((res) => res.json());
        id = created.id;
        setDocumentId(id);
      }

      await fetch(`${BACKEND_URL}/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      onDocumentsChanged?.();
    } catch {
      // Backend/database unreachable — Calculation's own "Saved" indicator
      // still shows locally; the row just won't appear in All Documents
      // until the backend is back.
    }
  };

  const handleExtractionStart = (fileName) => {
    setDocumentId(null);
    setExtraction({ status: "loading", fileName, summary: "", error: "" });
  };

  const handleExtractionResult = async (summary, meta) => {
    setExtraction((prev) => ({ ...prev, status: "success", summary, error: "" }));

    try {
      const created = await fetch(`${BACKEND_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: meta?.fileName || extraction.fileName,
          fileKind: meta?.fileKind || null,
          extractionSummary: summary,
        }),
      }).then((res) => res.json());
      setDocumentId(created.id);
      onDocumentsChanged?.();
    } catch {
      // Backend/database unreachable — extraction result still displays;
      // it just won't be persisted (or attachable to an email) until the
      // backend is back.
    }
  };

  const handleExtractionError = (error) => setExtraction((prev) => ({ ...prev, status: "error", summary: "", error }));

  return (
    <main className="documents-page">
      <div className="upload-section">
        {/* Left: Upload File */}
        <UploadFile
          extractionStatus={extraction.status}
          onExtractionStart={handleExtractionStart}
          onExtractionResult={handleExtractionResult}
          onExtractionError={handleExtractionError}
        />

        {/* Right: Uploaded Files Table */}
        <UploadedFilesTable files={uploadedFiles} />
      </div>

      {/* Storage-only companion to Upload File — never sent to AI, only
          linked to the document created above. */}
      <EmailAttach documentId={documentId} onLinked={onDocumentsChanged} />

      {/* Temporary: AI-extracted summary of the uploaded drawing */}
      <ExtractionPreview
        status={extraction.status}
        fileName={extraction.fileName}
        summary={extraction.summary}
        error={extraction.error}
      />

      {/* Calculation: Firma Info + Extracted Details (left) /
          Revenue + Pricing + Info (right) */}
      <Calculation
        onSyncOfferFields={setSyncedOfferFields}
        onFirmaInfoChange={setFirmaInfo}
        extractionSummary={extraction.summary}
        onSave={handleCalculationSave}
      />

      {/* Offer Details — below the calculation section */}
      <OfferDetails
        syncedFields={syncedOfferFields}
        extractedFields={extractedOfferFields}
        onOfferDetailsChange={setOfferDetailsRows}
      />

      {/* Document Preview — below Offer Details */}
      <DocPreview firmaInfo={firmaInfo} offerDetailsRows={offerDetailsRows} />
    </main>
  );
};

export default Documents;
