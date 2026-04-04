// ARC Version tracking
// Convention:
// - Patch (0.0.x): bug fixes, UI tweaks
// - Minor (0.x.0): new feature shipped  
// - Major (x.0.0): full system change

export const VERSION = "0.0.1";

export const CHANGELOG = [
  { 
    version: "0.0.1", 
    date: "2026-04-05", 
    notes: "Initial build. Feed, Write, Schedule, Voice, Sources. Persistent context system. YouTube-style feed tiles." 
  }
];

export function getVersion(): string {
  return VERSION;
}

export function getChangelog() {
  return CHANGELOG;
}
