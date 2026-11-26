import { useEffect, useState } from "react";
import {
  FileText,
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
    // Offers - the KTL / Powder offer builder (Work Place, the landing
    // page) and the list of every stored offer (All Documents). Grouped
    // like Test Report below; the page ids and addresses are unchanged.
    {
      id: "offers",
      label: t("sidebar.offers"),
      icon: FileText,
      children: [
        { id: "workplace", label: t("sidebar.workPlace") },
        { id: "documents", label: t("sidebar.allDocuments") },
      ],
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

  // Accordion: only ONE group is open at a time. Opening a group closes the
  // one that was open before (even the group of the page being shown), and
  // clicking an open group's title closes it again. On navigation the group
  // of the new page opens and every other group closes - a top-level page
  // like All Documents closes them all.
  const accordionItems = menuItems.filter((item) => item.children?.length);
  const isOnChildOf = (item) => item.children?.some((child) => child.id === activeItem) ?? false;
  const groupOfActive = () => accordionItems.find(isOnChildOf)?.id ?? null;
  const [openGroup, setOpenGroup] = useState(groupOfActive);
  const isExpanded = (item) => openGroup === item.id;
  const toggleExpanded = (itemId) => setOpenGroup((current) => (current === itemId ? null : itemId));

  useEffect(() => {
    setOpenGroup(groupOfActive());
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

      {/* Company name at the top left - a teal letter mark plus the name */}
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark" aria-hidden="true">
          O
        </span>
        <span className="sidebar-brand-text">
          <span className="sidebar-brand-name">{t("sidebar.brandName")}</span>
          <span className="sidebar-brand-suffix">{t("sidebar.brandSuffix")}</span>
        </span>
      </div>

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
