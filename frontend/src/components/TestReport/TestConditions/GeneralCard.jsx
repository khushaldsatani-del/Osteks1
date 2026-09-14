import React, { useState } from "react";
import { Settings, ChevronUp } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import CustomSelect from "../../common/CustomSelect";
import { toOptions, DURATION_CYCLES_OPTIONS, CONDENSATION_DURATION_OPTIONS, isCondensationClimateTest } from "../testReportConstants";

// "General" — Test Method and Test Duration. When the selected Test Method
// is the Condensation Water Constant Climate test, "Test Duration" picks
// an hour count (240 h / 144 h — both real values across TL 260's Ofl-code
// table, see CONDENSATION_DURATION_OPTIONS) instead of a cycle count;
// otherwise it's the usual cycle-count picker.
const GeneralCard = ({
  testMethod,
  setTestMethod,
  tests,
  durationCycles,
  setDurationCycles,
  condensationDuration,
  setCondensationDuration,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  return (
    <div className="testreport-card">
      <div className="testreport-card-header">
        <span className="testreport-card-icon">
          <Settings size={14} />
        </span>
        <h3 className="testreport-card-title">{t("testReport.general")}</h3>
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
        <div className="testreport-grid-2">
          <div className="testreport-field">
            <label htmlFor="tr-testMethod">{t("testReport.testMethod")}</label>
            <CustomSelect
              id="tr-testMethod"
              value={testMethod}
              onChange={setTestMethod}
              options={toOptions(tests.filter((test) => test.trim()))}
              placeholder={t("testReport.placeholderSelect")}
            />
          </div>

          <div className="testreport-field">
            <label htmlFor="tr-durationCycles">{t("testReport.testDurationCycles")}</label>
            {isCondensationClimateTest(testMethod) ? (
              <CustomSelect
                id="tr-durationCycles"
                value={condensationDuration}
                onChange={setCondensationDuration}
                options={CONDENSATION_DURATION_OPTIONS}
                placeholder={t("testReport.placeholderSelect")}
              />
            ) : (
              // Fixed checkpoint values, not free-typed — this is what
              // drives which "N Cycles" rail items Results shows (see
              // buildResultSections), so it has to stay one of the
              // values that list actually knows about.
              <CustomSelect
                id="tr-durationCycles"
                value={durationCycles}
                onChange={setDurationCycles}
                options={DURATION_CYCLES_OPTIONS}
                placeholder={t("testReport.placeholderSelect")}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralCard;
