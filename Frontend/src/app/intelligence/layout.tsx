import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rokkha Intelligence — data, model, evidence and limits",
  description:
    "How Rokkha turns Sentinel-1 satellite observations, rain and river-flow data and Bangladesh's official geography into daily district flood forecasts: pipeline, XGBoost model, year-separated evaluation, milestones and limitations.",
};

export default function IntelligenceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
