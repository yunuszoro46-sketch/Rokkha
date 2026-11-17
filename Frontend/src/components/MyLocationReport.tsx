"use client";

import React, { useEffect, useState } from "react";
import { Crosshair, LogOut, MapPin, Trash2, User as UserIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Language, DISTRICTS_BN, toBnNum } from "../lib/translations";
import {
  AccountUser,
  AuthError,
  LocationReport,
  getMyReport,
  readGpsPosition,
  removeMyLocation,
  saveMyLocation,
} from "../services/auth";

interface MyLocationReportProps {
  user: AccountUser;
  targetDate: string;
  lang?: Language;
  /** The account changed (location saved or removed). */
  onUserChange: (user: AccountUser) => void;
  /** The login ended (logged out, or the server no longer accepts it). */
  onLoggedOut: () => void;
  onLogOut: () => void;
}

/**
 * The logged-in user's own flood report, from GET /auth/me/report.
 *
 * Two facts are kept apart on purpose: the model's forecast is for the whole
 * district; the flood history is for the exact spot the user saved.
 */
export const MyLocationReport: React.FC<MyLocationReportProps> = ({
  user,
  targetDate,
  lang = "en",
  onUserChange,
  onLoggedOut,
  onLogOut,
}) => {
  const isBn = lang === "bn";
  const num = (value: number | string) => (isBn ? toBnNum(value) : String(value));

  const [report, setReport] = useState<LocationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (problem: unknown) => {
    if (problem instanceof AuthError && problem.status === 401) {
      onLoggedOut();
      return;
    }
    setError((problem as Error).message || "Something went wrong.");
  };

  const locationKey = user.location ? user.location.coordinates.join(",") : "";

  useEffect(() => {
    let mounted = true;
    setReport(null);
    setError(null);
    if (!user.location) return;

    setIsLoading(true);
    getMyReport(targetDate)
      .then((data) => {
        if (mounted) setReport(data);
      })
      .catch((problem) => {
        if (mounted) fail(problem);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationKey, targetDate, user.id]);

  const handleUseGps = async () => {
    setError(null);
    setIsSaving(true);
    try {
      const [lng, lat] = await readGpsPosition(isBn);
      onUserChange(await saveMyLocation(lng, lat));
    } catch (problem) {
      fail(problem);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveLocation = async () => {
    setError(null);
    setIsSaving(true);
    try {
      onUserChange(await removeMyLocation());
    } catch (problem) {
      fail(problem);
    } finally {
      setIsSaving(false);
    }
  };

  const forecast = report?.forecast || null;
  const probability = forecast?.probability;
  const probabilityText =
    probability === null || probability === undefined
      ? null
      : probability > 0.95
      ? isBn ? "৯৫% এর বেশি" : "more than 95%"
      : `${num(Math.round(probability * 100))}%`;

  const level = forecast?.alert_level;
  const badge =
    level === "alert"
      ? { text: isBn ? "অ্যালার্ট" : "ALERT", color: "bg-[#C9443A] text-white" }
      : level === "watch"
      ? { text: isBn ? "নজরদারি" : "WATCH", color: "bg-[#E08A24] text-white" }
      : level === "none"
      ? { text: isBn ? "সতর্কতা সীমার নিচে" : "BELOW ALERT LEVEL", color: "bg-[#22C55E] text-white" }
      : forecast?.status === "unsupported"
      ? { text: isBn ? "এখানে পূর্বাভাস সম্ভব নয়" : "NO FORECAST POSSIBLE HERE", color: "bg-[#6B7280] text-white" }
      : { text: isBn ? "এই দিনের পূর্বাভাস নেই" : "NO FORECAST FOR THIS DAY", color: "bg-[#6B7280] text-white" };

  const districtName = user.district
    ? isBn
      ? DISTRICTS_BN[user.district.pcode] || user.district.name
      : user.district.name
    : "";
  const cell = report?.flood_history.cell || null;
  const depths = (cell?.hazard || []).filter((h) => h.depth_label);

  return (
    <Card className="border-[#DFDDD3] bg-white rounded-2xl shadow-xs overflow-hidden mb-3" id="my-report">
      <CardHeader className="px-4 sm:px-5 py-2.5 border-b border-[#EBE8DC] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <CardTitle className="text-lg sm:text-xl font-extrabold text-[#12241C] tracking-tight">
            {isBn ? "আমার এলাকার বন্যা প্রতিবেদন" : "My Place Flood Report"}
          </CardTitle>
          <div className="flex items-center gap-1.5 text-xs text-[#5C6863] font-medium">
            <UserIcon size={12} />
            <span>
              {user.name} · {user.email}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onLogOut}
          className="h-7.5 px-2.5 border-[#DFDDD3] text-[#12241C] hover:bg-[#FAF9F5] flex items-center gap-1 text-xs font-semibold rounded-lg self-start sm:self-center"
        >
          <LogOut className="w-3 h-3" />
          <span>{isBn ? "লগআউট" : "Log out"}</span>
        </Button>
      </CardHeader>

      <CardContent className="p-3 sm:p-4 space-y-3">
        {error && (
          <div role="alert" className="rounded-xl border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2 text-xs font-semibold text-[#991B1B]">
            {error}
          </div>
        )}

        {!user.location ? (
          <div className="rounded-xl border border-[#DFDDD3] bg-[#FAF9F5] p-3 sm:p-4 space-y-2">
            <p className="text-xs sm:text-sm text-[#12241C]">
              {isBn
                ? "আপনার এলাকার প্রতিবেদন দেখতে আপনার অবস্থান সংরক্ষণ করুন। এটি শুধু আপনিই দেখতে পারবেন এবং যেকোনো সময় মুছে ফেলতে পারবেন।"
                : "Save your location to see the report for your own place. Only you can see it, and you can remove it at any time."}
            </p>
            <Button
              onClick={handleUseGps}
              disabled={isSaving}
              className="bg-[#122B1E] hover:bg-[#0C1F15] text-white font-bold text-sm px-4 h-10 rounded-xl flex items-center gap-2"
            >
              <Crosshair className="w-4 h-4" />
              <span>
                {isSaving
                  ? isBn ? "অবস্থান নেওয়া হচ্ছে..." : "Reading location..."
                  : isBn ? "আমার বর্তমান অবস্থান ব্যবহার করুন" : "Use my current location"}
              </span>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#12241C]">
              <div className="flex items-center gap-1.5 font-semibold">
                <MapPin className="w-4 h-4 text-[#2A7256]" />
                <span>
                  {user.location_label ? `${user.location_label} · ` : ""}
                  {districtName} {isBn ? "জেলা" : "District"} ·{" "}
                  {num(user.location.coordinates[1].toFixed(4))}°N, {num(user.location.coordinates[0].toFixed(4))}°E
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUseGps}
                  disabled={isSaving}
                  className="h-8 px-2.5 border-[#DFDDD3] text-xs font-semibold rounded-lg flex items-center gap-1.5"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>{isBn ? "অবস্থান হালনাগাদ" : "Update location"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveLocation}
                  disabled={isSaving}
                  className="h-8 px-2.5 border-[#DFDDD3] text-xs font-semibold rounded-lg flex items-center gap-1.5 text-[#991B1B]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isBn ? "অবস্থান মুছুন" : "Remove location"}</span>
                </Button>
              </div>
            </div>

            {isLoading && (
              <div className="py-6 text-center text-sm text-[#5C6863] animate-pulse">
                {isBn ? "প্রতিবেদন আনা হচ্ছে..." : "Loading your report..."}
              </div>
            )}

            {report && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Model forecast: the whole district */}
                <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EDEBE2] space-y-2">
                  <div className="text-xs font-bold text-[#263B32]/70 uppercase tracking-wider">
                    {isBn
                      ? `${districtName} জেলার পূর্বাভাস · ${num(report.target_date)}`
                      : `Forecast for ${districtName} district · ${report.target_date}`}
                  </div>
                  <span className={`inline-block text-xs px-2.5 py-1 rounded-md font-bold uppercase ${badge.color}`}>
                    {badge.text}
                  </span>
                  {probabilityText ? (
                    <div className="text-sm text-[#12241C]">
                      {isBn ? "মডেলের সম্ভাবনা: " : "Model probability: "}
                      <span className="font-extrabold">{probabilityText}</span>
                    </div>
                  ) : (
                    <div className="text-sm text-[#12241C]">
                      {forecast?.reason ||
                        (isBn
                          ? "এই দিনের জন্য মডেল চালানো হয়নি। এর মানে ঝুঁকি নেই, তা নয়।"
                          : "The model has not been run for this day. This does not mean there is no risk.")}
                    </div>
                  )}
                  <p className="text-[11px] text-[#5C6863] leading-snug">
                    {isBn
                      ? "পূর্বাভাস পুরো জেলার জন্য, আপনার নির্দিষ্ট স্থানের জন্য নয়। এটি সরকারি বন্যা সতর্কতা নয় (এফএফডব্লিউসি দেখুন)।"
                      : "The forecast is for the whole district, not your exact place. It is a model estimate, not an official flood warning (see FFWC)."}
                  </p>
                </div>

                {/* 2. Observed history: the exact spot */}
                <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EDEBE2] space-y-2">
                  <div className="text-xs font-bold text-[#263B32]/70 uppercase tracking-wider">
                    {isBn ? "এই নির্দিষ্ট স্থানে অতীতের বন্যা" : "This exact spot in past floods"}
                  </div>
                  {cell ? (
                    <>
                      <div className="text-sm text-[#12241C]">
                        {cell.times_observed === 0
                          ? isBn ? "এই স্থানের কোনো স্যাটেলাইট তথ্য নেই।" : "No satellite data for this spot."
                          : isBn
                          ? `${num(cell.times_observed)}টি বড় বন্যার মধ্যে ${num(cell.times_flooded)}টিতে এখানে পানি দেখা গেছে।`
                          : `Flood water was seen here in ${cell.times_flooded} of ${cell.times_observed} large floods checked by satellite.`}
                      </div>
                      {depths.map((h) => (
                        <div key={h.return_period_years} className="text-sm text-[#12241C]">
                          {isBn
                            ? `${num(h.return_period_years)} বছরে একবারের বন্যায় মডেল অনুযায়ী গভীরতা: `
                            : `Modelled depth in a ${h.return_period_years}-year flood: `}
                          <span className="font-extrabold">{h.depth_label}</span>
                        </div>
                      ))}
                      {cell.permanent_water && (
                        <div className="text-sm text-[#12241C]">
                          {isBn ? "এই স্থানটি স্থায়ী জলাশয়ের ওপর।" : "This spot lies on permanent water."}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-[#12241C]">
                      {isBn ? "এই স্থানের তথ্য নেই।" : "No data for this spot."}
                    </div>
                  )}
                  <p className="text-[11px] text-[#5C6863] leading-snug">
                    {isBn
                      ? "স্যাটেলাইট ভবনের মাঝের পানি দেখতে পায় না, তাই শহরে \"কখনো প্লাবিত হয়নি\" মানে নিরাপদ নয়।"
                      : "Satellites cannot see water between buildings, so \"never flooded\" in a town does not mean safe."}
                  </p>
                </div>

                {/* 3. Registered places nearby */}
                <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EDEBE2] space-y-2">
                  <div className="text-xs font-bold text-[#263B32]/70 uppercase tracking-wider">
                    {isBn
                      ? `${num(report.nearest_assets_radius_meters / 1000)} কিমির মধ্যে নিবন্ধিত স্থান`
                      : `Registered places within ${report.nearest_assets_radius_meters / 1000} km`}
                  </div>
                  {report.nearest_assets.length === 0 ? (
                    <div className="text-sm text-[#12241C]">
                      {isBn
                        ? "এখনো কোনো আশ্রয়কেন্দ্র বা সেবাকেন্দ্র নিবন্ধিত হয়নি। জরুরি প্রয়োজনে ৯৯৯ নম্বরে কল করুন।"
                        : "No shelter or facility is registered here yet. In an emergency call 999."}
                    </div>
                  ) : (
                    report.nearest_assets.map((item) => (
                      <div key={item.asset.id} className="flex items-center justify-between gap-2 text-sm text-[#12241C]">
                        <span>
                          <span className="font-bold">{item.asset.name}</span>{" "}
                          <span className="text-[#5C6863]">({item.asset.asset_type.replace(/_/g, " ")})</span>
                        </span>
                        <span className="font-bold shrink-0">
                          {num(item.distance_kilometers.toFixed(1))} {isBn ? "কিমি" : "km"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
