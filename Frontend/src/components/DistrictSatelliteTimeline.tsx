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

interface DistrictSatelliteTimelineProps {
  districtPcode: string;
  districtName: string;
  onSelectDistrict?: (pcode: string, name: string) => void;
}

export const DistrictSatelliteTimeline: React.FC<
  DistrictSatelliteTimelineProps
> = ({ districtPcode, districtName, onSelectDistrict }) => {
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
              <CardTitle>64-District Flood Frequency</CardTitle>
            </div>
            <Badge variant="secondary">2016–2024 UNOSAT</Badge>
          </div>
          <p className="text-base text-brand-forest/70 font-medium">
            Click any district row to inspect its Copernicus Sentinel-1
            satellite timeline and event history.
          </p>
          <div className="pt-2 relative">
            <Search className="w-4 h-4 text-brand-forest/50 absolute left-3.5 top-5 z-10" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter 64 districts by name or division..."
              className="pl-10"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-hidden">
          <div className="max-h-[460px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead className="text-right">Peak</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDistricts.map((d) => {
                  const isSelected = d.pcode === districtPcode;
                  const maxPct = Math.round((d.max_flooded_share || 0) * 100);
                  return (
                    <TableRow
                      key={d.pcode}
                      data-state={isSelected ? "selected" : undefined}
                      onClick={() => onSelectDistrict?.(d.pcode, d.name)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-bold">#{d.rank}</TableCell>
                      <TableCell>
                        <div className="font-bold text-base">{d.name}</div>
                        <div
                          className={`text-base ${
                            isSelected
                              ? "text-white/70"
                              : "text-brand-forest/60"
                          }`}
                        >
                          {d.division}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {d.events_flooded}
                        </span>{" "}
                        / {d.events_observed}
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
                          {maxPct}%
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
                Sentinel-1 Timeline: {districtName}
                {currentDistrictHistory?.rank && (
                  <span className="ml-2 text-base font-semibold text-brand-amber">
                    (Rank #{currentDistrictHistory.rank} of 64)
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
                2022 Monsoon
              </Button>
              <Button
                size="sm"
                variant={seasonYear === "2024" ? "default" : "secondary"}
                onClick={() => setSeasonYear("2024")}
              >
                2024 Monsoon
              </Button>
            </div>
          </div>
          <p className="text-base text-brand-forest/70 font-medium">
            Share of observed district land covered by unusual flood water
            (Copernicus GFM). Gaps are days with no satellite pass, not dry days.
          </p>
        </CardHeader>

        <CardContent className="pt-5 space-y-5">
          {isLoading ? (
            <div className="py-12 text-center text-base text-brand-sage animate-pulse">
              Loading Copernicus Sentinel-1 satellite passes...
            </div>
          ) : isUnsupported ? (
            <Alert variant="muted">
              <Info className="h-5 w-5" />
              <AlertTitle>
                Satellite cannot observe floods in {districtName}
              </AlertTitle>
              <AlertDescription>
                Sentinel-1 radar backscatter cannot map floods under hills,
                forest canopy, or dense city buildings (one of 8 radar-blind
                districts). This means <strong>no satellite data</strong>, not
                that the district is safe.
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
                        `${val}% unusual flood water`,
                        "Flooded Share",
                      ]}
                      labelFormatter={(label) =>
                        `Sentinel-1 Pass (${seasonYear}-${label})`
                      }
                    />
                    <Bar
                      dataKey="floodedPercent"
                      fill="#C69A50"
                      radius={[4, 4, 0, 0]}
                      name="Flooded Share (%)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-base text-brand-forest/60">
              No satellite passes recorded for this window in {districtName}.
            </div>
          )}

          {/* 10 Historical Flood Events Breakdown (Section 3.C) */}
          {currentDistrictHistory?.events && (
            <div className="pt-2 space-y-3">
              <Separator />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-base font-bold uppercase tracking-wider text-brand-forest/80">
                  10 Major Flood Events Record (2016–2024)
                </span>
                <span className="text-base text-brand-forest/60">
                  Grey = Not observed by satellite (never implies safe)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {currentDistrictHistory.events.map((ev: any) => {
                  const metaEv = floodEvents.find(
                    (e) => e.event_id === ev.event_id
                  );
                  const pct =
                    ev.flooded_share !== null && ev.flooded_share !== undefined
                      ? `${Math.round(ev.flooded_share * 100)}%`
                      : "No Data";
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
                            ? "No Data"
                            : ev.status.replace("_", " ")}
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
