import React, { useState } from "react";
import { useTranslation } from "../../../i18n/LanguageContext";
import DatePickerButton from "../shared/DatePickerButton";
import FileUploadCard from "./FileUploadCard";
import UploadHistoryCard from "./UploadHistoryCard";
import { buildSampleHistory, FILE_TYPE_ORDER } from "./uploadData";
import { isSameDay } from "../shared/shiftFormat";
import "./shiftUpload.css";

// Shift Planning > Upload: the daily ERP export and ZWZ files. Each card
// shows the file uploaded on the date picked in the header (the newest one
// that day, or the one opened from the history) and its validation; the
// history lists every upload. Files are checked in the browser and kept on
// this page only - there is no upload backend yet (see uploadData.js).
const ShiftUpload = () => {
  const { t } = useTranslation();
  const [date, setDate] = useState(() => new Date());
  const [history, setHistory] = useState(() => buildSampleHistory(new Date()));
  // file type -> history entry opened with "Show validation" / just uploaded
  const [pinned, setPinned] = useState({});

  const currentFor = (type) => {
    const sameDay = history.filter((entry) => entry.type === type && isSameDay(entry.uploadedAt, date));
    return sameDay.find((entry) => entry.id === pinned[type]) ?? sameDay.sort((a, b) => b.uploadedAt - a.uploadedAt)[0] ?? null;
  };

  const showEntry = (entry) => {
    setDate(new Date(entry.uploadedAt));
    setPinned((prev) => ({ ...prev, [entry.type]: entry.id }));
  };

  const handleUploaded = (entry) => {
    setHistory((prev) => [entry, ...prev]);
    showEntry(entry);
  };

  const downloadEntry = (entry) => {
    if (!entry.file) return;
    const url = URL.createObjectURL(entry.file);
    const link = document.createElement("a");
    link.href = url;
    link.download = entry.fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main className="sp-page">
      <div className="sp-header">
        <div className="sp-heading">
          <h2 className="sp-title">{t("shiftUpload.title")}</h2>
          <p className="sp-subtitle">{t("shiftUpload.subtitle")}</p>
        </div>
        <DatePickerButton value={date} onChange={setDate} />
      </div>

      <div className="supl-cards">
        {FILE_TYPE_ORDER.map((type) => (
          <FileUploadCard key={type} type={type} entry={currentFor(type)} date={date} onUploaded={handleUploaded} />
        ))}
      </div>

      <UploadHistoryCard
        history={history}
        onShow={(entry) => {
          showEntry(entry);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onDownload={downloadEntry}
        onRemove={(id) => setHistory((prev) => prev.filter((entry) => entry.id !== id))}
      />
    </main>
  );
};

export default ShiftUpload;
