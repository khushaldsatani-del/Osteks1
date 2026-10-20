import React from "react";
import BacklogDashboard from "../components/ProductionView/Dashboard/BacklogDashboard";
import ProductionUpload from "../components/ProductionView/Upload/ProductionUpload";

// The Production View area's sub-pages (sidebar: Production View > ...):
// the backlog dashboard and the workbook upload that feeds it
// (components/ProductionView/...). `section` picks the sub-page; App.jsx
// maps each sidebar page id to one of these. `onNavigate` lets the empty
// dashboard send the user to the upload page.
const ProductionView = ({ section = "dashboard", onNavigate }) =>
  section === "upload" ? <ProductionUpload /> : <BacklogDashboard onNavigate={onNavigate} />;

export default ProductionView;
