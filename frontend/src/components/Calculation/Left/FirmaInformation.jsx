import React from "react";
import { FileSpreadsheet } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";

const FirmaInformation = ({ values, onChange }) => {
  const { t } = useTranslation();
  const set = (field) => (event) => onChange(field, event.target.value);

  return (
    <div className="calc-card">
      <div className="calc-card-header">
        <span className="calc-card-icon calc-card-icon--blue">
          <FileSpreadsheet size={16} />
        </span>
        <h3 className="calc-card-title">{t("firmaInformation.title")}</h3>
      </div>

      <div className="calc-form-grid">
        <div className="calc-field">
          <label htmlFor="companyName">{t("firmaInformation.companyName")}</label>
          <input
            id="companyName"
            type="text"
            placeholder={t("firmaInformation.enterCompanyName")}
            value={values.companyName}
            onChange={set("companyName")}
          />
        </div>

        <div className="calc-field">
          <label htmlFor="address">{t("firmaInformation.address")}</label>
          <textarea
            id="address"
            rows={1}
            placeholder={t("firmaInformation.enterAddress")}
            value={values.address}
            onChange={set("address")}
          />
        </div>

        <div className="calc-field">
          <label htmlFor="offerNumber">{t("firmaInformation.offerNumber")}</label>
          <input
            id="offerNumber"
            type="text"
            placeholder={t("firmaInformation.enterOfferNumber")}
            value={values.offerNumber}
            onChange={set("offerNumber")}
          />
        </div>

        <div className="calc-field">
          <label htmlFor="enquiryDate">{t("firmaInformation.enquiryDate")}</label>
          <input
            id="enquiryDate"
            type="date"
            value={values.enquiryDate}
            onChange={set("enquiryDate")}
          />
        </div>
      </div>
    </div>
  );
};

export default FirmaInformation;
