import {
  House,
  FileText,
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
  ];


  return (
    <aside className="sidebar">

      {/* =========================
          NAVIGATION
      ========================== */}

      <nav className="sidebar-menu">

        {menuItems.map((item) => {

          const Icon = item.icon;

          const isActive = activeItem === item.id;


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