import React, { useEffect, useRef, useState } from "react";
import { Download, Ellipsis, Eye, Trash2 } from "lucide-react";
import { useTranslation } from "../../../i18n/LanguageContext";

// The "..." menu of an Upload History row. Fixed-positioned under its
// button so the table's horizontal scroll box never clips it, and moved
// with the button when the page scrolls or resizes; closes on an outside
// click or Escape.
const positionUnder = (button) => {
  const rect = button.getBoundingClientRect();
  return { top: rect.bottom + 4, right: window.innerWidth - rect.right };
};

const RowMenu = ({ canDownload, onShow, onDownload, onRemove }) => {
  const { t } = useTranslation();
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [position, setPosition] = useState(null);

  const isOpen = !!position;

  useEffect(() => {
    if (!isOpen) return undefined;
    const close = () => setPosition(null);
    const follow = () => buttonRef.current && setPosition(positionUnder(buttonRef.current));
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) close();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [isOpen]);

  const toggle = () => {
    if (position) {
      setPosition(null);
      return;
    }
    setPosition(positionUnder(buttonRef.current));
  };

  const run = (action) => () => {
    setPosition(null);
    action();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="supl-row-button"
        onClick={toggle}
        aria-label={t("shiftUpload.rowActions")}
        aria-haspopup="menu"
        aria-expanded={!!position}
      >
        <Ellipsis size={16} />
      </button>
      {position && (
        <div ref={menuRef} className="supl-menu" role="menu" style={{ top: position.top, right: position.right }}>
          <button type="button" role="menuitem" onClick={run(onShow)}>
            <Eye size={14} />
            {t("shiftUpload.showValidation")}
          </button>
          {canDownload && (
            <button type="button" role="menuitem" onClick={run(onDownload)}>
              <Download size={14} />
              {t("shiftUpload.download")}
            </button>
          )}
          <button type="button" role="menuitem" className="supl-menu-danger" onClick={run(onRemove)}>
            <Trash2 size={14} />
            {t("shiftUpload.remove")}
          </button>
        </div>
      )}
    </>
  );
};

export default RowMenu;
