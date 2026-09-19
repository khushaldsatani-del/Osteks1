import React, { useEffect, useMemo, useState } from "react";
import {
  FolderPlus,
  Search,
  ListFilter,
  Calendar,
  Download,
  ChevronDown,
  FolderOpen,
  Trash2,
  FileText,
  Mail,
  Image as ImageIcon,
} from "lucide-react";

import CustomSelect from "../common/CustomSelect";
import { formatEUR, formatGermanDigits } from "../Calculation/format";
import EmailDetailsModal from "./EmailDetailsModal";
import SpecificationModal from "./SpecificationModal";
import { useTranslation } from "../../i18n/LanguageContext";
import "./allDocuments.css";

// Short label for the Specification column cell — the code itself when the
// detected norm resolved to one (e.g. "Ofl-x639"), otherwise the plain
// document number (e.g. "TL 227") when only that resolved, otherwise "—"
// (no norm detected on this record at all, or nothing in the Standards KB
// matched it — both render identically here, matching how every other
// "nothing found" field in this table already reads).
function getSpecificationLabel(spec) {
  if (!spec) return "—";
  // Non-VW norms (BMW GS 90011, Daimler DBL, ...) carry their own full
  // designation; VW results have no label and keep the "Ofl-x633" form.
  if (spec.label) return spec.label;
  if (spec.code) return `Ofl-${spec.code}`;
  return spec.documentNumber || "—";
}

function getSortValue(row, field) {
  if (field === "totalPrice") return row.pricePerStk * row.annualQuantity;
  if (field === "annualQuantity") return row.annualQuantity;
  if (field === "pricePerStk") return row.pricePerStk;
  return 0;
}

const ROWS_PER_PAGE_OPTIONS = ["10", "15", "25", "50"].map((value) => ({ value, label: value }));

// Categorizes a row into one of the four real upload paths this app
// actually supports — PDF, Image, Email (extracted straight from an email's
// text, no usable attachment), Email + Image (an email whose attachment was
// itself processed through the normal image/PDF pipeline). "STEP" never
// belonged here — this app has never accepted STEP file uploads, so that tab
// could never match anything. `row.fileKind` ("pdf"/"tiff"/"image"/"email")
// comes from the backend's own detect_file_kind()/email extraction meta.
// TIFF counts as an Image, not a PDF: a .tif here is a scanned raster
// drawing, which is exactly what the Image tab means, and it's what the rest
// of the app already treats it as (UploadFile's DRAWING_EXTENSIONS, the test
// report's image pickers). Grouping it under PDF meant that uploading .tif
// drawings — the common case — left the Image tab permanently empty while
// listing those scans as PDFs.
// `row.mailEmailId` is set whenever a document is linked to a source email
// (see documents_repo.py's LEFT JOIN emails). Falls back to the file
// extension only for older rows saved before file_kind existed.
function getFileTypeMeta(row) {
  const ext = (row.fileName || "").split(".").pop()?.toLowerCase() ?? "";
  const isPdf = row.fileKind === "pdf" || ext === "pdf";
  const isImage =
    row.fileKind === "image" || row.fileKind === "tiff" || ["png", "jpg", "jpeg", "webp", "tif", "tiff"].includes(ext);
  const isEmail = Boolean(row.mailEmailId) || row.fileKind === "email";

  if (isEmail && (isPdf || isImage)) {
    return { tab: "email-image", Icon: Mail, color: "#b45309", bg: "#fef3e2" };
  }
  if (isEmail) return { tab: "email", Icon: Mail, color: "#7c3aed", bg: "#f0e9fd" };
  if (isPdf) return { tab: "pdf", Icon: FileText, color: "#d64545", bg: "#fdecea" };
  if (isImage) return { tab: "image", Icon: ImageIcon, color: "#14b8a6", bg: "#e1f7f3" };
  return { tab: "other", Icon: FileText, color: "#8992a1", bg: "#f1f3f8" };
}

function formatDMY(date) {
  return [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    date.getFullYear(),
  ].join("-");
}

// Static first-five-then-ellipsis window (matches the reference layout) —
// same level of pagination sophistication as the rest of this app's tables,
// just driven by real page counts instead of a hardcoded "3".
function getPageWindow(totalPages) {
  if (totalPages <= 6) return Array.from({ length: totalPages }, (_, i) => i + 1);
  return [1, 2, 3, 4, 5, "ellipsis", totalPages];
}

// `records` is the saved-document list (App.jsx owns it — see the Save
// button note below); `onUpdateStatus`/`onDelete` mutate that shared list
// rather than a local copy, so status changes/deletes here are visible
// everywhere this data is used. `onOpenWorkspace` switches the sidebar back
// to Work Place (for the row action menu's "Open in Workspace" entry).
const AllDocuments = ({ records = [], onUpdateStatus, onDelete, onOpenWorkspace }) => {
  const { t } = useTranslation();

  const STATUS_OPTIONS = [
    // Only two states exist: a row is created by extraction as "pending" and
    // flips to "created" when Save is pressed in the workspace (see
    // documents_repo.py's update_document). Both are still selectable here so
    // a row can be put back by hand.
    { value: "pending", label: t("allDocuments.statusPending") },
    { value: "created", label: t("allDocuments.statusCreated") },
  ];

  const SORT_FIELDS = [
    { value: "totalPrice", label: t("allDocuments.sortTotalPrice") },
    { value: "annualQuantity", label: t("allDocuments.sortAnnualQuantity") },
    { value: "pricePerStk", label: t("allDocuments.sortPricePerStk") },
  ];

  const FILE_TABS = [
    { id: "all", label: t("allDocuments.tabAll") },
    { id: "pdf", label: t("allDocuments.tabPdf") },
    { id: "image", label: t("allDocuments.tabImage") },
    { id: "email", label: t("allDocuments.tabEmail") },
    { id: "email-image", label: t("allDocuments.tabEmailImage") },
  ];

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState([]);
  const [sort, setSort] = useState({ field: null, direction: null });
  const [rowsPerPage, setRowsPerPage] = useState("15");
  const [currentPage, setCurrentPage] = useState(1);

  const [dateOpen, setDateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [openStatusId, setOpenStatusId] = useState(null);
  const [openEmailId, setOpenEmailId] = useState(null);
  const [openSpecification, setOpenSpecification] = useState(null);

  // One delegated listener closes whichever popover/dropdown is open when
  // the user clicks anywhere outside it — same click-outside pattern
  // CustomSelect already uses, just shared across every popover here.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".alldocs-date-popover-wrap")) setDateOpen(false);
      if (!event.target.closest(".alldocs-filter-popover-wrap")) setFilterOpen(false);
      if (!event.target.closest(".alldocs-status-select")) setOpenStatusId(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;

    return records.filter((row) => {
      if (query) {
        const haystack = `${row.fileName} ${row.customerName} ${row.customerNumber}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (activeTab !== "all" && getFileTypeMeta(row).tab !== activeTab) return false;

      if (statusFilter.length > 0 && !statusFilter.includes(row.status)) return false;

      if (from && row.uploadedAt < from) return false;
      if (to) {
        const toEnd = new Date(to);
        toEnd.setHours(23, 59, 59, 999);
        if (row.uploadedAt > toEnd) return false;
      }

      return true;
    });
  }, [records, search, activeTab, statusFilter, dateFrom, dateTo]);

  const sortedRows = useMemo(() => {
    if (!sort.field) return filteredRows;
    const sorted = [...filteredRows].sort((a, b) => getSortValue(a, sort.field) - getSortValue(b, sort.field));
    return sort.direction === "desc" ? sorted.reverse() : sorted;
  }, [filteredRows, sort]);

  const perPage = Number(rowsPerPage) || 15;
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * perPage;
  const pageRows = sortedRows.slice(pageStart, pageStart + perPage);

  // Any filter/search/page-size change can shrink the result set below the
  // current page — snap back to the last valid page instead of showing a
  // blank table.
  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const updateStatus = (id, status) => {
    onUpdateStatus?.(id, status);
    setOpenStatusId(null);
  };

  const deleteRow = (id) => {
    onDelete?.(id);
  };

  const toggleStatusFilter = (value) => {
    setStatusFilter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const handleExport = () => {
    const header = [
      t("allDocuments.csvFileName"),
      t("allDocuments.csvNorm"),
      t("allDocuments.csvCustomerName"),
      t("allDocuments.csvCustomerNumber"),
      t("allDocuments.csvPricePerStk"),
      t("allDocuments.csvAnnualQuantity"),
      t("allDocuments.csvTotalPrice"),
      t("allDocuments.csvSpecification"),
      t("allDocuments.csvMail"),
      t("allDocuments.csvUploadedDate"),
      t("allDocuments.csvStatus"),
    ];
    const csvRows = sortedRows.map((row) => {
      const total = row.pricePerStk * row.annualQuantity;
      return [
        row.fileName,
        row.norm,
        row.customerName,
        row.customerNumber,
        row.pricePerStk.toFixed(2),
        row.annualQuantity,
        total.toFixed(2),
        getSpecificationLabel(row.kbSpecification),
        row.mailSubject || "—",
        formatDMY(row.uploadedAt),
        STATUS_OPTIONS.find((option) => option.value === row.status)?.label ?? row.status,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",");
    });
    const csv = [header.join(","), ...csvRows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = t("allDocuments.csvFilename");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const dateRangeLabel =
    dateFrom || dateTo ? `${dateFrom || "…"} → ${dateTo || "…"}` : t("allDocuments.selectDateRange");

  return (
    <div className="alldocs-page">
      <div className="alldocs-card">
        <div className="alldocs-header">
          <span className="alldocs-header-icon">
            <FolderPlus size={13} />
          </span>
          <h2 className="alldocs-title">{t("allDocuments.pageTitle")}</h2>
        </div>

        <div className="alldocs-toolbar">
          <div className="alldocs-search">
            <Search size={14} />
            <input
              type="text"
              placeholder={t("allDocuments.searchPlaceholder")}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="alldocs-filter-tabs">
            {FILE_TABS.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={`alldocs-filter-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setCurrentPage(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="alldocs-popover-wrap alldocs-date-popover-wrap">
            <button type="button" className="alldocs-btn" onClick={() => setDateOpen((prev) => !prev)}>
              <Calendar size={14} />
              {dateRangeLabel}
              <ChevronDown size={15} />
            </button>

            {dateOpen && (
              <div className="alldocs-popover">
                <div className="alldocs-popover-row">
                  <span className="alldocs-popover-label">{t("allDocuments.from")}</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => {
                      setDateFrom(event.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
                <div className="alldocs-popover-row">
                  <span className="alldocs-popover-label">{t("allDocuments.to")}</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => {
                      setDateTo(event.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="alldocs-popover-clear"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  {t("allDocuments.clear")}
                </button>
              </div>
            )}
          </div>

          <div className="alldocs-rows-select">
            <span>{t("allDocuments.rows")}</span>
            <CustomSelect
              value={rowsPerPage}
              onChange={(value) => {
                setRowsPerPage(value);
                setCurrentPage(1);
              }}
              options={ROWS_PER_PAGE_OPTIONS}
            />
          </div>

          <div className="alldocs-popover-wrap alldocs-filter-popover-wrap">
            <button type="button" className="alldocs-btn" onClick={() => setFilterOpen((prev) => !prev)}>
              <ListFilter size={14} />
              {t("allDocuments.filter")}
            </button>

            {filterOpen && (
              <div className="alldocs-popover alldocs-popover--wide">
                <div className="alldocs-popover-row">
                  <span className="alldocs-popover-label">{t("allDocuments.status")}</span>
                  {STATUS_OPTIONS.map((option) => (
                    <label className="alldocs-checkbox-row" key={option.value}>
                      <input
                        type="checkbox"
                        checked={statusFilter.includes(option.value)}
                        onChange={() => {
                          toggleStatusFilter(option.value);
                          setCurrentPage(1);
                        }}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>

                <div className="alldocs-popover-row">
                  <span className="alldocs-popover-label">{t("allDocuments.sortBy")}</span>
                  {SORT_FIELDS.map((field) => (
                    <div className="alldocs-sort-row" key={field.value}>
                      <span>{field.label}</span>
                      <div className="alldocs-sort-buttons">
                        <button
                          type="button"
                          className={sort.field === field.value && sort.direction === "desc" ? "active" : ""}
                          onClick={() => setSort({ field: field.value, direction: "desc" })}
                        >
                          {t("allDocuments.highToLow")}
                        </button>
                        <button
                          type="button"
                          className={sort.field === field.value && sort.direction === "asc" ? "active" : ""}
                          onClick={() => setSort({ field: field.value, direction: "asc" })}
                        >
                          {t("allDocuments.lowToHigh")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="alldocs-popover-clear"
                  onClick={() => {
                    setStatusFilter([]);
                    setSort({ field: null, direction: null });
                  }}
                >
                  {t("allDocuments.clearFilters")}
                </button>
              </div>
            )}
          </div>

          <button type="button" className="alldocs-btn alldocs-btn--solid" onClick={handleExport}>
            <Download size={14} />
            {t("allDocuments.export")}
          </button>
        </div>

        <div className="alldocs-table-wrapper">
          <table className="alldocs-table">
            <thead>
              <tr>
                <th className="alldocs-number-column">#</th>
                <th>{t("allDocuments.colFileName")}</th>
                <th>{t("allDocuments.colNorm")}</th>
                <th>{t("allDocuments.colCustomerName")}</th>
                <th>{t("allDocuments.colCustomerNumber")}</th>
                <th>{t("allDocuments.colPricePerStk")}</th>
                <th>{t("allDocuments.colAnnualQuantity")}</th>
                <th>{t("allDocuments.colTotalPrice")}</th>
                <th>{t("allDocuments.colSpecification")}</th>
                <th>{t("allDocuments.colMail")}</th>
                <th>{t("allDocuments.colUploadedDate")}</th>
                <th>{t("allDocuments.colStatus")}</th>
                <th>{t("allDocuments.colAction")}</th>
              </tr>
            </thead>

            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="alldocs-table-empty">
                    {records.length === 0
                      ? t("allDocuments.emptyNoDocuments")
                      : t("allDocuments.emptyNoMatch")}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const { Icon, color, bg } = getFileTypeMeta(row);
                  const total = row.pricePerStk * row.annualQuantity;

                  return (
                    <tr key={row.id}>
                      <td className="alldocs-number-column">{row.id}</td>
                      <td className="alldocs-filename-cell" title={row.fileName}>
                        <span className="alldocs-file-icon" style={{ background: bg, color }}>
                          <Icon size={11} />
                        </span>
                        {row.fileName}
                      </td>
                      <td>{row.norm}</td>
                      <td>{row.customerName}</td>
                      <td>{row.customerNumber}</td>
                      <td>{formatEUR(row.pricePerStk)}</td>
                      <td>{formatGermanDigits(String(row.annualQuantity))}</td>
                      <td>{formatEUR(total, 0)}</td>
                      <td className="alldocs-specification-cell">
                        {row.kbSpecification ? (
                          <button
                            type="button"
                            className="alldocs-specification-link"
                            onClick={() => setOpenSpecification(row.kbSpecification)}
                            title={t("allDocuments.viewSpecification")}
                          >
                            {getSpecificationLabel(row.kbSpecification)}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="alldocs-mail-cell">
                        {row.mailEmailId ? (
                          <button
                            type="button"
                            className="alldocs-mail-link"
                            onClick={() => setOpenEmailId(row.mailEmailId)}
                            title={row.mailSubject || t("allDocuments.email")}
                          >
                            ✉ {row.mailSubject || t("allDocuments.email")}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{formatDMY(row.uploadedAt)}</td>
                      <td>
                        <div className="alldocs-status-select">
                          <button
                            type="button"
                            className={`alldocs-status-trigger alldocs-status--${row.status}`}
                            aria-expanded={openStatusId === row.id}
                            onClick={() => setOpenStatusId((prev) => (prev === row.id ? null : row.id))}
                          >
                            {STATUS_OPTIONS.find((option) => option.value === row.status)?.label ?? row.status}
                            <ChevronDown size={15} />
                          </button>

                          {openStatusId === row.id && (
                            <ul className="alldocs-status-list">
                              {STATUS_OPTIONS.map((option) => (
                                <li
                                  key={option.value}
                                  className="alldocs-status-option"
                                  onClick={() => updateStatus(row.id, option.value)}
                                >
                                  {option.label}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="alldocs-row-actions">
                          <button
                            type="button"
                            className="alldocs-row-action-btn"
                            onClick={() => onOpenWorkspace?.(row.id)}
                            aria-label={t("allDocuments.openInWorkspace")}
                            title={t("allDocuments.openInWorkspace")}
                          >
                            <FolderOpen size={15} />
                          </button>
                          <button
                            type="button"
                            className="alldocs-row-action-btn alldocs-row-action-btn--danger"
                            onClick={() => deleteRow(row.id)}
                            aria-label={t("allDocuments.delete")}
                            title={t("allDocuments.delete")}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Blank filler rows keep the table body a constant "perPage
                  rows tall" height (e.g. 15 rows) even when there's only a
                  handful of real records, instead of the table visibly
                  shrinking as rows are filtered/deleted down to a few. */}
              {Array.from({
                length: Math.max(0, perPage - (pageRows.length === 0 ? 1 : pageRows.length)),
              }).map((_, index) => (
                <tr key={`filler-${index}`} className="alldocs-table-filler-row">
                  <td colSpan={13}>&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="alldocs-footer">
          <span className="alldocs-showing">
            {sortedRows.length === 0
              ? t("allDocuments.showingZero")
              : t("allDocuments.showingRange", {
                  from: pageStart + 1,
                  to: Math.min(pageStart + perPage, sortedRows.length),
                  total: sortedRows.length,
                })}
          </span>

          <div className="alldocs-pagination">
            <button type="button" onClick={() => setCurrentPage(1)} disabled={safePage === 1}>
              «
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={safePage === 1}
            >
              ‹
            </button>

            {getPageWindow(totalPages).map((page, index) =>
              page === "ellipsis" ? (
                <span className="alldocs-pagination-ellipsis" key={`ellipsis-${index}`}>
                  …
                </span>
              ) : (
                <button
                  type="button"
                  key={page}
                  className={safePage === page ? "active" : ""}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={safePage === totalPages}
            >
              ›
            </button>
            <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages}>
              »
            </button>
          </div>
        </div>
      </div>

      <EmailDetailsModal emailId={openEmailId} onClose={() => setOpenEmailId(null)} />
      <SpecificationModal specification={openSpecification} onClose={() => setOpenSpecification(null)} />
    </div>
  );
};

export default AllDocuments;
