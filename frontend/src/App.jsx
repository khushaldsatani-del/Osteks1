import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { LoaderCircle, Menu, X } from "lucide-react";
import Sidebar from "./components/Sidebar/Sidebar";
import Documents from "./pages/Documents";

// Every page except Work Place (the landing page) is its own JavaScript
// file, loaded when first opened - so the app starts with a fraction of the
// code. PAGE_LOADERS are also run once the app is idle (see the effect in
// App), so by the time a page is clicked it is usually already there.
const PAGE_LOADERS = {
  AllDocuments: () => import("./components/AllDocuments/AllDocuments"),
  TestReport: () => import("./pages/TestReport"),
  TestReportOverview: () => import("./pages/TestReportOverview"),
  EightDReport: () => import("./pages/EightDReport"),
  EightDReportOverview: () => import("./pages/EightDReportOverview"),
  NormLibrary: () => import("./pages/NormLibrary"),
  ShiftPlanning: () => import("./pages/ShiftPlanning"),
  ProductionView: () => import("./pages/ProductionView"),
};
const AllDocuments = lazy(PAGE_LOADERS.AllDocuments);
const TestReport = lazy(PAGE_LOADERS.TestReport);
const TestReportOverview = lazy(PAGE_LOADERS.TestReportOverview);
const EightDReport = lazy(PAGE_LOADERS.EightDReport);
const EightDReportOverview = lazy(PAGE_LOADERS.EightDReportOverview);
const NormLibrary = lazy(PAGE_LOADERS.NormLibrary);
const ShiftPlanning = lazy(PAGE_LOADERS.ShiftPlanning);
const ProductionView = lazy(PAGE_LOADERS.ProductionView);

const PageLoading = () => (
  <div className="page-loading" role="status">
    <LoaderCircle size={22} className="page-loading-spin" />
  </div>
);
import { listTestReports, deleteTestReport } from "./components/TestReport/testReportsApi";
import { listEightDReports, deleteEightDReport } from "./components/EightDReport/eightDReportsApi";
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
  eightDReportOverview: "sidebar.eightDReportOverview",
  eightDReportGenerate: "sidebar.eightDReportGenerate",
  shiftDashboard: "sidebar.shiftDashboard",
  shiftPlan: "sidebar.shiftPlan",
  shiftOrders: "sidebar.shiftOrders",
  shiftProductionReport: "sidebar.shiftProductionReport",
  shiftUpload: "sidebar.shiftUpload",
  shiftSettings: "sidebar.shiftSettings",
  productionDashboard: "sidebar.productionDashboard",
  productionUpload: "sidebar.productionUpload",
  normLibrary: "sidebar.normLibrary",
};

// Shift Planning's sub-pages: sidebar page id -> the section ShiftPlanning
// shows (see pages/ShiftPlanning.jsx).
const SHIFT_PAGE_SECTIONS = {
  shiftDashboard: "dashboard",
  shiftPlan: "planning",
  shiftOrders: "orders",
  shiftProductionReport: "productionReport",
  shiftUpload: "upload",
  shiftSettings: "settings",
};

// Production View's sub-pages: sidebar page id -> the section
// ProductionView shows (see pages/ProductionView.jsx).
const PRODUCTION_PAGE_SECTIONS = {
  productionDashboard: "dashboard",
  productionUpload: "upload",
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

  // 8D Report Overview's saved-record list - same "lives in App so it
  // survives switching pages, refetched after every change" pattern as the
  // Test Report records above (backend: services/eightd_reports_repo.py).
  const [eightDRecords, setEightDRecords] = useState([]);
  const [eightDLoading, setEightDLoading] = useState(true);
  const [openEightDReportId, setOpenEightDReportId] = useState(null);

  const refreshEightDReports = useCallback(async () => {
    try {
      setEightDRecords(await listEightDReports());
    } catch {
      // Backend not running yet - the Overview just stays empty until it is.
    } finally {
      setEightDLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshEightDReports();
  }, [refreshEightDReports]);

  // Throws on failure so the Overview can tell the user the delete didn't
  // happen; the list is refetched either way.
  const deleteEightDRecord = async (id) => {
    try {
      await deleteEightDReport(id);
    } finally {
      refreshEightDReports();
    }
  };

  const deleteTestReportRecord = async (id) => {
    await deleteTestReport(id);
    refreshTestReports();
  };

  // Fetch the other pages' code in the background once the app has
  // settled, so switching pages doesn't wait for a download.
  useEffect(() => {
    const prefetch = () => Object.values(PAGE_LOADERS).forEach((load) => load().catch(() => {}));
    const idle = window.requestIdleCallback ?? ((cb) => window.setTimeout(cb, 1500));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(prefetch, { timeout: 4000 });
    return () => cancel(handle);
  }, []);

  // Wraps Sidebar's plain onSelectItem — the only extra behavior needed is
  // clearing openTestReportId when "Generate Report" is clicked directly
  // (not via Overview's "Open"), so the sidebar entry always starts a
  // fresh report rather than reopening the last one viewed.
  const handleSelectItem = (pageId) => {
    if (pageId === "testReportGenerate") setOpenTestReportId(null);
    if (pageId === "eightDReportGenerate") setOpenEightDReportId(null);
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
        <Suspense fallback={<PageLoading />}>
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
        ) : currentPage === "eightDReportOverview" ? (
          <EightDReportOverview
            records={eightDRecords}
            loading={eightDLoading}
            onDelete={deleteEightDRecord}
            onOpen={(id) => {
              setOpenEightDReportId(id);
              setCurrentPage("eightDReportGenerate");
            }}
            onCreate={() => {
              setOpenEightDReportId(null);
              setCurrentPage("eightDReportGenerate");
            }}
          />
        ) : currentPage === "eightDReportGenerate" ? (
          // Keyed by the record being edited, so switching from one report
          // (or a fresh one) to another always starts the wizard clean.
          <EightDReport
            key={openEightDReportId ?? "new"}
            openReportId={openEightDReportId}
            onSaved={refreshEightDReports}
          />
        ) : SHIFT_PAGE_SECTIONS[currentPage] ? (
          <ShiftPlanning key={currentPage} section={SHIFT_PAGE_SECTIONS[currentPage]} />
        ) : PRODUCTION_PAGE_SECTIONS[currentPage] ? (
          <ProductionView key={currentPage} section={PRODUCTION_PAGE_SECTIONS[currentPage]} onNavigate={handleSelectItem} />
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
        </Suspense>
      </main>
    </div>
  );
}

export default App;
