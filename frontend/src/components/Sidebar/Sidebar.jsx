import { useEffect, useState } from "react";
import {
  House,
  Files,
  FlaskConical,
  ShieldAlert,
  BookOpen,
  CalendarClock,
  Factory,
  ChevronDown,
  Settings,
  X,
} from "lucide-react";

import { useLanguage, useTranslation } from "../../i18n/LanguageContext";
import "./Sidebar.css";


const Sidebar = ({ activeItem = "workplace", onSelectItem, open = false, onClose } = {}) => {

  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();


  // Below 900px this component renders as an off-canvas drawer (see
  // Sidebar.css). Escape closes it, matching every other dismissible layer
  // in this app, and it is torn down on unmount so the handler never
  // outlives the drawer.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // The page behind a drawer must not scroll with it, otherwise closing the
  // drawer leaves the reader somewhere they never navigated to. The previous
  // value is restored rather than hard-coded back to "", so this cannot
  // clobber an overflow another component set.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Resizing from phone width up to desktop leaves the drawer flagged open
  // while it is once again a permanent column; the backdrop would then sit
  // over the whole page with nothing to explain it.
  useEffect(() => {
    if (!open) return undefined;
    const query = window.matchMedia("(min-width: 901px)");
    const onChange = (event) => {
      if (event.matches) onClose?.();
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [open, onClose]);

  // Picking a page closes the drawer - on a phone the new page is behind it.
  const handleSelect = (pageId) => {
    onSelectItem?.(pageId);
    onClose?.();
  };

  const menuItems = [
    {
      id: "workplace",
      label: t("sidebar.workPlace"),
      icon: House,
    },
    {
      id: "documents",
      label: t("sidebar.allDocuments"),
      icon: Files,
    },
    {
      id: "testReport",
      label: t("sidebar.testReport"),
      icon: FlaskConical,
      // Nested pages — Overview (a searchable/paginated list of every
      // created report) and Generate Report (the existing 5-step wizard,
      // unchanged). The parent row itself never navigates anywhere; it
      // only expands/collapses this list, matching a normal accordion.
      children: [
        { id: "testReportOverview", label: t("sidebar.testReportOverview") },
        { id: "testReportGenerate", label: t("sidebar.testReportGenerate") },
      ],
    },
    {
      id: "eightDReport",
      label: t("sidebar.eightDReport"),
      icon: ShieldAlert,
      // Same nested-pages shape as Test Report above (Overview + a
      // create-new wizard) — frontend-only for now, no backend persistence.
      children: [
        { id: "eightDReportOverview", label: t("sidebar.eightDReportOverview") },
        { id: "eightDReportGenerate", label: t("sidebar.eightDReportGenerate") },
      ],
    },
    // Shift Planning area - accordion like Test Report / 8D Report above;
    // every sub-page is a "still in development" placeholder for now.
    {
      id: "shiftPlanning",
      label: t("sidebar.shiftPlanning"),
      icon: CalendarClock,
      children: [
        { id: "shiftDashboard", label: t("sidebar.shiftDashboard") },
        { id: "shiftPlan", label: t("sidebar.shiftPlan") },
        { id: "shiftOrders", label: t("sidebar.shiftOrders") },
        { id: "shiftProductionReport", label: t("sidebar.shiftProductionReport") },
        { id: "shiftUpload", label: t("sidebar.shiftUpload") },
        { id: "shiftSettings", label: t("sidebar.shiftSettings") },
      ],
    },
    // Production View - backlog dashboard and the workbook upload that
    // feeds it (components/ProductionView/).
    {
      id: "productionView",
      label: t("sidebar.productionView"),
      icon: Factory,
      children: [
        { id: "productionDashboard", label: t("sidebar.productionDashboard") },
        { id: "productionUpload", label: t("sidebar.productionUpload") },
      ],
    },
    // Temporary reference page: every known coating norm and its requirements.
    {
      id: "normLibrary",
      label: t("sidebar.normLibrary"),
      icon: BookOpen,
    },
  ];

  // Accordion expand/collapse state, one entry per parent item id — a plain
  // map rather than one bool per group (the previous shape, from when Test
  // Report was the only accordion item) so any number of independent
  // accordion groups works the same way without each one needing its own
  // hand-written state/effect pair.
  const accordionItems = menuItems.filter((item) => item.children?.length);
  const isOnChildOf = (item) => item.children?.some((child) => child.id === activeItem) ?? false;
  const [expandedGroups, setExpandedGroups] = useState(() =>
    Object.fromEntries(accordionItems.map((item) => [item.id, isOnChildOf(item)]))
  );
  const isExpanded = (item) => expandedGroups[item.id] || isOnChildOf(item);
  const toggleExpanded = (itemId) => setExpandedGroups((prev) => ({ ...prev, [itemId]: !prev[itemId] }));

  // Auto-close a submenu the moment navigation actually lands on a page
  // that isn't one of its own children (e.g. All Documents) — only reacts
  // to activeItem changing, not to the manual toggle above, so opening a
  // menu to look at it (without picking a child yet) is never immediately
  // undone by this same effect. Runs for every accordion group at once.
  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      accordionItems.forEach((item) => {
        if (!isOnChildOf(item) && next[item.id]) {
          next[item.id] = false;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem]);


  return (
    <>
      {open && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label={t("sidebar.closeMenu")}
          onClick={onClose}
        />
      )}

    <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>

      <button
        type="button"
        className="sidebar-close"
        aria-label={t("sidebar.closeMenu")}
        onClick={onClose}
      >
        <X size={19} />
      </button>

      {/* =========================
          NAVIGATION
      ========================== */}

      <nav className="sidebar-menu">

        {menuItems.map((item) => {

          const Icon = item.icon;

          const hasChildren = !!item.children?.length;

          // A parent with children is never itself "active" (it has no
          // page of its own) — it just reads as expanded/collapsed;
          // highlighting comes from whichever child page is actually shown.
          const isActive = !hasChildren && activeItem === item.id;

          if (hasChildren) {
            const groupExpanded = isExpanded(item);
            return (
              <div key={item.id} className="sidebar-menu-group">
                <button
                  type="button"
                  className={`sidebar-menu-item sidebar-menu-item--parent ${isOnChildOf(item) ? "active" : ""}`}
                  onClick={() => toggleExpanded(item.id)}
                  aria-expanded={groupExpanded}
                >
                  <Icon className="menu-icon" />
                  <span className="menu-label">{item.label}</span>
                  <ChevronDown className={`menu-chevron ${groupExpanded ? "expanded" : ""}`} />
                </button>

                {/* Always mounted (never conditionally rendered) so the
                    expand/collapse is a real CSS transition — animating
                    max-height/opacity — rather than the submenu just
                    instantly appearing/disappearing. */}
                <div className={`sidebar-submenu ${groupExpanded ? "expanded" : ""}`}>
                  {item.children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      className={`sidebar-submenu-item ${activeItem === child.id ? "active" : ""}`}
                      onClick={() => handleSelect(child.id)}
                    >
                      <span className="menu-label">{child.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <button
              key={item.id}

              className={`sidebar-menu-item ${
                isActive ? "active" : ""
              }`}

              onClick={() => handleSelect(item.id)}
            >

              <Icon className="menu-icon" />

              <span className="menu-label">
                {item.label}
              </span>

            </button>
          );

        })}

      </nav>


      {/* =========================
          LANGUAGE
      ========================== */}

      <div className="language-card">

        <div className="language-top">

          <span className="language-title">
            {t("sidebar.language")}
          </span>

          <Settings className="settings-icon" />

        </div>


        <div className="language-switch">

          <button
            className={`language-option ${
              language === "EN" ? "active" : ""
            }`}
            onClick={() => setLanguage("EN")}
          >
            EN
          </button>


          <button
            className={`language-option ${
              language === "DE" ? "active" : ""
            }`}
            onClick={() => setLanguage("DE")}
          >
            DE
          </button>

        </div>

      </div>

    </aside>
    </>
  );
};


export default Sidebar;
