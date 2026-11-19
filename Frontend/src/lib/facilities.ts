// Presentation-only helpers for registered facilities (docs/SHELTER_DATA_AUDIT.md).
// Nothing here changes stored data: names are tidied for display only, and possible duplicates are
// flagged, never merged (two similar names can be two real places).

/** Display form of a facility name: trims stray spacing and punctuation; all-lowercase Latin names get capitals. */
export function displayName(raw: string): string {
  let s = (raw || "").replace(/\s+/g, " ").trim();
  s = s.replace(/^[\s,;:.\-–—()[\]]+/, "").replace(/[\s,;:\-–—([]+$/, "");
  // Unbalanced closing bracket left at the end: "Foo Clinic)" -> "Foo Clinic"
  if (/\)$/.test(s) && (s.match(/\(/g) || []).length < (s.match(/\)/g) || []).length) s = s.slice(0, -1).trim();
  if (s && /[a-z]/.test(s) && s === s.toLowerCase() && /^[\x00-\x7F]+$/.test(s)) {
    s = s.replace(/\b([a-z])/g, (c) => c.toUpperCase());
  }
  return s || raw;
}

const norm = (s: string) => displayName(s).toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, " ").trim();

function metres(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Ids of entries that have another entry with the same (normalised) name within `withinM` metres.
 * Shown as "may be listed twice": a hint for the reader and for manual review, not a merge.
 */
export function possibleDuplicates(
  items: Array<{ id: string; name: string; coordinates: [number, number] }>,
  withinM = 200
): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (norm(a.name) && norm(a.name) === norm(b.name) && metres(a.coordinates, b.coordinates) <= withinM) {
        out.add(a.id);
        out.add(b.id);
      }
    }
  }
  return out;
}
