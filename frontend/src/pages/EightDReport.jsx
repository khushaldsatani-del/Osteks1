import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslation } from "../i18n/LanguageContext";
import Stepper8D from "../components/EightDReport/Stepper8D";
import GeneralInformationCard from "../components/EightDReport/GeneralInformationCard";
import ThreeDInfo from "../components/EightDReport/ThreeDInfo/ThreeDInfo";
import EightDInfo from "../components/EightDReport/EightDInfo/EightDInfo";
import ViewReport from "../components/EightDReport/ViewReport/ViewReport";
import LoadingBar from "../components/TestReport/LoadingBar";
import {
  STEPS,
  getInitialGeneralInfo,
  getInitialThreeDInfo,
  getInitialEightDInfo,
} from "../components/EightDReport/eightDReportConstants";
import { getEightDReport, createEightDReport, updateEightDReport } from "../components/EightDReport/eightDReportsApi";
import "../components/EightDReport/eightDReport.css";

// Thin orchestrator, same pattern as TestReport.jsx: this page owns all the
// wizard's state, each step's own visual piece lives under
// components/EightDReport/.
//
// Persistence: a report is saved when it is downloaded (PDF or Word) from
// View Report - the first download creates the backend row, every later one
// overwrites it with the current wizard state (saveRecord below).
// `openReportId` is set by App.jsx when a row in the 8D Report Overview is
// opened (null for a fresh report from the sidebar); `onSaved` lets App
// refresh the Overview list after a save.
const EightDReport = ({ openReportId = null, onSaved }) => {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  const [generalInfo, setGeneralInfo] = useState(getInitialGeneralInfo);
  const [threeDInfo, setThreeDInfo] = useState(getInitialThreeDInfo);
  const [eightDInfo, setEightDInfo] = useState(getInitialEightDInfo);
  const [reportId, setReportId] = useState(openReportId);
  const reportIdRef = useRef(openReportId);
  const [loading, setLoading] = useState(Boolean(openReportId));
  const [loadError, setLoadError] = useState(false);

  // Opening a saved report: its stored wizard state is laid over fresh
  // defaults, so a report saved before a field existed still gets that
  // field (blank) instead of breaking the form.
  useEffect(() => {
    if (!openReportId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const report = await getEightDReport(openReportId);
        if (cancelled) return;
        const w = report.wizardState || {};
        setGeneralInfo({ ...getInitialGeneralInfo(), ...(w.generalInfo || {}) });
        setThreeDInfo((initial) => {
          const saved = w.threeDInfo || {};
          return { ...initial, ...saved, affected: { ...initial.affected, ...(saved.affected || {}) } };
        });
        setEightDInfo((initial) => {
          const saved = w.eightDInfo || {};
          return { ...initial, ...saved, checks: { ...initial.checks, ...(saved.checks || {}) } };
        });
        reportIdRef.current = report.id;
        setReportId(report.id);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openReportId]);

  // Writes the whole wizard to the backend: creates the row the first time,
  // updates it afterwards. The Overview's columns are copied out of the
  // wizard here; "customer" is the first line of Customer / Location.
  const saveRecord = async () => {
    const body = {
      reportNo: generalInfo.reportNo.trim(),
      customerReference: generalInfo.customerReferenceNumber.trim(),
      partName: generalInfo.partName.trim(),
      customer: (generalInfo.customerLocation.split("\n")[0] || "").trim(),
      complaintDate: generalInfo.complaintDate.trim(),
      wizardState: { generalInfo, threeDInfo, eightDInfo },
    };
    const saved = reportIdRef.current
      ? await updateEightDReport(reportIdRef.current, body)
      : await createEightDReport(body);
    reportIdRef.current = saved.id;
    setReportId(saved.id);
    onSaved?.();
  };

  const setField = (field, value) => setGeneralInfo((prev) => ({ ...prev, [field]: value }));

  const goBack = () => setActiveStep((step) => Math.max(0, step - 1));
  const goNext = () => setActiveStep((step) => Math.min(STEPS.length - 1, step + 1));

  if (loading) {
    return (
      <main className="eightd-page">
        <h1 className="eightd-page-title">{t("eightD.pageTitle")}</h1>
        <div className="eightd-loading">
          <p className="eightd-loading-text">{t("eightD.loadingReport")}</p>
          <LoadingBar />
        </div>
      </main>
    );
  }

  return (
    <main className="eightd-page">
      <h1 className="eightd-page-title">{t("eightD.pageTitle")}</h1>
      {loadError && <p className="eightd-load-error">{t("eightD.loadError")}</p>}

      <Stepper8D activeStep={activeStep} onSelectStep={setActiveStep} />

      {activeStep === 0 && (
        <>
          <h2 className="eightd-section-title">{t("eightD.stepGeneralInfo")}</h2>
          <GeneralInformationCard info={generalInfo} setField={setField} />
        </>
      )}

      {activeStep === 1 && <ThreeDInfo info={threeDInfo} setInfo={setThreeDInfo} />}

      {activeStep === 2 && <EightDInfo info={eightDInfo} setInfo={setEightDInfo} />}

      {activeStep === 3 && (
        <ViewReport
          generalInfo={generalInfo}
          threeDInfo={threeDInfo}
          eightDInfo={eightDInfo}
          onSaveRecord={saveRecord}
          savedRecordId={reportId}
        />
      )}

      <div className="eightd-footer">
        <button type="button" className="eightd-btn" onClick={goBack} disabled={activeStep === 0}>
          <ArrowLeft size={14} />
          {t("eightD.back")}
        </button>

        <button
          type="button"
          className="eightd-btn eightd-btn--solid"
          onClick={goNext}
          disabled={activeStep === STEPS.length - 1}
        >
          {t("eightD.next")}
          <ArrowRight size={14} />
        </button>
      </div>
    </main>
  );
};

export default EightDReport;
