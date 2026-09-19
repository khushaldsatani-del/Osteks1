import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { FileType2, Save } from "lucide-react";
import ResizableImageFrame from "./ResizableImageFrame";
import ProgressButton from "./ProgressButton";
import { buildTestReportDocxBlob } from "./buildTestReportDocx";
import { buildDocData, collectDocImageUrls, ENTHAFTUNG_TEXT } from "./testReportDocData";
import {
  groupColumns,
  orderStacked,
  photoBoxGeometry,
  cellMaxWidth,
  applyResizeScale,
  imageKey,
  MIN_RESIZE_SCALE,
} from "./testReportImageLayout";
import "./testReportPreview.css";

// Must match .doc-page { width } in testReportPreview.css.
const A4_PAGE_WIDTH_PX = 794;

// ===========================================================================
// Step 5 (Preview & Export) — a live preview of the actual "Prüfbericht"
// document this wizard produces, styled like the real printed report (white
// A4-proportioned page, black text, muted gray table borders) rather than
// this app's own teal UI chrome.
//
// Almost everything on this page is READ-ONLY, assembled from what was
// entered in Steps 1-4. The photos in particular are NOT re-collected here
// anymore (the old 10 fixed "Abb. N" upload slots are gone): every image in
// the document is pulled straight from where it was actually uploaded —
// Test Conditions' before-testing reference pairs, each Results cycle
// checkpoint's photos, the ISO 4628-8 delamination measurements, the two
// Cross-cut Test cards, the constant-climate card. The signature block's
// image is the Bearbeiter's signature (uploaded in Basic Information) — it
// is never editable from here, just displayed.
//
// IMAGE LAYOUT: each photo group renders inside a black-bordered box; a pair
// sits side by side or stacked depending on the two photos' aspect ratios
// (see testReportImageLayout.js). Ratios are measured by preloading every
// image once, so pagination sees real heights.
//
// PAGINATION: real content-measured pagination — the whole document is one
// ordered list of "blocks", rendered once offscreen to measure each block's
// true height, then bucketed into fixed-size A4 sheets. `keepWithNext` keeps
// a heading on the same page as the content it introduces instead of
// orphaning it at a page bottom. Every page repeats the letterhead and gets
// its own footer/page number.
// ===========================================================================

const PAGE_HEIGHT = 1123;
const PAGE_PADDING_TOP = 44;
const PAGE_PADDING_BOTTOM = 44;
const PAGE_CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;
const SAFETY_BUFFER = 10;

// .doc-page is 794px wide with 48px side padding; a photo box adds a 1px
// border + 7px padding each side. This is the width available to the images
// themselves — the number photoBoxGeometry() lays out against.
const PHOTO_BOX_INNER_W = 794 - 48 * 2 - 2 - 7 * 2;

export const formatDateDots = (isoDate) => {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
};

export const ASSESSMENT_LABEL = { Fulfilled: "erfüllt", "Not Fulfilled": "nicht erfüllt" };

const TestReportPreview = ({
  reportInfo,
  subjectTask,
  testMethod,
  durationCycles,
  condensationDuration,
  cycleDurations,
  cyclesData,
  corrosionCrosscutData,
  condensationCrosscutData,
  constantClimateData,
  corrosionReferenceImages,
  condensationReferenceImages,
  evaluationSyncedRows,
  evaluationSummary,
  table2Rows,
  evaluationSummary2,
  cwtBegin,
  cwtEnd,
  imageSizeOverrides,
  setImageOverride,
  captionOverrides,
  setCaptionOverride,
  onSave,
}) => {
  const [pages, setPages] = useState([]);
  // url -> natural aspect ratio (w / h). Populated by the preload effect
  // below; pagination waits on it so photo boxes measure at their real size.
  const [imageRatios, setImageRatios] = useState({});
  const ratioRequestedRef = useRef(new Set());

  const measureRef = useRef(null);

  // An A4 sheet is 794px wide - wider than a phone - so the page was cut off
  // at the right and had to be panned. Each visible page is shrunk to fit
  // the surface instead: zoom, not transform, so the layout box shrinks too
  // and no empty scroll area is left beside it. The offscreen measuring page
  // is never zoomed, so pagination still measures true A4 sizes. There is no
  // screenshot-based export here (Word is built from data), so nothing else
  // depends on the on-screen size. On a wide screen this stays exactly 1.
  const surfaceRef = useRef(null);
  const [pageScale, setPageScale] = useState(1);
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || typeof ResizeObserver === "undefined") return undefined;
    const update = () => {
      const style = getComputedStyle(surface);
      const available =
        surface.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const next = Math.min(1, Math.max(0.2, available / A4_PAGE_WIDTH_PX));
      setPageScale((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);
  const pageHeaderRef = useRef(null);
  const blockRefs = useRef([]);

  const today = new Date();
  const todayFormatted = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

  const docData = useMemo(
    () =>
      buildDocData({
        subjectTask,
        reportInfo,
        testMethod,
        durationCycles,
        condensationDuration,
        cycleDurations,
        cyclesData,
        corrosionCrosscutData,
        condensationCrosscutData,
        constantClimateData,
        corrosionReferenceImages,
        condensationReferenceImages,
        captionOverrides,
      }),
    [
      subjectTask,
      reportInfo,
      testMethod,
      durationCycles,
      condensationDuration,
      cycleDurations,
      cyclesData,
      corrosionCrosscutData,
      condensationCrosscutData,
      constantClimateData,
      corrosionReferenceImages,
      condensationReferenceImages,
      captionOverrides,
    ]
  );

  // Preload every image the document references so its aspect ratio is known
  // before the layout pass runs. Each URL is only ever requested once (the
  // ref guard) — an already-cached photo resolves in the same frame.
  useLayoutEffect(() => {
    collectDocImageUrls(docData, subjectTask.signature).forEach((url) => {
      if (ratioRequestedRef.current.has(url)) return;
      ratioRequestedRef.current.add(url);
      const probe = new Image();
      probe.onload = () =>
        setImageRatios((prev) => ({
          ...prev,
          [url]: probe.naturalHeight ? probe.naturalWidth / probe.naturalHeight : 1.4,
        }));
      probe.onerror = () => setImageRatios((prev) => ({ ...prev, [url]: 1.4 }));
      probe.src = url;
    });
  }, [docData, subjectTask.signature]);

  const ratioOf = (image) => (image?.url ? imageRatios[image.url] || 1.4 : 1.4);

  // One black-bordered photo box. `items` is [{ image, caption }]; empty
  // slots are dropped, and the box itself is omitted (returns null) when
  // nothing's been uploaded yet. One or two images lay out side by side or
  // stacked by aspect ratio (a stacked pair puts the wider photo on top);
  // three or more fall into a 2-wide grid.
  //
  // Layout (side-by-side vs. stacked, ordering) is always automatic — a
  // user can only resize/align one photo *within its own column* via
  // ResizableImageFrame's drag handle and left/center/right buttons
  // (imageSizeOverrides, keyed by imageKey — see testReportImageLayout.js),
  // never move it out of that column. A resize is a SCALE relative to that
  // photo's own auto-computed size (not an absolute fraction of the
  // column) so the same relative change looks the same in both this
  // preview and the differently-proportioned Word export.
  // `groupKey` looks up this box's auto-numbered "Abb. N …" caption in
  // docData.captions (see testReportDocData.js's buildCaptions) — the
  // number is always auto-computed and never itself editable, but the
  // descriptive text after it is a plain editable field (writes to
  // captionOverrides via setCaptionOverride), and that edit is exactly
  // what the downloaded .docx shows too (buildTestReportDocx.js reads the
  // very same docData.captions).
  const photoBox = (items, groupKey) => {
    const present = (items || []).filter((it) => it.image?.url);
    if (present.length === 0) return null;

    const groupCaption = groupKey ? docData.captions[groupKey] : null;

    const columns = groupColumns(present.map((it) => ratioOf(it.image)));
    const ordered =
      columns === 1 && present.length === 2 ? orderStacked(present, (it) => ratioOf(it.image)) : present;
    const geo = photoBoxGeometry(
      PHOTO_BOX_INNER_W,
      columns,
      ordered.map((it) => ratioOf(it.image))
    );
    const maxW = cellMaxWidth(PHOTO_BOX_INNER_W, columns);

    // A single column (a lone photo, OR a stacked pair — either way, no
    // side-by-side grid) at its untouched auto size gets a border that
    // hugs the widest photo actually in it (CSS `width: fit-content`
    // naturally sizes to whichever stacked child is widest), not one
    // stretched to the page's full content width — the moment the user
    // resizes or aligns ANY photo in it, the box widens back out so that
    // control has room to actually move it (see buildTestReportDocx.js's
    // mirrored logic).
    let fitBox = false;
    if (columns === 1) {
      fitBox = !ordered.some((it) => {
        const key = imageKey(it.image);
        const override = key != null ? imageSizeOverrides[key] : null;
        return override && (override.scale || override.align);
      });
    }

    return (
      <>
        <div className={`doc-photo-box${fitBox ? " doc-photo-box--fit" : ""}`}>
          <div
            className="doc-photo-grid"
            style={
              columns === 2
                ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: geo.gap, alignItems: "start" }
                : { display: "flex", flexDirection: "column", gap: geo.gap }
            }
          >
            {ordered.map((it, i) => {
              const ratio = ratioOf(it.image);
              const key = imageKey(it.image);
              const override = key != null ? imageSizeOverrides[key] : null;
              const auto = geo.cells[i];
              const size = override?.scale ? applyResizeScale(auto.width, auto.height, override.scale, maxW) : auto;
              const align = override?.align || "left";
              return (
                // eslint-disable-next-line react/no-array-index-key
                <div className={`doc-photo-cell doc-photo-align-${align}`} key={i}>
                  <ResizableImageFrame
                    src={it.image.url}
                    width={size.width}
                    height={size.height}
                    ratio={ratio}
                    minWidth={auto.width * MIN_RESIZE_SCALE}
                    maxWidth={maxW}
                    align={align}
                    onResize={(finalWidthPx) => key && setImageOverride(key, { scale: finalWidthPx / auto.width })}
                    onReset={() => key && setImageOverride(key, { scale: null })}
                    onAlign={(value) => key && setImageOverride(key, { align: value === "left" ? null : value })}
                  />
                  {it.caption ? <span className="doc-photo-caption">{it.caption}</span> : null}
                </div>
              );
            })}
          </div>
        </div>
        {groupCaption && (
          // Deliberately a SIBLING of .doc-photo-box, not nested inside
          // it — the caption line reads below the bordered box, not
          // enclosed by its border (matches the reference report's own
          // layout).
          <div className="doc-photo-groupcaption-wrap">
            <span className="doc-photo-groupcaption-number">Abb. {groupCaption.number}</span>
            <textarea
              className="doc-photo-groupcaption"
              value={groupCaption.text}
              rows={groupCaption.text.split("\n").length}
              onChange={(event) => setCaptionOverride(groupKey, event.target.value)}
            />
          </div>
        )}
      </>
    );
  };

  // Progress/disabled-while-running is handled by the ProgressButton
  // wrapping this (see the toolbar below) — this just does the actual work
  // and lets a failure propagate as a rejected promise, which is exactly
  // what flips that button into its error state.
  const handleDownloadDocx = async () => {
    const blob = await buildTestReportDocxBlob({
      reportInfo,
      subjectTask,
      testMethod,
      durationCycles,
      condensationDuration,
      cycleDurations,
      cyclesData,
      corrosionCrosscutData,
      condensationCrosscutData,
      constantClimateData,
      corrosionReferenceImages,
      condensationReferenceImages,
      evaluationSyncedRows,
      evaluationSummary,
      table2Rows,
      evaluationSummary2,
      cwtBegin,
      cwtEnd,
      imageSizeOverrides,
      captionOverrides,
      todayFormatted,
      pageCount: pages.length || 1,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Pruefbericht_${reportInfo.reportNo || "Entwurf"}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const rows1 = cycleDurations
    .filter((c) => c <= Number(durationCycles))
    .map((c) => ({ cycles: c, ...evaluationSyncedRows[c] }));

  const testObjectPart = reportInfo.testObjectPart || "—";
  const partNo = subjectTask.partNo || "—";
  const drawingNo = subjectTask.drawingNo || "—";
  const quantity = subjectTask.quantity || "—";
  const material = subjectTask.material || "—";
  const surface = subjectTask.surfaceProtectionType || "—";
  const hasDrawingNo = !!subjectTask.drawingNo?.trim();
  const cwtDurationCompact = (docData.condensationDuration || "240 h").replace(/\s+/g, "");

  // ===================== BLOCK LIST (single source of flow) =====================
  const blocks = [];
  const add = (key, node, opts = {}) => {
    if (node == null) return;
    blocks.push({ key, node, ...opts });
  };

  add("title", <h1 className="doc-title">Prüfbericht</h1>);
  add(
    "info-block",
    <div className="doc-info-block">
      <div className="doc-info-row">
        <span className="doc-info-label">Prüfbericht Nr.</span>
        <span className="doc-info-value">{reportInfo.reportNo || "—"}</span>
      </div>
      <div className="doc-info-row">
        <span className="doc-info-label">Prüfgegenstand</span>
        <span className="doc-info-value">
          <strong>{testObjectPart}</strong>
          {partNo !== "—" ? ` ${partNo}` : ""}
          {subjectTask.drawingNo?.trim() ? ` / ${subjectTask.drawingNo.trim()}` : ""}
          <br />
          {quantity} Stück mit KTL-Beschichtung
          <br />
          {reportInfo.description || "—"}
        </span>
      </div>
      <div className="doc-info-row">
        <span className="doc-info-label">Bearbeiter</span>
        <span className="doc-info-value">{subjectTask.createdBy || "—"}</span>
      </div>
    </div>
  );
  add(
    "date-table",
    <table className="doc-table doc-date-table">
      <thead>
        <tr>
          <th>Probeneingang</th>
          <th>Prüfbeginn</th>
          <th>Prüfende</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{formatDateDots(reportInfo.sampleReceivedDate)}</td>
          <td>{formatDateDots(reportInfo.testStartDate)}</td>
          <td>{formatDateDots(reportInfo.plannedTestEndDate)}</td>
        </tr>
      </tbody>
    </table>
  );
  add(
    "signature-block",
    <div className="doc-footer-block">
      {subjectTask.signature?.url ? (
        <img className="doc-signature-img" src={subjectTask.signature.url} alt="" />
      ) : null}
      <p className="doc-p doc-tight">{subjectTask.createdBy || "—"}</p>
      <p className="doc-p doc-tight">Leiter Qualitätsmanagement</p>
    </div>
  );
  add(
    "disclaimer-block",
    <div className="doc-disclaimer-block">
      <p className="doc-p doc-tight">Anlagen</p>
      <p className="doc-p doc-tight">{pages.length || 1} Seiten Protokoll</p>
      <p className="doc-disclaimer doc-tight">
        Die Prüfleistungen beziehen sich ausschließlich auf den o. g. Prüfauftrag und auf die damit übergebenen
        Prüfstücke
      </p>
    </div>,
    { pinBottom: true, forceBreakAfter: true }
  );

  add("sachverhalt-h2", <h2 className="doc-h2">Sachverhalt / Prüfaufgabe</h2>, { keepWithNext: 2 });
  add(
    "sachverhalt-intro",
    <p className="doc-p">Gemäß Beauftragung war an den übergebenen Musterteilen nachfolgende Prüfung vorzunehmen:</p>
  );
  add(
    "sachverhalt-table",
    <table className="doc-table doc-centered-table">
      <thead>
        <tr>
          <th>Prüfmuster</th>
          <th>Teile-Nr.</th>
          {hasDrawingNo && <th>Zeichnungs-Nr.</th>}
          <th>Stückzahl</th>
          <th>Werkstoff</th>
          <th>Oberfläche</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>{testObjectPart}</strong>
          </td>
          <td>{partNo}</td>
          {hasDrawingNo && <td>{drawingNo}</td>}
          <td>{quantity}</td>
          <td>{material}</td>
          <td>{surface}</td>
        </tr>
      </tbody>
    </table>
  );
  add(
    "numbered-table",
    <table className="doc-table doc-numbered-table">
      <thead>
        <tr>
          <th>Nr.</th>
          <th>Prüfung</th>
        </tr>
      </thead>
      <tbody>
        {subjectTask.tests.map((test, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <tr key={index}>
            <td>{index + 1}.</td>
            <td>{test || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // ---------- 1. Korrosionswechseltest ----------
  if (docData.showCorrosion) {
    add("test1-h2", <h2 className="doc-h2">Untersuchung / Untersuchungsergebnisse</h2>, { keepWithNext: 2 });
    add("test1-anlieferung-h3", <h3 className="doc-h3">Anlieferungszustand</h3>, { keepWithNext: 1 });
    add("test1-anlieferung-photos", photoBox(docData.corrosionReference, "ref-corrosion"));
    add(
      "test1-anlieferung-p",
      <p className="doc-p">
        Alle Musterteile zeigen im Anlieferungszustand vor der Korrosionsprüfung keine Auffälligkeiten in der
        Beschichtung.
      </p>
    );

    add("test1-h3", <h3 className="doc-h3">1. Korrosionswechseltest PV 1210 Stand: 2016-02</h3>, {
      forceBreakBefore: true,
      keepWithNext: 2,
    });
    add(
      "test1-verfahren-pruefdauer",
      <div className="doc-def-table">
        <div className="doc-def-row">
          <span>Verfahren:</span>
          <span>Korrosionswechselprüfung nach VW PV 1210</span>
        </div>
        <div className="doc-def-row">
          <span>Prüfdauer:</span>
          <span>
            {durationCycles} Zyklen (6 Wochen) / {formatDateDots(reportInfo.testStartDate)} –{" "}
            {formatDateDots(reportInfo.plannedTestEndDate)}
          </span>
        </div>
      </div>
    );
    add(
      "test1-cycle-intro",
      <div className="doc-indent-block">
        <p>Ein Prüfzyklus (24 h) besteht aus:</p>
        <p>1) 4 h Salzsprühnebelprüfung, Prüfverfahren NSS nach DIN EN ISO 9227,</p>
        <p>2) 4 h Lagerung bei Normalklima ISO 554–23/50,</p>
        <p>3) 16 h Feucht-Wärme-Lagerung, Prüfklima CH nach DIN EN ISO 6270-2.</p>
        <p>(Nach jeweils 5 Zyklen folgt eine 2-tägige Ruhephase bei Normalklima ISO 554–23/50).</p>
      </div>
    );
    add(
      "test1-zu1",
      <>
        <div className="doc-indent-block doc-indent-block--deeper">
          <p>zu 1) Salzsprühnebelprüfung nach DIN EN ISO 9227</p>
        </div>
        <div className="doc-def-table doc-def-table--indent doc-def-table--narrow">
          <div className="doc-def-row">
            <span>Prüflösung:</span>
            <span>5 +/- 1 % Natriumchlorid in VEW</span>
          </div>
          <div className="doc-def-row">
            <span>pH-Wert:</span>
            <span>6,5 bis 7,2</span>
          </div>
          <div className="doc-def-row">
            <span>Temperatur:</span>
            <span>35° C</span>
          </div>
          <div className="doc-def-row">
            <span>Verdüsung:</span>
            <span>1 bis 2 ml pro Stunde auf 80 cm² Fläche</span>
          </div>
        </div>
      </>
    );
    add(
      "test1-zu2",
      <>
        <div className="doc-indent-block doc-indent-block--deeper">
          <p>zu 2) Normalklima nach ISO 554–23/50 (vorm. DIN 50 014)</p>
        </div>
        <div className="doc-def-table doc-def-table--indent doc-def-table--narrow">
          <div className="doc-def-row">
            <span>Temperatur:</span>
            <span>23 +/- 5° C</span>
          </div>
          <div className="doc-def-row">
            <span>rel. Feuchte:</span>
            <span>50 +/- 5° %</span>
          </div>
        </div>
      </>
    );
    add(
      "test1-zu3",
      <>
        <div className="doc-indent-block doc-indent-block--deeper">
          <p>zu 3) Kondenswasserkonstantklima nach DIN EN ISO 6270-2 CH **</p>
        </div>
        <div className="doc-def-table doc-def-table--indent doc-def-table--narrow">
          <div className="doc-def-row">
            <span>Temperatur:</span>
            <span>40° +/- 2 °C</span>
          </div>
          <div className="doc-def-row">
            <span>rel. Feuchte:</span>
            <span>nahe 100 % mit Betauung der Proben</span>
          </div>
        </div>
      </>
    );
    add(
      "test1-geraetetechnik",
      <p className="doc-p doc-tight">
        Gerätetechnik: Korrosionsprüfgerät SKBWF-C 1000 A-TR von Gebr. Liebisch GmbH Co. KG
      </p>
    );
    add(
      "test1-pruefteile",
      <p className="doc-p doc-tight">
        Prüfteile: <strong>{testObjectPart}</strong> – {quantity} Musterteile
      </p>
    );
    add(
      "test1-probenvorbereitung",
      <p className="doc-p">Probenvorbereitung je Musterteil Anbringung von einer Ritzspur nach Clemen (Breite 0,5 mm)</p>
    );

    docData.cycles.forEach((c) => {
      if (!c.hasContent) return;
      add(
        `cycle-${c.cycles}-h4`,
        <h4 className="doc-h4">Zustand nach {c.cycles} Zyklen Korrosionswechseltest</h4>,
        { keepWithNext: 1 }
      );
      add(
        `cycle-${c.cycles}-photos`,
        photoBox(
          [
            { image: c.beforeImage, caption: null },
            { image: c.afterImage, caption: null },
          ],
          `cycle-${c.cycles}-normal`
        )
      );

      if (c.delaminationImages.length) {
        add(`cycle-${c.cycles}-enth-h3`, <h3 className="doc-h3">{ENTHAFTUNG_TEXT.heading}</h3>, { keepWithNext: 4 });
        add(`cycle-${c.cycles}-enth-verf`, <p className="doc-p doc-tight">Verfahren: {c.delaminationVerfahren}</p>);
        add(`cycle-${c.cycles}-enth-durch`, <p className="doc-p">{ENTHAFTUNG_TEXT.durchfuehrung}</p>);
        add(
          `cycle-${c.cycles}-enth-quote`,
          <div className="doc-indent-block">
            {ENTHAFTUNG_TEXT.lines.map((line, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <p key={i}>{line}</p>
            ))}
          </div>
        );
        add(`cycle-${c.cycles}-enth-photos`, photoBox(c.delaminationImages, `cycle-${c.cycles}-delam`));
      }
    });

    // The last cycle's "Add Delamination Measurement" log.
    if (docData.finalDelaminationImages.length) {
      add("final-delam-h3", <h3 className="doc-h3">{ENTHAFTUNG_TEXT.heading}</h3>, { keepWithNext: 4 });
      add("final-delam-verf", <p className="doc-p doc-tight">Verfahren: {docData.finalDelaminationVerfahren}</p>);
      add("final-delam-durch", <p className="doc-p">{ENTHAFTUNG_TEXT.durchfuehrung}</p>);
      add(
        "final-delam-quote",
        <div className="doc-indent-block">
          {ENTHAFTUNG_TEXT.lines.map((line, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <p key={i}>{line}</p>
          ))}
        </div>
      );
      add("final-delam-photos", photoBox(docData.finalDelaminationImages, "final-delam"));
    }

    if (docData.corrosionCrosscut.length) {
      add("gitterschnitt1-h4", <h4 className="doc-h4">Gitterschnittprüfung:</h4>, { keepWithNext: 1 });
      add("gitterschnitt1-photos", photoBox(docData.corrosionCrosscut, "crosscut-corrosion"));
    }

    add(
      "results-table-1",
      <table className="doc-table doc-results-table">
        <thead>
          <tr>
            <th>Prüfdauer</th>
            <th>Ergebnis nach Korrosionswechseltest nach PV 1210</th>
            <th>Sollvorgaben / Anforderungen für Ofl X-633 nach TL 227</th>
            <th>Bewertung</th>
          </tr>
        </thead>
        <tbody>
          {rows1.map((row) => (
            <tr key={row.cycles}>
              <td>{row.cycles} Zyklen</td>
              <td>
                <strong>{row.result}</strong>
              </td>
              <td>{row.requirement}</td>
              <td className={row.assessment === "Fulfilled" ? "doc-results-pass" : "doc-results-fail"}>
                {ASSESSMENT_LABEL[row.assessment] ?? row.assessment}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
    add(
      "bewertung1-label",
      <p className="doc-p doc-tight">
        <strong>Bewertung:</strong>
      </p>,
      { keepWithNext: 1 }
    );
    add(
      "bewertung1-text",
      <p className="doc-p">
        {evaluationSummary ||
          "Bei der Prüfung der Korrosionsbeständigkeit nach PV 1210 über " +
            durationCycles +
            " Zyklen werden die Sollvorgaben erfüllt. Es liegt keine Flächen-, Kantenkorrosion und keine Blasenbildung vor."}
      </p>
    );
  }

  // ---------- 2. Kondenswasserkonstantklimatest ----------
  if (docData.showCondensation) {
    add("test2-h2", <h2 className="doc-h2">2. Kondenswasserkonstantklimatest</h2>, {
      forceBreakBefore: docData.showCorrosion,
      keepWithNext: 3,
    });
    add("test2-untersuchung-h3-1", <h3 className="doc-h3">Untersuchung / Untersuchungsergebnisse</h3>);
    add("test2-anlieferung-h3", <h3 className="doc-h3">Anlieferungszustand</h3>, { keepWithNext: 1 });
    add("test2-anlieferung-photos", photoBox(docData.condensationReference, "ref-condensation"));
    add(
      "test2-anlieferung-p",
      <p className="doc-p">
        Alle Musterteile zeigen im Anlieferungszustand vor der Korrosionsprüfung keine Auffälligkeiten in der
        Beschichtung.
      </p>
    );

    add("test2-untersuchung-h3-2", <h3 className="doc-h3">Untersuchung / Untersuchungsergebnisse</h3>, {
      keepWithNext: 1,
    });
    {
      /* Verfahren / Prüfdauer / Prüfbedingungen / Temperatur / rel. Feuchte
         all sit flush against each other, no blank line anywhere in the
         run — only after the last of them (Temperatur/rel. Feuchte) does a
         normal paragraph gap resume, before "Gerätetechnik:". */
    }
    add(
      "test2-verfahren-pruefdauer",
      <div className="doc-def-table doc-def-table--narrow doc-def-table--flush">
        <div className="doc-def-row">
          <span>Verfahren:</span>
          <span>nach DIN EN ISO 6270-2 CH:2018-04</span>
        </div>
        <div className="doc-def-row">
          <span>Prüfdauer:</span>
          <span>
            {cwtDurationCompact} {formatDateDots(cwtBegin)} – {formatDateDots(cwtEnd)}
          </span>
        </div>
      </div>
    );
    add("test2-bedingungen-label", <p className="doc-p doc-flush">Prüfbedingungen:</p>);
    add(
      "test2-quote-1",
      <div className="doc-def-table doc-def-table--indent doc-def-table--narrow">
        <div className="doc-def-row">
          <span>Temperatur:</span>
          <span>40° +/- 2 °C</span>
        </div>
        <div className="doc-def-row">
          <span>rel. Feuchte:</span>
          <span>nahe 100 % mit Betauung der Proben (&gt;96%)</span>
        </div>
      </div>
    );
    add(
      "test2-geraetetechnik",
      <p className="doc-p doc-tight">
        Gerätetechnik: Korrosionsprüfgerät SKBWF-C 1000 A-TR von Gebr. Liebisch GmbH Co. KG
      </p>
    );
    add(
      "test2-pruefteile",
      <p className="doc-p">
        Prüfteile: <strong>{testObjectPart}</strong> – {quantity} Musterteile
      </p>
    );
    {
      /* Sollvorgaben is a label with THREE stacked value lines (keine
         Blasenbildung / keine Grundmetallkorrosion / the Gitterschnitt
         requirement) — same tab-aligned label/value column as
         Verfahren/Prüfdauer above, with a full blank-line gap between each
         value line (doc-def-table--loose) rather than the tight 2px list
         rhythm def-rows normally use. The 2nd/3rd rows' label column is
         left empty so their value keeps the same left edge as the first. */
    }
    add(
      "test2-sollvorgaben-block",
      <div className="doc-def-table doc-def-table--wide doc-def-table--loose">
        <div className="doc-def-row">
          <span>Sollvorgaben:</span>
          <span>keine Blasenbildung</span>
        </div>
        <div className="doc-def-row">
          <span />
          <span>keine Grundmetallkorrosion</span>
        </div>
        <div className="doc-def-row">
          <span />
          <span>Gitterschnittprüfung nach DIN EN ISO 2409 Anforderung: Kennwert ≤ 1</span>
        </div>
      </div>
    );

    if (docData.constantClimate.length) {
      add(
        "test2-240h-h4",
        <h4 className="doc-h4">Zustand nach {cwtDurationCompact} Kondenswasserkonstantklima</h4>,
        { keepWithNext: 1 }
      );
      add("test2-240h-photos", photoBox(docData.constantClimate, "constant-climate"));
    }

    if (docData.condensationCrosscut.length) {
      add("gitterschnitt2-h4", <h4 className="doc-h4">Gitterschnittprüfung:</h4>, { keepWithNext: 1 });
      add("gitterschnitt2-photos", photoBox(docData.condensationCrosscut, "crosscut-condensation"));
    }

    add(
      "results-table-2",
      <table className="doc-table doc-results-table">
        <thead>
          <tr>
            <th>Prüfdauer</th>
            <th>Ergebnis nach {cwtDurationCompact} Kondenswasserkonstantklima nach DIN EN ISO 6270-2</th>
            <th>Sollvorgaben / Anforderungen für Ofl X-633 nach TL 227</th>
            <th>Bewertung</th>
          </tr>
        </thead>
        <tbody>
          {table2Rows.map((row) => (
            <tr key={row.id}>
              <td>{row.duration}</td>
              <td>
                <strong>{row.result}</strong>
              </td>
              <td>{row.requirement}</td>
              <td className={row.assessment === "Fulfilled" ? "doc-results-pass" : "doc-results-fail"}>
                {ASSESSMENT_LABEL[row.assessment] ?? row.assessment}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
    add(
      "bewertung2-label",
      <p className="doc-p doc-tight">
        <strong>Bewertung:</strong>
      </p>,
      { keepWithNext: 1 }
    );
    add(
      "bewertung2-text",
      <p className="doc-p">
        {evaluationSummary2 ||
          "Bei der Prüfung der Korrosionsbeständigkeit im 240h Kondenswasserkonstantklima erfüllt der Zustand hinsichtlich Blasengrad, Grundmetallkorrosion und Gitterschnittkennwert die Anforderungen nach Norm TL 227. Die Gitterschnittkennwerte liegen nach der Belastung bei 2x Gt0. Der Kondenswasserkonstantklimatest ist somit als bestanden zu bewerten."}
      </p>
    );
  }

  const pageHeader = (
    <>
      <div className="doc-letterhead-company">OSTEKS GMBH</div>
      <div className="doc-letterhead-banner">WERTE SCHAFFEN OHNE VERSCHWENDUNG</div>
    </>
  );

  useLayoutEffect(() => {
    if (!measureRef.current) return;

    blockRefs.current.length = blocks.length;

    const containerTop = measureRef.current.getBoundingClientRect().top;
    const tops = blockRefs.current.map((el) => (el ? el.getBoundingClientRect().top - containerTop : 0));
    const bottoms = blockRefs.current.map((el) => (el ? el.getBoundingClientRect().bottom - containerTop : 0));
    const heights = blocks.map((_, i) => (i < blocks.length - 1 ? tops[i + 1] - tops[i] : bottoms[i] - tops[i]));

    const headerHeight = pageHeaderRef.current ? pageHeaderRef.current.getBoundingClientRect().height : 0;
    const budget = PAGE_CONTENT_HEIGHT - SAFETY_BUFFER - headerHeight;

    const computed = [];
    let current = [];
    let used = 0;

    const closePage = () => {
      if (current.length === 0) return;
      const leftover = Math.max(0, budget - used);
      const lastIndex = current.length - 1;
      if (current[lastIndex].pinBottom) {
        current = [...current.slice(0, lastIndex), { ...current[lastIndex], pinTopPx: leftover }];
      }
      computed.push(current);
      current = [];
      used = 0;
    };

    blocks.forEach((block, i) => {
      const h = Math.max(0, heights[i]);

      // How much vertical space this block needs to land without orphaning
      // the content it introduces: itself plus its keepWithNext followers,
      // never demanding more than a whole page's worth.
      let need = h;
      if (block.keepWithNext) {
        for (let k = 1; k <= block.keepWithNext && i + k < blocks.length; k += 1) {
          need += Math.max(0, heights[i + k]);
        }
        need = Math.min(need, budget);
      }

      if (block.forceBreakBefore && current.length > 0) {
        closePage();
      } else if (current.length > 0 && used + need > budget) {
        closePage();
      }
      current.push(block);
      used += h;
      if (block.forceBreakAfter) closePage();
    });
    closePage();

    setPages(computed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    reportInfo,
    subjectTask,
    testMethod,
    durationCycles,
    condensationDuration,
    cycleDurations,
    cyclesData,
    corrosionCrosscutData,
    condensationCrosscutData,
    constantClimateData,
    corrosionReferenceImages,
    condensationReferenceImages,
    evaluationSyncedRows,
    evaluationSummary,
    table2Rows,
    evaluationSummary2,
    cwtBegin,
    cwtEnd,
    imageRatios,
    imageSizeOverrides,
    captionOverrides,
  ]);

  return (
    <div className="doc-preview-wrap">
      <div className="doc-preview-toolbar">
        <ProgressButton
          icon={Save}
          idleLabel="Speichern"
          doneLabel="Gespeichert"
          errorLabel="Fehler – erneut versuchen"
          onRun={onSave}
          className="testreport-btn"
        />

        <ProgressButton
          icon={FileType2}
          idleLabel="Als Word herunterladen"
          doneLabel="Heruntergeladen"
          errorLabel="Fehler – erneut versuchen"
          onRun={handleDownloadDocx}
          className="testreport-btn testreport-btn--solid"
        />
      </div>

      <div className="doc-page doc-page--measure" ref={measureRef} aria-hidden="true">
        <div ref={pageHeaderRef}>{pageHeader}</div>
        {blocks.map((block, i) => (
          <div key={block.key} ref={(el) => (blockRefs.current[i] = el)}>
            {block.node}
          </div>
        ))}
      </div>

      <div className="doc-preview-surface" ref={surfaceRef}>
        {pages.map((pageBlocks, pageIndex) => (
          <div
            className="doc-page"
            key={pageBlocks.map((b) => b.key).join("-") || pageIndex}
            style={pageScale < 1 ? { zoom: pageScale } : undefined}
          >
            {pageHeader}
            {pageBlocks.map((block) =>
              block.pinTopPx != null ? (
                <div key={block.key} style={{ marginTop: block.pinTopPx }}>
                  {block.node}
                </div>
              ) : (
                <React.Fragment key={block.key}>{block.node}</React.Fragment>
              )
            )}
            <div className="doc-page-footer">
              <span>Erstellt durch {subjectTask.createdBy || "—"}</span>
              <span>Erstellt am {todayFormatted}</span>
              <span>
                Seite {pageIndex + 1} von {pages.length || 1}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestReportPreview;
