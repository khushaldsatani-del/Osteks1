import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
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
import { idParam, pageFromPath, pathOf } from "./routes";
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

// The sidebar section a sub-page belongs to, by its page id's start - for
// the browser tab's name.
const PAGE_SECTION_KEYS = [
  ["workplace", "sidebar.offers"],
  ["documents", "sidebar.offers"],
  ["testReport", "sidebar.testReport"],
  ["eightDReport", "sidebar.eightDReport"],
  ["shift", "sidebar.shiftPlanning"],
  ["production", "sidebar.productionView"],
];

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
  const navigate = useNavigate();
  const location = useLocation();

  // The page comes from the address (see routes.js), so every page has its
  // own URL: refresh, Back / Forward and bookmarks all work. A saved record
  // a page opens (a document in Work Place, a Test / 8D report) is part of
  // the address too.
  const route = pageFromPath(location.pathname);
  const currentPage = route?.page ?? "workplace";
  const params = route?.params ?? {};
  const workspaceDocumentId = currentPage === "workplace" ? idParam(params.documentId) : null;
  const openTestReportId = currentPage === "testReportGenerate" ? idParam(params.reportId) : null;
  const openEightDReportId = currentPage === "eightDReportGenerate" ? idParam(params.reportId) : null;

  // The Test / 8D wizards are keyed so a different report always starts a
  // clean form. "Generate / Create Report" opens /…/new with its own
  // `wizardKey`; after the first save the address becomes /…/<id> with the
  // same key (onSaved below), so the form stays as it is - and a refresh
  // or bookmark then opens the saved report.
  const wizardKey = location.state?.wizardKey;
  const testReportKey = wizardKey ?? String(openTestReportId ?? "new");
  const eightDReportKey = wizardKey ?? String(openEightDReportId ?? "new");

  // Drives the off-canvas sidebar below 900px (see Sidebar.css). Always
  // false on desktop, where the sidebar is a permanent column and neither
  // this flag nor the menu button is reachable.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Work Place is a single ongoing workspace with no "start a new one"
  // concept: the document last opened there with "Open in Workspace" (All
  // Documents) is opened again when Work Place is picked in the sidebar.
  // Test / 8D Report differ on purpose - "Generate Report" in the sidebar
  // always starts a fresh report (/test-report/new), the Overview's "Open"
  // opens one (/test-report/<id>).
  const [lastWorkspaceId, setLastWorkspaceId] = useState(null);
  useEffect(() => {
    if (workspaceDocumentId != null) setLastWorkspaceId(workspaceDocumentId);
  }, [workspaceDocumentId]);

  // The browser tab names the page - with its section for sub-pages ("Test
  // Report · Overview"), so tabs and bookmarks can be told apart.
  useEffect(() => {
    const section = PAGE_SECTION_KEYS.find(([prefix]) => currentPage.startsWith(prefix))?.[1];
    const page = t(PAGE_TITLE_KEYS[currentPage] ?? "sidebar.workPlace");
    document.title = `${section && t(section) !== page ? `${t(section)} · ` : ""}${page} · Osteks`;
  }, [currentPage, t]);

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

  // Sidebar (and Production View's "Go to Upload") pick a page by its id;
  // it opens at its own address. Generate Report goes to /…/new, so it
  // always starts fresh; Work Place reopens the last workspace document.
  const handleSelectItem = (pageId) => {
    if (pageId === "workplace" && lastWorkspaceId != null) navigate(`/workplace/${lastWorkspaceId}`);
    else if (pageId === "testReportGenerate" || pageId === "eightDReportGenerate") navigate(pathOf(pageId), { state: { wizardKey: `new-${Date.now()}` } });
    else navigate(pathOf(pageId));
  };

  // A report saved for the first time gets its own address, in place of /…/new.
  const showSavedReport = (base, openId, key) => (id) => {
    if (id != null && openId == null) navigate(`${base}/${id}`, { replace: true, state: { wizardKey: key } });
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
        {!route ? (
          // an unknown address goes back to Work Place
          <Navigate to="/" replace />
        ) : currentPage === "documents" ? (
          <AllDocuments
            records={documentRecords}
            onUpdateStatus={updateDocumentStatus}
            onDelete={deleteDocumentRecord}
            onOpenWorkspace={(id) => navigate(`/workplace/${id}`)}
          />
        ) : currentPage === "testReportOverview" ? (
          <TestReportOverview
            records={testReportRecords}
            onDelete={deleteTestReportRecord}
            onOpen={(id) => navigate(`/test-report/${id}`)}
          />
        ) : currentPage === "eightDReportOverview" ? (
          <EightDReportOverview
            records={eightDRecords}
            loading={eightDLoading}
            onDelete={deleteEightDRecord}
            onOpen={(id) => navigate(`/8d-report/${id}`)}
            onCreate={() => navigate("/8d-report/new", { state: { wizardKey: `new-${Date.now()}` } })}
          />
        ) : currentPage === "eightDReportGenerate" ? (
          // Keyed by the record being edited, so switching from one report
          // (or a fresh one) to another always starts the wizard clean.
          <EightDReport
            key={eightDReportKey}
            openReportId={openEightDReportId}
            onSaved={(id) => {
              refreshEightDReports();
              showSavedReport("/8d-report", openEightDReportId, eightDReportKey)(id);
            }}
          />
        ) : SHIFT_PAGE_SECTIONS[currentPage] ? (
          <ShiftPlanning key={currentPage} section={SHIFT_PAGE_SECTIONS[currentPage]} />
        ) : PRODUCTION_PAGE_SECTIONS[currentPage] ? (
          <ProductionView key={currentPage} section={PRODUCTION_PAGE_SECTIONS[currentPage]} onNavigate={handleSelectItem} />
        ) : currentPage === "normLibrary" ? (
          <NormLibrary />
        ) : currentPage === "testReportGenerate" ? (
          // Keyed like the 8D wizard: /test-report/new after an opened report
          // starts a clean wizard instead of keeping that report's fields.
          <TestReport
            key={testReportKey}
            openReportId={openTestReportId}
            onSaved={(id) => {
              refreshTestReports();
              showSavedReport("/test-report", openTestReportId, testReportKey)(id);
            }}
          />
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
