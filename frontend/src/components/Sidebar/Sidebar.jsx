import { useEffect, useState } from "react";
import {
  House,
  FileText,
  ClipboardList,
  ChevronDown,
  Settings,
} from "lucide-react";

import { useLanguage, useTranslation } from "../../i18n/LanguageContext";
import "./Sidebar.css";


const Sidebar = ({ activeItem = "workplace", onSelectItem } = {}) => {

  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();


  const menuItems = [
    {
      id: "workplace",
      label: t("sidebar.workPlace"),
      icon: House,
    },
    {
      id: "documents",
      label: t("sidebar.allDocuments"),
      icon: FileText,
    },
    {
      id: "testReport",
      label: t("sidebar.testReport"),
      icon: ClipboardList,
      // Nested pages — Overview (a searchable/paginated list of every
      // created report) and Generate Report (the existing 5-step wizard,
      // unchanged). The parent row itself never navigates anywhere; it
      // only expands/collapses this list, matching a normal accordion.
      children: [
        { id: "testReportOverview", label: t("sidebar.testReportOverview") },
        { id: "testReportGenerate", label: t("sidebar.testReportGenerate") },
      ],
    },
  ];

  // Auto-expand "Test Report" if the page we're currently on is one of its
  // own children (e.g. after a parent re-render triggered by navigating
  // straight to a child elsewhere), so the submenu is never hidden while
  // one of its own pages is what's actually showing.
  const testReportItem = menuItems.find((item) => item.id === "testReport");
  const isOnTestReportChild = testReportItem?.children?.some((child) => child.id === activeItem) ?? false;
  const [testReportExpanded, setTestReportExpanded] = useState(isOnTestReportChild);
  const expanded = testReportExpanded || isOnTestReportChild;

  // Auto-close the submenu the moment navigation actually lands on a
  // DIFFERENT top-level page (e.g. All Documents) — only reacts to
  // activeItem changing, not to the manual toggle below, so opening the
  // menu to look at it (without picking a child yet) is never immediately
  // undone by this same effect.
  useEffect(() => {
    if (!isOnTestReportChild) {
      setTestReportExpanded(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem]);


  return (
    <aside className="sidebar">

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
            return (
              <div key={item.id} className="sidebar-menu-group">
                <button
                  type="button"
                  className={`sidebar-menu-item sidebar-menu-item--parent ${isOnTestReportChild ? "active" : ""}`}
                  onClick={() => setTestReportExpanded((open) => !open)}
                  aria-expanded={expanded}
                >
                  <Icon className="menu-icon" />
                  <span className="menu-label">{item.label}</span>
                  <ChevronDown className={`menu-chevron ${expanded ? "expanded" : ""}`} />
                </button>

                {/* Always mounted (never conditionally rendered) so the
                    expand/collapse is a real CSS transition — animating
                    max-height/opacity — rather than the submenu just
                    instantly appearing/disappearing. */}
                <div className={`sidebar-submenu ${expanded ? "expanded" : ""}`}>
                  {item.children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      className={`sidebar-submenu-item ${activeItem === child.id ? "active" : ""}`}
                      onClick={() => onSelectItem?.(child.id)}
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

              onClick={() => onSelectItem?.(item.id)}
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
  );
};


export default Sidebar;
