import { DistrictPrediction } from "../../types/api";
import benchmarkData from "../../data/benchmark_predictions.json";
import { API_BASE } from "../common/client";

/**
 * Get Predictions for a specific target_date
 */
export async function getPredictions(targetDate: string): Promise<DistrictPrediction[]> {
  try {
    const res = await fetch(`${API_BASE}/predictions?target_date=${targetDate}`);
    if (res.ok) {
      const data = await res.json();
      if (data.predictions && data.predictions.length > 0) {
        return data.predictions;
      }
    }
  } catch {
    // fallback below
  }

  const allDates = (benchmarkData as any).predictions || {};
  const list =
    allDates[targetDate] ||
    allDates["2022-06-18"] ||
    [];
  return list.map((p: any) => ({
    ...p,
    target_date: targetDate,
  }));
}

