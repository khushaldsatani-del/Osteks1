import { matchPath } from "react-router";

// The address of every page. Pages are still known by the ids the sidebar
// uses ("shiftPlan", "testReportGenerate" …); this file turns an id into its
// address and an address back into { page, params }. Pages that open one
// saved record carry its id in the address, so a refresh or a bookmark
// opens the same record again. Order matters: "/test-report/new" must be
// matched before "/test-report/:reportId".
const ROUTES = [
  { page: "workplace", path: "/" },
  { page: "workplace", path: "/workplace/:documentId" },
  { page: "documents", path: "/documents" },
  { page: "testReportOverview", path: "/test-report" },
  { page: "testReportGenerate", path: "/test-report/new" },
  { page: "testReportGenerate", path: "/test-report/:reportId" },
  { page: "eightDReportOverview", path: "/8d-report" },
  { page: "eightDReportGenerate", path: "/8d-report/new" },
  { page: "eightDReportGenerate", path: "/8d-report/:reportId" },
  { page: "shiftDashboard", path: "/shift-planning" },
  { page: "shiftPlan", path: "/shift-planning/plan" },
  { page: "shiftTeam", path: "/shift-planning/team" },
  { page: "shiftOrders", path: "/shift-planning/orders" },
  { page: "shiftProductionReport", path: "/shift-planning/production-report" },
  { page: "shiftUpload", path: "/shift-planning/upload" },
  { page: "shiftSettings", path: "/shift-planning/settings" },
  { page: "productionDashboard", path: "/production-view" },
  { page: "productionUpload", path: "/production-view/upload" },
  { page: "normLibrary", path: "/norm-library" },
];

// The plain address of a page (the first route listed for it).
export const pathOf = (page) => ROUTES.find((route) => route.page === page)?.path ?? "/";

// { page, params } for an address, or null for an unknown one.
export const pageFromPath = (pathname) => {
  for (const route of ROUTES) {
    const match = matchPath({ path: route.path, end: true }, pathname);
    if (match) return { page: route.page, params: match.params };
  }
  return null;
};

// Record ids in the address are text; the saved records use numbers.
export const idParam = (value) => (value == null ? null : /^\d+$/.test(value) ? Number(value) : value);
