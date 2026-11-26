import React, { useLayoutEffect, useRef, useState } from "react";
import { caretAfter, readTyped, showPlaceholder, showValue } from "../../engine/numberText";
import { useT } from "../../i18n/languageContext";

// A number box in the language's style - English 1,50,000.5, German
// 150.000,5 - grouped while typing, with the caret kept behind the digit
// just typed. The parent always gets the plain number ("" when empty).
// `commitOnBlur` hands it over only when the box is left (settings, where
// a half-typed value would recalculate everything for nothing).
const NumberInput = ({ value, onChange, placeholder, commitOnBlur = false, ...rest }) => {
  const { language } = useT();
  const [draft, setDraft] = useState(null); // what the box shows while it is being typed in
  const pending = useRef(undefined);
  const caret = useRef(null);
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (caret.current == null || !ref.current) return;
    ref.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  const handleChange = (event) => {
    const typed = event.target.value;
    const position = event.target.selectionStart ?? typed.length;
    const { display, value: next } = readTyped(typed, language);
    caret.current = caretAfter(typed.slice(0, position), display, language);
    setDraft(display);
    if (commitOnBlur) pending.current = next;
    else onChange?.(next);
  };

  const handleBlur = (event) => {
    if (commitOnBlur && pending.current !== undefined && pending.current !== "") onChange?.(pending.current);
    pending.current = undefined;
    setDraft(null);
    rest.onBlur?.(event);
  };

  return (
    <input
      {...rest}
      ref={ref}
      inputMode="decimal"
      autoComplete="off"
      value={draft ?? showValue(value, language)}
      placeholder={showPlaceholder(placeholder, language)}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={(event) => {
        if (commitOnBlur && event.key === "Enter") event.currentTarget.blur();
        rest.onKeyDown?.(event);
      }}
    />
  );
};

export default NumberInput;
