import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  FileSpreadsheet,
  Hand,
  Info,
  LoaderCircle,
  RefreshCw,
  Zap,
} from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { formatFileSize, formatNumber } from "../../ShiftPlanning/shared/shiftFormat";
import {
  ImportError,
  commitImport,
  discardImport,
  getPendingImport,
  importErrorMessage,
  listUploads,
  previewImport,
} from "../productionApi";
import "../productionView.css";

// Production View > Upload. Normally the workbook arrives by itself every
// morning (automation/osteks-sync) - "Automatic" mode, the default, shows
// only the history of what came in. "Manual" is the fallback for a day the
// automatic feed fails: one upload box that checks the file, shows what it
// would change, and saves it on confirmation. Both write the same history.
//
// Every failure is shown where it happened (in the upload box, or in the
// table) with a translated reason and a way to retry; nothing on the page
// ever just stops responding.

const MAX_FILE_BYTES = 30 * 1024 * 1024; // same cap as the server (MAX_FILE_SIZE_BYTES)
const PAGE_SIZE = 15;

const pad = (n) => String(n).padStart(2, "0");
const isoToDots = (iso) => (iso ? iso.split("-").reverse().join(".") : "–");
const dateDots = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
const timeOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// committed = imported; unchanged = the automatic feed found no new data
// that morning; failed = the file couldn't be imported (reason in summary)
const STATUS = {
  committed: { tone: "green", key: "status_committed" },
  unchanged: { tone: "amber", key: "status_unchanged" },
  failed: { tone: "red", key: "status_failed" },
};

// Checks the browser can do before sending anything.
function checkFile(file) {
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) return new ImportError("wrong_type");
  if (file.size === 0) return new ImportError("empty_file");
  if (file.size > MAX_FILE_BYTES) return new ImportError("too_large");
  return null;
}

const ModeToggle = ({ mode, onChange }) => {
  const { t } = useTranslation();
  return (
    <div className="bl-seg bl-seg--dark up-toggle" role="radiogroup" aria-label={t("productionUpload.modeLabel")}>
      {[
        ["auto", Zap],
        ["manual", Hand],
      ].map(([value, Icon]) => (
        <button key={value} type="button" role="radio" aria-checked={mode === value} className={mode === value ? "is-active" : ""} onClick={() => onChange(value)}>
          <Icon size={14} />
          {t(`productionUpload.mode_${value}`)}
        </button>
      ))}
    </div>
  );
};

// The manual upload box: drop zone -> checking -> confirm -> saved, with
// errors shown inside the box.
const UploadBox = ({ preview, phase, error, saved, onFile, onSave, onDiscard, onReset }) => {
  const { t, language } = useTranslation();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  if (phase === "preview" || phase === "saving") {
    const s = preview.summary;
    const warnings = s.warnings ?? [];
    const mismatches = warnings.filter((w) => w.code === "totalMismatch").length;
    const noBacklog = warnings.filter((w) => w.code === "noBacklog").length;
    return (
      <section className="up-box up-box--confirm" aria-live="polite">
        <div className="up-confirm-head">
          <span className="up-file-icon">
            <FileSpreadsheet size={18} />
          </span>
          <div className="up-confirm-text">
            <p className="up-file-name" title={preview.fileName}>
              {preview.fileName}
            </p>
            <p className="up-file-meta">
              {t("productionUpload.confirmMeta", {
                from: isoToDots(s.firstDate),
                to: isoToDots(s.lastDate),
                values: formatNumber(language, s.valueCount),
              })}
            </p>
          </div>
        </div>

        <div className="up-changes">
          <span className="up-change up-change--new">{t("productionUpload.valuesNew", { count: formatNumber(language, s.values.new) })}</span>
          <span className="up-change up-change--changed">{t("productionUpload.valuesChanged", { count: formatNumber(language, s.values.changed) })}</span>
          <span className="up-change">{t("productionUpload.valuesUnchanged", { count: formatNumber(language, s.values.unchanged) })}</span>
        </div>

        {(s.duplicateOf || mismatches > 0 || noBacklog > 0) && (
          <ul className="up-notes">
            {s.duplicateOf && (
              <li>
                <Info size={14} />
                {t("productionUpload.duplicateNoteShort")}
              </li>
            )}
            {mismatches > 0 && (
              <li className="is-warn">
                <AlertTriangle size={14} />
                {t("productionUpload.mismatchShort", { count: mismatches })}
              </li>
            )}
            {noBacklog > 0 && (
              <li>
                <Info size={14} />
                {t("productionUpload.noBacklogShort", { count: noBacklog })}
              </li>
            )}
          </ul>
        )}

        {error && (
          <p className="up-error" role="alert">
            <AlertTriangle size={15} />
            {error}
          </p>
        )}

        <div className="up-actions">
          <span className="up-hint">{t("productionUpload.notSavedYet")}</span>
          <button type="button" className="pv-btn pv-btn--ghost" onClick={onDiscard} disabled={phase === "saving"}>
            {t("productionUpload.discard")}
          </button>
          <button type="button" className="pv-btn pv-btn--primary" onClick={onSave} disabled={phase === "saving"}>
            {phase === "saving" ? <LoaderCircle size={15} className="up-spin" /> : <CheckCircle2 size={15} />}
            {t("productionUpload.save")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`up-box up-drop ${dragging ? "is-dragging" : ""} ${error ? "has-error" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (phase !== "checking") setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (phase !== "checking") onFile(event.dataTransfer.files?.[0]);
      }}
      aria-live="polite"
    >
      {phase === "checking" ? (
        <>
          <LoaderCircle size={26} className="up-drop-icon up-spin" />
          <p className="up-drop-title">{t("productionUpload.checking")}</p>
          <p className="up-drop-hint">{t("productionUpload.checkingHint")}</p>
        </>
      ) : saved ? (
        <>
          <CheckCircle2 size={26} className="up-drop-icon up-drop-icon--ok" />
          <p className="up-drop-title">
            {t("productionUpload.savedShort", {
              newCount: formatNumber(language, saved.summary.values.new),
              changedCount: formatNumber(language, saved.summary.values.changed),
            })}
          </p>
          <button type="button" className="up-link" onClick={onReset}>
            {t("productionUpload.uploadAnother")}
          </button>
        </>
      ) : (
        <>
          <CloudUpload size={26} className="up-drop-icon" />
          <p className="up-drop-title">{t("productionUpload.drop")}</p>
          <p className="up-drop-hint">
            {t("productionUpload.dropHint")}{" "}
            <button type="button" className="up-link" onClick={() => inputRef.current?.click()}>
              {t("productionUpload.browse")}
            </button>
          </p>
          {error && (
            <p className="up-error" role="alert">
              <AlertTriangle size={15} />
              {error}
            </p>
          )}
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xlsm"
        hidden
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </section>
  );
};

const HistoryTable = ({ history, loading, error, onRetry }) => {
  const { t, language } = useTranslation();
  const [visible, setVisible] = useState(PAGE_SIZE);
  const rows = history.slice(0, visible);

  return (
    <section className="sp-card up-history">
      <div className="up-history-head">
        <h3 className="sp-card-title">{t("productionUpload.historyTitle")}</h3>
        <button type="button" className="up-icon-btn" onClick={onRetry} disabled={loading} title={t("productionUpload.refresh")} aria-label={t("productionUpload.refresh")}>
          <RefreshCw size={14} className={loading ? "up-spin" : ""} />
        </button>
      </div>

      <div className="up-table-wrap">
        <table className="up-table">
          <thead>
            <tr>
              <th>{t("productionUpload.colDate")}</th>
              <th>{t("productionUpload.colSource")}</th>
              <th>{t("productionUpload.colFile")}</th>
              <th>{t("productionUpload.colDataUpTo")}</th>
              <th className="up-num">{t("productionUpload.colChanges")}</th>
              <th>{t("productionUpload.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={6} className="up-table-message up-table-message--error">
                  <AlertTriangle size={15} />
                  {error}
                  <button type="button" className="up-link" onClick={onRetry}>
                    {t("productionUpload.retry")}
                  </button>
                </td>
              </tr>
            ) : loading && history.length === 0 ? (
              Array.from({ length: 4 }, (_, i) => (
                <tr key={i} className="up-skeleton">
                  {Array.from({ length: 6 }, (__, j) => (
                    <td key={j}>
                      <span />
                    </td>
                  ))}
                </tr>
              ))
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={6} className="up-table-message">
                  {t("productionUpload.historyEmpty")}
                </td>
              </tr>
            ) : (
              rows.map((u) => {
                const when = new Date(u.uploadedAt);
                const status = STATUS[u.status] ?? { tone: "grey", key: `status_${u.status}` };
                const values = u.summary.values;
                return (
                  <tr key={u.id}>
                    <td>
                      <span className="up-date">{dateDots(when)}</span>
                      <span className="up-time">{timeOf(when)}</span>
                    </td>
                    <td>
                      <span className={`up-source up-source--${u.source}`}>
                        {u.source === "auto" ? <Zap size={12} /> : <Hand size={12} />}
                        {t(`productionUpload.source_${u.source}`)}
                      </span>
                    </td>
                    <td className="up-file-cell" title={u.fileName}>
                      <span className="up-file">{u.fileName}</span>
                      <span className="up-size">{formatFileSize(language, u.fileSize)}</span>
                    </td>
                    <td>{u.summary.lastDate ? isoToDots(u.summary.lastDate) : <span className="up-muted">–</span>}</td>
                    <td className="up-num">
                      {values ? (
                        <>
                          {values.new > 0 && <span className="up-count up-count--new">+{formatNumber(language, values.new)}</span>}
                          {values.changed > 0 && <span className="up-count up-count--changed">~{formatNumber(language, values.changed)}</span>}
                          {values.new === 0 && values.changed === 0 && <span className="up-muted">0</span>}
                        </>
                      ) : (
                        <span className="up-muted">–</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`up-status up-status--${status.tone}`}
                        title={u.status === "unchanged" ? t("productionUpload.unchangedHint") : undefined}
                      >
                        <span className="up-status-dot" />
                        {t(`productionUpload.${status.key}`)}
                      </span>
                      {u.summary.error && (
                        <span className="up-reason">
                          {u.summary.code ? importErrorMessage(t, { code: u.summary.code, detail: u.summary.error }) : u.summary.error}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!error && history.length > visible && (
        <button type="button" className="up-more" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
          {t("productionUpload.showMore", { count: Math.min(PAGE_SIZE, history.length - visible) })}
        </button>
      )}
    </section>
  );
};

const ProductionUpload = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState("auto");
  const [phase, setPhase] = useState("idle"); // idle | checking | preview | saving
  const [preview, setPreview] = useState(null);
  const [saved, setSaved] = useState(null);
  // errors are kept as ImportError objects and turned into text when shown,
  // so they follow a language switch
  const [uploadError, setUploadError] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await listUploads());
      setHistoryError(null);
    } catch (err) {
      setHistoryError(err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // A file checked earlier but never saved comes back in Manual mode, so it
  // can still be saved or discarded.
  useEffect(() => {
    let cancelled = false;
    getPendingImport()
      .then((pending) => {
        if (cancelled || !pending) return;
        setPreview(pending);
        setPhase("preview");
        setMode("manual");
      })
      .catch(() => {}); // nothing pending to recover - not worth an error
    return () => {
      cancelled = true;
    };
  }, []);

  const resetBox = () => {
    setPhase("idle");
    setPreview(null);
    setSaved(null);
    setUploadError(null);
  };

  const handleFile = async (file) => {
    if (!file || phase === "checking" || phase === "saving") return;
    setSaved(null);
    const problem = checkFile(file);
    if (problem) {
      setUploadError(problem);
      return;
    }
    setUploadError(null);
    setPhase("checking");
    try {
      setPreview(await previewImport(file));
      setPhase("preview");
    } catch (err) {
      setUploadError(err);
      setPhase("idle");
      refreshHistory(); // a rejected file is listed as Failed
    }
  };

  const handleSave = async () => {
    setPhase("saving");
    setUploadError(null);
    try {
      const result = await commitImport(preview.id);
      setSaved(result);
      setPreview(null);
      setPhase("idle");
    } catch (err) {
      if (err.code === "already_processed" || err.code === "not_found") {
        // saved/discarded meanwhile (e.g. in another tab) - start over
        resetBox();
        setUploadError(err);
      } else {
        // network / server problem - the preview is still there, try again
        setUploadError(err);
        setPhase("preview");
      }
    } finally {
      refreshHistory();
    }
  };

  const handleDiscard = async () => {
    const id = preview.id;
    resetBox();
    try {
      await discardImport(id);
    } catch {
      // already gone, or the server is unreachable - an unsaved preview
      // changes nothing either way
    }
  };

  return (
    <main className="sp-page up-page">
      <div className="sp-header">
        <div className="sp-heading">
          <h2 className="sp-title">{t("productionUpload.title")}</h2>
          <p className="sp-subtitle">{t(`productionUpload.subtitle_${mode}`)}</p>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {mode === "manual" && (
        <UploadBox
          preview={preview}
          phase={phase}
          error={uploadError && importErrorMessage(t, uploadError)}
          saved={saved}
          onFile={handleFile}
          onSave={handleSave}
          onDiscard={handleDiscard}
          onReset={resetBox}
        />
      )}

      <HistoryTable history={history} loading={historyLoading} error={historyError && importErrorMessage(t, historyError)} onRetry={refreshHistory} />
    </main>
  );
};

export default ProductionUpload;
