import React, { useEffect, useState } from "react";

// Simulated 0→~92% climb while a record is being fetched from the backend
// and hydrated into the wizard (Step 5's Save/Download buttons use the same
// climb-then-jump pattern — see PreviewExport/ProgressButton.jsx — but this
// bar has no "done" state of its own since the whole loading screen simply
// unmounts the instant TestReport.jsx's hydration effect finishes).
const LoadingBar = () => {
  const [progress, setProgress] = useState(4);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((p) => (p < 92 ? p + Math.max(0.6, (92 - p) / 14) : p));
    }, 110);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="testreport-loadingbar-track">
      <div className="testreport-loadingbar-fill" style={{ width: `${progress}%` }} />
    </div>
  );
};

export default LoadingBar;
