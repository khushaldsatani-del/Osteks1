import React, { useState } from "react";
import { FileText, ChevronUp } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";

// "Report Information" — the first of Basic Information's two cards
// (see SubjectTaskCard for the second). Owns its own collapse state; no
// sibling needs to know whether this card is expanded.
const ReportInformationCard = ({ reportInfo, setReportField }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  return (
    <div className="testreport-card">
      <div className="testreport-card-header">
        <span className="testreport-card-icon">
          <FileText size={14} />
        </span>
        <h3 className="testreport-card-title">{t("testReport.reportInfoTitle")}</h3>
        <button
          type="button"
          className={`testreport-collapse-btn ${open ? "" : "collapsed"}`}
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle section"
        >
          <ChevronUp size={16} />
        </button>
      </div>

      {open && (
        <>
          <div className="testreport-grid-3">
            <div className="testreport-field">
              <label htmlFor="tr-reportNo">{t("testReport.reportNo")}</label>
              <input id="tr-reportNo" type="text" value={reportInfo.reportNo} onChange={setReportField("reportNo")} />
            </div>

            <div className="testreport-field">
              <label htmlFor="tr-description">{t("testReport.description")}</label>
              {/* A textarea (same element/styling family as the per-cycle
                  and Cross-cut Test "Description" fields), but height-capped
                  to match this card's other single-line inputs rather than
                  the taller multi-line box those use — this field just holds
                  a longer free-text sentence, not multiple lines. */}
              <textarea
                id="tr-description"
                rows={1}
                className="testreport-description-textarea"
                value={reportInfo.description}
                onChange={setReportField("description")}
              />
            </div>

            <div className="testreport-field">
              <label htmlFor="tr-testStartDate">{t("testReport.testStartDate")}</label>
              <input
                id="tr-testStartDate"
                type="date"
                value={reportInfo.testStartDate}
                onChange={setReportField("testStartDate")}
              />
            </div>
          </div>

          <div className="testreport-grid-3">
            <div className="testreport-field">
              <label htmlFor="tr-testObjectPart">{t("testReport.testObjectPart")}</label>
              <input
                id="tr-testObjectPart"
                type="text"
                value={reportInfo.testObjectPart}
                onChange={setReportField("testObjectPart")}
              />
            </div>

            <div className="testreport-field">
              <label htmlFor="tr-sampleReceivedDate">{t("testReport.sampleReceivedDate")}</label>
              <input
                id="tr-sampleReceivedDate"
                type="date"
                value={reportInfo.sampleReceivedDate}
                onChange={setReportField("sampleReceivedDate")}
              />
            </div>

            <div className="testreport-field">
              <label htmlFor="tr-plannedTestEndDate">{t("testReport.plannedTestEndDate")}</label>
              <input
                id="tr-plannedTestEndDate"
                type="date"
                value={reportInfo.plannedTestEndDate}
                onChange={setReportField("plannedTestEndDate")}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportInformationCard;
