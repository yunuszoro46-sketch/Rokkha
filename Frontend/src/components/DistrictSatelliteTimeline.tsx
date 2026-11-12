"use client";

import React, { useEffect, useState } from "react";
import { SatelliteObservation } from "../types/api";
import {
  getSatelliteObservations,
  getFloodDistricts,
  getFloodEvents,
} from "../services/api";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { Separator } from "./ui/separator";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Satellite, Info, Award, Search } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredDistricts = rankedDistricts.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.division.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.pcode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const chartData = observations.map((o) => ({
    date: o.date.slice(5), // MM-DD
    fullDate: o.date,
    floodedPercent: Math.round(o.flooded_share * 100 * 10) / 10,
    observedPercent: Math.round(o.observed_share * 100),
    isFlooded: o.flooded,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: 64-District Flood Ranking Table using shadcn/ui Table & Input */}
      <Card className="lg:col-span-5 border-brand-limestone bg-brand-white shadow-card flex flex-col">
        <CardHeader className="border-b border-brand-limestone pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Award className="w-6 h-6 text-brand-forest" />
              <CardTitle>{t.timeline_card_title}</CardTitle>
            </div>
            <Badge variant="secondary">{t.timeline_badge}</Badge>
          </div>
          <p className="text-base text-brand-forest/70 font-medium">
            {t.timeline_card_sub}
          </p>
          <div className="pt-2 relative">
            <Search className="w-4 h-4 text-brand-forest/50 absolute left-3.5 top-5 z-10" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.timeline_search_placeholder}
              className="pl-10"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-hidden">
          <div className="max-h-[460px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">{t.th_rank}</TableHead>
                  <TableHead>{t.th_district}</TableHead>
                  <TableHead>{t.th_events}</TableHead>
                  <TableHead className="text-right">{t.th_peak}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDistricts.map((d) => {
                  const isSelected = d.pcode === districtPcode;
                  const maxPct = Math.round((d.max_flooded_share || 0) * 100);
                  const dName = isBn
                    ? DISTRICTS_BN[d.pcode] || d.name
                    : d.name;
                  const dDiv = isBn
                    ? DIVISIONS_BN[d.division] || d.division
                    : d.division;

                  return (
                    <TableRow
                      key={d.pcode}
                      data-state={isSelected ? "selected" : undefined}
                      onClick={() => onSelectDistrict?.(d.pcode, d.name)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-bold">
                        #{isBn ? toBnNum(d.rank) : d.rank}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-base">{dName}</div>
                        <div
                          className={`text-base ${
                            isSelected
                              ? "text-white/70"
                              : "text-brand-forest/60"
                          }`}
                        >
                          {dDiv}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {isBn ? toBnNum(d.events_flooded) : d.events_flooded}
                        </span>{" "}
                        / {isBn ? toBnNum(d.events_observed) : d.events_observed}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            maxPct >= 50
                              ? "alert"
                              : maxPct >= 20
                              ? "watch"
                              : "secondary"
                          }
                        >
                          {isBn ? toBnNum(maxPct) : maxPct}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Right Column: Satellite Flood Timeline & Event Matrix (Section 3.C) */}
      <Card className="lg:col-span-7 border-brand-limestone bg-brand-white shadow-card">
        <CardHeader className="border-b border-brand-limestone pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Satellite className="w-6 h-6 text-brand-forest" />
              <CardTitle>
                {t.timeline_right_title} {displayDistrictName}
                {currentDistrictHistory?.rank && (
                  <span className="ml-2 text-base font-semibold text-brand-amber">
                    (
                    {t.timeline_rank_of_64.replace(
                      "{rank}",
                      isBn
                        ? toBnNum(currentDistrictHistory.rank)
                        : String(currentDistrictHistory.rank)
                    )}
                    )
                  </span>
                )}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={seasonYear === "2022" ? "default" : "secondary"}
                onClick={() => setSeasonYear("2022")}
              >
                {t.timeline_btn_2022}
              </Button>
              <Button
                size="sm"
                variant={seasonYear === "2024" ? "default" : "secondary"}
                onClick={() => setSeasonYear("2024")}
              >
                {t.timeline_btn_2024}
              </Button>
            </div>
          </div>
          <p className="text-base text-brand-forest/70 font-medium">
            {t.timeline_right_sub}
          </p>
        </CardHeader>

        <CardContent className="pt-5 space-y-5">
          {isLoading ? (
            <div className="py-12 text-center text-base text-brand-sage animate-pulse">
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
            <div className="space-y-3">
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDEBE2" />
                    <XAxis
                      dataKey="date"
                      stroke="#64748B"
                      fontSize={16}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#64748B"
                      fontSize={16}
                      unit="%"
                      tickLine={false}
                      domain={[0, "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        borderColor: "#EDEBE2",
                        borderRadius: "0.5rem",
                        fontSize: "16px",
                        color: "#263B32",
                      }}
                      formatter={(val: any) => [
                        `${isBn ? toBnNum(val) : val}${t.timeline_tooltip_flooded}`,
                        t.timeline_tooltip_flooded_share,
                      ]}
                      labelFormatter={(label) =>
                        `${t.timeline_pass_label} (${isBn ? toBnNum(seasonYear) : seasonYear}-${label})`
                      }
                    />
                    <Bar
                      dataKey="floodedPercent"
                      fill="#C69A50"
                      radius={[4, 4, 0, 0]}
                      name={t.timeline_tooltip_flooded_share}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-base text-brand-forest/60">
              {t.timeline_no_passes.replace(
                "{district}",
                displayDistrictName
              )}
            </div>
          )}

          {/* 10 Historical Flood Events Breakdown (Section 3.C) */}
          {currentDistrictHistory?.events && (
            <div className="pt-2 space-y-3">
              <Separator />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-base font-bold uppercase tracking-wider text-brand-forest/80">
                  {t.timeline_10_events_title}
                </span>
                <span className="text-base text-brand-forest/60">
                  {t.timeline_grey_sub}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {currentDistrictHistory.events.map((ev: any) => {
                  const metaEv = floodEvents.find(
                    (e) => e.event_id === ev.event_id
                  );
                  const pct =
                    ev.flooded_share !== null && ev.flooded_share !== undefined
                      ? `${isBn ? toBnNum(Math.round(ev.flooded_share * 100)) : Math.round(ev.flooded_share * 100)}%`
                      : t.timeline_no_data;
                  return (
                    <div
                      key={ev.event_id}
                      className={`p-3 rounded-lg border text-base flex flex-col justify-between ${
                        ev.status === "flooded"
                          ? "bg-brand-clay/10 border-brand-clay/30 text-brand-forest"
                          : ev.status === "not_flooded"
                          ? "bg-brand-warm border-brand-limestone text-brand-forest/80"
                          : "bg-gray-100 border-gray-200 text-gray-500"
                      }`}
                      title={metaEv?.name || ev.event_id}
                    >
                      <span className="font-mono font-bold text-base truncate">
                        {ev.event_id}
                      </span>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="capitalize text-base">
                          {ev.status === "not_observed"
                            ? t.timeline_no_data
                            : ev.status === "flooded"
                            ? isBn
                              ? "প্লাবিত"
                              : "Flooded"
                            : isBn
                            ? "প্লাবিত নয়"
                            : "Not Flooded"}
                        </span>
                        <span className="font-extrabold text-base">{pct}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
