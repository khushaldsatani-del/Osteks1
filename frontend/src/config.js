// The extraction/documents backend (see backend/README.md) — override with
// VITE_BACKEND_URL if it's not running on the default port.
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";
