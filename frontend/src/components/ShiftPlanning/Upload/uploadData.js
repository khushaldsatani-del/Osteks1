import { CircleCheck, CircleX, Database, FileText, TriangleAlert } from "lucide-react";

// The two daily files. `requiredColumns` are the header names a file must
// contain (matched ignoring case, spaces and underscores - see
// validateExcelFile.js).
export const FILE_TYPES = {
  erp: {
    id: "erp",
    icon: Database,
    requiredColumns: ["Teil_Nr", "Bezeichnung", "KW", "Datum", "Menge", "Kunde", "Auftrag_Nr"],
  },
  zwz: {
    id: "zwz",
    icon: FileText,
    requiredColumns: ["Teil_Nr", "Farbe", "Kunde", "KW", "Datum", "Tagesmenge", "Einsatzlinie"],
  },
};

export const FILE_TYPE_ORDER = ["erp", "zwz"];

// Shown as "Uploaded By". There is no login yet, so every upload is
// attributed to this user.
export const CURRENT_USER = "k.satani";

// Result of checking a file: colour and icon of its badge.
export const STATUS_META = {
  valid: { tone: "green", icon: CircleCheck },
  missingColumns: { tone: "amber", icon: TriangleAlert },
  noData: { tone: "amber", icon: TriangleAlert },
  unreadable: { tone: "red", icon: CircleX },
  invalidFormat: { tone: "red", icon: CircleX },
};

// Upload History period filter; `days` counts back from today.
export const HISTORY_RANGES = [
  { id: "7", days: 7 },
  { id: "30", days: 30 },
  { id: "all", days: null },
];

const MB = 1024 * 1024;
const pad = (n) => String(n).padStart(2, "0");

// Sample uploads from the approved mock-up, dated relative to today. There
// is no upload backend yet - files picked on the page are checked in the
// browser and added to this list, but not stored anywhere.
const SAMPLE_UPLOADS = [
  { type: "zwz", dayOffset: 0, time: [8, 26], rows: 3456, sizeMb: 1.8 },
  { type: "erp", dayOffset: 0, time: [8, 24], rows: 1248, sizeMb: 2.1 },
  { type: "zwz", dayOffset: -1, time: [8, 17], rows: 3402, sizeMb: 1.7 },
  { type: "erp", dayOffset: -1, time: [8, 15], rows: 1306, sizeMb: 2.0 },
  { type: "zwz", dayOffset: -4, time: [8, 12], rows: 3298, sizeMb: 1.6 },
  { type: "erp", dayOffset: -4, time: [8, 10], rows: 1280, sizeMb: 1.9 },
  { type: "zwz", dayOffset: -5, time: [8, 9], rows: 3210, sizeMb: 1.5, missing: ["Einsatzlinie"] },
];

// File names as the plant's exports name them: ERP_2026-10-06.xlsx, ZWZ_06_10.xlsx
const sampleFileName = (type, d) =>
  type === "erp"
    ? `ERP_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.xlsx`
    : `ZWZ_${pad(d.getDate())}_${pad(d.getMonth() + 1)}.xlsx`;

export const buildSampleHistory = (today) =>
  SAMPLE_UPLOADS.map((sample, index) => {
    const uploadedAt = new Date(today);
    uploadedAt.setDate(uploadedAt.getDate() + sample.dayOffset);
    uploadedAt.setHours(sample.time[0], sample.time[1], 0, 0);
    const missing = sample.missing ?? [];
    return {
      id: `sample-${index}`,
      type: sample.type,
      fileName: sampleFileName(sample.type, uploadedAt),
      uploadedAt,
      size: sample.sizeMb * MB,
      rows: sample.rows,
      status: missing.length ? "missingColumns" : "valid",
      columns: FILE_TYPES[sample.type].requiredColumns.filter((column) => !missing.includes(column)),
      missing,
      user: CURRENT_USER,
    };
  });
