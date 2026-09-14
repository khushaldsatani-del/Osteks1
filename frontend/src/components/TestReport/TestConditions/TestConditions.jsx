import React from "react";
import { useTranslation } from "../../../i18n/LanguageContext";
import GeneralCard from "./GeneralCard";
import OneTestCycleCard from "./OneTestCycleCard";
import CondensationClimateCard from "./CondensationClimateCard";
import { isCorrosionChangeTest, isCondensationClimateTest } from "../testReportConstants";

// Step 2 — General card, then the (static) One Test Cycle overview, then
// the Condensation Water Constant Climate summary card.
// Which of the two reference cards below applies depends on the selected
// Test Method — see testReportConstants.js for the matching rules. Neither
// card shows until a method matching one of these is actually selected.

const TestConditions = ({
  testMethod,
  setTestMethod,
  subjectTask,
  durationCycles,
  setDurationCycles,
  condensationDuration,
  setCondensationDuration,
  reportInfo,
  cwtBegin,
  setCwtBegin,
  cwtEnd,
  setCwtEnd,
  corrosionReferenceImages,
  setCorrosionReferenceImage,
  swapCorrosionReferenceImages,
  condensationReferenceImages,
  setCondensationReferenceImage,
  swapCondensationReferenceImages,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <h2 className="testreport-section-title">
        {t("testReport.sectionTestConditions")} – {testMethod || t("testReport.testMethod")}
      </h2>

      <GeneralCard
        testMethod={testMethod}
        setTestMethod={setTestMethod}
        tests={subjectTask.tests}
        durationCycles={durationCycles}
        setDurationCycles={setDurationCycles}
        condensationDuration={condensationDuration}
        setCondensationDuration={setCondensationDuration}
        reportInfo={reportInfo}
      />

      {isCorrosionChangeTest(testMethod) && (
        <OneTestCycleCard
          referenceImages={corrosionReferenceImages}
          setReferenceImage={setCorrosionReferenceImage}
          swapReferenceImages={swapCorrosionReferenceImages}
        />
      )}

      {isCondensationClimateTest(testMethod) && (
        <CondensationClimateCard
          reportInfo={reportInfo}
          subjectTask={subjectTask}
          condensationDuration={condensationDuration}
          cwtBegin={cwtBegin}
          setCwtBegin={setCwtBegin}
          cwtEnd={cwtEnd}
          setCwtEnd={setCwtEnd}
          referenceImages={condensationReferenceImages}
          setReferenceImage={setCondensationReferenceImage}
          swapReferenceImages={swapCondensationReferenceImages}
        />
      )}
    </>
  );
};

export default TestConditions;
