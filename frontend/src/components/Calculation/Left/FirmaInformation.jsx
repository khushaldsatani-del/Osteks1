import React from "react";
import { FileSpreadsheet } from "lucide-react";

const FirmaInformation = ({ values, onChange }) => {
  const set = (field) => (event) => onChange(field, event.target.value);

  return (
    <div className="calc-card">
      <div className="calc-card-header">
        <span className="calc-card-icon calc-card-icon--blue">
          <FileSpreadsheet size={16} />
        </span>
        <h3 className="calc-card-title">Firma Information</h3>
      </div>

      <div className="calc-form-grid">
        <div className="calc-field">
          <label htmlFor="companyName">Company Name</label>
          <input
            id="companyName"
            type="text"
            placeholder="Enter Company Name"
            value={values.companyName}
            onChange={set("companyName")}
          />
        </div>

        <div className="calc-field">
          <label htmlFor="address">Address</label>
          <textarea
            id="address"
            rows={1}
            placeholder={"Enter Address of company\n(one line per address line)"}
            value={values.address}
            onChange={set("address")}
          />
        </div>

        <div className="calc-field">
          <label htmlFor="offerNumber">Offer Number</label>
          <input
            id="offerNumber"
            type="text"
            placeholder="Enter Offer Number"
            value={values.offerNumber}
            onChange={set("offerNumber")}
          />
        </div>

        <div className="calc-field">
          <label htmlFor="enquiryDate">Enquiry Date</label>
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
