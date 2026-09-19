import React, { useCallback, useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import Sidebar from "./components/Sidebar/Sidebar";
import Documents from "./pages/Documents";
import AllDocuments from "./components/AllDocuments/AllDocuments";
import TestReport from "./pages/TestReport";
import TestReportOverview from "./pages/TestReportOverview";
import NormLibrary from "./pages/NormLibrary";
import { listTestReports, deleteTestReport } from "./components/TestReport/testReportsApi";
import { useTranslation } from "./i18n/LanguageContext";
import { BACKEND_URL } from "./config";
import "./App.css";

// Labels for the mobile top bar, which has to say which page is showing
// because the sidebar that would otherwise show it is closed by default on a
// phone. Keyed by the same page ids handleSelectItem sets.
const PAGE_TITLE_KEYS = {
  workplace: "sidebar.workPlace",
  documents: "sidebar.allDocuments",
  testReportOverview: "sidebar.testReportOverview",
  testReportGenerate: "sidebar.testReportGenerate",
  normLibrary: "sidebar.normLibrary",
};

function App() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState("workplace");

  // Drives the off-canvas sidebar below 900px (see Sidebar.css). Always
  // false on desktop, where the sidebar is a permanent column and neither
  // this flag nor the menu button is reachable.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Set when "Open in Workspace" is clicked from All Documents — tells
  // Documents.jsx which saved record to hydrate instead of starting blank.
  const [workspaceDocumentId, setWorkspaceDocumentId] = useState(null);

  // Same pattern, one level down, for Test Report — set when Overview's
  // "Open" button is clicked. Unlike workspaceDocumentId above (Work Place
  // is a single ongoing workspace with no "start a new one" concept), Test
  // Report Overview is a real multi-record list, so clicking "Generate
  // Report" directly in the sidebar deliberately clears this back to null
  // (see handleSelectItem below) rather than silently reopening whatever
  // was last viewed — that's the "start from scratch" entry point.
  const [openTestReportId, setOpenTestReportId] = useState(null);

  // Test Report Overview's saved-record list — same "lives in App so it
  // survives switching pages" reasoning as documentRecords below, backed
  // by Postgres via backend/services/test_reports_repo.py.
  const [testReportRecords, setTestReportRecords] = useState([]);

  const refreshTestReports = useCallback(async () => {
    try {
      setTestReportRecords(await listTestReports());
    } catch {
      // Backend not running yet — Overview just stays empty until it is.
    }
  }, []);

  useEffect(() => {
    refreshTestReports();
  }, [refreshTestReports]);

  const deleteTestReportRecord = async (id) => {
    await deleteTestReport(id);
    refreshTestReports();
  };

  // Wraps Sidebar's plain onSelectItem — the only extra behavior needed is
  // clearing openTestReportId when "Generate Report" is clicked directly
  // (not via Overview's "Open"), so the sidebar entry always starts a
  // fresh report rather than reopening the last one viewed.
  const handleSelectItem = (pageId) => {
    if (pageId === "testReportGenerate") setOpenTestReportId(null);
    setCurrentPage(pageId);
  };

  // All Documents' saved-record list. Lives here (not in Documents.jsx)
  // because it must survive switching away from Work Place and back — App
  // itself never unmounts, only which page it renders changes. Backed by
  // Postgres (Neon) via backend/services/documents_repo.py — refreshDocuments
  // is the single source of truth, called after every create/update/status
  // change/delete instead of mutating this list by hand, so it can never
  // drift from what's actually in the database.
  const [documentRecords, setDocumentRecords] = useState([]);

  const refreshDocuments = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/documents`);
      if (!response.ok) return;
      const data = await response.json();
      setDocumentRecords(data.map((row) => ({ ...row, uploadedAt: new Date(row.uploadedAt) })));
    } catch {
      // Backend not running yet — All Documents just stays empty until it is.
    }
  }, []);

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  const updateDocumentStatus = async (id, status) => {
    await fetch(`${BACKEND_URL}/api/documents/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refreshDocuments();
  };

  const deleteDocumentRecord = async (id) => {
    await fetch(`${BACKEND_URL}/api/documents/${id}`, { method: "DELETE" });
    refreshDocuments();
  };

  return (
    <div className="app">
      <Sidebar
        activeItem={currentPage}
        onSelectItem={handleSelectItem}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <header className="mobile-topbar">
        <button
          type="button"
          className="mobile-menu-button"
          aria-label={sidebarOpen ? t("sidebar.closeMenu") : t("sidebar.openMenu")}
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen((isOpen) => !isOpen)}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <span className="mobile-topbar-title">
          {t(PAGE_TITLE_KEYS[currentPage] ?? "sidebar.workPlace")}
        </span>
      </header>

       <main className="main-content">
        {currentPage === "documents" ? (
          <AllDocuments
            records={documentRecords}
            onUpdateStatus={updateDocumentStatus}
            onDelete={deleteDocumentRecord}
            onOpenWorkspace={(id) => {
              setWorkspaceDocumentId(id);
              setCurrentPage("workplace");
            }}
          />
        ) : currentPage === "testReportOverview" ? (
          <TestReportOverview
            records={testReportRecords}
            onDelete={deleteTestReportRecord}
            onOpen={(id) => {
              setOpenTestReportId(id);
              setCurrentPage("testReportGenerate");
            }}
          />
        ) : currentPage === "normLibrary" ? (
          <NormLibrary />
        ) : currentPage === "testReportGenerate" ? (
          <TestReport openReportId={openTestReportId} onSaved={refreshTestReports} />
        ) : (
          <Documents
            onDocumentsChanged={refreshDocuments}
            openDocumentId={workspaceDocumentId}
            onTestReportCreated={refreshTestReports}
          />
        )}
      </main>
    </div>
  );
}

export default App;
