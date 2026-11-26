import React from "react";

// A titled block of calculation lines, so a tab with several kinds of
// figures reads as separate groups instead of one long list.
const KeySection = ({ title, note, children }) => (
  <section className="ksec">
    <header className="ksec-head">
      <h4>{title}</h4>
      {note && <span>{note}</span>}
    </header>
    <div className="crows">{children}</div>
  </section>
);

export default KeySection;
