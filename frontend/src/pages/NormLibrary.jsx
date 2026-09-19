import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Search, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

import { BACKEND_URL } from "../config";
import { fetchKbSpecification } from "../components/Calculation/kbLookup";
import { factLabel } from "../components/AllDocuments/specificationFacts";
import { CYCLE_DURATIONS } from "../components/TestReport/testReportConstants";
import { useTranslation } from "../i18n/LanguageContext";
import "./normLibrary.css";

// Temporary reference page: every coating norm the app knows (the VW 13750
// codes from the knowledge base plus the other customers' catalogue) with
// its thickness and test requirements, and a search box that ALSO runs the
// exact lookup the extraction uses - so typing a norm the way it appears on
// a drawing shows precisely what the app will fill in for it.

const PAGE_SIZE = 25;
const FACTS_COLLAPSED = 4;

// Letters and digits only, so "VW 13750 Ofl.- X633" finds "VW 13750 Ofl-x633".
const normalize = (text) => (text || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function wizardCyclesFrom(facts) {
  const values = (facts || [])
    .filter((fact) => fact.label === "cyclic_corrosion_cycles")
    .map((fact) => Number(fact.value))
    .filter((n) => Number.isFinite(n) && CYCLE_DURATIONS.includes(n));
  return values.length ? Math.max(...values) : null;
}

function thicknessText(thickness) {
  if (!thickness) return "";
  if (thickness.display) return thickness.display;
  if (thickness.min != null && thickness.max != null) return `${thickness.min}-${thickness.max} ${thickness.unit || "µm"}`;
  return "";
}

const NormLibrary = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState("all");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState({});
  const [resolved, setResolved] = useState(null); // live lookup result for the query
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND_URL}/api/norms`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows || []);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, []);

  // The same lookup Documents.jsx runs on an AI-extracted norm, debounced.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) {
      setResolved(null);
      return undefined;
    }
    setResolving(true);
    const timer = setTimeout(() => {
      fetchKbSpecification(text).then((result) => {
        setResolved(result);
        setResolving(false);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const customers = useMemo(() => {
    const counts = new Map();
    rows.forEach((row) => counts.set(row.customer, (counts.get(row.customer) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const resolvedKey = resolved ? normalize(resolved.label || (resolved.code ? `VW 13750 Ofl-${resolved.code}` : "")) : "";

  const filtered = useMemo(() => {
    const q = normalize(query);
    const words = query.trim().toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
    const list = rows.filter((row) => {
      if (customer !== "all" && row.customer !== customer) return false;
      if (!q) return true;
      const designation = normalize(row.designation);
      if (designation.includes(q) || q.includes(designation)) return true;
      if (resolvedKey && designation === resolvedKey) return true;
      const haystack = `${row.customer} ${row.meaning || ""} ${row.source_document || ""}`.toLowerCase();
      return words.length > 0 && words.every((w) => haystack.includes(w));
    });
    // the norm the lookup resolved to always comes first
    if (resolvedKey) list.sort((a, b) => (normalize(b.designation) === resolvedKey) - (normalize(a.designation) === resolvedKey));
    return list;
  }, [rows, query, customer, resolvedKey]);

  useEffect(() => setPage(1), [query, customer]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const coverageLabel = (coverage) =>
    t(`normLibrary.coverage_${coverage === "meaning_only" ? "meaning" : coverage || "full"}`);

  return (
    <div className="normlib-page">
      <div className="normlib-card">
        <div className="normlib-header">
          <span className="normlib-header-icon">
            <BookOpen size={15} />
          </span>
          <div>
            <h2 className="normlib-title">{t("normLibrary.title")}</h2>
            <p className="normlib-subtitle">{t("normLibrary.subtitle")}</p>
          </div>
        </div>

        <div className="normlib-toolbar">
          <label className="normlib-search">
            <Search size={15} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("normLibrary.searchPlaceholder")}
              aria-label={t("normLibrary.searchPlaceholder")}
            />
          </label>
          <select
            className="normlib-customer"
            value={customer}
            onChange={(event) => setCustomer(event.target.value)}
            aria-label={t("normLibrary.customer")}
          >
            <option value="all">
              {t("normLibrary.allCustomers")} ({rows.length})
            </option>
            {customers.map(([name, count]) => (
              <option key={name} value={name}>
                {name} ({count})
              </option>
            ))}
          </select>
        </div>

        {query.trim().length >= 3 && (
          <div className={`normlib-resolve ${resolved ? "normlib-resolve--hit" : "normlib-resolve--miss"}`}>
            <Sparkles size={15} />
            {resolving ? (
              <span>{t("normLibrary.resolving")}</span>
            ) : resolved ? (
              <span>
                {t("normLibrary.resolvedAs")}{" "}
                <strong>{resolved.label || (resolved.code ? `VW 13750 Ofl-${resolved.code}` : resolved.documentNumber)}</strong>
                {" · "}
                {t("normLibrary.schichtdicke")}: <strong>{thicknessText(resolved.thickness) || "—"}</strong>
                {" · "}
                {t("normLibrary.testReportCycles")}:{" "}
                <strong>{wizardCyclesFrom(resolved.keyFacts) ?? t("normLibrary.cyclesDefault")}</strong>
              </span>
            ) : (
              <span>{t("normLibrary.notResolved")}</span>
            )}
          </div>
        )}

        {status === "loading" && <p className="normlib-state">{t("normLibrary.loading")}</p>}
        {status === "error" && <p className="normlib-state normlib-state--error">{t("normLibrary.error")}</p>}

        {status === "ready" && (
          <>
            <p className="normlib-count">{t("normLibrary.count", { count: filtered.length })}</p>

            <div className="normlib-table-wrap">
              <table className="normlib-table">
                <thead>
                  <tr>
                    <th>{t("normLibrary.colNorm")}</th>
                    <th>{t("normLibrary.colMeaning")}</th>
                    <th>{t("normLibrary.colThickness")}</th>
                    <th>{t("normLibrary.colTests")}</th>
                    <th>{t("normLibrary.colCycles")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const id = row.designation;
                    const isOpen = !!expanded[id];
                    const facts = row.facts || [];
                    const shown = isOpen ? facts : facts.slice(0, FACTS_COLLAPSED);
                    const isResolved = resolvedKey && normalize(row.designation) === resolvedKey;
                    return (
                      <tr key={id} className={isResolved ? "normlib-row--resolved" : ""}>
                        <td data-label={t("normLibrary.colNorm")}>
                          <div className="normlib-norm">{row.designation}</div>
                          <div className="normlib-meta">
                            <span className="normlib-customer-tag">{row.customer}</span>
                            <span className={`normlib-coverage normlib-coverage--${row.coverage || "full"}`}>
                              {coverageLabel(row.coverage)}
                            </span>
                          </div>
                        </td>
                        <td data-label={t("normLibrary.colMeaning")} className="normlib-meaning">
                          {row.meaning || "—"}
                          {row.source_document && <div className="normlib-source">{row.source_document}</div>}
                        </td>
                        <td data-label={t("normLibrary.colThickness")} className="normlib-thickness">
                          {thicknessText(row.thickness) || "—"}
                        </td>
                        <td data-label={t("normLibrary.colTests")}>
                          {facts.length === 0 ? (
                            <span className="normlib-muted">{row.notes || "—"}</span>
                          ) : (
                            <ul className="normlib-facts">
                              {shown.map((fact, index) => (
                                <li key={index} title={fact.detail || ""}>
                                  <span className="normlib-fact-label">{factLabel(t, fact)}:</span>{" "}
                                  <span className="normlib-fact-value">
                                    {fact.value}
                                    {fact.unit ? ` ${fact.unit}` : ""}
                                  </span>
                                  {fact.detail && <span className="normlib-fact-detail"> — {fact.detail}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                          {facts.length > FACTS_COLLAPSED && (
                            <button
                              type="button"
                              className="normlib-more"
                              onClick={() => setExpanded((prev) => ({ ...prev, [id]: !isOpen }))}
                            >
                              {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              {isOpen
                                ? t("normLibrary.showLess")
                                : t("normLibrary.showMore", { count: facts.length - FACTS_COLLAPSED })}
                            </button>
                          )}
                        </td>
                        <td data-label={t("normLibrary.colCycles")} className="normlib-cycles">
                          {row.testReportCycles ?? <span className="normlib-muted">{t("normLibrary.cyclesDefault")}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pageCount > 1 && (
              <div className="normlib-pager">
                <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  ‹
                </button>
                <span>
                  {page} / {pageCount}
                </span>
                <button type="button" disabled={page === pageCount} onClick={() => setPage((p) => p + 1)}>
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NormLibrary;
