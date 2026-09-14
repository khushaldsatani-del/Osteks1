import React from "react";
import { FileText } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ReportInformationCard from "./ReportInformationCard";
import SubjectTaskCard from "./SubjectTaskCard";

// Step 1 — two cards: Report Information, then Subject / Test Task.
const BasicInformation = ({
  reportInfo,
  setReportField,
  subjectTask,
  setSubjectField,
  setSubjectSelect,
  setTestValue,
  addTest,
  removeTest,
  setSignatureImage,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <h2 className="testreport-section-title">
        <span className="testreport-section-icon">
          <FileText size={13} />
        </span>
        {t("testReport.sectionBasicInfo")}
      </h2>

      <ReportInformationCard reportInfo={reportInfo} setReportField={setReportField} />

      <SubjectTaskCard
        subjectTask={subjectTask}
        setSubjectField={setSubjectField}
        setSubjectSelect={setSubjectSelect}
        setTestValue={setTestValue}
        addTest={addTest}
        removeTest={removeTest}
        setSignatureImage={setSignatureImage}
      />
    </>
  );
};

export default BasicInformation;
