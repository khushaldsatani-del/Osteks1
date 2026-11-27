import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { X } from "lucide-react";

import UploadFile from "../components/Upload/UploadFile";
import ExtractionPreview from "../components/Extraction/ExtractionPreview";
import { parseOfferDetailsFields } from "../components/Calculation/extractionParser";
import { fetchKbSpecification } from "../components/Calculation/kbLookup";
import OfferBuilder from "../components/OfferBuilder/OfferBuilder";
import OfferLetterModal from "../components/OfferBuilder/OfferLetterModal";
import OfferErrorBoundary from "../components/OfferBuilder/OfferErrorBoundary";
import { useOfferStore, priceForLetter } from "../components/OfferBuilder/state/useOfferStore";
import { emptyKtlPart, emptyOffer, emptyPulverPart, isUntouchedPart } from "../components/OfferBuilder/state/offerState";
import { parseNum } from "../components/OfferBuilder/engine/format";
import { partFromExtraction, layerFromKb, normOf } from "../components/OfferBuilder/state/fromExtraction";
import { addressOf, docPreviewInput, isUsedPart } from "../components/OfferBuilder/letters/offerLetter";
import { useT } from "../components/OfferBuilder/i18n/languageContext";
import { createTestReport, deleteTestReport, getTestReportByDocumentId } from "../components/TestReport/testReportsApi";
import { CYCLE_DURATIONS } from "../components/TestReport/testReportConstants";
import { BACKEND_URL } from "../config";

// keep in sync with backend/main.py's MAX_IMAGE_SLOTS - drawings per offer
const MAX_IMAGES = 4;

// Key under which an offer from the builder is stored in its record's
// calculationData - tells "Open in Workspace" it can restore the offer as
// it was, instead of reading an older Calculation record.
const OFFER_BUILDER_KEY = "offerBuilder";

const NO_EXTRACTION = { status: "idle", fileName: "", summary: "", error: "" };

const jsonFetch = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json();
};

// An offer saved by the old Calculation / Offer Details forms, opened again:
// every stored drawing becomes a KTL part with what those forms knew - its
// name, drawing number, norm, layer, quantity, weight, surface and price -
// and the old Firma Information becomes the customer.
const legacyOffer = (data) => {
  const images = (data.images || []).slice().sort((a, b) => a.imageSlot - b.imageSlot);
  const offer = emptyOffer("ktl");
  const firma = data.firmaInfo || {};
  const positive = (v) => (Number(v) > 0 ? String(v) : "");
  offer.customer = { company: firma.companyName || "", person: firma.name || "", address: firma.address || "" };
  offer.offerNo = firma.offerNumber || "";
  offer.project = firma.projectName || "";
  offer.requestDate = firma.enquiryDate || "";
  offer.documentId = data.id;
  offer.parts = images.map((row) => {
    const calc = row.calculationData || {};
    const shown = row.offerDetailsValues || {};
    const extracted = parseOfferDetailsFields(row.extractionSummary);
    const price = Number(calc.offerPrice) > 0 ? calc.offerPrice : calc.kalkulierterPreis;
    return {
      ...emptyKtlPart(),
      name: shown.teilebezeichnung || extracted.teilebezeichnung || "",
      drawingNo: shown.zeichnungsnummer || extracted.zeichnungsnummer || "",
      paintSpec: shown.lackiervorschrift || extracted.lackiervorschrift || "",
      ...(calc.schichtdickeUm ? { layer: /[µμ]m/i.test(calc.schichtdickeUm) ? calc.schichtdickeUm : `${calc.schichtdickeUm} µm` } : {}),
      quantity: positive(calc.quantity),
      weightG: positive(calc.weightG),
      ...(Number(calc.thicknessMm) > 0 ? { thicknessMm: String(calc.thicknessMm) } : {}),
      surfaceMm2: positive(calc.surfaceAreaMm2),
      beizen: calc.beizenJN ? calc.beizenJN === "j" : true,
      guss: calc.gussteilJN === "j",
      maskingPoints: positive(calc.maskierungStueck) || "0",
      offerPrice: positive(price),
      documentId: row.id,
      extraction: {
        ...NO_EXTRACTION,
        status: row.extractionSummary ? "success" : "idle",
        fileName: row.fileName,
        summary: row.extractionSummary || "",
        source: row.fileKind === "email" ? "email" : "image",
      },
      kbSpecification: row.kbSpecification ?? null,
    };
  });
  if (!offer.parts.length) offer.parts = [emptyKtlPart()];
  offer.selectedId = offer.parts[0].id;
  return offer;
};

// Work Place: upload a drawing / email (left) beside what the AI read from
// it (right), then the KTL / Powder offer builder. Every uploaded drawing
// becomes a part of the open offer and fills it in; "View offer" opens
// Document Preview with its downloads; Save stores the offer, so All
// Documents lists it and "Open in Workspace" brings it back.
const Documents = ({ onDocumentsChanged, openDocumentId, onTestReportCreated }) => {
  const navigate = useNavigate();
  const { t, language } = useT();
  const store = useOfferStore();
  const { state, dispatch, offer, results, selected } = store;
  const process = state.process;
  const [layer, setLayer] = useState(null); // "details" | "settings" | "offer" | "preview"
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  // one line above the builder when something went wrong in the background
  // (drawing not stored, offer not found ...); the user closes it
  const [notice, setNotice] = useState(null);

  // Upload File runs a whole batch of files through one async loop whose
  // callbacks were created when the batch started - they read the offer
  // through this ref, never through a stale render's values.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // "Saved" turns back into "Save" as soon as the offer changes after it
  // (the first render after saving only takes note of the saved offer).
  const savedSnapshot = useRef(null);
  useEffect(() => {
    if (saveState !== "saved") return;
    if (savedSnapshot.current === null) savedSnapshot.current = state.offers;
    else if (savedSnapshot.current !== state.offers) setSaveState("idle");
  }, [state.offers, saveState]);

  // While a stored offer opened with "Open in Workspace" is still loading,
  // Extracted Drawing Details shows a loading state.
  const [hydrating, setHydrating] = useState(Boolean(openDocumentId));

  const updatePart = useCallback((id, changes) => dispatch({ type: "part", id, changes }), [dispatch]);
  const currentOffer = () => stateRef.current.offers[stateRef.current.process];
  const findPart = (id) => Object.values(stateRef.current.offers).flatMap((o) => o.parts).find((p) => p.id === id);

  // ---------- Related Email (staged until the first drawing is stored) ----------
  const [emailFile, setEmailFile] = useState(null);
  const [emailStatus, setEmailStatus] = useState("idle"); // idle | linking | linked | error
  const [emailError, setEmailError] = useState("");
  const emailFileRef = useRef(null);
  useEffect(() => {
    emailFileRef.current = emailFile;
  }, [emailFile]);

  // ---------- upload / extraction ----------
  // Which part each file of the current upload batch fills in, by its
  // position in the batch - fixed before the first file starts.
  const batchTargetsRef = useRef([]);
  const drawingsInOffer = (o) => o.parts.filter((p) => p.documentId || p.extraction?.status === "loading").length;

  // Before a batch: the open part takes the first file when nothing has
  // been entered for it yet (or its last upload failed); every further
  // file gets a new part, up to the 4 drawings an offer can store.
  // `reuseActiveSlot` (email path) lets the open part take the file again
  // when the email flow calls this a second time with the real part count.
  const handleBatchStart = (count, { reuseActiveSlot = false } = {}) => {
    const o = currentOffer();
    const proc = stateRef.current.process;
    const open = o.parts.find((p) => p.id === o.selectedId) ?? o.parts[0];
    const targets = [];
    const reusable =
      open && (reuseActiveSlot || isUntouchedPart(proc, open) || (!open.documentId && open.extraction?.status === "error"));
    if (reusable) targets.push(open.id);

    const fresh = [];
    let room = MAX_IMAGES - drawingsInOffer(o);
    while (targets.length < count && room > 0) {
      const part = proc === "ktl" ? emptyKtlPart() : emptyPulverPart();
      fresh.push(part);
      targets.push(part.id);
      room -= 1;
    }
    if (fresh.length) dispatch({ type: "addParts", parts: fresh });
    batchTargetsRef.current = targets;
  };

  const handleExtractionStart = (fileName, index = 0) => {
    const id = batchTargetsRef.current[index];
    if (!id) return;
    updatePart(id, { documentId: null, extraction: { status: "loading", fileName, summary: "", error: "", stepStartedAt: Date.now() } });
    // only the first file of a batch opens its tab - later ones fill in
    // their parts in the background without pulling the user away
    if (index === 0) dispatch({ type: "select", id });
  };

  // A drawing is stored (and an email linked) only once its extraction has
  // succeeded. Its values fill the part in; the standards lookup for its
  // norm runs alongside and never holds the result up.
  const handleExtractionResult = async (summary, meta, index = 0) => {
    const id = batchTargetsRef.current[index];
    if (!id) return;
    const proc = Object.entries(stateRef.current.offers).find(([, o]) => o.parts.some((p) => p.id === id))?.[0] ?? stateRef.current.process;
    const changes = partFromExtraction(proc, summary);
    const hasOwnLayer = "layer" in changes;

    updatePart(id, (part) => ({
      ...changes,
      extraction: { ...part.extraction, status: "success", summary, error: "", source: meta?.fileKind === "email" ? "email" : "image" },
    }));
    // a later drawing of an upload whose email was already read
    applyEmailQuantities(proc);

    const norm = parseOfferDetailsFields(summary).lackiervorschrift;
    const kbPromise = fetchKbSpecification(norm).then((result) => {
      if (result) {
        const layerFromNorm = proc === "ktl" && !hasOwnLayer ? layerFromKb(result) : undefined;
        updatePart(id, { kbSpecification: result, ...(layerFromNorm ? { layer: layerFromNorm } : {}) });
      }
      return result;
    });

    // the part may have been removed while its drawing was being read -
    // then there is nothing to store it for
    if (!findPart(id)) return;

    // the offer's first stored drawing is its record; later ones hang
    // under it as further images (slots 2-4)
    const o = stateRef.current.offers[proc];
    const parentId = o.documentId;
    const childSlot = o.parts.filter((p) => p.documentId && p.documentId !== parentId).length + 2;
    if (parentId && childSlot > MAX_IMAGES) {
      setNotice("drawingLimit");
      return;
    }
    let createdId = null;
    try {
      const created = await jsonFetch(`${BACKEND_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: meta?.fileName || findPart(id)?.extraction?.fileName,
          fileKind: meta?.fileKind || null,
          extractionSummary: summary,
          parentDocumentId: parentId ?? undefined,
          imageSlot: parentId ? childSlot : 1,
        }),
      });
      createdId = created.id;
      updatePart(id, { documentId: createdId });
      if (!parentId) dispatch({ type: "offerIn", process: proc, changes: { documentId: createdId } });
      onDocumentsChanged?.();

      kbPromise.then((result) => {
        if (!result) return;
        fetch(`${BACKEND_URL}/api/documents/${createdId}/specification`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kbSpecification: result }),
        })
          .then(() => onDocumentsChanged?.())
          .catch(() => {
            // the part keeps its norm; All Documents just shows it after the next Save
          });
      });
    } catch {
      // backend unreachable - the part is filled in anyway and stored with
      // the next Save; the user is told so
      setNotice("drawingNotStored");
      return;
    }

    // the email belongs to the offer's record (its first drawing)
    if (parentId) return;
    const stagedEmailFile = emailFileRef.current;
    if (!stagedEmailFile || !createdId) return;
    setEmailStatus("linking");
    setEmailError("");
    let emailId = null;
    try {
      const formData = new FormData();
      formData.append("email", stagedEmailFile);
      formData.append("document_id", String(createdId));
      const response = await fetch(`${BACKEND_URL}/api/emails/upload`, { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not attach this email.");
      setEmailStatus("linked");
      setEmailFile(null);
      emailId = data.id;
      onDocumentsChanged?.();
      // the enquiry date comes from the email's own Date header - only
      // when it is still empty
      if (data.date && !stateRef.current.offers[proc].requestDate) {
        dispatch({ type: "offerIn", process: proc, changes: { requestDate: data.date.slice(0, 10) } });
      }
    } catch (err) {
      setEmailStatus("error");
      setEmailError(err.message || "Could not attach this email.");
      return;
    }
    if (emailId) await readEnquiryEmail(proc, emailId, createdId);
  };

  // The quantities the enquiry email gives per part, kept for the offer
  // record they were read for: drawings of the same upload that are read
  // after the email get theirs as soon as their part number is known.
  const emailQuantitiesRef = useRef(null);
  const applyEmailQuantities = (proc) => {
    const kept = emailQuantitiesRef.current;
    if (!kept || kept.process !== proc || stateRef.current.offers[proc].documentId !== kept.documentId) return;
    dispatch({ type: "emailQuantities", process: proc, quantities: kept.parts, single: kept.single });
  };

  // Company, contact person, address and each part's quantity from the
  // stored email, read by the AI (the user's choice) - only into fields
  // that are still empty, so nothing typed is overwritten. Awaited by the
  // upload, so the next drawing waits: AI requests run one at a time.
  const readEnquiryEmail = async (proc, emailId, documentId) => {
    const isEmpty = () => {
      const c = stateRef.current.offers[proc].customer;
      return { company: !c.company?.trim(), person: !c.person?.trim(), address: !addressOf(c).trim() };
    };
    try {
      const found = await jsonFetch(`${BACKEND_URL}/api/emails/${emailId}/enquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      emailQuantitiesRef.current = {
        process: proc,
        documentId,
        parts: Array.isArray(found?.parts) ? found.parts : [],
        // one drawing in this upload: a single quantity in the email is its own
        single: batchTargetsRef.current.length === 1,
      };
      applyEmailQuantities(proc);
      // read again: the user may have typed while the AI was reading
      const empty = isEmpty();
      const fills = Object.fromEntries(["company", "person", "address"].filter((key) => empty[key] && found?.[key]).map((key) => [key, found[key]]));
      if (!Object.keys(fills).length) return;
      const customer = stateRef.current.offers[proc].customer;
      dispatch({ type: "offerIn", process: proc, changes: { customer: { ...customer, ...fills } } });
    } catch {
      setNotice("customerNotRead");
    }
  };

  // A failed extraction stores nothing; the staged email waits for the next upload.
  const handleExtractionError = (error, index = 0) => {
    const id = batchTargetsRef.current[index];
    if (!id) return;
    updatePart(id, (part) => ({ extraction: { ...(part.extraction ?? NO_EXTRACTION), status: "error", summary: "", error } }));
  };

  // ---------- Test Report ("Test erforderlich" in the offer letter) ----------
  // Whether the open part's drawing already has a Test Report - asked again
  // whenever another drawing is opened.
  useEffect(() => {
    const { id, documentId } = selected;
    if (!documentId) return undefined;
    let cancelled = false;
    getTestReportByDocumentId(documentId)
      .then((report) => !cancelled && updatePart(id, { hasTestReport: !!report, testReportId: report?.id ?? null }))
      .catch(() => {
        // backend unreachable - the checkbox keeps its last known state
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.documentId]);

  // Checking it creates a Test Report draft for the open part's drawing,
  // filled with its name, drawing number and norm (and the norm's cycle
  // count, if the standards library knows it); unchecking deletes it again.
  const handleTestRequiredChange = async (checked) => {
    const part = selected;
    if (!part.documentId) return;
    if (!checked) {
      updatePart(part.id, { hasTestReport: false, testReportId: null });
      if (part.testReportId) {
        try {
          await deleteTestReport(part.testReportId);
          onTestReportCreated?.();
        } catch {
          // best effort - the checkbox already shows the choice
        }
      }
      return;
    }
    const norm = normOf(part);
    const drawingNo = part.drawingNo || part.customerArticleNo || parseOfferDetailsFields(part.extraction?.summary).zeichnungsnummer || "";
    let durationCycles = "60";
    try {
      const kbSpec = await fetchKbSpecification(norm);
      const cycles = (kbSpec?.keyFacts || [])
        .filter((fact) => fact.label === "cyclic_corrosion_cycles")
        .map((fact) => Number(fact.value))
        .filter((n) => Number.isFinite(n) && CYCLE_DURATIONS.includes(n));
      if (cycles.length) durationCycles = String(Math.max(...cycles));
    } catch {
      // keep the default duration
    }
    try {
      const created = await createTestReport({
        documentId: part.documentId,
        testObject: part.name || "",
        norm,
        wizardState: {
          reportInfo: { testObjectPart: part.name || "" },
          subjectTask: { testSample: part.name || "", drawingNo, surfaceProtectionType: norm },
          durationCycles,
        },
      });
      updatePart(part.id, { hasTestReport: true, testReportId: created.id });
      onTestReportCreated?.();
    } catch {
      // best effort - the offer does not depend on it
    }
  };

  // ---------- Save ----------
  // The offer is stored on its record (the first drawing's row, or a new
  // one): the whole builder offer for "Open in Workspace", plus the first
  // part's price / quantity / norm and the customer for All Documents.
  // Every other part with a drawing gets its own price on its own row.
  const recordFields = (proc, o, part, isRecord) => {
    const res = results[part.id] ?? null;
    const preview = docPreviewInput(proc, { ...o, parts: [part] }, { [part.id]: res }, language, t);
    return {
      norm: normOf(part) || "—",
      customerName: isRecord ? o.customer.company || "—" : "—",
      customerNumber: isRecord ? o.offerNo || "—" : "—",
      pricePerStk: priceForLetter(part, res) || 0,
      annualQuantity: Math.round(parseNum(part.quantity)) || 0,
      offerDetailsRows: preview.offerDetailsRowsList[0],
      offerDetailsValues: null,
      kbSpecification: part.kbSpecification ?? null,
    };
  };

  const handleSave = async () => {
    const proc = stateRef.current.process;
    const o = stateRef.current.offers[proc];
    const parts = o.parts.filter(isUsedPart);
    const first = parts[0] ?? o.parts[0];
    const json = (body) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaveState("saving");
    try {
      let recordId = o.documentId;
      if (!recordId) {
        const created = await jsonFetch(`${BACKEND_URL}/api/documents`, {
          method: "POST",
          ...json({ fileName: first.extraction?.fileName || first.name || t("app.title"), imageSlot: 1 }),
        });
        recordId = created.id;
        // remembered at once: if a later step of this save fails, saving
        // again updates this record instead of creating a second one
        dispatch({ type: "offerIn", process: proc, changes: { documentId: recordId } });
      }
      const preview = docPreviewInput(proc, o, results, language, t);
      const record = await jsonFetch(`${BACKEND_URL}/api/documents/${recordId}`, {
        method: "PATCH",
        ...json({
          ...recordFields(proc, o, first, true),
          // only used if the record has to be stored anew (see below)
          fileName: first.extraction?.fileName || first.name || t("app.title"),
          extractionSummary: first.extraction?.summary || null,
          firmaInfo: preview.firmaInfo,
          calculationData: {
            [OFFER_BUILDER_KEY]: { version: 1, process: proc, offer: { ...o, documentId: recordId } },
            kalkulierterPreis: results[first.id]?.calculatedPrice ?? null,
            quantity: first.quantity ?? "",
          },
        }),
      });
      // A record deleted in All Offers while it was open is stored anew by
      // the backend, under a new number - the offer follows it there.
      if (record?.id && record.id !== recordId) {
        if (first.documentId === recordId) updatePart(first.id, { documentId: record.id });
        recordId = record.id;
        dispatch({ type: "offerIn", process: proc, changes: { documentId: recordId } });
      }
      let slot = 1;
      for (const part of o.parts) {
        if (!part.documentId || part.documentId === recordId || part.documentId === o.documentId) continue;
        slot = Math.min(MAX_IMAGES, slot + 1);
        // eslint-disable-next-line no-await-in-loop
        const row = await jsonFetch(`${BACKEND_URL}/api/documents/${part.documentId}`, {
          method: "PATCH",
          ...json({
            ...recordFields(proc, o, part, false),
            // a drawing deleted meanwhile is stored anew as this offer's image
            fileName: part.extraction?.fileName || part.name || t("app.title"),
            extractionSummary: part.extraction?.summary || null,
            parentDocumentId: recordId,
            imageSlot: slot,
            firmaInfo: {},
            calculationData: { [`${OFFER_BUILDER_KEY}Part`]: { process: proc, partId: part.id }, kalkulierterPreis: results[part.id]?.calculatedPrice ?? null },
          }),
        });
        if (row?.id && row.id !== part.documentId) updatePart(part.id, { documentId: row.id });
      }
      onDocumentsChanged?.();
      savedSnapshot.current = null;
      setSaveState("saved");
      setNotice((current) => (current === "saveFailed" ? null : current));
      // the saved offer gets its own address, so the sidebar and a reload
      // open it again
      if (openDocumentId !== recordId) navigate(`/workplace/${recordId}`, { replace: true });
    } catch {
      setSaveState("error");
      setNotice("saveFailed");
    }
  };


  // ---------- "Open in Workspace" ----------
  useEffect(() => {
    if (!openDocumentId) {
      setHydrating(false);
      return undefined;
    }
    // already open (e.g. just saved) - nothing to load
    if (Object.values(stateRef.current.offers).some((o) => o.documentId === openDocumentId)) {
      setHydrating(false);
      return undefined;
    }
    setHydrating(true);
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/documents/${openDocumentId}`);
        if (cancelled) return;
        if (response.status === 404) {
          // deleted in All Offers (or a mistyped address): say so and start empty
          setNotice("offerNotFound");
          navigate("/", { replace: true });
          return;
        }
        if (!response.ok) throw new Error(`${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        const stored = data.calculationData?.[OFFER_BUILDER_KEY];
        if (stored?.offer) {
          const ids = new Map((data.images || []).map((row) => [row.id, row]));
          const restored = {
            ...stored.offer,
            documentId: data.id,
            // a drawing deleted in All Documents is no longer linked
            parts: stored.offer.parts.map((p) => (p.documentId && !ids.has(p.documentId) ? { ...p, documentId: null } : p)),
          };
          dispatch({ type: "load", process: stored.process === "pulver" ? "pulver" : "ktl", offer: restored });
        } else {
          dispatch({ type: "load", process: "ktl", offer: legacyOffer(data) });
        }
      } catch {
        // backend unreachable - the workspace stays as it was, and says so
        if (!cancelled) setNotice("offerNotLoaded");
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocumentId]);

  const handleNewOffer = () => {
    dispatch({ type: "newOffer" });
    setEmailFile(null);
    setEmailStatus("idle");
    setEmailError("");
    setSaveState("idle");
    if (openDocumentId) navigate("/", { replace: true });
  };

  const extraction = selected.extraction ?? NO_EXTRACTION;
  const preview = layer === "preview" ? docPreviewInput(process, offer, results, language, t) : null;

  return (
    <main className="documents-page">
      <div className="upload-section">
        {/* Upload File + Related Email - one stable drop zone for the whole
            offer; up to 4 drawings at once, each fills in its own part. */}
        <UploadFile
          onExtractionStart={handleExtractionStart}
          onExtractionResult={handleExtractionResult}
          onExtractionError={handleExtractionError}
          onBatchStart={handleBatchStart}
          maxFiles={Math.max(1, MAX_IMAGES - drawingsInOffer(offer))}
          hasImageSource={offer.parts.some((p) => p.extraction?.source === "image" && p.extraction?.status !== "idle")}
          emailFile={emailFile}
          onEmailFileChange={setEmailFile}
          emailStatus={emailStatus}
          emailError={emailError}
        />

        {/* What the AI read from the open part's drawing */}
        <ExtractionPreview
          status={extraction.status}
          fileName={extraction.fileName}
          summary={extraction.summary}
          error={extraction.error}
          stepStartedAt={extraction.stepStartedAt}
          hydrating={hydrating}
        />
      </div>

      {notice && (
        <div className="ob-notice" role="alert">
          <span>{t(`notice.${notice}`)}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={t("notice.close")}>
            <X size={15} />
          </button>
        </div>
      )}

      <OfferErrorBoundary onReset={handleNewOffer}>
        <OfferBuilder
        store={store}
        layer={layer}
        onLayer={setLayer}
        onViewOffer={() => setLayer("preview")}
        onNewOffer={handleNewOffer}
        onSave={handleSave}
        saveState={saveState}
      />
      </OfferErrorBoundary>

      {preview && (
        <OfferLetterModal
          {...preview}
          onTestRequiredChange={handleTestRequiredChange}
          testRequired={!!selected.hasTestReport}
          onClose={() => setLayer(null)}
        />
      )}
    </main>
  );
};

export default Documents;
