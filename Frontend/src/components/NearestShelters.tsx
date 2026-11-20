"use client";

import React, { useState, useEffect } from "react";
import { AssetNearResult } from "../types/api";
import { findNearestAssets } from "../services/api";
import { Card, CardHeader, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import { Users, MapPin, RotateCw, Copy, Crosshair } from "lucide-react";
import { displayName, possibleDuplicates } from "@/lib/facilities";
import { formatDay } from "@/lib/dates";
import {
  Language,
  UI_TEXT,
  DISTRICTS_BN,
  toBnNum,
} from "../lib/translations";

interface NearestSheltersProps {
  currentCoords: { lat: number; lng: number };
  districtName: string;
  lang?: Language;
  /** Where currentCoords came from, and its readable name, so distances are explained honestly. */
  origin?: { source: "district" | "gps" | "saved"; place: string | null };
  onUseMyLocation?: () => void;
  locating?: boolean;
}

export const NearestShelters: React.FC<NearestSheltersProps> = ({
  currentCoords,
  districtName,
  lang = "en",
  origin = { source: "district", place: null },
  onUseMyLocation,
  locating = false,
}) => {
  const t = UI_TEXT[lang] || UI_TEXT.en;
  const isBn = lang === "bn";
  const displayDistrict = isBn
    ? Object.entries(DISTRICTS_BN).find(([_, name]) => name === districtName)?.[1] || districtName
    : districtName;

  const [assets, setAssets] = useState<AssetNearResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const num = (v: string | number) => (isBn ? toBnNum(v) : String(v));
  const dupIds = React.useMemo(
    () => possibleDuplicates(assets.map((a) => ({ id: a.asset.id, name: a.asset.name, coordinates: a.asset.location.coordinates }))),
    [assets]
  );
  const [filterType, setFilterType] = useState<string>("");
  const [radiusKm, setRadiusKm] = useState<number>(25);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    findNearestAssets(
      currentCoords.lng,
      currentCoords.lat,
      radiusKm * 1000,
      filterType || undefined
    ).then((res) => {
      if (!mounted) return;
      setIsLoading(false);
      setFailed(res === null);
      setAssets(res || []);
    });

    return () => {
      mounted = false;
    };
  }, [currentCoords, radiusKm, filterType, attempt]);

  return (
    <Card className="border-rk-line bg-rk-surface shadow-card" id="shelters">
      <CardHeader className="border-b border-rk-line pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Filter Pills using shadcn/ui Button */}
          <div className="flex flex-wrap items-center gap-2 text-base" role="group" aria-label={t.shelters_filter_label}>
            <span className="text-sm font-semibold text-rk-muted mr-1">{t.shelters_filter_label}</span>
            {[
              { id: "", label: t.shelters_type_all },
              { id: "flood_shelter", label: t.shelters_type_flood },
              { id: "hospital", label: t.shelters_type_hospital },
              { id: "clinic", label: t.shelters_type_clinic },
              { id: "school", label: t.shelters_type_school },
            ].map((type) => (
              <Button
                key={type.id}
                size="sm"
                variant={filterType === type.id ? "default" : "secondary"}
                aria-pressed={filterType === type.id}
                onClick={() => setFilterType(type.id)}
              >
                {type.label}
              </Button>
            ))}
          </div>

          {/* Radius selector using shadcn/ui Select */}
          <div className="flex items-center space-x-2 shrink-0">
            <span id="rk-radius-label" className="text-sm font-semibold text-rk-muted">
              {t.shelters_radius_label}
            </span>
            <Select
              value={String(radiusKm)}
              onValueChange={(val) => setRadiusKm(Number(val))}
            >
              <SelectTrigger className="w-32 h-10" aria-labelledby="rk-radius-label">
                <SelectValue placeholder={t.shelters_radius_label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">{isBn ? "৫ কিমি" : "5 km"}</SelectItem>
                <SelectItem value="10">{isBn ? "১০ কিমি" : "10 km"}</SelectItem>
                <SelectItem value="25">{isBn ? "২৫ কিমি" : "25 km"}</SelectItem>
                <SelectItem value="50">{isBn ? "৫০ কিমি" : "50 km"}</SelectItem>
                <SelectItem value="100">{isBn ? "১০০ কিমি" : "100 km"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-3">
        {/* Distances are measured from this point: say which, in words, never as coordinates. */}
        <div
          role="status"
          className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${origin.source === "district" ? "border-rk-warning-accent/60 bg-rk-warning-soft/50" : "border-rk-success/40 bg-rk-success-soft/60"}`}
        >
          <p className="text-sm text-rk-ink">
            {origin.source === "gps" ? (
              <>{isBn ? "দূরত্ব মাপা হয়েছে আপনার বর্তমান অবস্থান থেকে" : "Distances are from your current location"}{origin.place ? <>: <strong>{origin.place}</strong></> : null}.</>
            ) : origin.source === "saved" ? (
              <>{isBn ? "দূরত্ব মাপা হয়েছে আপনার সংরক্ষিত স্থান থেকে" : "Distances are from your saved place"}{origin.place ? <>: <strong>{origin.place}</strong></> : null}.</>
            ) : (
              <>
                {isBn ? "দূরত্ব মাপা হয়েছে " : "Distances are from the centre of "}
                <strong>{isBn ? `${displayDistrict} জেলার কেন্দ্র` : `${displayDistrict} district`}</strong>
                {isBn ? " থেকে, আপনার অবস্থান থেকে নয়।" : ", not from where you are."}
              </>
            )}
          </p>
          {onUseMyLocation && origin.source !== "gps" && (
            <Button size="sm" onClick={onUseMyLocation} disabled={locating} className="shrink-0 gap-1.5 bg-rk-brand hover:bg-rk-brand-strong">
              <Crosshair className="w-4 h-4" aria-hidden="true" />
              {locating ? (isBn ? "খোঁজা হচ্ছে…" : "Finding you…") : isBn ? "আমার অবস্থান থেকে দূরত্ব" : "Use my location"}
            </Button>
          )}
        </div>
        <p className="text-sm text-rk-muted">
          {isBn
            ? "বেশিরভাগ স্থান OpenStreetMap থেকে নেওয়া (© OpenStreetMap contributors) এবং সরেজমিনে যাচাই করা নয়। তালিকা সম্পূর্ণ নয়: এখানে না থাকলেও আশ্রয়কেন্দ্র থাকতে পারে। জরুরি প্রয়োজনে ৯৯৯ নম্বরে কল করুন।"
            : "Most places come from OpenStreetMap (© OpenStreetMap contributors) and are not checked on the ground. The list is not complete: a shelter may exist even if it is not shown here. In an emergency call 999."}
        </p>
        {isLoading ? (
          <div role="status" className="py-6 text-center text-base text-rk-muted motion-safe:animate-pulse">
            {t.shelters_loading}
          </div>
        ) : failed ? (
          <div role="alert" className="p-6 text-center rounded-lg border border-rk-line bg-rk-page space-y-3">
            <p className="font-semibold text-rk-ink">
              {isBn ? "আশ্রয়কেন্দ্রের তালিকা এখন আনা যাচ্ছে না।" : "The list of places could not be loaded right now."}
            </p>
            <p className="text-sm text-rk-muted">
              {isBn
                ? "রক্ষা সার্ভারে পৌঁছানো যায়নি; এর মানে কাছে কোনো আশ্রয়কেন্দ্র নেই, তা নয়। জরুরি প্রয়োজনে ৯৯৯ নম্বরে কল করুন।"
                : "Rokkha's server could not be reached; this does not mean there are no shelters nearby. In an emergency call 999."}
            </p>
            <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)} className="gap-1.5">
              <RotateCw className="w-4 h-4" aria-hidden="true" />
              {isBn ? "আবার চেষ্টা করুন" : "Try again"}
            </Button>
          </div>
        ) : assets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assets.map((item) => {
              const name = displayName(item.asset.name);
              const dup = dupIds.has(item.asset.id);
              const occ = item.asset.occupancy;
              return (
              <Card
                key={item.asset.id}
                className="p-4 sm:p-5 border-rk-line bg-rk-page flex flex-col justify-between space-y-3 shadow-sm"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-bold text-lg leading-snug text-rk-forest min-w-0 break-words" title={name !== item.asset.name ? item.asset.name : undefined}>
                      {name}
                    </h2>
                    <Badge variant="outline" className="whitespace-nowrap shrink-0 font-mono" aria-label={isBn ? "দূরত্ব" : "Distance"}>
                      {item.distance_kilometers < 1
                        ? `${isBn ? toBnNum(Math.round(item.distance_meters)) : Math.round(item.distance_meters)} ${isBn ? "মিটার" : "m"}`
                        : `${isBn ? toBnNum(item.distance_kilometers.toFixed(1)) : item.distance_kilometers.toFixed(1)} ${isBn ? "কিমি" : "km"}`}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <Badge variant="secondary">
                      {item.asset.asset_type === "flood_shelter"
                        ? isBn ? "বন্যা আশ্রয়কেন্দ্র" : "Flood shelter"
                        : item.asset.asset_type === "hospital"
                        ? isBn ? "হাসপাতাল" : "Hospital"
                        : item.asset.asset_type === "clinic"
                        ? isBn ? "ক্লিনিক" : "Clinic"
                        : item.asset.asset_type === "school"
                        ? isBn ? "বিদ্যালয়" : "School"
                        : item.asset.asset_type.replace("_", " ")}
                    </Badge>
                    {dup && (
                      <span className="inline-flex items-center gap-1 text-xs text-rk-warning" title={isBn ? "একই নামের আরেকটি স্থান ২০০ মিটারের মধ্যে আছে; এটি একই জায়গা হতে পারে। তথ্যটি যাচাই করা হয়নি।" : "Another entry with the same name is within 200 m; it may be the same place. Not checked."}>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        {isBn ? "দুবার তালিকাভুক্ত হতে পারে" : "May be listed twice"}
                      </span>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-rk-muted">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-rk-muted shrink-0" aria-hidden="true" />
                    <span>
                      {occ != null && occ > 0
                        ? `${t.shelters_capacity} ${isBn ? toBnNum(occ.toLocaleString()) : occ.toLocaleString()} ${t.shelters_people} ${isBn ? "(যাচাই করা নয়)" : "(not verified)"}`
                        : isBn ? "ধারণক্ষমতার তথ্য নেই" : "Capacity not recorded"}
                    </span>
                  </div>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${item.asset.location.coordinates[1]}&mlon=${item.asset.location.coordinates[0]}#map=16/${item.asset.location.coordinates[1]}/${item.asset.location.coordinates[0]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-6 items-center gap-1 text-xs font-semibold text-rk-muted underline decoration-dotted underline-offset-2 hover:text-rk-brand-strong"
                    aria-label={`${isBn ? "মানচিত্রে দেখুন" : "Open on OpenStreetMap"}: ${name}`}
                  >
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    {isBn ? "মানচিত্রে দেখুন" : "Open on map"}
                  </a>
                </div>
                <p className="text-xs text-rk-muted">
                  {item.asset.source
                    ? `${isBn ? "উৎস" : "Source"}: ${item.asset.source}${item.asset.source === "OpenStreetMap" ? (isBn ? ", সরেজমিনে যাচাই করা নয়" : ", not checked on the ground") : ""}`
                    : isBn ? "হাতে যোগ করা; উৎস লেখা নেই" : "Added by hand; source not recorded"}
                  {item.asset.updated_at ? ` · ${isBn ? "হালনাগাদ" : "updated"} ${formatDay(item.asset.updated_at.slice(0, 10), isBn ? "bn" : "en")}` : ""}
                  {isBn ? " · এখন খোলা বা জায়গা আছে কি না জানা নেই" : " · whether it is open or has space now is unknown"}
                </p>
              </Card>
              );
            })}
          </div>
        ) : (
          <div role="status" className="p-6 text-center text-base text-rk-muted bg-rk-page rounded-lg border border-rk-line">
            {t.shelters_empty.replace(
              "{radius}",
              isBn ? toBnNum(radiusKm) : String(radiusKm)
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
