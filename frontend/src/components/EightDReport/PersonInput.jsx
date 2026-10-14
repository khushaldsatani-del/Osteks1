import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { KNOWN_PEOPLE } from "./eightDReportConstants";

const MAX_LIST_HEIGHT = 220;

// A name field with suggestions: type any name, or open the list (chevron,
// or just start typing) and pick one of the regular people. `extraNames`
// adds more suggestions (e.g. the team entered in step 2). Picking calls
// `onPick` with the KNOWN_PEOPLE entry (or just { name }) so the caller can
// fill that person's department / phone / e-mail; typing only changes the
// text. The list is portaled onto <body> with fixed coordinates, exactly
// like CustomSelect, so a scrolling table never clips it, and reuses
// CustomSelect's list styles so both dropdowns look the same.
const PersonInput = ({ id, value, onChange, onPick, extraNames = [], placeholder, ariaLabel, multiline = false }) => {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [listStyle, setListStyle] = useState(null);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const suggestions = [
    ...KNOWN_PEOPLE,
    ...extraNames
      .map((name) => name.trim())
      .filter((name, index, all) => name && all.indexOf(name) === index)
      .filter((name) => !KNOWN_PEOPLE.some((person) => person.name.toLowerCase() === name.toLowerCase()))
      .map((name) => ({ name })),
  ];
  const query = (value || "").trim().toLowerCase();
  const visible = showAll || !query ? suggestions : suggestions.filter((p) => p.name.toLowerCase().includes(query));

  const updatePosition = () => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const estimated = Math.min(MAX_LIST_HEIGHT, Math.max(visible.length, 1) * 34 + 12);
    const below = window.innerHeight - rect.bottom;
    const up = below < estimated && rect.top > below;
    setListStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      right: "auto",
      top: up ? "auto" : rect.bottom + 6,
      bottom: up ? window.innerHeight - rect.top + 6 : "auto",
    });
  };

  const openList = (all) => {
    updatePosition();
    setShowAll(all);
    setHighlighted(-1);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (rootRef.current?.contains(event.target) || listRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onMove = () => updatePosition();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (person) => {
    onChange(person.name);
    onPick?.(person);
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) openList(true);
      else setHighlighted((i) => Math.min(i + 1, visible.length - 1));
    } else if (event.key === "ArrowUp" && open) {
      event.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && open && highlighted >= 0 && visible[highlighted]) {
      event.preventDefault();
      pick(visible[highlighted]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  const fieldProps = {
    id,
    ref: inputRef,
    value,
    placeholder,
    "aria-label": ariaLabel,
    autoComplete: "off",
    onChange: (event) => {
      onChange(event.target.value);
      if (!open) openList(false);
      else setShowAll(false);
    },
    onKeyDown,
  };

  return (
    <div className="eightd-person" ref={rootRef}>
      {multiline ? (
        <textarea rows={1} className="eightd-textarea--line" {...fieldProps} />
      ) : (
        <input type="text" {...fieldProps} />
      )}
      <button
        type="button"
        className="eightd-person-btn"
        tabIndex={-1}
        aria-label={ariaLabel}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => (open ? setOpen(false) : openList(true))}
      >
        <ChevronDown size={15} />
      </button>

      {open &&
        listStyle &&
        visible.length > 0 &&
        createPortal(
          <ul ref={listRef} className="custom-select-list custom-select-list--portal" style={listStyle} role="listbox">
            {visible.map((person, index) => (
              <li
                key={person.name}
                role="option"
                aria-selected={person.name === value}
                className={[
                  "custom-select-option",
                  person.name === value ? "selected" : "",
                  index === highlighted ? "highlighted" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseEnter={() => setHighlighted(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(person)}
              >
                {person.name}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
};

export default PersonInput;
