"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ExternalLink, Phone, RefreshCw, Users } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Language, DISTRICTS_BN, toBnNum } from "../lib/translations";
import { AccountUser, AuthError } from "../services/auth";
import { Need, SosList, SosRequest, SosStatus, listSos, updateSos } from "../services/rescue";

interface RescuePanelProps {
  user: AccountUser | null;
  lang?: Language;
  onOpenLogin: () => void;
}

const REFRESH_EVERY_MS = 30000;

const NEED_LABEL: Record<Need, { en: string; bn: string }> = {
  rescue: { en: "Rescue", bn: "উদ্ধার" },
  medical: { en: "Medical help", bn: "চিকিৎসা" },
  food_water: { en: "Food and water", bn: "খাবার ও পানি" },
  shelter: { en: "Shelter", bn: "আশ্রয়" },
  other: { en: "Other", bn: "অন্যান্য" },
};

const STATUS_LABEL: Record<SosStatus, { en: string; bn: string; tone: string }> = {
  new: { en: "NEW", bn: "নতুন", tone: "bg-[#C9443A] text-white" },
  acknowledged: { en: "SEEN", bn: "দেখা হয়েছে", tone: "bg-[#E08A24] text-white" },
  team_sent: { en: "TEAM SENT", bn: "দল পাঠানো হয়েছে", tone: "bg-[#2563EB] text-white" },
  resolved: { en: "RESOLVED", bn: "সমাধান", tone: "bg-[#16A34A] text-white" },
  cancelled: { en: "CANCELLED", bn: "বাতিল", tone: "bg-[#6B7280] text-white" },
};

// The next steps a rescuer may take from each status (the backend enforces the same order).
const NEXT: Record<SosStatus, SosStatus[]> = {
  new: ["acknowledged", "team_sent", "resolved", "cancelled"],
  acknowledged: ["team_sent", "resolved", "cancelled"],
  team_sent: ["resolved", "cancelled"],
  resolved: [],
  cancelled: [],
};

const ACTION_LABEL: Record<SosStatus, { en: string; bn: string }> = {
  new: { en: "", bn: "" },
  acknowledged: { en: "Mark as seen", bn: "দেখা হয়েছে" },
  team_sent: { en: "Team sent", bn: "দল পাঠানো হয়েছে" },
  resolved: { en: "Resolved", bn: "সমাধান হয়েছে" },
  cancelled: { en: "Cancel", bn: "বাতিল" },
};

/**
 * The rescuers' list of requests for help. Only accounts with the role
 * "rescuer" or "admin" get data: the backend refuses everyone else.
 */
export const RescuePanel: React.FC<RescuePanelProps> = ({ user, lang = "en", onOpenLogin }) => {
  const isBn = lang === "bn";
  const tr = (en: string, bn: string) => (isBn ? bn : en);
  const num = (value: number | string) => (isBn ? toBnNum(value) : String(value));

  const allowed = user?.role === "rescuer" || user?.role === "admin";

  const [filter, setFilter] = useState<SosStatus | "open">("open");
  const [list, setList] = useState<SosList | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!allowed) return;
    try {
      setList(await listSos(filter === "open" ? undefined : filter));
      setLoadedAt(new Date());
      setProblem(null);
    } catch (error) {
      // Keep the last list on screen; say that it could not be refreshed.
      setProblem(error instanceof AuthError ? error.message : "The list could not be loaded.");
    }
  }, [allowed, filter]);

  useEffect(() => {
    setList(null);
    load();
    const timer = window.setInterval(load, REFRESH_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const move = async (request: SosRequest, status: SosStatus) => {
    setBusyId(request.id);
    try {
      await updateSos(request.id, status, messages[request.id]?.trim() || undefined);
      setMessages((m) => ({ ...m, [request.id]: "" }));
      setProblem(null);
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setBusyId(null);
      load();
    }
  };

  if (!allowed) {
    return (
      <Card className="border-[#DFDDD3] bg-white rounded-3xl shadow-sm">
        <CardContent className="p-8 text-center space-y-3">
          <div className="text-xl font-extrabold text-[#12241C]">
            {tr("This page is for rescuers.", "এই পাতাটি উদ্ধারকারীদের জন্য।")}
          </div>
          <p className="text-sm text-[#5C6863]">
            {user
              ? tr(
                  "Your account is a normal user account. An admin can give it the rescuer role.",
                  "আপনার অ্যাকাউন্টটি সাধারণ ব্যবহারকারীর। একজন অ্যাডমিন এটিকে উদ্ধারকারীর ভূমিকা দিতে পারেন।"
                )
              : tr("Log in with a rescuer account to see requests for help.", "সাহায্যের অনুরোধ দেখতে উদ্ধারকারী অ্যাকাউন্ট দিয়ে লগইন করুন।")}
          </p>
          {!user && (
            <Button onClick={onOpenLogin} className="bg-[#122B1E] hover:bg-[#0C1F15] text-white font-bold rounded-xl">
              {tr("Log in", "লগইন")}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const waited = (iso: string) => {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (minutes < 60) return tr(`${minutes} min ago`, `${num(minutes)} মিনিট আগে`);
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return tr(`${hours} h ${minutes % 60} min ago`, `${num(hours)} ঘণ্টা ${num(minutes % 60)} মিনিট আগে`);
    return tr(`${Math.floor(hours / 24)} days ago`, `${num(Math.floor(hours / 24))} দিন আগে`);
  };

  const counts = list?.by_status || {};
  const openCount = (counts.new || 0) + (counts.acknowledged || 0) + (counts.team_sent || 0);
  const tabs: Array<{ id: SosStatus | "open"; label: string; count: number }> = [
    { id: "open", label: tr("Open", "চলমান"), count: openCount },
    { id: "new", label: tr("New", "নতুন"), count: counts.new || 0 },
    { id: "resolved", label: tr("Resolved", "সমাধান"), count: counts.resolved || 0 },
    { id: "cancelled", label: tr("Cancelled", "বাতিল"), count: counts.cancelled || 0 },
  ];

  return (
    <Card className="border-[#DFDDD3] bg-white rounded-3xl shadow-sm overflow-hidden">
      <CardHeader className="px-5 sm:px-6 py-4 border-b border-[#EBE8DC] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-xl sm:text-2xl font-extrabold text-[#12241C] tracking-tight">
            {tr("Requests for help", "সাহায্যের অনুরোধ")}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-[#5C6863]">
            {loadedAt && (
              <span>
                {tr("Updated", "হালনাগাদ")} {num(loadedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }))}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={load} className="h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              {tr("Refresh", "রিফ্রেশ")}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              size="sm"
              variant={filter === tab.id ? "default" : "secondary"}
              onClick={() => setFilter(tab.id)}
              className="rounded-lg text-xs font-bold"
            >
              {tab.label} ({num(tab.count)})
            </Button>
          ))}
        </div>
        <p className="text-xs text-[#5C6863]">
          {tr(
            "Longest-waiting first. The list refreshes every 30 seconds; nothing here rings or notifies you. Requests are not verified.",
            "যিনি সবচেয়ে বেশি সময় অপেক্ষা করছেন তিনি আগে। তালিকা প্রতি ৩০ সেকেন্ডে হালনাগাদ হয়; এখানে কোনো শব্দ বা নোটিফিকেশন আসে না। অনুরোধগুলো যাচাই করা নয়।"
          )}
        </p>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-4">
        {problem && (
          <div role="alert" className="rounded-xl border border-[#FCA5A5] bg-[#FEE2E2] px-3.5 py-2.5 text-sm font-semibold text-[#991B1B]">
            {problem}
          </div>
        )}

        {!list ? (
          <div className="py-10 text-center text-sm text-[#5C6863] animate-pulse">{tr("Loading requests...", "অনুরোধ আনা হচ্ছে...")}</div>
        ) : list.requests.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#5C6863]">{tr("No requests in this list.", "এই তালিকায় কোনো অনুরোধ নেই।")}</div>
        ) : (
          list.requests.map((request) => {
            const [lng, lat] = request.location.coordinates;
            const status = STATUS_LABEL[request.status];
            const need = NEED_LABEL[request.need];
            const district = isBn ? DISTRICTS_BN[request.district.pcode] || request.district.name : request.district.name;
            return (
              <div key={request.id} className="rounded-2xl border border-[#DFDDD3] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-md font-bold ${status.tone}`}>{tr(status.en, status.bn)}</span>
                    <span className="font-extrabold text-base text-[#12241C]">{tr(need.en, need.bn)}</span>
                    <span className="flex items-center gap-1 text-sm font-bold text-[#12241C]">
                      <Users className="w-4 h-4" />
                      {num(request.people)}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#5C6863]">
                    {tr("Received", "পাওয়া গেছে")} {waited(request.received_at)}
                  </span>
                </div>

                <div className="text-sm text-[#12241C] space-y-1">
                  <div>
                    <span className="font-bold">{district}</span> · {num(lat.toFixed(5))}°N, {num(lng.toFixed(5))}°E{" "}
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#2A7256] font-bold underline"
                    >
                      {tr("open map", "মানচিত্র খুলুন")} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  {request.note && <div className="rounded-lg bg-[#FAF9F5] border border-[#EDEBE2] px-3 py-2">{request.note}</div>}
                  <div className="flex flex-wrap items-center gap-3">
                    {request.contact_name && <span>{request.contact_name}</span>}
                    {request.contact_phone ? (
                      <a href={`tel:${request.contact_phone.replace(/[^0-9+]/g, "")}`} className="inline-flex items-center gap-1 font-bold text-[#2A7256] underline">
                        <Phone className="w-3.5 h-3.5" /> {request.contact_phone}
                      </a>
                    ) : (
                      <span className="text-[#5C6863]">{tr("No phone number given", "ফোন নম্বর দেওয়া হয়নি")}</span>
                    )}
                  </div>
                  {request.message_to_sender && (
                    <div className="text-xs text-[#5C6863]">
                      {tr("Last message to the sender:", "প্রেরককে শেষ বার্তা:")} {request.message_to_sender}
                    </div>
                  )}
                </div>

                {NEXT[request.status].length > 0 && (
                  <div className="space-y-2 border-t border-[#F0EFEA] pt-3">
                    <Input
                      value={messages[request.id] || ""}
                      onChange={(e) => setMessages((m) => ({ ...m, [request.id]: e.target.value }))}
                      maxLength={300}
                      placeholder={tr("Message the sender will see (optional)", "প্রেরক যে বার্তা দেখবেন (ঐচ্ছিক)")}
                      className="h-9 rounded-lg text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      {NEXT[request.status].map((next) => (
                        <Button
                          key={next}
                          size="sm"
                          variant={next === "cancelled" ? "outline" : "default"}
                          disabled={busyId === request.id}
                          onClick={() => move(request, next)}
                          className={`h-8 rounded-lg text-xs font-bold ${next === "cancelled" ? "text-[#991B1B]" : "bg-[#122B1E] hover:bg-[#0C1F15] text-white"}`}
                        >
                          {tr(ACTION_LABEL[next].en, ACTION_LABEL[next].bn)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
