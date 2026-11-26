import React from "react";

// One section of the part form, headed like the Test Report cards (a small
// teal icon square and a bold title), its fields in a grid below - the
// sections share one card. `cols` sets how many fields share a row.
const FieldGroup = ({ title, icon: Icon, cols = 3, aside, children }) => (
  <section className="fgroup">
    <header className="fgroup-head">
      {Icon && (
        <span className="fgroup-icon">
          <Icon size={15} />
        </span>
      )}
      <h3>{title}</h3>
      {aside}
    </header>
    <div className={`fgroup-grid fgroup-grid--${cols}`}>{children}</div>
  </section>
);

export default FieldGroup;
