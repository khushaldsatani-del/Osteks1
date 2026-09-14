import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import "./customSelect.css";

// A native <select> popup is rendered by the OS/browser, not the page, so
// its option hover color can't be restyled with CSS — it always uses the
// system accent color. This is a fully custom dropdown instead, so the
// hover/selected state can match the app's theme exactly.
// The list's own CSS caps it at 220px tall — used here purely to estimate
// how much room it actually needs before deciding which way to open.
const MAX_LIST_HEIGHT = 220;

const CustomSelect = ({ id, value, onChange, options, placeholder = "Select" }) => {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  // The list is portaled straight onto <body> (see the render below) so it
  // is never clipped by a scrolling ancestor — e.g. the Results table's own
  // scroll box, which used to clip/hide the options entirely for a select
  // near its bottom edge no matter which way the list tried to open. Since
  // it's no longer positioned relative to its trigger via CSS, its exact
  // fixed-viewport coordinates (and open-upward decision) are computed here
  // instead, and kept live while open in case the trigger itself scrolls.
  const [listStyle, setListStyle] = useState(null);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const selectedOption = options.find((option) => option.value === value);

  const updatePosition = () => {
    if (!rootRef.current) return;
    const triggerRect = rootRef.current.getBoundingClientRect();
    const estimatedListHeight = Math.min(MAX_LIST_HEIGHT, options.length * 34 + 12);
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    // Only flip when there's genuinely more room above — never flips a
    // dropdown that already fits below just because there's even more
    // space above it.
    const up = spaceBelow < estimatedListHeight && spaceAbove > spaceBelow;
    setListStyle({
      position: "fixed",
      left: triggerRect.left,
      width: triggerRect.width,
      right: "auto",
      top: up ? "auto" : triggerRect.bottom + 6,
      bottom: up ? window.innerHeight - triggerRect.top + 6 : "auto",
    });
  };

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      const insideTrigger = rootRef.current && rootRef.current.contains(event.target);
      const insideList = listRef.current && listRef.current.contains(event.target);
      if (!insideTrigger && !insideList) setOpen(false);
    };
    // capture:true so a scroll anywhere (including the Results table's own
    // scroll box, an ancestor of the trigger but not of the portaled list)
    // still reaches this listener and keeps the fixed-position list glued
    // to its trigger instead of drifting away from it.
    const handleReposition = () => updatePosition();

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const openList = () => {
    updatePosition();
    setOpen(true);
    const currentIndex = options.findIndex((option) => option.value === value);
    setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
  };

  const selectOption = (option) => {
    onChange(option.value);
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, options.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (highlightedIndex >= 0) selectOption(options[highlightedIndex]);
    }
  };

  return (
    <div className="custom-select" ref={rootRef}>
      <button
        type="button"
        id={id}
        className="custom-select-trigger"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selectedOption ? undefined : "custom-select-placeholder"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={15} className="custom-select-chevron" />
      </button>

      {open &&
        listStyle &&
        createPortal(
          <ul ref={listRef} className="custom-select-list custom-select-list--portal" style={listStyle} role="listbox">
            {options.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={[
                  "custom-select-option",
                  option.value === value ? "selected" : "",
                  index === highlightedIndex ? "highlighted" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOption(option)}
              >
                {option.label}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
};

export default CustomSelect;
