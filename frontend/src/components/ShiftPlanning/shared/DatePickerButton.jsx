import React, { useRef } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";
import { formatShortDate, fromIsoDate, toIsoDate } from "./shiftFormat";
import "./shiftShared.css";

// The header's date button: shows the chosen day and opens the browser's
// own date picker (same hidden-native-input approach as the 8D date fields).
// With `label`, the label sits small above the date (two-line style).
const DatePickerButton = ({ value, onChange, label }) => {
  const { t, language } = useTranslation();
  const nativeRef = useRef(null);

  const openPicker = () => {
    const native = nativeRef.current;
    if (!native) return;
    if (typeof native.showPicker === "function") {
      try {
        native.showPicker();
        return;
      } catch {
        // Some browsers refuse showPicker outside a direct user gesture;
        // fall through to focusing the input instead.
      }
    }
    native.focus();
    native.click();
  };

  return (
    <div className="sp-date">
      <button
        type="button"
        className={`sp-date-button ${label ? "sp-date-button--labelled" : ""}`}
        onClick={openPicker}
        aria-label={`${t("shiftDashboard.pickDate")}: ${formatShortDate(language, value)}`}
      >
        <CalendarDays size={15} />
        {label ? (
          <span className="sp-field-text">
            <span className="sp-field-label">{label}</span>
            <span className="sp-field-value">{formatShortDate(language, value)}</span>
          </span>
        ) : (
          <span>{formatShortDate(language, value)}</span>
        )}
        <ChevronDown size={15} className="sp-date-chevron" />
      </button>
      <input
        ref={nativeRef}
        type="date"
        className="sp-date-native"
        value={toIsoDate(value)}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => event.target.value && onChange(fromIsoDate(event.target.value))}
      />
    </div>
  );
};

export default DatePickerButton;
