import React, { useMemo, useRef, useState } from "react";
import { Check, Download, LoaderCircle, Pencil, Plus, RotateCcw, Search, Trash2, Upload, X } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ShiftCard from "../shared/ShiftCard";
import QtyInput from "../Planning/QtyInput";
import { PLAN_LINES } from "../Planning/planningData";
import { TEAMS } from "./settingsData";
import { downloadPartTemplate, readPartsFromExcel } from "./partMasterExcel";

const lineName = (id) => PLAN_LINES.find((line) => line.id === id)?.name ?? id;
const EMPTY_FORM = { part: "", name: "", line: PLAN_LINES[0].id, perRack: 0, team: TEAMS[0] };

const TeamSelect = ({ value, onChange, label }) => {
  const { t } = useTranslation();
  return (
    <select className="sset-select" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
      {!value && <option value="">{t("shiftSettings.noTeam")}</option>}
      {TEAMS.map((team) => (
        <option key={team} value={team}>
          {team}
        </option>
      ))}
    </select>
  );
};

// The part list with line, pieces per rack and team. Pieces per rack and
// team save as soon as they change; the pencil edits name and line in the
// row. Parts can be added one by one or imported from an Excel file (new
// part numbers are added, existing ones updated).
const PartMasterCard = ({ parts, onChange }) => {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [query, setQuery] = useState("");
  const [lineFilter, setLineFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [editing, setEditing] = useState(null); // { part, name, line }
  const [busy, setBusy] = useState(null); // "import" | "template"
  const [message, setMessage] = useState(null); // { tone, text }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parts.filter(
      (p) =>
        (!q || `${p.part} ${p.name}`.toLowerCase().includes(q)) &&
        (!lineFilter || p.line === lineFilter) &&
        (!teamFilter || p.team === teamFilter)
    );
  }, [parts, query, lineFilter, teamFilter]);
  const filtering = query.trim() !== "" || lineFilter !== "" || teamFilter !== "";

  const update = (partNo, changes) => onChange(parts.map((p) => (p.part === partNo ? { ...p, ...changes } : p)));

  const submitAdd = (event) => {
    event.preventDefault();
    const partNo = form.part.trim();
    if (!partNo) return setFormError(t("shiftPlan.partNoRequired"));
    if (parts.some((p) => p.part.toLowerCase() === partNo.toLowerCase()))
      return setFormError(t("shiftSettings.partExists", { part: partNo }));
    onChange([...parts, { ...form, part: partNo, name: form.name.trim() }]);
    setForm(EMPTY_FORM);
    setAdding(false);
    setMessage({ tone: "ok", text: t("shiftSettings.partAdded", { part: partNo }) });
    return undefined;
  };

  const handleImport = async (file) => {
    if (!file) return;
    setBusy("import");
    setMessage(null);
    try {
      const result = await readPartsFromExcel(file);
      if (result.error) {
        setMessage({ tone: "warn", text: t(`shiftSettings.importError_${result.error}`) });
        return;
      }
      const byPart = new Map(parts.map((p) => [p.part.toLowerCase(), p]));
      let added = 0;
      let updated = 0;
      result.parts.forEach((p) => {
        const key = p.part.toLowerCase();
        const existing = byPart.get(key);
        if (existing) updated += 1;
        else added += 1;
        byPart.set(key, existing ? { ...existing, ...p, part: existing.part, name: p.name || existing.name } : p);
      });
      onChange([...byPart.values()]);
      const skippedText = result.skipped.length
        ? ` ${t("shiftSettings.importSkipped", { count: result.skipped.length, parts: result.skipped.map((s) => s.part).join(", ") })}`
        : "";
      setMessage({
        tone: result.skipped.length ? "warn" : "ok",
        text: t("shiftSettings.importDone", { added, updated }) + skippedText,
      });
    } finally {
      setBusy(null);
    }
  };

  const saveEdit = () => {
    update(editing.part, { name: editing.name.trim(), line: editing.line });
    setEditing(null);
  };

  return (
    <ShiftCard
      className="sset-card"
      title={t("shiftSettings.partsTitle")}
      subtitle={t("shiftSettings.partsSubtitle")}
      actions={
        <div className="sset-part-actions">
          <button type="button" className="splan-btn" onClick={() => fileRef.current?.click()} disabled={busy === "import"}>
            {busy === "import" ? <LoaderCircle size={15} className="splan-spin" /> : <Upload size={15} className="sset-teal-icon" />}
            {t("shiftSettings.importExcel")}
          </button>
          <button
            type="button"
            className="splan-btn"
            disabled={busy === "template"}
            onClick={async () => {
              setBusy("template");
              try {
                await downloadPartTemplate(t);
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "template" ? <LoaderCircle size={15} className="splan-spin" /> : <Download size={15} className="sset-teal-icon" />}
            {t("shiftSettings.downloadTemplate")}
          </button>
          <button type="button" className="splan-btn splan-btn--solid" onClick={() => setAdding(true)} disabled={adding}>
            <Plus size={15} />
            {t("shiftSettings.addPart")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            hidden
            onChange={(event) => {
              handleImport(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      }
    >
      <div className="sset-filters">
        <label className="splan-search sset-search">
          <Search size={14} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("shiftPlan.search")}
            aria-label={t("shiftPlan.search")}
          />
        </label>
        <label className="sset-filter">
          <span>{t("shiftPlan.colLine")}</span>
          <select className="sset-select" value={lineFilter} onChange={(event) => setLineFilter(event.target.value)}>
            <option value="">{t("shiftSettings.all")}</option>
            {PLAN_LINES.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name}
              </option>
            ))}
          </select>
        </label>
        <label className="sset-filter">
          <span>{t("shiftSettings.colTeam")}</span>
          <select className="sset-select" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
            <option value="">{t("shiftSettings.all")}</option>
            {TEAMS.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="splan-btn sset-reset"
          disabled={!filtering}
          onClick={() => {
            setQuery("");
            setLineFilter("");
            setTeamFilter("");
          }}
        >
          <RotateCcw size={14} />
          {t("shiftSettings.resetFilters")}
        </button>
      </div>

      {message && (
        <p className={`splan-notice splan-notice--${message.tone} sset-message`} role="status">
          {message.text}
        </p>
      )}

      {adding && (
        <form className="splan-add" onSubmit={submitAdd} noValidate>
          <p className="splan-add-title">{t("shiftSettings.addPartTitle")}</p>
          <div className="splan-add-fields">
            <label className="splan-field">
              <span>{t("shiftPlan.colPartNo")} *</span>
              <input
                value={form.part}
                autoFocus
                aria-invalid={!!formError}
                onChange={(event) => {
                  setForm((f) => ({ ...f, part: event.target.value }));
                  setFormError("");
                }}
              />
            </label>
            <label className="splan-field">
              <span>{t("shiftPlan.fieldName")}</span>
              <input value={form.name} onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))} />
            </label>
            <label className="splan-field splan-field--small">
              <span>{t("shiftPlan.colLine")}</span>
              <select value={form.line} onChange={(event) => setForm((f) => ({ ...f, line: event.target.value }))}>
                {PLAN_LINES.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="splan-field splan-field--small">
              <span>{t("shiftSettings.colPerRack")}</span>
              <input
                inputMode="numeric"
                value={form.perRack || ""}
                onChange={(event) => setForm((f) => ({ ...f, perRack: Number(event.target.value.replace(/\D/g, "").slice(0, 5)) || 0 }))}
              />
            </label>
            <label className="splan-field splan-field--small">
              <span>{t("shiftSettings.colTeam")}</span>
              <select value={form.team} onChange={(event) => setForm((f) => ({ ...f, team: event.target.value }))}>
                {TEAMS.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>
            <div className="splan-add-actions">
              <button
                type="button"
                className="splan-btn"
                onClick={() => {
                  setAdding(false);
                  setForm(EMPTY_FORM);
                  setFormError("");
                }}
              >
                {t("shiftPlan.cancel")}
              </button>
              <button type="submit" className="splan-btn splan-btn--solid">
                {t("shiftPlan.add")}
              </button>
            </div>
          </div>
          {formError && (
            <p className="splan-add-error" role="alert">
              {formError}
            </p>
          )}
        </form>
      )}

      <div className="sp-table-wrap">
        <table className="sp-table splan-table sset-parts">
          <thead>
            <tr>
              <th>{t("shiftPlan.colPartNo")}</th>
              <th>{t("shiftPlan.colName")}</th>
              <th className="splan-center">{t("shiftPlan.colLine")}</th>
              <th className="splan-center">{t("shiftSettings.colPerRack")}</th>
              <th className="splan-center">{t("shiftSettings.colTeam")}</th>
              <th className="splan-center">{t("shiftPlan.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="splan-empty">
                  {parts.length ? t("shiftPlan.noMatches") : t("shiftSettings.noParts")}
                </td>
              </tr>
            ) : (
              rows.map((p) => {
                const isEditing = editing?.part === p.part;
                return (
                  <tr key={p.part} className={isEditing ? "is-editing" : ""}>
                    <td className="splan-part">{p.part}</td>
                    <td>
                      {isEditing ? (
                        <input
                          className="sset-inline-input"
                          value={editing.name}
                          autoFocus
                          aria-label={t("shiftPlan.fieldName")}
                          onChange={(event) => setEditing((e) => ({ ...e, name: event.target.value }))}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") saveEdit();
                            if (event.key === "Escape") setEditing(null);
                          }}
                        />
                      ) : (
                        p.name || <span className="splan-muted">-</span>
                      )}
                    </td>
                    <td className="splan-center">
                      {isEditing ? (
                        <select
                          className="sset-select sset-select--small"
                          value={editing.line}
                          aria-label={t("shiftPlan.colLine")}
                          onChange={(event) => setEditing((e) => ({ ...e, line: event.target.value }))}
                        >
                          {PLAN_LINES.map((line) => (
                            <option key={line.id} value={line.id}>
                              {line.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`splan-line splan-line--${p.line}`}>{lineName(p.line)}</span>
                      )}
                    </td>
                    <td className="splan-center">
                      <QtyInput
                        className="sset-rack-input"
                        value={p.perRack}
                        label={t("shiftSettings.perRackFor", { part: p.part })}
                        onChange={(value) => update(p.part, { perRack: value })}
                      />
                    </td>
                    <td className="splan-center">
                      <TeamSelect value={p.team} onChange={(team) => update(p.part, { team })} label={t("shiftSettings.teamFor", { part: p.part })} />
                    </td>
                    <td className="splan-center">
                      <div className="splan-actions">
                        {isEditing ? (
                          <>
                            <button type="button" className="splan-icon-btn sset-confirm" onClick={saveEdit} aria-label={t("shiftSettings.saveEdit")} title={t("shiftSettings.saveEdit")}>
                              <Check size={15} />
                            </button>
                            <button type="button" className="splan-icon-btn" onClick={() => setEditing(null)} aria-label={t("shiftPlan.cancel")} title={t("shiftPlan.cancel")}>
                              <X size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="splan-icon-btn"
                              onClick={() => setEditing({ part: p.part, name: p.name, line: p.line })}
                              aria-label={t("shiftSettings.editPartFor", { part: p.part })}
                              title={t("shiftSettings.editPart")}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="splan-icon-btn splan-icon-btn--danger"
                              onClick={() => {
                                if (window.confirm(t("shiftSettings.deleteConfirm", { part: p.part }))) {
                                  onChange(parts.filter((x) => x.part !== p.part));
                                }
                              }}
                              aria-label={t("shiftSettings.deletePartFor", { part: p.part })}
                              title={t("shiftPlan.deletePart")}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="splan-note">{t("shiftSettings.partsCount", { shown: rows.length, total: parts.length })}</p>
    </ShiftCard>
  );
};

export default PartMasterCard;
