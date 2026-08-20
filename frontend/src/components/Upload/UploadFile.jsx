import React, { useRef, useState } from "react";
import { UploadCloud, Image as ImageIcon } from "lucide-react";
import { BACKEND_URL } from "../../config";
import "./upload.css";

const UploadFile = ({ onExtractionStart, onExtractionResult, onExtractionError, extractionStatus } = {}) => {
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);

  const extractDrawing = async (selectedFile) => {
    onExtractionStart?.(selectedFile.name);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${BACKEND_URL}/api/extract`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Extraction request failed (${response.status}).`);
      }

      onExtractionResult?.(data.summary, data.meta);
    } catch (error) {
      const isNetworkError = error instanceof TypeError;
      onExtractionError?.(
        isNetworkError
          ? "Could not reach the extraction backend. Is it running? See backend/README.md."
          : error.message
      );
    }
  };

  const handleFile = (selectedFile) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    extractDrawing(selectedFile);
  };

  const handleInputChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      handleFile(selectedFile);
    }

    // Allows selecting the same file again
    event.target.value = "";
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();

    setDragging(false);

    const droppedFile = event.dataTransfer.files?.[0];

    if (droppedFile) {
      handleFile(droppedFile);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 KB";

    const mb = bytes / (1024 * 1024);

    if (mb >= 1) {
      return `${mb.toFixed(1)} MB`;
    }

    return `${Math.round(bytes / 1024)} KB`;
  };

  return (
    <div className="upload-file-card">

      {/* Section Label */}
      <div className="upload-file-title">
        <span className="upload-title-icon">
          <UploadCloud size={16} />
        </span>
        Upload File Here
      </div>

      {/* Hidden File Input */}
      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
        onChange={handleInputChange}
      />

      {/* DROP AREA */}
      <div
        className={`upload-drop-zone ${
          dragging ? "dragging" : ""
        }`}
        onClick={openFilePicker}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragging(false);
        }}
        onDrop={handleDrop}
      >
        {/* Cloud Upload Icon */}
        <div className="upload-cloud-icon">
          <svg
            width="38"
            height="38"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9" />

            <path d="M16 16l3-3 3 3" />

            <path d="M19 13v7" />
          </svg>
        </div>

        <div className="upload-title">
          Drag & drop files here
        </div>

        <div className="upload-description">
          PDF, PNG, JPG, JPEG, TIFF
        </div>

        {/* Browse Button */}
        <button
          type="button"
          className="browse-button"
          onClick={(event) => {
            event.stopPropagation();
            openFilePicker();
          }}
        >
          Browse Files
        </button>
      </div>

      {/* SELECTED FILE */}
      {file && (
        <div className="upload-file-preview">

          {/* File Icon */}
          <div className="pdf-icon">
            <ImageIcon size={20} color="#14b8a6" />
          </div>

          {/* File Information */}
          <div className="uploaded-file-info">
            <div className="uploaded-file-name">
              {file.name}
            </div>

            <div className="uploaded-file-meta">
              {formatFileSize(file.size)}

              <span>•</span>

              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>

          {/* Status — spins while the drawing extraction is still running,
              switches to the checkmark only once it actually succeeds. */}
          {extractionStatus === "success" ? (
            <div className="uploaded-status">
              <span className="status-check">
                ✓
              </span>

              Uploaded
            </div>
          ) : extractionStatus === "error" ? (
            <div className="uploaded-status uploaded-status--error">
              <span className="status-check status-check--error">
                !
              </span>

              Failed
            </div>
          ) : (
            <div className="uploaded-status uploaded-status--pending">
              <span className="status-spinner" />
              Uploading...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UploadFile;