import React, { useState } from "react";
import { ChevronUp } from "lucide-react";
import { useTranslation } from "../../i18n/LanguageContext";

// Card shell shared by the 8D wizard's sections: icon badge + title +
// collapse chevron, same header as GeneralInformationCard, plus an optional
// one-line subtitle under the title. Owns its own collapse state.
const CollapsibleCard = ({ icon: Icon, title, subtitle, children }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  return (
    <div className="eightd-card">
      <div className={`eightd-card-header ${open ? "" : "eightd-card-header--collapsed"}`}>
        <span className="eightd-card-icon">
          <Icon size={14} />
        </span>
        <div className="eightd-card-heading">
          <h3 className="eightd-card-title">{title}</h3>
          {subtitle && <p className="eightd-card-subtitle">{subtitle}</p>}
        </div>
        <button
          type="button"
          className={`eightd-collapse-btn ${open ? "" : "collapsed"}`}
          onClick={() => setOpen((o) => !o)}
          aria-label={t("eightD.toggleSection")}
        >
          <ChevronUp size={16} />
        </button>
      </div>

      {open && children}
    </div>
  );
};

export default CollapsibleCard;
