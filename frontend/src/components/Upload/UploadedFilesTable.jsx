import React, { useState } from "react";
import { Files } from "lucide-react";
import "./upload.css";

const UploadedFilesTable = ({ files = [] }) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = 3;

  const handlePrevious = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNext = () => {
    setCurrentPage((prev) =>
      Math.min(prev + 1, totalPages)
    );
  };

  return (
    <div className="uploaded-files-card">
      {/* Header */}
      <div className="uploaded-files-title">
        <span className="upload-title-icon">
          <Files size={16} />
        </span>
        Uploaded Files
      </div>

      {/* Table */}
      <div className="uploaded-table-wrapper">
        <table className="uploaded-table">
          <thead>
            <tr>
              <th className="number-column">#</th>
              <th>File Name</th>
              <th>Norm</th>
              <th>Drawing Number</th>
              <th>Uploaded Date</th>
            </tr>
          </thead>

          <tbody>
            {files.length === 0 ? (
              <tr>
                <td colSpan={5} className="uploaded-table-empty">
                  No files uploaded yet
                </td>
              </tr>
            ) : (
              files.map((file) => (
                <tr key={file.id}>
                  <td>{file.id}</td>
                  <td className="file-name-cell">
                    {file.fileName}
                  </td>
                  <td>{file.norm}</td>
                  <td>{file.drawingNumber}</td>
                  <td>{file.uploadedDate}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button
          className="pagination-arrow"
          onClick={handlePrevious}
          disabled={currentPage === 1}
        >
          ‹
        </button>

        {[1, 2, 3].map((page) => (
          <button
            key={page}
            className={`pagination-number ${
              currentPage === page ? "active" : ""
            }`}
            onClick={() => setCurrentPage(page)}
          >
            {page}
          </button>
        ))}

        <button
          className="pagination-arrow"
          onClick={handleNext}
          disabled={currentPage === totalPages}
        >
          ›
        </button>
      </div>
    </div>
  );
};

export default UploadedFilesTable;