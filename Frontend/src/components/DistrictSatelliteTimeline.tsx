"use client";

import React, { useEffect, useState } from "react";
import { SatelliteObservation } from "../types/api";
import {
  getSatelliteObservations,
  getFloodDistricts,
  getFloodEvents,
} from "../services/api";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { Separator } from "./ui/separator";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Satellite, Info } from "lucide-react";
import {
  Language,
  UI_TEXT,
  DISTRICTS_BN,
  DIVISIONS_BN,
  toBnNum,
} from "../lib/translations";

interface DistrictSatelliteTimelineProps {
  districtPcode: string;
  districtName: string;
  lang?: Language;
  onSelectDistrict?: (pcode: string, name: string) => void;
}

export const DistrictSatelliteTimeline: React.FC<
  DistrictSatelliteTimelineProps
> = ({ districtPcode, districtName, lang = "en", onSelectDistrict }) => {
  const t = UI_TEXT[lang] || UI_TEXT.en;
  const isBn = lang === "bn";
  const displayDistrictName = isBn
    ? DISTRICTS_BN[districtPcode] || districtName
    : districtName;
  const [observations, setObservations] = useState<SatelliteObservation[]>([]);
  const [rankedDistricts, setRankedDistricts] = useState<any[]>([]);
  const [floodEvents, setFloodEvents] = useState<any[]>([]);
  const [seasonYear, setSeasonYear] = useState<"2022" | "2024">("2022");
  const [isLoading, setIsLoading] = useState(false);
  const [isUnsupported, setIsUnsupported] = useState(false);

  useEffect(() => {
    getFloodDistricts().then(setRankedDistricts);
    getFloodEvents().then(setFloodEvents);
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setIsUnsupported(false);

    const start = `${seasonYear}-04-01`;
    const end = `${seasonYear}-10-31`;

    getSatelliteObservations(districtPcode, start, end).then((res) => {
      if (!mounted) return;
      setIsLoading(false);
      if (res.unsupported) {
        setIsUnsupported(true);
        setObservations([]);
      } else {
        setIsUnsupported(false);
        setObservations(res.observations || []);
      }
    });

    return () => {
      mounted = false;
    };
  }, [districtPcode, seasonYear]);

  const currentDistrictHistory = rankedDistricts.find(
    (d) => d.pcode === districtPcode
  );

  const chartData = observations.map((o) => ({
    date: o.date.slice(5), // MM-DD
    fullDate: o.date,
    floodedPercent: Math.round(o.flooded_share * 100 * 10) / 10,
    observedPercent: Math.round(o.observed_share * 100),
    isFlooded: o.flooded,
  }));

  return (
    <div className="w-full">
      {/* Sentinel-1 Timeline & 10 Major Flood Events Record */}
      <Card className="w-full bg-white rounded-3xl border border-[#DFDDD3] p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-2 border-b border-[#E5E3D8]">
            <div className="flex items-start gap-2.5">
              <span className="text-lg text-[#11241C] mt-0.5">✳</span>
              <div>
                <div className="text-lg sm:text-xl font-black text-[#11241C] tracking-tight leading-snug">
                  Sentinel-1 Timeline:
                </div>
                <div className="text-lg sm:text-xl font-black text-[#11241C] tracking-tight leading-snug">
                  {displayDistrictName}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSeasonYear("2022")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-xs ${
                  seasonYear === "2022"
                    ? "bg-[#11241C] text-white"
                    : "bg-white border border-[#DFDDD3] text-[#11241C] hover:bg-[#F7F6F0]"
                }`}
              >
                2022 Monsoon
              </button>
              <button
                onClick={() => setSeasonYear("2024")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-xs ${
                  seasonYear === "2024"
                    ? "bg-[#11241C] text-white"
                    : "bg-white border border-[#DFDDD3] text-[#11241C] hover:bg-[#F7F6F0]"
                }`}
              >
                2024 Monsoon
              </button>
            </div>
          </div>

          <p className="text-xs text-[#5C6863] leading-relaxed mt-2 mb-3">
            Share of observed district land covered by unusual flood water (Copernicus GFM). Gaps are days with no satellite pass, not dry days.
          </p>

          {/* Legend Matching Image 2 */}
          <div className="flex flex-col items-end gap-1 text-[11px] text-[#4B5563] pb-1 pr-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-xs bg-[#D89B37]" />
              <span className="font-bold text-[#11241C]">Flood Coverage</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#5C6863]">
              <span>💧</span>
              <span>Water over district land</span>
            </div>
          </div>

          <div className="pt-2">
            {isLoading ? (
              <div className="py-12 text-center text-sm text-[#5C6863] animate-pulse">
                {t.timeline_loading}
              </div>
            ) : isUnsupported ? (
              <Alert variant="muted">
                <Info className="h-5 w-5" />
                <AlertTitle>
                  {t.timeline_radar_blind_title.replace(
                    "{district}",
                    displayDistrictName
                  )}
                </AlertTitle>
                <AlertDescription>
                  {t.timeline_radar_blind_desc}
                </AlertDescription>
              </Alert>
            ) : chartData.length > 0 ? (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEA" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#8C938E"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#8C938E"
                      fontSize={11}
                      unit="%"
                      tickLine={false}
                      domain={[0, 60]}
                      ticks={[0, 15, 30, 45, 60]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        borderColor: "#EDEBE2",
                        borderRadius: "0.5rem",
                        fontSize: "12px",
                        color: "#11241C",
                      }}
                      formatter={(val: any) => [
                        `${isBn ? toBnNum(val) : val}%`,
                        "Flood Coverage",
                      ]}
                      labelFormatter={(label) =>
                        `${seasonYear}-${label}`
                      }
                    />
                    <Bar
                      dataKey="floodedPercent"
                      fill="#D89B37"
                      radius={[2, 2, 0, 0]}
                      name="Flood Coverage"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-[#5C6863]">
                {t.timeline_no_passes.replace(
                  "{district}",
                  displayDistrictName
                )}
              </div>
            )}
          </div>
        </div>

        {/* 10 Major Flood Events Record (2016-2024) (Matching Image 2) */}
        {currentDistrictHistory?.events && (
          <div className="pt-4 border-t border-[#E5E3D8] mt-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#11241C]">
                10 MAJOR FLOOD EVENTS RECORD (2016–2024)
              </span>
              <span className="text-[11px] text-[#5C6863]">
                Grey = Not observed by satellite (never implies safe)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {currentDistrictHistory.events.map((ev: any) => {
                const isFlooded = ev.status === "flooded";
                const isNotObserved = ev.status === "not_observed";
                const pctNum =
                  ev.flooded_share !== null && ev.flooded_share !== undefined
                    ? Math.round(ev.flooded_share * 100)
                    : null;

                // Color schemes strictly matching Image 2
                let cardBg = "bg-[#F3F4F6] border-[#E5E7EB] text-[#6B7280]";
                if (isFlooded) {
                  if (pctNum !== null && pctNum >= 50) {
                    cardBg = "bg-[#F87171] border-[#EF4444]/40 text-[#11241C]";
                  } else {
                    cardBg = "bg-[#FCA5A5] border-[#F87171]/40 text-[#11241C]";
                  }
                } else if (ev.status === "not_flooded") {
                  cardBg = "bg-[#D1FAE5] border-[#A7F3D0] text-[#065F46]";
                }

                // Format event id: e.g. "2016-07-mo..."
                const truncatedId =
                  ev.event_id.length > 11
                    ? `${ev.event_id.slice(0, 10)}...`
                    : ev.event_id;

                return (
                  <div
                    key={ev.event_id}
                    className={`p-2.5 rounded-xl border text-xs flex flex-col justify-between min-h-[58px] transition shadow-2xs ${cardBg}`}
                    title={ev.event_id}
                  >
                    <span className="font-mono text-[10px] font-semibold opacity-85 truncate">
                      {truncatedId}
                    </span>
                    <div className="mt-1">
                      {isNotObserved ? (
                        <div className="text-[11px] font-bold leading-tight text-[#6B7280]">
                          <div>No</div>
                          <div>Data</div>
                        </div>
                      ) : isFlooded ? (
                        <div className="text-[11px] font-extrabold leading-tight text-[#11241C]">
                          Flooded {pctNum}%
                        </div>
                      ) : (
                        <div className="text-[11px] font-extrabold leading-tight text-[#065F46]">
                          Dry {pctNum ?? 0}%
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
