import { Moon, Sun } from "lucide-react";

// Shifts in the day's order, with their capacity in pieces (Stück). Shift
// names are the plant's own German names in both languages.
export const SHIFT_DEFS = [
  { id: "frueh", name: "Früh", from: "06:00", to: "14:00", icon: Sun, capacity: 42000 },
  { id: "spaet", name: "Spät", from: "14:00", to: "22:00", icon: Sun, capacity: 41000 },
  { id: "nacht", name: "Nacht", from: "22:00", to: "06:00", icon: Moon, capacity: 43000 },
];

// The plant's two lines. Colours: shiftPlan.css (.splan-line--<id>).
export const PLAN_LINES = [
  { id: "ktl", name: "KTL" },
  { id: "pulver", name: "Pulver" },
];

// Sample plan from the approved mock-up (the two Schaum parts moved to
// Pulver - the plant has no Schaum line). There is no shift-planning
// backend yet: a day's plan starts from this sample and edits are kept in
// this browser (see planStorage.js).
export const SAMPLE_PARTS = [
  { id: "p1", part: "710746S00E", name: "Rahmen", line: "ktl", orderQty: 5000, price: 12.5, plan: { frueh: 2000, spaet: 2000, nacht: 1000 } },
  { id: "p2", part: "T01122", name: "Halter klein", line: "ktl", orderQty: 4000, price: 8.2, plan: { frueh: 1500, spaet: 1500, nacht: 1000 } },
  { id: "p3", part: "T06789", name: "Halter hinten", line: "ktl", orderQty: 3500, price: 6.8, plan: { frueh: 1000, spaet: 1500, nacht: 1000 } },
  { id: "p4", part: "T04175", name: "Deckel", line: "pulver", orderQty: 3000, price: 7.5, plan: { frueh: 0, spaet: 2000, nacht: 1000 } },
  { id: "p5", part: "T09988", name: "Abdeckung", line: "pulver", orderQty: 2800, price: 5.9, plan: { frueh: 1000, spaet: 1000, nacht: 800 } },
  { id: "p6", part: "T03351", name: "Blende", line: "pulver", orderQty: 3500, price: 4.2, plan: { frueh: 1200, spaet: 1000, nacht: 1000 } },
  { id: "p7", part: "T03434", name: "Halter vorne", line: "ktl", orderQty: 6000, price: 10.1, plan: { frueh: 2000, spaet: 2000, nacht: 2000 } },
  { id: "p8", part: "T00406", name: "Gehäuse", line: "ktl", orderQty: 4200, price: 9.3, plan: { frueh: 1500, spaet: 1500, nacht: 1200 } },
  { id: "p9", part: "T02218-s01", name: "Träger links", line: "pulver", orderQty: 2800, price: 6.1, plan: { frueh: 800, spaet: 1000, nacht: 1000 } },
  { id: "p10", part: "T04176", name: "Konsole", line: "ktl", orderQty: 4500, price: 8.9, plan: { frueh: 1500, spaet: 1500, nacht: 1500 } },
];

// Parts with an order but not in the plan yet. `dueOffset` is days from the
// plan's date (0 = that day); null for a part moved back from the plan.
export const SAMPLE_WAITING = [
  { id: "w1", part: "T07777", name: "Feder", line: "ktl", orderQty: 4500, price: 5.2, dueOffset: 0 },
  { id: "w2", part: "T08888", name: "Halter oben", line: "pulver", orderQty: 3200, price: 7.1, dueOffset: 0 },
  { id: "w3", part: "T09999", name: "Abdeckung", line: "pulver", orderQty: 2800, price: 6.5, dueOffset: 2 },
];

export const emptyShiftPlan = () => Object.fromEntries(SHIFT_DEFS.map((shift) => [shift.id, 0]));
