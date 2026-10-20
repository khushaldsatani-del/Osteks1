import React, { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudUpload, FileSpreadsheet, Info, LoaderCircle, X } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ShiftCard from "../../ShiftPlanning/shared/ShiftCard";
import { formatDateTimeDots, formatFileSize, formatNumber } from "../../ShiftPlanning/shared/shiftFormat";
import { commitImport, discardImport, getPendingImport, listMetrics, listUploads, previewImport } from "../productionApi";
import "../../ShiftPlanning/Upload/shiftUpload.css";
import "../productionView.css";

// Production View > Upload: import the whole "Auswertungen" workbook.
// Two steps - the file is parsed on the server and shown as a preview
// (months found, new / changed / unchanged values, warnings); only "Save to
// database" writes it. Every row of every month sheet is stored, not just
// the backlog. Below: what the database holds per metric, and the history.

const isoToDots = (iso) => (iso ? iso.split("-").reverse().join(".") : "–");

const Warnings = ({ warnings }) => {
  const { t } = useTranslation();
  if (!warnings?.length) return null;
  const noBacklog = warnings.filter((w) => w.code === "noBacklog").map((w) => w.sheet);
  const mismatch = warnings.filter((w) => w.code === "totalMismatch").map((w) => isoToDots(w.date));
  const duplicates = warnings.filter((w) => w.code === "duplicateDay");
  const other = warnings.filter((w) => ["noDayColumns", "noValues"].includes(w.code));
  return (
    <ul className="pv-warnings">
      {noBacklog.length > 0 && (
        <li className="pv-warning pv-warning--info">
          <Info size={15} />
          <span>{t("productionUpload.warnNoBacklog", { sheets: noBacklog.join(", ") })}</span>
        </li>
      )}
      {mismatch.length > 0 && (
        <li className="pv-warning">
          <AlertTriangle size={15} />
          <span>{t("productionUpload.warnTotalMismatch", { count: mismatch.length, dates: mismatch.slice(0, 6).join(", ") })}</span>
        </li>
      )}
      {duplicates.length > 0 && (
        <li className="pv-warning">
          <AlertTriangle size={15} />
          <span>{t("productionUpload.warnDuplicate", { count: duplicates.length })}</span>
        </li>
      )}
      {other.map((w, i) => (
        <li key={i} className="pv-warning">
          <AlertTriangle size={15} />
          <span>{t(`productionUpload.warn_${w.code}`, { sheet: w.sheet ?? "" })}</span>
        </li>
      ))}
    </ul>
  );
};

const PreviewPanel = forwardRef(function PreviewPanel({ upload, busy, onCommit, onDiscard }, ref) {
  const { t, language } = useTranslation();
  const s = upload.summary;
  const months = s.months.filter((m) => !m.skipped);
  const stats = [
    { label: t("productionUpload.statMonths"), value: months.length },
    { label: t("productionUpload.statDays"), value: s.dayCount },
    { label: t("productionUpload.statMetrics"), value: s.metricCount },
    { label: t("productionUpload.statValues"), value: formatNumber(language, s.valueCount) },
  ];
  return (
    <div ref={ref} className="pv-preview-anchor">
    <ShiftCard
      title={t("productionUpload.previewTitle")}
      subtitle={t("productionUpload.previewSubtitle", { file: upload.fileName })}
      className="pv-preview"
    >
      <p className="pv-note pv-note--unsaved">
        <AlertTriangle size={15} />
        {t("productionUpload.unsavedNote", { date: formatDateTimeDots(new Date(upload.uploadedAt)) })}
      </p>
      {s.duplicateOf && (
        <p className="pv-note">
          <Info size={15} />
          {t("productionUpload.duplicateNote", { date: formatDateTimeDots(new Date(s.duplicateOf.uploadedAt)) })}
        </p>
      )}

      <div className="pv-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="pv-stat">
            <span className="pv-stat-value">{stat.value}</span>
            <span className="pv-stat-label">{stat.label}</span>
          </div>
        ))}
        <div className="pv-stat pv-stat--changes">
          <span className="pv-change pv-change--new">{t("productionUpload.valuesNew", { count: formatNumber(language, s.values.new) })}</span>
          <span className="pv-change pv-change--changed">
            {t("productionUpload.valuesChanged", { count: formatNumber(language, s.values.changed) })}
          </span>
          <span className="pv-change">{t("productionUpload.valuesUnchanged", { count: formatNumber(language, s.values.unchanged) })}</span>
        </div>
      </div>

      <div className="sp-table-wrap">
        <table className="sp-table pv-table">
          <thead>
            <tr>
              <th>{t("productionUpload.colSheet")}</th>
              <th>{t("productionUpload.colRange")}</th>
              <th className="sp-num">{t("productionUpload.colDays")}</th>
              <th className="sp-num">{t("productionUpload.colMetrics")}</th>
              <th className="sp-num">{t("productionUpload.colValues")}</th>
              <th className="sp-num">{t("productionUpload.colBacklogDays")}</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.sheet}>
                <td className="pv-strong">{m.sheet}</td>
                <td>
                  {isoToDots(m.firstDate)} – {isoToDots(m.lastDate)}
                </td>
                <td className="sp-num">{m.days}</td>
                <td className="sp-num">{m.metrics}</td>
                <td className="sp-num">{formatNumber(language, m.values)}</td>
                <td className="sp-num">
                  {m.backlogDays ? m.backlogDays : <span className="pv-muted">–</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Warnings warnings={s.warnings} />

      <div className="pv-actions">
        <button type="button" className="pv-btn pv-btn--ghost" onClick={onDiscard} disabled={busy}>
          {t("productionUpload.discard")}
        </button>
        <button type="button" className="pv-btn pv-btn--primary" onClick={onCommit} disabled={busy || s.valueCount === 0}>
          {busy ? <LoaderCircle size={15} className="supl-spin" /> : <CheckCircle2 size={15} />}
          {t("productionUpload.save")}
        </button>
      </div>
    </ShiftCard>
    </div>
  );
});

// committed = imported; unchanged = the automatic feed found no new file
// that morning; failed = unreadable file (reason in summary.error)
const STATUS_TONE = { committed: "green", discarded: "grey", failed: "red", unchanged: "amber" };

const ProductionUpload = () => {
  const { t, language } = useTranslation();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | reading | preview | saving
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null); // last committed upload
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [listError, setListError] = useState("");
  const previewRef = useRef(null);

  const refreshLists = useCallback(async () => {
    try {
      const [uploads, coverage] = await Promise.all([listUploads(), listMetrics()]);
      setHistory(uploads);
      setMetrics(coverage);
      setListError("");
    } catch (err) {
      setListError(err.message);
    }
  }, []);

  useEffect(() => {
    refreshLists();
  }, [refreshLists]);

  // A file previewed earlier but never saved comes back here, so it can
  // still be saved (or discarded) instead of silently missing from the
  // dashboard.
  useEffect(() => {
    let cancelled = false;
    getPendingImport()
      .then((pending) => {
        if (cancelled || !pending) return;
        setPreview((current) => current ?? pending);
        setPhase((current) => (current === "idle" ? "preview" : current));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // bring the "Check before saving" card into view when a preview appears
  useEffect(() => {
    if (preview?.id) previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [preview?.id]);

  const handleFile = async (file) => {
    if (!file || phase === "reading" || phase === "saving") return;
    if (preview) discardImport(preview.id).catch(() => {});
    setError("");
    setResult(null);
    setPreview(null);
    setPhase("reading");
    try {
      setPreview(await previewImport(file));
      setPhase("preview");
    } catch (err) {
      setError(err.message);
      setPhase("idle");
    }
  };

  const handleCommit = async () => {
    setPhase("saving");
    try {
      const saved = await commitImport(preview.id);
      setResult(saved);
      setPreview(null);
      setPhase("idle");
      refreshLists();
    } catch (err) {
      setError(err.message);
      setPhase("preview");
    }
  };

  const handleDiscard = async () => {
    const id = preview.id;
    setPreview(null);
    setPhase("idle");
    try {
      await discardImport(id);
    } catch {
      // already gone - nothing to undo
    }
  };

  return (
    <main className="sp-page">
      <div className="sp-header">
        <div className="sp-heading">
          <h2 className="sp-title">{t("productionUpload.title")}</h2>
          <p className="sp-subtitle">{t("productionUpload.subtitle")}</p>
        </div>
      </div>

      <ShiftCard
        heading={
          <div className="supl-card-heading">
            <span className="supl-type-icon pv-type-icon">
              <FileSpreadsheet size={20} />
            </span>
            <div>
              <h3 className="sp-card-title">{t("productionUpload.cardTitle")}</h3>
              <p className="sp-card-subtitle">{t("productionUpload.cardHint")}</p>
            </div>
          </div>
        }
      >
        <div
          className={`supl-drop ${dragging ? "is-dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFile(event.dataTransfer.files?.[0]);
          }}
        >
          {phase === "reading" ? (
            <>
              <LoaderCircle size={28} className="supl-drop-icon supl-spin" />
              <p className="supl-drop-title">{t("productionUpload.reading")}</p>
            </>
          ) : (
            <>
              <CloudUpload size={30} className="supl-drop-icon" />
              <p className="supl-drop-title">{t("productionUpload.drop")}</p>
              <p className="supl-drop-or">{t("shiftUpload.or")}</p>
              <button type="button" className="supl-select" onClick={() => inputRef.current?.click()}>
                {t("shiftUpload.selectFile")}
              </button>
              <p className="supl-drop-hint">{t("productionUpload.supported")}</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xlsm"
            hidden
            onChange={(event) => {
              handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>

        {error && (
          <p className="pv-banner pv-banner--error">
            <AlertTriangle size={16} />
            <span>{error}</span>
            <button type="button" className="pv-banner-close" onClick={() => setError("")} aria-label={t("productionUpload.close")}>
              <X size={14} />
            </button>
          </p>
        )}
        {result && (
          <p className="pv-banner pv-banner--success">
            <CheckCircle2 size={16} />
            <span>
              {t("productionUpload.savedNote", {
                file: result.fileName,
                newCount: formatNumber(language, result.summary.values.new),
                changedCount: formatNumber(language, result.summary.values.changed),
              })}
            </span>
          </p>
        )}
      </ShiftCard>

      {preview && (phase === "preview" || phase === "saving") && (
        <PreviewPanel ref={previewRef} upload={preview} busy={phase === "saving"} onCommit={handleCommit} onDiscard={handleDiscard} />
      )}

      {listError && (
        <p className="pv-banner pv-banner--error">
          <AlertTriangle size={16} />
          <span>{listError}</span>
        </p>
      )}

      <div className="pv-two-col">
        <ShiftCard title={t("productionUpload.storedTitle")} subtitle={t("productionUpload.storedSubtitle", { count: metrics.length })}>
          {metrics.length === 0 ? (
            <p className="pv-empty">{t("productionUpload.storedEmpty")}</p>
          ) : (
            <div className="sp-table-wrap pv-scroll">
              <table className="sp-table pv-table">
                <thead>
                  <tr>
                    <th>{t("productionUpload.colMetric")}</th>
                    <th className="sp-num">{t("productionUpload.colDays")}</th>
                    <th>{t("productionUpload.colFrom")}</th>
                    <th>{t("productionUpload.colTo")}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.key} className={m.key.startsWith("auftragsbestand") || m.key === "summe_auftragsbestand" ? "pv-row-accent" : ""}>
                      <td className="pv-strong">{m.label}</td>
                      <td className="sp-num">{m.days}</td>
                      <td>{isoToDots(m.firstDate)}</td>
                      <td>{isoToDots(m.lastDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ShiftCard>

        <ShiftCard title={t("productionUpload.historyTitle")} subtitle={t("productionUpload.historySubtitle")}>
          {history.length === 0 ? (
            <p className="pv-empty">{t("productionUpload.historyEmpty")}</p>
          ) : (
            <div className="sp-table-wrap pv-scroll">
              <table className="sp-table pv-table">
                <thead>
                  <tr>
                    <th>{t("productionUpload.colFile")}</th>
                    <th>{t("productionUpload.colUploaded")}</th>
                    <th>{t("productionUpload.colSource")}</th>
                    <th>{t("productionUpload.colRange")}</th>
                    <th className="sp-num">{t("productionUpload.colChanges")}</th>
                    <th>{t("productionUpload.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((u) => (
                    <tr key={u.id}>
                      <td className="pv-strong pv-file" title={u.fileName}>
                        {u.fileName}
                        <span className="pv-muted"> · {formatFileSize(language, u.fileSize)}</span>
                      </td>
                      <td>{formatDateTimeDots(new Date(u.uploadedAt))}</td>
                      <td>
                        <span className={`pv-source pv-source--${u.source}`}>{t(`productionUpload.source_${u.source}`)}</span>
                      </td>
                      <td>
                        {u.summary.firstDate ? `${isoToDots(u.summary.firstDate)} – ${isoToDots(u.summary.lastDate)}` : "–"}
                      </td>
                      <td className="sp-num">
                        {u.summary.values
                          ? `+${formatNumber(language, u.summary.values.new)} / ~${formatNumber(language, u.summary.values.changed)}`
                          : "–"}
                      </td>
                      <td>
                        <span
                          className={`pv-status pv-status--${STATUS_TONE[u.status] ?? "grey"}`}
                          title={u.summary.error ?? (u.status === "unchanged" ? t("productionUpload.unchangedHint") : undefined)}
                        >
                          {t(`productionUpload.status_${u.status}`)}
                        </span>
                        {u.summary.error && <span className="pv-status-reason">{u.summary.error}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ShiftCard>
      </div>
    </main>
  );
};

export default ProductionUpload;
