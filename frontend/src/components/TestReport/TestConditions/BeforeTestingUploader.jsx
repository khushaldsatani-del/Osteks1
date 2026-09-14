import React from "react";
import { ArrowLeftRight } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import ImageUploadBox from "../ImageUploadBox";

// "Upload image before testing" — a Front part / Back part reference photo
// pair with a swap button, same paired-upload design used throughout this
// wizard (ImageUploadBox x2 + swap). A controlled component now (state
// lifted to TestReport.jsx, one instance's worth of props per caller —
// OneTestCycleCard and CondensationClimateCard each pass their own
// independent state/handlers) so these photos upload to Cloud Storage and
// survive a reload, the same as every other image slot in the wizard.
const BeforeTestingUploader = ({ images, onSelect, onSwap }) => {
  const { t } = useTranslation();

  return (
    <>
      <span className="testreport-tests-label">{t("testReport.uploadImageBeforeTesting")}</span>

      <div className="testreport-photo-row testreport-cycle-photo-row">
        <ImageUploadBox
          label={t("testReport.beforeTest")}
          image={images.beforeImage}
          onSelect={(file) => onSelect("beforeImage", file)}
          onRemove={() => onSelect("beforeImage", null)}
        />

        <button type="button" className="testreport-swap-btn" onClick={onSwap} title={t("testReport.swapImages")}>
          <ArrowLeftRight size={16} />
        </button>

        <ImageUploadBox
          label={t("testReport.afterTest")}
          image={images.afterImage}
          onSelect={(file) => onSelect("afterImage", file)}
          onRemove={() => onSelect("afterImage", null)}
        />
      </div>
    </>
  );
};

export default BeforeTestingUploader;
