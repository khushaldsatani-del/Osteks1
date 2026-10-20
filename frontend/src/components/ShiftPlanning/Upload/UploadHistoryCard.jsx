import React, { useMemo, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ShiftCard from "../shared/ShiftCard";
import RowMenu from "./RowMenu";
import { FILE_TYPES, HISTORY_RANGES, STATUS_META } from "./uploadData";
import { addDays, formatDateTimeDots, formatFileSize, formatNumber } from "../shared/shiftFormat";

// Every upload in the chosen period, newest first.
const UploadHistoryCard = ({ history, onShow, onDownload, onRemove }) => {
  const { t, language } = useTranslation();
  const [rangeId, setRangeId] = useState("7");

  const rows = useMemo(() => {
    const range = HISTORY_RANGES.find((r) => r.id === rangeId);
    const from = range.days ? addDays(new Date(), -(range.days - 1)) : null;
    if (from) from.setHours(0, 0, 0, 0);
    return history
      .filter((entry) => !from || entry.uploadedAt >= from)
      .sort((a, b) => b.uploadedAt - a.uploadedAt);
  }, [history, rangeId]);

  return (
    <ShiftCard
      title={t("shiftUpload.historyTitle")}
      subtitle={t("shiftUpload.historySubtitle")}
      actions={
        <label className="supl-range">
          <CalendarDays size={15} />
          <select value={rangeId} onChange={(event) => setRangeId(event.target.value)} aria-label={t("shiftUpload.rangeLabel")}>
            {HISTORY_RANGES.map((range) => (
              <option key={range.id} value={range.id}>
                {t(`shiftUpload.range_${range.id}`)}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="supl-range-chevron" />
        </label>
      }
    >
      <div className="sp-table-wrap">
        <table className="sp-table supl-history">
          <thead>
            <tr>
              <th>{t("shiftUpload.colDateTime")}</th>
              <th>{t("shiftUpload.colFileType")}</th>
              <th>{t("shiftUpload.colFileName")}</th>
              <th>{t("shiftUpload.colStatus")}</th>
              <th className="sp-num">{t("shiftUpload.colRows")}</th>
              <th className="sp-num">{t("shiftUpload.colSize")}</th>
              <th>{t("shiftUpload.colUploadedBy")}</th>
              <th>
                <span className="supl-sr-only">{t("shiftUpload.colActions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="supl-history-empty">
                  {t("shiftUpload.noHistory")}
                </td>
              </tr>
            ) : (
              rows.map((entry) => {
                const TypeIcon = FILE_TYPES[entry.type].icon;
                const { tone, icon: StatusIcon } = STATUS_META[entry.status];
                const readable = entry.status !== "unreadable" && entry.status !== "invalidFormat";
                return (
                  <tr key={entry.id}>
                    <td>{formatDateTimeDots(entry.uploadedAt)}</td>
                    <td>
                      <span className={`supl-file-type supl-file-type--${entry.type}`}>
                        <TypeIcon size={15} />
                        {t(`shiftUpload.${entry.type}Title`)}
                      </span>
                    </td>
                    <td className="supl-history-name">{entry.fileName}</td>
                    <td>
                      <span className={`supl-badge supl-badge--${tone}`}>
                        <StatusIcon size={13} />
                        {t(`shiftUpload.status_${entry.status}`)}
                      </span>
                    </td>
                    <td className="sp-num">{readable ? formatNumber(language, entry.rows) : "-"}</td>
                    <td className="sp-num">{formatFileSize(language, entry.size)}</td>
                    <td>{entry.user}</td>
                    <td className="supl-history-actions">
                      <RowMenu
                        canDownload={!!entry.file}
                        onShow={() => onShow(entry)}
                        onDownload={() => onDownload(entry)}
                        onRemove={() => onRemove(entry.id)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </ShiftCard>
  );
};

export default UploadHistoryCard;
