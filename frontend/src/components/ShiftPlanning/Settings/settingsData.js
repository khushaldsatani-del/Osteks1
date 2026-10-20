// Defaults for Shift Planning > Settings, from the approved mock-up (the
// plant has two lines, KTL and Pulver - no Schaum).

export const TEAMS = ["Team 1", "Team 2", "Team 3"];

// Monday first, as the plant's week starts.
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DEFAULT_SETTINGS = {
  // Available capacity in euro per line and shift.
  capacity: {
    ktl: { frueh: 8000, spaet: 8000, nacht: 6000 },
    pulver: { frueh: 5000, spaet: 5000, nacht: 4000 },
  },
  workingDays: ["mon", "tue", "wed", "thu", "fri"],
  shiftTimes: {
    frueh: { from: "06:00", to: "14:00" },
    spaet: { from: "14:00", to: "22:00" },
    nacht: { from: "22:00", to: "06:00", overnight: true },
  },
};

export const DEFAULT_MASTER_PARTS = [
  { part: "710746S00E", name: "Rahmen", line: "ktl", perRack: 20, team: "Team 1" },
  { part: "T01122", name: "Halter klein", line: "ktl", perRack: 30, team: "Team 1" },
  { part: "T06789", name: "Halter hinten", line: "ktl", perRack: 25, team: "Team 2" },
  { part: "T04175", name: "Deckel", line: "pulver", perRack: 15, team: "Team 2" },
  { part: "T09988", name: "Abdeckung", line: "pulver", perRack: 18, team: "Team 2" },
  { part: "T03351", name: "Blende", line: "pulver", perRack: 12, team: "Team 3" },
  { part: "T03434", name: "Halter vorne", line: "ktl", perRack: 25, team: "Team 1" },
  { part: "T00406", name: "Gehäuse", line: "ktl", perRack: 28, team: "Team 3" },
];
