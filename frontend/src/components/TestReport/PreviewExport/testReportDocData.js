import { isCorrosionChangeTest, isCondensationClimateTest } from "../testReportConstants";

// Turns the wizard's raw state into the ordered, resolved shape the
// Prüfbericht actually renders — which cycles exist, which photos belong to
// each checkpoint, whether a cycle tripped the ISO 4628-8 delamination
// section, the cross-cut pairs, the condensation section's photos, AND
// (see buildCaptions below) every photo box's auto-numbered "Abb. N …"
// caption. Shared by TestReportPreview.jsx (on-screen) and
// buildTestReportDocx.js (Word) so the document's structure is defined
// exactly once.
//
// Every "image" below is the wizard's usual slot shape — { url, name, ... }
// or a pending { url: blob:…, … } — or null. Callers only ever read `.url`.

const img = (value) => (value && value.url ? value : null);

// The Verfahren field's seed/default value — a free-text field the user can
// edit (see cycle.delamination.verfahren / cycle.finalDelamination.procedure
// in TestReport.jsx), not a fixed dropdown, but still autofilled with the
// standard this test is actually run to so a fresh cycle doesn't start
// blank.
export const DEFAULT_DELAMINATION_VERFAHREN = "DIN EN ISO 4628-8: 2013-03";

// The fixed ISO 4628-8 wording shown above a cycle's delamination photos —
// `verfahren` itself is a fallback only: each Enthaftung block actually
// renders whatever the user entered in that cycle's own Verfahren field
// (see buildDocData below), falling back to this default text only if that
// field was somehow left empty.
export const ENTHAFTUNG_TEXT = {
  heading: "Enthaftung (Unterwanderung) an der Ritzspur",
  verfahren: `Verfahren: ${DEFAULT_DELAMINATION_VERFAHREN}`,
  durchfuehrung: "Prüfdurchführung: Beschichtung bis zur noch fest haftendenden Zone entfernen,",
  lines: [
    "Bestimmung der Gesamtbreite der Enthaftung:",
    "Auswertung nach DIN EN ISO 4628-8, messen an 6 gleichmäßig verteilten Messpunkten, Bestimmung des arithm. Mittelwertes d1 aus 6 Messwerten,",
    "Enthaftung d = (d1-w) / 2 (w … Breite der Ritzspur: 0,5 mm)",
  ],
};

// At most this many delamination photos are carried into the document from
// the last cycle's "Add Delamination Measurement" log (ISO 4628-8 measures
// at 6 points).
export const MAX_FINAL_DELAMINATION_IMAGES = 6;

// The first non-empty dBefore/dAfter among a set of delamination entries —
// only one side of a scratch-delamination pair is normally actually
// measured, so this is "whichever one has a real reading," not an average.
const firstDValue = (entries) => {
  for (const e of entries) {
    if (e.dValue != null && String(e.dValue).trim()) return String(e.dValue).trim();
  }
  return null;
};

export function buildDocData({
  subjectTask,
  reportInfo,
  testMethod,
  durationCycles,
  cycleDurations,
  cyclesData,
  corrosionCrosscutData,
  condensationCrosscutData,
  constantClimateData,
  corrosionReferenceImages,
  condensationReferenceImages,
  condensationDuration,
  captionOverrides,
}) {
  const testObjectPart = reportInfo?.testObjectPart || "—";
  const tests = subjectTask?.tests || [];
  const methodPool = [...tests, testMethod].filter(Boolean);
  const anyMatched = methodPool.some(isCorrosionChangeTest) || methodPool.some(isCondensationClimateTest);
  const showCorrosion = !anyMatched || methodPool.some(isCorrosionChangeTest);
  const showCondensation = !anyMatched || methodPool.some(isCondensationClimateTest);

  const cycleValues = (cycleDurations || [])
    .filter((c) => c <= Number(durationCycles))
    .sort((a, b) => a - b);
  const lastCycle = cycleValues[cycleValues.length - 1];
  const firstCycle = cycleValues[0];

  const cycles = cycleValues.map((c) => {
    const data = cyclesData?.[`cycles${c}`] || {};
    const rows = data.rows || [];
    const isLast = c === lastCycle;
    const failed = rows.some((r) => r.assessment && r.assessment !== "Pass");

    // Non-last cycle that tripped a Fail/Conditional verdict → the
    // auto-revealed ISO 4628-8 pair (cyclesData[c].delamination). Raw
    // dBefore/dAfter travel alongside each image (not baked into a
    // per-image caption anymore — see buildCaptions below, which captions
    // the whole box once, not each photo separately).
    let delaminationImages = [];
    if (failed && !isLast) {
      const d = data.delamination || {};
      delaminationImages = [
        { image: img(d.beforeImage), dValue: d.dBefore },
        { image: img(d.afterImage), dValue: d.dAfter },
      ].filter((x) => x.image);
    }

    const beforeImage = img(data.beforeImage);
    const afterImage = img(data.afterImage);
    const delaminationVerfahren = (data.delamination?.verfahren || "").trim() || DEFAULT_DELAMINATION_VERFAHREN;
    return {
      cycles: c,
      isLast,
      isFirst: c === firstCycle,
      failed,
      rows,
      beforeImage,
      afterImage,
      delaminationImages,
      delaminationVerfahren,
      // A checkpoint with no photos and no delamination section adds only a
      // bare underlined heading to the document — skip it (the evaluation
      // table still lists every cycle).
      hasContent: Boolean(beforeImage || afterImage || delaminationImages.length),
    };
  });

  // The last cycle's "Add Delamination Measurement" log — every committed
  // entry's before/after pair, plus the still-uncommitted working pair if it
  // holds an image, flattened and capped. Its own group caption (see
  // buildCaptions) is derived from the LAST logged entry's cycle/d-value —
  // the most recent measurement is the representative one for a caption
  // covering the whole log.
  let finalDelaminationImages = [];
  let finalDelaminationVerfahren = DEFAULT_DELAMINATION_VERFAHREN;
  let finalDelaminationLast = null;
  if (lastCycle != null) {
    const fd = cyclesData?.[`cycles${lastCycle}`]?.finalDelamination || { entries: [] };
    finalDelaminationVerfahren = (fd.procedure || "").trim() || DEFAULT_DELAMINATION_VERFAHREN;
    const flat = [];
    (fd.entries || []).forEach((e) => {
      flat.push({ image: img(e.beforeImage), dValue: e.dBefore, cycle: e.cycleBefore });
      flat.push({ image: img(e.afterImage), dValue: e.dAfter, cycle: e.cycleAfter });
    });
    if (img(fd.beforeImage) || img(fd.afterImage)) {
      flat.push({ image: img(fd.beforeImage), dValue: fd.dBefore, cycle: fd.cycleBefore });
      flat.push({ image: img(fd.afterImage), dValue: fd.dAfter, cycle: fd.cycleAfter });
    }
    const withImages = flat.filter((x) => x.image);
    finalDelaminationImages = withImages.slice(0, MAX_FINAL_DELAMINATION_IMAGES);
    finalDelaminationLast = withImages[withImages.length - 1] || null;
  }

  const pair = (data, order = ["beforeImage", "afterImage"]) => {
    const d = data || {};
    const descKey = { beforeImage: "descriptionBefore", afterImage: "descriptionAfter" };
    return order
      .map((slot) => ({ image: img(d[slot]), caption: (d[descKey[slot]] || "").trim() || null }))
      .filter((x) => x.image);
  };

  const corrosionReference = pair(corrosionReferenceImages);
  const condensationReference = pair(condensationReferenceImages);
  const corrosionCrosscut = pair(corrosionCrosscutData);
  const condensationCrosscut = pair(condensationCrosscutData);
  const constantClimate = pair(constantClimateData);
  const condensationDurationCompact = (condensationDuration || "240 h").replace(/\s+/g, "");

  const docData = {
    showCorrosion,
    showCondensation,
    cycles,
    lastCycle,
    finalDelaminationImages,
    finalDelaminationVerfahren,
    anyCycleFailed: cycles.some((c) => c.failed),
    corrosionReference,
    condensationReference,
    corrosionCrosscut,
    condensationCrosscut,
    constantClimate,
    condensationDuration: condensationDuration || "240 h",
  };

  docData.captions = buildCaptions({
    testObjectPart,
    showCorrosion,
    showCondensation,
    corrosionReference,
    cycles,
    finalDelaminationImages,
    finalDelaminationLast,
    corrosionCrosscut,
    corrosionCrosscutGrade: (corrosionCrosscutData?.grade || "").trim(),
    condensationReference,
    constantClimate,
    condensationCrosscut,
    condensationCrosscutGrade: (condensationCrosscutData?.grade || "").trim(),
    condensationDurationCompact,
    overrides: captionOverrides || {},
  });

  return docData;
}

// One global, sequential "Abb. N" counter across the whole document — every
// photo box gets exactly one entry here, in the exact order the document
// itself lays them out (mirrored by the two renderers' own add() call
// order). The NUMBER is always auto-computed fresh from which groups
// currently exist (never itself editable); only each group's descriptive
// TEXT can be overridden by the user (captionOverrides, keyed by the same
// stable `key` used below) — see TestReport.jsx's captionOverrides state.
function buildCaptions({
  testObjectPart,
  showCorrosion,
  showCondensation,
  corrosionReference,
  cycles,
  finalDelaminationImages,
  finalDelaminationLast,
  corrosionCrosscut,
  corrosionCrosscutGrade,
  condensationReference,
  constantClimate,
  condensationCrosscut,
  condensationCrosscutGrade,
  condensationDurationCompact,
  overrides,
}) {
  const groups = [];
  const push = (key, present, defaultText) => {
    if (!present) return;
    groups.push({ key, defaultText });
  };

  push(
    "ref-corrosion",
    showCorrosion && corrosionReference.length > 0,
    `${testObjectPart} – Musterteile für Korrosionswechseltest nach PV 1210`
  );

  cycles.forEach((c) => {
    push(
      `cycle-${c.cycles}-normal`,
      Boolean(c.beforeImage || c.afterImage),
      c.isFirst
        ? `${testObjectPart} – nach ${c.cycles} Zyklen Korrosionswechseltest – keine Auffälligkeiten sichtbar`
        : `${testObjectPart} – nach ${c.cycles} Zyklen Korrosionswechseltest – keine Auffälligkeiten in der Beschichtung\n-keine Blasenbildung - keine Zinkkorrosion der Oberfläche und der Schnittkanten`
    );

    // Exactly one of before/after uploaded → the usual single delamination
    // reading, captioned with its own d-value. Both uploaded → read as a
    // second, distinct pair (contact-point corrosion photos, not a
    // delamination measurement), fixed caption, no cycle/d-value in it.
    if (c.delaminationImages.length === 1) {
      const dValue = firstDValue(c.delaminationImages);
      push(
        `cycle-${c.cycles}-delam`,
        true,
        dValue ? `${testObjectPart} – nach ${c.cycles} Zyklen\nEnthaftung d=${dValue}mm` : `${testObjectPart} – nach ${c.cycles} Zyklen`
      );
    } else if (c.delaminationImages.length >= 2) {
      push(`cycle-${c.cycles}-delam`, true, `${testObjectPart} –Korrosionserscheinungen an den Kontaktierungspunkten`);
    }
  });

  if (finalDelaminationImages.length) {
    const dValue = finalDelaminationLast?.dValue != null && String(finalDelaminationLast.dValue).trim() ? String(finalDelaminationLast.dValue).trim() : null;
    const cycle = finalDelaminationLast?.cycle != null && String(finalDelaminationLast.cycle).trim() ? String(finalDelaminationLast.cycle).trim() : null;
    let text = testObjectPart;
    if (cycle) text += ` – nach ${cycle} Zyklen`;
    if (dValue) text += `\nEnthaftung d=${dValue}mm`;
    push("final-delam", true, text);
  }

  push(
    "crosscut-corrosion",
    showCorrosion && corrosionCrosscut.length > 0,
    corrosionCrosscutGrade ? `Gitterschnittprüfung nach der Belastung ${corrosionCrosscutGrade}` : "Gitterschnittprüfung nach der Belastung"
  );

  push(
    "ref-condensation",
    showCondensation && condensationReference.length > 0,
    `${testObjectPart} für ${condensationDurationCompact} Kondenswasserkonstantklimatest`
  );

  push(
    "constant-climate",
    showCondensation && constantClimate.length > 0,
    `${testObjectPart} – nach ${condensationDurationCompact} Kondenswasserkonstantklima – keine Auffälligkeiten`
  );

  push(
    "crosscut-condensation",
    showCondensation && condensationCrosscut.length > 0,
    condensationCrosscutGrade
      ? `Gitterschnittprüfung nach ${condensationDurationCompact} Kondenswasserkonstantklima: ${condensationCrosscutGrade}`
      : `Gitterschnittprüfung nach ${condensationDurationCompact} Kondenswasserkonstantklima`
  );

  const captions = {};
  groups.forEach((g, i) => {
    const number = i + 1;
    const overrideText = overrides[g.key];
    const text = overrideText != null && overrideText !== "" ? overrideText : g.defaultText;
    captions[g.key] = { number, text, full: `Abb. ${number} ${text}` };
  });
  return captions;
}

// Every image URL the assembled document references, for the on-screen
// preview to preload (so aspect ratios are known before pagination runs).
export function collectDocImageUrls(docData, signature) {
  const urls = [];
  const push = (im) => im && im.url && urls.push(im.url);
  push(signature);
  docData.cycles.forEach((c) => {
    push(c.beforeImage);
    push(c.afterImage);
    c.delaminationImages.forEach((d) => push(d.image));
  });
  docData.finalDelaminationImages.forEach((d) => push(d.image));
  [
    docData.corrosionReference,
    docData.condensationReference,
    docData.corrosionCrosscut,
    docData.condensationCrosscut,
    docData.constantClimate,
  ].forEach((group) => group.forEach((g) => push(g.image)));
  return Array.from(new Set(urls));
}
