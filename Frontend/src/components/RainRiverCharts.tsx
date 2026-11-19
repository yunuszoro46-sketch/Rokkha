"use client";

import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { CloudRain } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSiteRain, getSiteRiver } from "@/services/api";
import {
  Language,
  UI_TEXT,
  DISTRICTS_BN,
  toBnNum,
} from "../lib/translations";

interface RainRiverChartsProps {
  districtPcode: string;
  districtName: string;
  lang?: Language;
}

export const RainRiverCharts: React.FC<RainRiverChartsProps> = ({
  districtPcode,
  districtName,
  lang = "en",
}) => {
  const t = UI_TEXT[lang] || UI_TEXT.en;
  const isBn = lang === "bn";
  const displayDistrictName = isBn
    ? DISTRICTS_BN[districtPcode] || districtName
    : districtName;

  const [activeTab, setActiveTab] = useState<"rain" | "river">("rain");
  const [rainData, setRainData] = useState<any[]>([]);
  const [riverData, setRiverData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    const siteId = `district-${districtPcode}`;
    const startDate = "2022-06-10";
    const endDate = "2022-06-25";

    Promise.all([
      getSiteRain(siteId, startDate, endDate),
      getSiteRiver("surma-sunamganj", startDate, endDate),
    ]).then(([rainRes, riverRes]) => {
      if (!mounted) return;
      setIsLoading(false);

      // Only values the backend (or its saved sample) really has. A missing day
      // stays empty (null): it must not be drawn as 0 mm or 0 m³/s.
      setRainData(
        (rainRes?.values || []).map((v: any) => ({
          date: v.date?.slice(5, 10),
          precipitation: v.missing ? null : v.precipitation_mm ?? null,
          isForecast: v.is_forecast,
        }))
      );
      setRiverData(
        (riverRes?.values || []).map((v: any) => ({
          date: v.date?.slice(5, 10),
          discharge: v.missing ? null : v.discharge_m3s ?? null,
        }))
      );
    });

    return () => {
      mounted = false;
    };
  }, [districtPcode]);

  return (
    <Card className="border-rk-line bg-white shadow-sm">
      <CardHeader className="border-b border-rk-line pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <CloudRain className="w-6 h-6 text-rk-forest" />
              <CardTitle>
                {t.hydro_card_title} {displayDistrictName}
              </CardTitle>
            </div>
            <p className="text-base text-rk-forest/70 font-normal">
              {t.hydro_card_sub}
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="bg-rk-secondary/60">
              <TabsTrigger value="rain">{t.hydro_tab_rain}</TabsTrigger>
              <TabsTrigger value="river">{t.hydro_tab_river}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        {isLoading ? (
          <div className="py-10 text-center text-base text-rk-muted animate-pulse">
            {t.hydro_loading}
          </div>
        ) : (activeTab === "rain" ? rainData : riverData).length === 0 ? (
          <div className="py-10 text-center text-base text-rk-muted">
            {lang === "bn"
              ? "এই তারিখগুলোর জন্য কোনো তথ্য পাওয়া যায়নি।"
              : "No data available for these dates."}
          </div>
        ) : activeTab === "rain" ? (
          <div className="space-y-3">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rainData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDEBE2" />
                  <XAxis dataKey="date" stroke="#64748B" fontSize={16} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={16} unit=" mm" tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#EDEBE2",
                      borderRadius: "0.5rem",
                      fontSize: "16px",
                      color: "#1A2820",
                    }}
                    formatter={(val: any) => [
                      `${isBn ? toBnNum(val) : val} ${isBn ? "মিমি" : "mm"}`,
                      t.hydro_rainfall_label,
                    ]}
                    labelFormatter={(label) => `${isBn ? "তারিখ: " : "Date: "}${label}`}
                  />
                  <Bar
                    dataKey="precipitation"
                    fill="#5C9287"
                    radius={[4, 4, 0, 0]}
                    name={t.hydro_rainfall_label}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-base text-rk-forest/60 pt-2 border-t border-rk-line">
              <span>{t.hydro_rain_sources}</span>
              <span>{t.hydro_rain_note}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={riverData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDEBE2" />
                  <XAxis dataKey="date" stroke="#64748B" fontSize={16} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={16} unit=" m³/s" tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#EDEBE2",
                      borderRadius: "0.5rem",
                      fontSize: "16px",
                      color: "#1A2820",
                    }}
                    formatter={(val: any) => [
                      `${isBn ? toBnNum(val) : val} ${isBn ? "ঘনমিটার/সে." : "m³/s"}`,
                      t.hydro_discharge_label,
                    ]}
                    labelFormatter={(label) => `${isBn ? "তারিখ: " : "Date: "}${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="discharge"
                    stroke="#234533"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#234533" }}
                    name={t.hydro_discharge_label}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-base text-rk-forest/60 pt-2 border-t border-rk-line">
              <span>{t.hydro_river_site}</span>
              <span>{t.hydro_river_source}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
