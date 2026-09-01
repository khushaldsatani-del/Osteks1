import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import UploadFile from "../components/Upload/UploadFile";
import UploadedFilesTable from "../components/Upload/UploadedFilesTable";
import ExtractionPreview from "../components/Extraction/ExtractionPreview";
import Calculation from "../components/Calculation/Calculation";
import {
  initialState as calculationInitialValues,
  AUTO_SYNC_FIELD_NAMES,
  computeCalcResults,
  deriveSyncedOfferFields,
} from "../components/Calculation/calculationDefaults";
import { parseExtractionSummary, parseOfferDetailsFields } from "../components/Calculation/extractionParser";
import { fetchKbSpecification } from "../components/Calculation/kbLookup";
import OfferDetails from "../components/OfferDetails/OfferDetails";
import { buildOfferDetailsRows, computePreisGesamt } from "../components/OfferDetails/offerDetailsRows";
import DocPreview from "../components/DocPreview/DocPreview";
import { BACKEND_URL } from "../config";

const MAX_IMAGES = 4;

function formatDMY(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    date.getFullYear(),
  ].join("-");
}

// One offer can hold up to 4 independently uploaded/extracted/calculated
// images (drawings). Each slot carries everything that used to be a single
// flat state in this component — its own extraction result, its own
// database row id, its own Calculation/OfferDetails state — so switching
// the active slot never bleeds one image's data into another's.
const makeEmptySlot = (slot) => ({
  slot,
  documentId: null,
  extraction: { status: "idle", fileName: "", summary: "", error: "" },
  // Seeded/reported by Calculation via initialCalcState/onCalcStateChange —
  // null until that slot's first extraction succeeds.
  calcState: null,
  // Seeded/reported by OfferDetails via initialValues/onValuesChange.
  offerValues: null,
  syncedOfferFields: {},
  offerDetailsRows: [],
  // Condensed Standards-KB match for this slot's detected norm/spec text
  // (see kbLookup.js) — null until/unless one resolves. Powers All
  // Documents' "Specification" column and the Schichtdicke auto-fill
  // fallback below; never required for the rest of the workflow to work.
  kbSpecification: null,
});

const Documents = ({ onDocumentsChanged, openDocumentId }) => {
  const [images, setImages] = useState([makeEmptySlot(1)]);
  const [activeSlot, setActiveSlot] = useState(1);

  // True for the brief window between "Open in Workspace" being clicked
  // and its GET /api/documents/{id} actually resolving — this component
  // mounts fresh every time (App.jsx only renders one page at a time), so
  // openDocumentId is already set on the very first render, before the
  // hydration effect below has had a chance to run at all. Seeding this
  // from that same prop (rather than starting at false) means the loading
  // state is visible from the first paint, not a flash of empty defaults
  // that then jumps to loading a moment later.
  const [hydrating, setHydrating] = useState(Boolean(openDocumentId));

  // Bumped every time "Open in Workspace" hydration finishes applying its
  // data. Calculation/OfferDetails only ever re-seed their form state from
  // props at MOUNT time (a deliberate design — see their own comments — so
  // a slot switch doesn't get clobbered by a stray prop update). That's a
  // problem specifically for whichever slot is already active the moment
  // hydration lands (slot 1, always, since activeSlot starts at 1 and
  // hydration resets it back to 1): its Calculation/OfferDetails never
  // actually remounts, because activeSlot's VALUE doesn't change, so it
  // keeps using the stale seed it mounted with (empty defaults) — e.g. a
  // saved Quantity would restore correctly on slot 2 (which does get a
  // genuine remount the first time it's clicked, by when `images` already
  // holds the hydrated data) but stay blank on slot 1. Folding this counter
  // into their `key` forces every currently-shown slot to remount on
  // hydration, regardless of whether the active slot number itself moved.
  const [hydrationVersion, setHydrationVersion] = useState(0);

  const updateSlot = useCallback((slot, patch) => {
    setImages((prev) =>
      prev.map((img) => {
        if (img.slot !== slot) return img;
        return typeof patch === "function" ? patch(img) : { ...img, ...patch };
      })
    );
  }, []);

  const activeImage = images.find((img) => img.slot === activeSlot) ?? images[0];

  // UploadFile now processes a whole batch of dropped drawings through one
  // continuous async loop (see its processDrawingFiles) — the closures it
  // captured (onExtractionResult etc.) are fixed from the moment the batch
  // started, not refreshed as Documents re-renders while later files in the
  // batch are still extracting. Reading `images` directly inside
  // handleExtractionResult below would see it stale (e.g. slot 1's just-
  // created documentId, needed as slot 2's parentDocumentId, wouldn't be
  // visible yet). A ref always reflects the latest value regardless of
  // which render's closure is running — same fix as emailFileRef above.
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Which image slot each file in the current upload batch belongs to,
  // indexed by its position in that batch (0, 1, 2…) — computed once in
  // handleBatchStart, before any file's extraction begins, so the mapping
  // stays stable across the whole sequential loop even as `images` itself
  // changes along the way.
  const batchTargetSlotsRef = useRef([]);

  // Calculation.jsx and OfferDetails.jsx report their state upward through
  // effects that list the callback itself as a dependency (so a change in
  // e.g. onCalcStateChange re-fires it). A fresh inline arrow function on
  // every Documents render would therefore re-trigger those effects forever
  // (each call updates `images`, which re-renders Documents, which creates
  // a new inline arrow, which re-triggers the effect...). Memoizing on
  // [activeSlot, updateSlot] — both stable unless the active slot actually
  // changes — keeps the callback identity stable across ordinary re-renders
  // and breaks that loop.
  const handleCalcStateChange = useCallback((state) => updateSlot(activeSlot, { calcState: state }), [activeSlot, updateSlot]);
  const handleSyncOfferFields = useCallback((fields) => updateSlot(activeSlot, { syncedOfferFields: fields }), [activeSlot, updateSlot]);
  const handleOfferValuesChange = useCallback((values) => updateSlot(activeSlot, { offerValues: values }), [activeSlot, updateSlot]);
  const handleOfferDetailsRowsChange = useCallback(
    (rows) => updateSlot(activeSlot, { offerDetailsRows: rows }),
    [activeSlot, updateSlot]
  );

  // The email picked alongside a drawing (see UploadFile's "Related Email"
  // section) — one per offer, always linked to the first (parent) image's
  // document row, matching the backend's emails.document_id UNIQUE
  // constraint. Purely staged here until extraction succeeds.
  const [emailFile, setEmailFile] = useState(null);
  const [emailStatus, setEmailStatus] = useState("idle"); // idle | linking | linked | error
  const [emailError, setEmailError] = useState("");

  // handleExtractionResult below is invoked from UploadFile's async
  // extractDrawing(), whose closure is captured at the moment the drawing
  // was dropped — often before the email gets picked. Reading emailFile
  // directly there would silently see whatever it was AT DROP TIME, not
  // what's actually staged when extraction finishes. A ref always reflects
  // the latest value regardless of which render's closure is running.
  const emailFileRef = useRef(null);
  useEffect(() => {
    emailFileRef.current = emailFile;
  }, [emailFile]);

  // Company Name / Address / Offer Number / Enquiry Date from Firma
  // Information — shared across every image of the offer (not per-slot),
  // fed into Document Preview's Projekt / recipient address / Angebot Nr.
  // All four keys are seeded up front (not `{}`) so every FirmaInformation
  // input starts life as a real controlled input — starting a field at
  // `undefined` and only assigning it a real value later (e.g. Enquiry
  // Date auto-filling once an email links) trips React's "uncontrolled to
  // controlled" warning.
  const [firmaInfo, setFirmaInfo] = useState({ companyName: "", address: "", offerNumber: "", enquiryDate: "" });

  // Weight / Coating Thickness / Spec. Gewicht for the active slot, parsed
  // straight from its own AI extraction — see Calculation's matching
  // safety-net effect for why this needs to reach it as a live prop, not
  // just a one-time seed.
  //
  // When the drawing itself gave no numeric Coating Thickness, but the
  // detected norm/spec text (e.g. "Ofl-x639") resolved to a Standards-KB
  // match with a known thickness range, that range (e.g. "15-30 µm", exactly
  // as the governing TL document states it — not narrowed to a single
  // midpoint number, which would silently look more precise than the norm
  // actually specifies) fills the same schichtdickeUm field as a fallback.
  // This field is plain reference text (nothing in calculationEngine.js's
  // pricing formulas reads it — verified), so a range string is exactly as
  // valid here as a single number. Same "only fills an untouched field"
  // mechanics as every other auto-filled field here (see Calculation.jsx's
  // safety-net effect), so it never overwrites a real printed value or
  // something the user already typed.
  const extractedCalcValues = useMemo(() => {
    const parsed = parseExtractionSummary(activeImage.extraction.summary);
    const kbThickness = activeImage.kbSpecification?.thickness;
    if (parsed.schichtdickeUm === undefined && kbThickness) {
      const range =
        kbThickness.min === kbThickness.max
          ? `${kbThickness.min} ${kbThickness.unit}`
          : `${kbThickness.min}-${kbThickness.max} ${kbThickness.unit}`;
      return { ...parsed, schichtdickeUm: range };
    }
    return parsed;
  }, [activeImage.extraction.summary, activeImage.kbSpecification]);

  // Teilebezeichnung / Zeichnungsnummer / Lackiervorschrift for the active
  // slot, auto-filled from that slot's own AI extraction — parsed straight
  // from its extraction summary, not sourced from Calculation.
  const extractedOfferFields = useMemo(
    () => parseOfferDetailsFields(activeImage.extraction.summary),
    [activeImage.extraction.summary]
  );

  // Document Preview's pricing block, one entry per image slot. The active
  // slot's own OfferDetails instance keeps `offerDetailsRows` fresh live (as
  // it always did); every OTHER slot has no OfferDetails/Calculation
  // actually mounted in the background to do the same for it, so its stored
  // `offerDetailsRows` can be stale — e.g. left over from an earlier,
  // incomplete state the last time that tab happened to be open. Recomputed
  // straight from that slot's own stored calcState/offerValues, via the
  // exact same buildOfferDetailsRows() its own OfferDetails would use if it
  // were mounted, so Document Preview is always accurate for every part in
  // a multi-part offer, not just the one currently on screen.
  const offerDetailsRowsList = useMemo(
    () =>
      images.map((img) => {
        if (img.slot === activeSlot) return img.offerDetailsRows;
        const syncedFields = deriveSyncedOfferFields(img.calcState?.values);
        const values = { ...(img.offerValues ?? {}) };
        values.preisGesamt = computePreisGesamt(syncedFields, values);
        return buildOfferDetailsRows(values, syncedFields);
      }),
    [images, activeSlot]
  );

  // Uploaded Files widget — real documents fetched from the backend
  // (Postgres-backed), not session-only state, so it survives a refresh.
  // Only top-level (parent/slot-1) rows are ever returned here — one row
  // per offer, regardless of how many images it has.
  const [documentRecords, setDocumentRecords] = useState([]);

  // True only for the very first fetch after this component mounts (it
  // remounts on every page switch, per the comment on `hydrating` above —
  // so Uploaded Files always starts empty and pops in a moment later).
  // Deliberately NOT reset to true on later refreshes (save/delete) —
  // those already have real rows on screen and re-showing a spinner there
  // would just be flicker, not a useful loading state.
  const [documentsLoading, setDocumentsLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/documents`);
      if (!response.ok) return;
      const data = await response.json();
      setDocumentRecords(data);
    } catch {
      // Backend unreachable — Uploaded Files just stays at whatever it last had.
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const uploadedFilesRows = useMemo(
    () =>
      documentRecords.map((doc) => {
        const parsed = parseOfferDetailsFields(doc.extractionSummary);
        return {
          id: doc.id,
          fileName: doc.fileName,
          norm: parsed.lackiervorschrift || "—",
          drawingNumber: parsed.zeichnungsnummer || "—",
          uploadedDate: formatDMY(doc.uploadedAt),
        };
      }),
    [documentRecords]
  );

  const handleDeleteUploadedFile = async (id) => {
    try {
      await fetch(`${BACKEND_URL}/api/documents/${id}`, { method: "DELETE" });
      await fetchDocuments();
      onDocumentsChanged?.();
    } catch {
      // Best-effort — table just won't reflect the delete until the backend is back.
    }
  };

  // Persists one slot's data — creates its document row first if it
  // doesn't exist yet (exactly as it always has for a single image), then
  // updates it. Firma Information is only ever stored on the parent
  // (slot 1) row — it's shared across the whole offer, not per-image.
  // Reads imagesRef (not `images` directly) for the parent's documentId:
  // when Save saves every slot in one go (see handleCalculationSave below),
  // slot 1's row may have only just been created a moment earlier in the
  // very same save, and a plain closure over `images` would still see the
  // pre-save snapshot.
  const saveOneSlot = async (slot, payload, image) => {
    const parsed = parseOfferDetailsFields(image.extraction.summary);
    // Same "recompute from calcState instead of trusting a possibly-stale
    // per-slot snapshot" fix as offerDetailsRowsList above — `payload` here
    // already carries this slot's correctly-recomputed calc values (see
    // handleCalculationSave below), so deriving straight from it keeps the
    // saved record's offerDetailsRows accurate even for a slot that wasn't
    // the active one when Save was clicked.
    const syncedFields = deriveSyncedOfferFields(payload);
    const offerValues = { ...(image.offerValues ?? {}) };
    offerValues.preisGesamt = computePreisGesamt(syncedFields, offerValues);
    const fields = {
      fileName: image.extraction.fileName || "Untitled",
      extractionSummary: image.extraction.summary || null,
      norm: parsed.lackiervorschrift || "—",
      customerName: slot === 1 ? firmaInfo.companyName || "—" : "—",
      customerNumber: slot === 1 ? firmaInfo.offerNumber || "—" : "—",
      pricePerStk: Number(payload.kalkulierterPreis) || 0,
      annualQuantity: Number(payload.quantity) || 0,
      calculationData: payload,
      offerDetailsRows: buildOfferDetailsRows(offerValues, syncedFields),
      offerDetailsValues: offerValues,
      kbSpecification: image.kbSpecification,
    };
    if (slot === 1) fields.firmaInfo = firmaInfo;

    let id = image.documentId;
    if (!id) {
      const created = await fetch(`${BACKEND_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: fields.fileName,
          extractionSummary: fields.extractionSummary,
          parentDocumentId: slot > 1 ? imagesRef.current.find((img) => img.slot === 1)?.documentId : undefined,
          imageSlot: slot,
        }),
      }).then((res) => res.json());
      id = created.id;
      updateSlot(slot, { documentId: id });
    }

    await fetch(`${BACKEND_URL}/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
  };

  // The Save button (in Offer Details, beside the slot nav) — the user sees
  // one Save action for the whole offer, so clicking it saves every image
  // slot's data, not just whichever tab happens to be active, even the ones
  // the user never manually revisited after their extraction finished. Each
  // slot's Calculation instance mirrors its own values/notes/touched into
  // `images` on every change (see onCalcStateChange, in Calculation.jsx),
  // so there's always something current to save here regardless of which
  // slot is active when the button is clicked — every slot's results are
  // recomputed from its stored calcState via the same pure engine
  // Calculation itself uses. Slot 1 is always saved first — slots 2/3 need
  // its documentId as their parentDocumentId.
  const handleCalculationSave = async () => {
    const ordered = [...images].sort((a, b) => a.slot - b.slot);
    try {
      for (const image of ordered) {
        // computeCalcResults's return also carries raw, full-precision
        // versions of fields calcState.values already holds as rounded
        // display strings (basePricePerPart, picklingCost, etc.) — values
        // must be spread LAST so its already-correctly-rounded versions
        // win; results only contributes fields with no equivalent in
        // values (naturalX, revenue*, etc).
        const payload = image.calcState
          ? { ...computeCalcResults(image.calcState.values, image.calcState.touched), ...image.calcState.values, notes: image.calcState.notes }
          : null;
        if (!payload) continue;
        // eslint-disable-next-line no-await-in-loop
        await saveOneSlot(image.slot, payload, image);
      }
      onDocumentsChanged?.();
      fetchDocuments();
    } catch {
      // Backend/database unreachable — the Save button's own "Saved"
      // indicator still shows locally; the row(s) just won't appear in All
      // Documents until the backend is back.
    }
  };

  // Fires once, before the first file in a newly-dropped batch (1-3
  // drawings) starts extracting. Works out which image slot each file will
  // land in — preferring the active slot itself if it isn't already a
  // successful image (covers both "fresh workspace" and "retry a failed/
  // idle slot" without opening an extra tab for it), then any other idle
  // slot, then brand-new slots up to the 3-image cap — and creates
  // whichever of those slots don't exist yet, all before any extraction
  // begins so the pager already shows the right number of tabs.
  // Computed directly off the current `images`/`activeSlot` (not inside a
  // setImages updater function) and assigned to the ref synchronously,
  // right here — not deferred into whenever React happens to invoke a state
  // updater. handleExtractionStart reads this ref moments later, still
  // perfectly synchronously (no await in between), so any delay in when
  // the ref is actually populated is enough to lose the very first file's
  // target slot: this was the real cause of image 1's processing steps
  // never appearing (its handleExtractionStart(name, 0) found an empty ref
  // and silently no-opped) while images 2/3 — called long after the first
  // extraction's own network round trip — worked fine.
  // `reuseActiveSlot` (email path only — see UploadFile.jsx's
  // processEmailOnlyFile) forces index 0 onto the active slot even if it's
  // already "loading". The email flow calls this twice: once for count=1
  // before the true part count is known (so slot 1 can show its loading/
  // ExtractionSteps state during the real network wait, matching what
  // images already do), then again with the real count once the response
  // arrives. Without this override, that second call's normal guard would
  // see slot 1 as "loading" and treat it as ineligible for reuse — landing
  // part 0's data on a brand-new slot instead and stranding the original
  // slot 1 permanently stuck on "loading".
  const handleBatchStart = (count, { reuseActiveSlot = false } = {}) => {
    const next = [...images];
    const targets = [];

    const active = next.find((img) => img.slot === activeSlot);
    const canReuseActive =
      active && (reuseActiveSlot || (active.extraction.status !== "success" && active.extraction.status !== "loading"));
    if (canReuseActive) {
      targets.push(active.slot);
    }

    while (targets.length < count && targets.length < MAX_IMAGES) {
      const idle = next.find((img) => img.extraction.status === "idle" && !targets.includes(img.slot));
      if (idle) {
        targets.push(idle.slot);
      } else if (next.length < MAX_IMAGES) {
        const newSlot = next.length + 1;
        next.push(makeEmptySlot(newSlot));
        targets.push(newSlot);
      } else {
        break;
      }
    }

    batchTargetSlotsRef.current = targets;
    setImages(next);
  };

  // `stepStartedAt` is a plain wall-clock timestamp, not a running counter —
  // ExtractionSteps derives "which of the 6 steps to show" from elapsed
  // real time against this value on every render, rather than ticking its
  // own local state. That's what makes background extraction genuinely
  // independent per slot: a slot's progress keeps advancing correctly
  // whether or not its ExtractionSteps instance happens to be mounted
  // (i.e. whether that slot's tab is the one currently being viewed), and
  // switching back to it later shows exactly where it actually is, not a
  // restarted or frozen animation.
  const handleExtractionStart = (fileName, index = 0) => {
    const slot = batchTargetSlotsRef.current[index];
    if (!slot) return;
    updateSlot(slot, (img) => ({
      ...img,
      documentId: null,
      extraction: { status: "loading", fileName, summary: "", error: "", stepStartedAt: Date.now() },
    }));
    // Only the very first file of a fresh batch auto-focuses its tab (there's
    // nothing else to view yet, so this just matches where the user already
    // is). Every later file in the same batch starts extracting purely in
    // the background — the pager gains a new page for it, but the active
    // tab is never forced away from wherever the user actually navigated,
    // so reviewing an already-finished image never gets interrupted by a
    // later one starting.
    if (index === 0) {
      setActiveSlot(slot);
    }
  };

  // The business rule lives here: a document (and therefore an email) is
  // only ever created/stored once extraction has actually succeeded. A
  // staged email is uploaded immediately after, linked to the offer's first
  // image's document row — never before, and never at all if extraction
  // fails.
  const handleExtractionResult = async (summary, meta, index = 0) => {
    const slot = batchTargetSlotsRef.current[index];
    if (!slot) return;

    // Weight / Coating Thickness / Spec. Gewicht auto-fill from this fresh
    // extraction, same as a single-image workflow always did — merged into
    // this slot's own calc values (preserving anything else already typed
    // for this slot, e.g. on a re-upload), never touching another slot's.
    // _surfaceAreaExplicit isn't itself a calc field — it signals that
    // `parsed` carried an explicit Surface Area (from a drawing, an email,
    // or an embedded image), which must be marked touched.surfaceArea so
    // computeCalcResults (calculationDefaults.js) uses it as-is and never
    // silently recomputes it from weight/thickness/density.
    const { _surfaceAreaExplicit, ...parsedValues } = parseExtractionSummary(summary);

    // Best-effort Standards-KB lookup for whatever norm/spec text this
    // extraction found (e.g. "VW 13750 - Ofl-x633 TL227") — fired here so
    // it covers every path that reaches this handler alike: a single
    // image, every image of a multi-image offer, and every part of an
    // email extraction (all three call this same function). Deliberately
    // not awaited inline — it must never delay or block the extraction
    // result itself; the slot (and, through extractedCalcValues, the
    // Schichtdicke fallback) just picks up the match a moment later,
    // exactly like a slightly-late extraction result already does today.
    //
    // The promise itself is kept (not just fire-and-forget) so it can also
    // be persisted to All Documents the moment the document row exists
    // (see the specification-persist block below) — without this, the
    // Specification column stayed at "—" until the user clicked Save even
    // though Schichtdicke had already auto-filled from this same lookup,
    // which read as a bug even though nothing was actually broken.
    const detectedNorm = parseOfferDetailsFields(summary).lackiervorschrift;
    const kbSpecificationPromise = fetchKbSpecification(detectedNorm).then((result) => {
      if (result) updateSlot(slot, { kbSpecification: result });
      return result;
    });

    updateSlot(slot, (img) => {
      const baseValues = img.calcState?.values ?? calculationInitialValues;
      const baseTouched = img.calcState?.touched ?? {};
      return {
        ...img,
        extraction: {
          ...img.extraction,
          status: "success",
          summary,
          error: "",
          source: meta?.fileKind === "email" ? "email" : "image",
        },
        calcState: {
          ...(img.calcState ?? { notes: "" }),
          values: { ...baseValues, ...parsedValues },
          touched: _surfaceAreaExplicit ? { ...baseTouched, surfaceArea: true } : baseTouched,
        },
      };
    });

    let createdId = null;
    try {
      const created = await fetch(`${BACKEND_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: meta?.fileName || imagesRef.current.find((img) => img.slot === slot)?.extraction.fileName,
          fileKind: meta?.fileKind || null,
          extractionSummary: summary,
          parentDocumentId: slot > 1 ? imagesRef.current.find((img) => img.slot === 1)?.documentId : undefined,
          imageSlot: slot,
        }),
      }).then((res) => res.json());
      createdId = created.id;
      updateSlot(slot, { documentId: createdId });
      onDocumentsChanged?.();
      fetchDocuments();

      // Persist the KB match (if/once it resolves — it may still be in
      // flight here) onto this just-created row right away, independent of
      // Save, via the narrow specification-only PATCH — never the general
      // update_document path, which would reset norm/calculationData/etc.
      // back to their unset defaults since nothing has been Saved yet.
      kbSpecificationPromise.then((result) => {
        if (!result) return;
        fetch(`${BACKEND_URL}/api/documents/${createdId}/specification`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kbSpecification: result }),
        })
          .then(() => {
            // Both refreshes, same as right after document creation above:
            // fetchDocuments() updates this page's own "Uploaded Files"
            // widget, onDocumentsChanged() updates App.jsx's separate
            // All Documents list — the Specification column lives there.
            onDocumentsChanged?.();
            fetchDocuments();
          })
          .catch(() => {
            // Backend/database unreachable — Schichtdicke still auto-filled
            // client-side; the Specification column just won't reflect it
            // until the next successful save/fetch.
          });
      });
    } catch {
      // Backend/database unreachable — extraction result still displays;
      // it just won't be persisted (or attachable to an email) until the
      // backend is back.
      return;
    }

    // Email only ever links to the offer's first image (see the field note
    // above) — only attempt it once slot 1 itself is actually saved.
    if (slot !== 1) return;

    const stagedEmailFile = emailFileRef.current;
    if (stagedEmailFile && createdId) {
      setEmailStatus("linking");
      setEmailError("");
      try {
        const formData = new FormData();
        formData.append("email", stagedEmailFile);
        formData.append("document_id", String(createdId));
        const response = await fetch(`${BACKEND_URL}/api/emails/upload`, { method: "POST", body: formData });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not attach this email.");

        setEmailStatus("linked");
        setEmailFile(null);
        onDocumentsChanged?.();

        // Enquiry Date auto-fills from the linked email's own Date header —
        // parsed by the backend already, no AI involved. Only fills it in
        // when it's still blank, so it never overwrites a date the user
        // already typed themselves; with no email attached this field
        // simply stays empty for manual entry, same as always.
        if (data.date) {
          const enquiryDate = data.date.slice(0, 10);
          setFirmaInfo((prev) => (prev.enquiryDate ? prev : { ...prev, enquiryDate }));
        }
      } catch (err) {
        setEmailStatus("error");
        setEmailError(err.message || "Could not attach this email.");
        // emailFile stays staged — retrying the drawing upload will try
        // attaching the same email again rather than forcing a re-pick.
      }
    }
  };

  // Extraction failing means nothing gets stored for that slot — no
  // document, and (deliberately) no touching of emailFile/emailStatus here
  // at all, so a staged email survives to be tried again on the next
  // successful upload. Other slots (including later files still queued in
  // the same batch) are completely untouched — one failure never loses the
  // others.
  const handleExtractionError = (error, index = 0) => {
    const slot = batchTargetSlotsRef.current[index];
    if (!slot) return;
    updateSlot(slot, (img) => ({ ...img, extraction: { ...img.extraction, status: "error", summary: "", error } }));
  };

  // "Open in Workspace" from All Documents — loads a saved record's parent
  // + child images back into this workspace's state. Any Pricing Analysis
  // field the user had manually overridden is restored as-is (marked
  // touched) rather than recalculated, so reopening a record never silently
  // replaces a saved number with a freshly-computed one.
  useEffect(() => {
    if (!openDocumentId) return;

    setHydrating(true);
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/documents/${openDocumentId}`);
        if (!response.ok || cancelled) return;
        const data = await response.json();
        if (cancelled) return;

        const hydrated = (data.images || [])
          .slice()
          .sort((a, b) => a.imageSlot - b.imageSlot)
          .map((row, index) => {
            const calcValues = row.calculationData ? { ...calculationInitialValues, ...row.calculationData } : null;
            return {
              slot: index + 1,
              documentId: row.id,
              extraction: {
                status: "success",
                fileName: row.fileName,
                summary: row.extractionSummary || "",
                error: "",
                source: row.fileKind === "email" ? "email" : "image",
              },
              calcState: calcValues
                ? {
                    values: calcValues,
                    notes: row.calculationData.notes ?? "",
                    touched: { offerPrice: true, surfaceArea: true, autoSync: AUTO_SYNC_FIELD_NAMES },
                  }
                : null,
              offerValues: row.offerDetailsValues ?? null,
              // Normally populated live by Calculation.jsx's own sync effect,
              // a render or two after it mounts — derived directly here
              // instead so OfferDetails' very first render (right after
              // hydration) already has the real values, not a momentary
              // empty {} that its row-building effect could otherwise turn
              // into an incomplete "Jahresmenge/Preis Beschichtung missing"
              // snapshot and persist into offerDetailsRows below before the
              // real sync lands.
              syncedOfferFields: deriveSyncedOfferFields(calcValues),
              // Only a starting point — offerDetailsRowsList below always
              // recomputes this fresh for whichever slot isn't currently
              // active, so this stored copy only actually gets used as-is
              // for the active slot until its own OfferDetails re-derives it.
              offerDetailsRows: row.offerDetailsRows ?? [],
              kbSpecification: row.kbSpecification ?? null,
            };
          });

        setImages(hydrated.length > 0 ? hydrated : [makeEmptySlot(1)]);
        setActiveSlot(1);
        setFirmaInfo({ companyName: "", address: "", offerNumber: "", enquiryDate: "", ...data.firmaInfo });
        setHydrationVersion((v) => v + 1);
      } catch {
        // Backend unreachable — workspace just stays as it was.
      } finally {
        // Covers every exit from the try block above — the early returns
        // (response not ok, or a stale/cancelled request) included, not
        // just the success path — so the loading state can never get
        // stuck showing forever if the fetch fails or a newer
        // openDocumentId supersedes this one before it resolves.
        if (!cancelled) setHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openDocumentId]);

  return (
    <main className="documents-page">
      <div className="upload-section">
        {/* Left: Upload File + Related Email — one stable drop zone for the
            whole workspace (not remounted per slot: it needs to survive a
            multi-file batch running across several slots/tabs in
            sequence). Up to 4 drawings can be picked/dropped at once; see
            handleBatchStart for how each one is assigned a slot. */}
        <UploadFile
          onExtractionStart={handleExtractionStart}
          onExtractionResult={handleExtractionResult}
          onExtractionError={handleExtractionError}
          onBatchStart={handleBatchStart}
          maxFiles={Math.max(
            1,
            MAX_IMAGES - images.filter((img) => img.extraction.status === "success" || img.extraction.status === "loading").length
          )}
          hasImageSource={images.some((img) => img.extraction.source === "image" && img.extraction.status !== "idle")}
          emailFile={emailFile}
          onEmailFileChange={setEmailFile}
          emailStatus={emailStatus}
          emailError={emailError}
        />

        {/* Right: Uploaded Files Table — backend-persisted, 5 rows/page */}
        <UploadedFilesTable files={uploadedFilesRows} onDelete={handleDeleteUploadedFile} loading={documentsLoading} />
      </div>

      {/* Temporary: AI-extracted summary of the active slot's drawing.
          `hydrating` (see the "Open in Workspace" effect above) overrides
          everything else below while a saved record's data is still being
          fetched — the rest of the page (Upload File, Calculation, etc.)
          keeps rendering normally underneath, only this card shows a
          loading state, per explicit request. */}
      <ExtractionPreview
        status={activeImage.extraction.status}
        fileName={activeImage.extraction.fileName}
        summary={activeImage.extraction.summary}
        error={activeImage.extraction.error}
        stepStartedAt={activeImage.extraction.stepStartedAt}
        hydrating={hydrating}
      />

      {/* Calculation: Firma Info + Extracted Details (left) /
          Revenue + Pricing + Info (right) — remounted per active slot so
          each image's form state is fully independent. */}
      <Calculation
        key={`calc-${activeSlot}-${hydrationVersion}`}
        onSyncOfferFields={handleSyncOfferFields}
        firmaValues={firmaInfo}
        onFirmaChange={setFirmaInfo}
        initialCalcState={activeImage.calcState}
        onCalcStateChange={handleCalcStateChange}
        extractedCalcValues={extractedCalcValues}
      />

      {/* Offer Details — below the calculation section, same remount-per-slot
          pattern. Save now lives here too, beside the slot nav — it saves
          every slot's data (see handleCalculationSave), not just this one,
          same as it always did when it lived in Calculation. */}
      <OfferDetails
        key={`offer-${activeSlot}-${hydrationVersion}`}
        syncedFields={activeImage.syncedOfferFields}
        extractedFields={extractedOfferFields}
        onOfferDetailsChange={handleOfferDetailsRowsChange}
        initialValues={activeImage.offerValues}
        onValuesChange={handleOfferValuesChange}
        activeSlot={activeSlot}
        slotCount={images.length}
        onSlotChange={setActiveSlot}
        onSaveCalculation={handleCalculationSave}
      />

      {/* Document Preview — below Offer Details, one pricing block per image.
          angebotsgueltigkeitDigits drives its live "Preisgültigkeit" terms
          row (Angebotsgültigkeit + 3 months) — the active image's own raw
          date digits from Offer Details, mirrored via handleOfferValuesChange. */}
      <DocPreview
        firmaInfo={firmaInfo}
        offerDetailsRowsList={offerDetailsRowsList}
        angebotsgueltigkeitDigits={activeImage.offerValues?.angebotsgueltigkeit}
      />
    </main>
  );
};

export default Documents;
