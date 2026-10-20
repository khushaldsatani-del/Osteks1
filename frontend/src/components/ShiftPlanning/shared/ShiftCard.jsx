import React from "react";
import "./shiftShared.css";

// Card shell shared by the Shift Planning pages' sections: title (with an
// optional subtitle) on the left - or a custom heading such as a collapse
// toggle - optional items on the right (legend, link, filter), then the
// content.
const ShiftCard = ({ title, subtitle, heading, actions, className = "", children }) => (
  <section className={`sp-card ${className}`}>
    <div className="sp-card-header">
      {heading ??
        (subtitle ? (
          <div>
            <h3 className="sp-card-title">{title}</h3>
            <p className="sp-card-subtitle">{subtitle}</p>
          </div>
        ) : (
          <h3 className="sp-card-title">{title}</h3>
        ))}
      {actions && <div className="sp-card-actions">{actions}</div>}
    </div>
    {children}
  </section>
);

export default ShiftCard;
