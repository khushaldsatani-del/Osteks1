import React, { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "../../i18n/LanguageContext";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DOTTED_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
const WEEK = /^kw\s*(\d{1,2})$/i;

const isoToDotted = (iso) => {
  const m = ISO_DATE.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
};

const dottedToIso = (text) => {
  const m = DOTTED_DATE.exec((text || "").trim());
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
};

const pad = (n) => String(n).padStart(2, "0");
const toIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Allowed dates: from one year before today to one year after today,
// inclusive, computed fresh on every render so the window moves with the day.
const allowedRange = () => {
  const today = new Date();
  const min = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  const max = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  return { min: toIso(min), max: toIso(max) };
};

// Tidies what was typed once the field is left: "kw 3" / "Kw34" become
// "KW3" / "KW34". Anything else (a date, free text) is kept as typed.
const tidy = (text) => {
  const trimmed = (text || "").trim();
  const week = WEEK.exec(trimmed);
  return week ? `KW${Number(week[1])}` : trimmed;
};

// What's wrong with a value, as a translation key plus variables, or null
// when it is fine (empty counts as fine - none of these fields is required).
const validate = (value, range) => {
  const text = isoToDotted((value || "").trim());
  if (!text) return null;

  const week = WEEK.exec(text);
  if (week) {
    const n = Number(week[1]);
    return n >= 1 && n <= 53 ? null : { key: "eightD.weekInvalid" };
  }

  const m = DOTTED_DATE.exec(text);
  if (!m) return { key: "eightD.dateFormatInvalid" };
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const date = new Date(year, month - 1, day);
  // Rejects dates that don't exist (31.02., 30.13. ...): JS would roll them
  // over into the next month instead of failing.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { key: "eightD.dateInvalid" };
  }
  const iso = toIso(date);
  if (iso < range.min || iso > range.max) {
    return { key: "eightD.dateOutOfRange", vars: { min: isoToDotted(range.min), max: isoToDotted(range.max) } };
  }
  return null;
};

// A date field that also takes a calendar week. The value is plain text: a
// date picked from the calendar is stored as "dd.mm.yyyy"; anything typed
// (a date, "KW34") is stored as typed. The calendar button opens the
// browser's own date picker through a hidden native date input, starting at
// the date already in the field and limited to the allowed range.
//
// Validation: a date must be a real date within one year before or after
// today; a week must be KW1-KW53; anything else is flagged. The message
// shows once the field has been left (or a date was picked), not while the
// user is still typing, and the value is kept so it can be corrected.
const DateOrWeekInput = ({ id, value, onChange, ariaLabel }) => {
  const { t } = useTranslation();
  const nativeRef = useRef(null);
  const [touched, setTouched] = useState(false);

  const range = allowedRange();
  const problem = touched ? validate(value, range) : null;

  const openPicker = () => {
    const native = nativeRef.current;
    if (!native) return;
    const current = dottedToIso(value);
    native.value = current >= range.min && current <= range.max ? current : "";
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
    <div className={`eightd-date-week ${problem ? "eightd-date-week--error" : ""}`}>
      <div className="eightd-date-week-box">
        <input
          id={id}
          type="text"
          value={isoToDotted(value)}
          placeholder={t("eightD.dateOrWeekPlaceholder")}
          aria-label={ariaLabel}
          aria-invalid={problem ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => {
            setTouched(true);
            const next = tidy(event.target.value);
            if (next !== event.target.value) onChange(next);
          }}
        />
        <button
          type="button"
          className="eightd-date-week-btn"
          onClick={openPicker}
          aria-label={t("eightD.pickDate")}
          title={t("eightD.pickDate")}
        >
          <CalendarDays size={15} />
        </button>
        <input
          ref={nativeRef}
          type="date"
          className="eightd-date-week-native"
          min={range.min}
          max={range.max}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            if (!event.target.value) return;
            setTouched(true);
            onChange(isoToDotted(event.target.value));
          }}
        />
      </div>
      {problem && (
        <p className="eightd-date-week-error" role="alert">
          {t(problem.key, problem.vars)}
        </p>
      )}
    </div>
  );
};

export default DateOrWeekInput;
