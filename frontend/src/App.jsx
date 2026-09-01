import React, { useCallback, useEffect, useState } from "react";
import Sidebar from "./components/Sidebar/Sidebar";
import Documents from "./pages/Documents";
import AllDocuments from "./components/AllDocuments/AllDocuments";
import { BACKEND_URL } from "./config";
import "./App.css";

function App() {
  const [currentPage, setCurrentPage] = useState("workplace");

  // Set when "Open in Workspace" is clicked from All Documents — tells
  // Documents.jsx which saved record to hydrate instead of starting blank.
  const [workspaceDocumentId, setWorkspaceDocumentId] = useState(null);

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
      <Sidebar activeItem={currentPage} onSelectItem={setCurrentPage} />
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
        ) : (
          <Documents onDocumentsChanged={refreshDocuments} openDocumentId={workspaceDocumentId} />
        )}
      </main>
    </div>
  );
}

export default App;
