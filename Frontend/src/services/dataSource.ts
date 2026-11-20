// Remembers which parts of the page are showing the saved sample instead of
// live backend answers, so the page can say so (see DataSourceBanner).
//
// Rule: the portal never shows saved data as if it were live. Every function
// in api.ts that falls back to src/data must call markSample(); when the
// backend answers, it calls markLive().

import { useSyncExternalStore } from "react";
import benchmarkData from "../data/benchmark_predictions.json";

export type DataPart =
  | "predictions"
  | "alerts"
  | "model"
  | "history"
  | "satellite"
  | "location"
  | "shelters"
  | "hydro";

// When the saved sample was copied from the backend (written by scripts/build_snapshot.py).
export const SAMPLE_GENERATED_AT: string = (benchmarkData as any).generated_at || "";
export const SAMPLE_DATES: string[] = Object.keys((benchmarkData as any).predictions || {});

const sampleParts = new Set<DataPart>();
const listeners = new Set<() => void>();
let snapshot = "";

function publish() {
  const next = Array.from(sampleParts).sort().join(",");
  if (next === snapshot) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function markSample(part: DataPart) {
  sampleParts.add(part);
  publish();
}

export function markLive(part: DataPart) {
  sampleParts.delete(part);
  publish();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The parts of the page currently showing the saved sample (empty = all live). */
export function useSampleParts(): DataPart[] {
  const value = useSyncExternalStore(subscribe, () => snapshot, () => "");
  return value ? (value.split(",") as DataPart[]) : [];
}
