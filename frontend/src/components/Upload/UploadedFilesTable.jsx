import React, { useEffect, useState } from "react";
import { Files, Trash2 } from "lucide-react";
import { useTranslation } from "../../i18n/LanguageContext";

const PER_PAGE = 6;

// Sliding window centered on (ending at) the current page, e.g. for 25
// pages: current=1 -> [1,2,3,…,24,25], current=10 -> [8,9,10,…,24,25].
// The last two pages are always visible; the window itself trails the
// current page by up to 2 pages, clamped so it never runs past total-2 at
// the start or duplicates the trailing pages once it reaches them.
function getPageWindow(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

  const windowStart = Math.min(Math.max(current - 2, 1), total - 2);
  const windowEnd = windowStart + 2;
  const pages = [windowStart, windowStart + 1, windowEnd];

  if (windowEnd < total - 2) {
    pages.push("ellipsis", total - 1, total);
  } else {
    for (let page = windowEnd + 1; page <= total; page += 1) pages.push(page);
  }
  return pages;
}

// `files` is the real, DB-backed document list (see Documents.jsx's
// fetchDocuments), already newest-first — this component only slices it
// into pages of 5, it doesn't own the data.
const UploadedFilesTable = ({ files = [], onDelete, loading = false }) => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(files.length / PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PER_PAGE;
  const pageRows = files.slice(pageStart, pageStart + PER_PAGE);

  // A delete (or any list-size change) can shrink the page count below the
  // current page — snap back instead of showing a blank table.
  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const handlePrevious = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNext = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));

  return (
    <div className="uploaded-files-card">
      {/* Header */}
      <div className="uploaded-files-title">
        <span className="upload-title-icon">
          <Files size={16} />
        </span>
        {t("uploadedFiles.title")}
      </div>

      {/* Table */}
      <div className="uploaded-table-wrapper">
        <table className="uploaded-table">
          <thead>
            <tr>
              <th className="number-column">#</th>
              <th>{t("uploadedFiles.colFileName")}</th>
              <th>{t("uploadedFiles.colNorm")}</th>
              <th>{t("uploadedFiles.colDrawingNumber")}</th>
              <th>{t("uploadedFiles.colUploadedDate")}</th>
              <th className="uploaded-action-column">{t("uploadedFiles.colAction")}</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="uploaded-table-loading">
                  <span className="uploaded-table-loading-spinner" />
                  {t("uploadedFiles.loading")}
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="uploaded-table-empty">
                  {t("uploadedFiles.emptyState")}
                </td>
              </tr>
            ) : (
              pageRows.map((file) => (
                <tr key={file.id}>
                  <td>{file.id}</td>
                  <td className="file-name-cell" title={file.fileName}>
                    {file.fileName}
                  </td>
                  <td>{file.norm}</td>
                  <td>{file.drawingNumber}</td>
                  <td>{file.uploadedDate}</td>
                  <td>
                    <button
                      type="button"
                      className="uploaded-delete-btn"
                      onClick={() => onDelete?.(file.id)}
                      aria-label={t("uploadedFiles.deleteAriaLabel", { fileName: file.fileName })}
                      title={t("common.delete")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}

            {/* Blank filler rows keep the table body a constant "PER_PAGE
                rows tall" height (5 rows) even when there are only a
                handful of real records, instead of the card visibly
                shrinking as rows are filtered/deleted down to a few —
                same pattern AllDocuments' table already uses. */}
            {Array.from({
              length: Math.max(0, PER_PAGE - (pageRows.length === 0 ? 1 : pageRows.length)),
            }).map((_, index) => (
              <tr key={`filler-${index}`} className="uploaded-table-filler-row">
                <td colSpan={6}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button className="pagination-arrow" onClick={handlePrevious} disabled={safePage === 1}>
          ‹
        </button>

        {getPageWindow(safePage, totalPages).map((page, index) =>
          page === "ellipsis" ? (
            <span className="pagination-ellipsis" key={`ellipsis-${index}`}>
              …
            </span>
          ) : (
            <button
              key={page}
              className={`pagination-number ${safePage === page ? "active" : ""}`}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </button>
          )
        )}

        <button className="pagination-arrow" onClick={handleNext} disabled={safePage === totalPages}>
          ›
        </button>
      </div>
    </div>
  );
};

export default UploadedFilesTable;
