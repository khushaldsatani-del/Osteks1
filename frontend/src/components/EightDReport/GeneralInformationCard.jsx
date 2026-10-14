import React, { useState } from "react";
import { FileText, ChevronUp, Check } from "lucide-react";
import { useTranslation } from "../../i18n/LanguageContext";
import CustomSelect from "../common/CustomSelect";
import DateOrWeekInput from "./DateOrWeekInput";
import PersonInput from "./PersonInput";
import { getDepartmentOptions } from "./eightDReportConstants";

// Step 1's single card — matches the given screenshot field-for-field:
// 3-column grid, 3 date pickers, a Department dropdown (fixed CustomSelect,
// same pattern as Test Report's Material field), and a Customer/Location
// textarea paired with a two-option Complaint toggle (Accepted/Rejected —
// mutually exclusive, so picking one clears the other) in the row's third
// slot is left empty, matching the screenshot's layout exactly.
const GeneralInformationCard = ({ info, setField }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  const setText = (field) => (event) => setField(field, event.target.value);
  const setComplaint = (status) => () => setField("complaintStatus", info.complaintStatus === status ? "" : status);

  return (
    <div className="eightd-card">
      <div className="eightd-card-header">
        <span className="eightd-card-icon">
          <FileText size={14} />
        </span>
        <h3 className="eightd-card-title">{t("eightD.generalInfoTitle")}</h3>
        <button
          type="button"
          className={`eightd-collapse-btn ${open ? "" : "collapsed"}`}
          onClick={() => setOpen((o) => !o)}
          aria-label={t("eightD.toggleSection")}
        >
          <ChevronUp size={16} />
        </button>
      </div>

      {open && (
        <>
          <div className="eightd-grid-3 eightd-grid--top">
            <div className="eightd-field">
              <label htmlFor="ed-customerReferenceNumber">{t("eightD.customerReferenceNumber")}</label>
              <input
                id="ed-customerReferenceNumber"
                type="text"
                value={info.customerReferenceNumber}
                onChange={setText("customerReferenceNumber")}
              />
            </div>

            <div className="eightd-field">
              <label htmlFor="ed-reportNo">{t("eightD.reportNo")}</label>
              <input id="ed-reportNo" type="text" value={info.reportNo} onChange={setText("reportNo")} />
            </div>

            <div className="eightd-field">
              <label htmlFor="ed-customerItemNo">{t("eightD.customerItemNo")}</label>
              <textarea
                id="ed-customerItemNo"
                rows={1}
                className="eightd-textarea--line"
                value={info.customerItemNo}
                onChange={setText("customerItemNo")}
              />
            </div>
          </div>

          <div className="eightd-grid-3 eightd-grid--top">
            <div className="eightd-field">
              <label htmlFor="ed-supplierItemNo">{t("eightD.supplierItemNo")}</label>
              <textarea
                id="ed-supplierItemNo"
                rows={1}
                className="eightd-textarea--line"
                value={info.supplierItemNo}
                onChange={setText("supplierItemNo")}
              />
            </div>

            <div className="eightd-field">
              <label htmlFor="ed-partName">{t("eightD.partName")}</label>
              <input id="ed-partName" type="text" value={info.partName} onChange={setText("partName")} />
            </div>

            <div className="eightd-field">
              <label htmlFor="ed-rejectedPartsCount">{t("eightD.rejectedPartsCount")}</label>
              <input
                id="ed-rejectedPartsCount"
                type="text"
                inputMode="numeric"
                value={info.rejectedPartsCount}
                onChange={setText("rejectedPartsCount")}
              />
            </div>
          </div>

          <div className="eightd-grid-3 eightd-grid--top">
            <div className="eightd-field">
              <label htmlFor="ed-complaintDate">{t("eightD.complaintDate")}</label>
              <DateOrWeekInput
                id="ed-complaintDate"
                value={info.complaintDate}
                onChange={(value) => setField("complaintDate", value)}
              />
            </div>

            <div className="eightd-field">
              <label htmlFor="ed-startDate">{t("eightD.startDate")}</label>
              <DateOrWeekInput id="ed-startDate" value={info.startDate} onChange={(value) => setField("startDate", value)} />
            </div>

            <div className="eightd-field">
              <label htmlFor="ed-statusDate">{t("eightD.statusDate")}</label>
              <DateOrWeekInput id="ed-statusDate" value={info.statusDate} onChange={(value) => setField("statusDate", value)} />
            </div>
          </div>

          <div className="eightd-grid-3 eightd-grid--top">
            <div className="eightd-field">
              <label htmlFor="ed-supplierContact">{t("eightD.supplierContact")}</label>
              <PersonInput
                id="ed-supplierContact"
                value={info.supplierContact}
                onChange={(value) => setField("supplierContact", value)}
                onPick={(person) => {
                  // A regular person brings their phone number, and their
                  // department when it is one of the dropdown's options.
                  if (person.phone) setField("phoneNo", person.phone);
                  if (getDepartmentOptions(t).some((option) => option.value === person.department)) {
                    setField("department", person.department);
                  }
                }}
              />
            </div>

            <div className="eightd-field">
              <label htmlFor="ed-department">{t("eightD.department")}</label>
              <CustomSelect
                id="ed-department"
                value={info.department}
                onChange={(value) => setField("department", value)}
                options={getDepartmentOptions(t)}
                placeholder={t("eightD.placeholderSelect")}
              />
            </div>

            <div className="eightd-field">
              <label htmlFor="ed-phoneNo">{t("eightD.phoneNo")}</label>
              <input id="ed-phoneNo" type="text" value={info.phoneNo} onChange={setText("phoneNo")} />
            </div>
          </div>

          <div className="eightd-grid-3 eightd-grid--top">
            <div className="eightd-field">
              <label htmlFor="ed-customerLocation">{t("eightD.customerLocation")}</label>
              <textarea
                id="ed-customerLocation"
                rows={2}
                value={info.customerLocation}
                onChange={setText("customerLocation")}
              />
            </div>

            <div className="eightd-field">
              <label>{t("eightD.complaint")}</label>
              <div className="eightd-checkbox-group">
                <span
                  role="checkbox"
                  tabIndex={0}
                  aria-checked={info.complaintStatus === "accepted"}
                  className={`eightd-checkbox-option ${info.complaintStatus === "accepted" ? "checked" : ""}`}
                  onClick={setComplaint("accepted")}
                  onKeyDown={(event) => event.key === "Enter" && setComplaint("accepted")()}
                >
                  <span className="eightd-checkbox-box">
                    {info.complaintStatus === "accepted" && <Check size={13} strokeWidth={3} />}
                  </span>
                  {t("eightD.accepted")}
                </span>
                <span
                  role="checkbox"
                  tabIndex={0}
                  aria-checked={info.complaintStatus === "rejected"}
                  className={`eightd-checkbox-option ${info.complaintStatus === "rejected" ? "checked" : ""}`}
                  onClick={setComplaint("rejected")}
                  onKeyDown={(event) => event.key === "Enter" && setComplaint("rejected")()}
                >
                  <span className="eightd-checkbox-box">
                    {info.complaintStatus === "rejected" && <Check size={13} strokeWidth={3} />}
                  </span>
                  {t("eightD.rejected")}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GeneralInformationCard;
