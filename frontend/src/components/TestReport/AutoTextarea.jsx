import React, { useEffect, useRef } from "react";

// A plain textarea grows a scrollbar once its content outgrows its fixed
// height — this one resizes itself to fit its content instead (height
// reset to "auto" then set to scrollHeight), so Evaluation's Result /
// Requirements cells never need one no matter how much text they hold.
// Re-measures on every value change, and once more on mount for content
// that arrives already long (e.g. the seeded multi-line 30-cycle text).
const AutoTextarea = ({ value, onChange, className }) => {
  const ref = useRef(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(resize, [value]);

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      onChange={onChange}
      rows={1}
    />
  );
};

export default AutoTextarea;
