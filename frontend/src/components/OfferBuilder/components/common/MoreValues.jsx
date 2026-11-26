import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "../../i18n/languageContext";

// Values that normally keep their default from the calculation settings
// (wage, chain speed …) stay folded away; open to change them for this
// part only. Shows how many differ from the default.
const MoreValues = ({ changed = 0, children }) => {
  const { t } = useT();
  const [open, setOpen] = useState(changed > 0);

  return (
    <div className={`more ${open ? "is-open" : ""}`}>
      <button type="button" className="more-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <ChevronDown size={15} />
        {t("form.moreValues")}
        {changed > 0 && <span className="more-count">{t("form.changed", { n: changed })}</span>}
      </button>
      {open && <div className="fgroup-grid fgroup-grid--4">{children}</div>}
    </div>
  );
};

export default MoreValues;
