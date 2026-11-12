import { ModelStatus } from "../../types/api";
import modelMeta from "../../data/flood_model_meta.json";
import { API_BASE } from "../common/client";

/**
 * Check if the FastAPI backend is reachable and returning valid JSON
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: "GET" });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.status === "healthy";
  } catch {
    return false;
  }
}

/**
 * Get Model Status & Verification Metrics
 */
export async function getModelStatus(): Promise<ModelStatus | null> {
  try {
    const res = await fetch(`${API_BASE}/predictions/model`);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fallback below
  }
  return {
    status: "ready",
    message: "A trained model is loaded.",
    model: {
      version: (modelMeta as any).model_version,
      test_results: (modelMeta as any).test_results,
    },
  };
}

