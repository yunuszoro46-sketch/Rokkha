"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ExternalLink, Phone, RefreshCw, Users } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Language, DISTRICTS_BN, localError, toBnNum } from "../lib/translations";
import { NEED_LABEL, RELEASE_LABEL, STATUS_LABEL, VULNERABLE_LABEL } from "../lib/rescueLabels";
import { AccountUser, AuthError } from "../services/auth";
import {
  ProgressStatus,
  ReleaseReason,
  SosList,
  SosRequest,
  SosStatus,
  acceptSos,
  askSupport,
  joinSupport,
  listSos,
  progressSos,
  releaseSos,
} from "../services/rescue";

interface RescuePanelProps {
  user: AccountUser | null;
  lang?: Language;
  onOpenLogin: () => void;
}

const REFRESH_EVERY_MS = 30000;

// The next step the primary team may confirm (the backend enforces the same order).
const NEXT_STEP: Partial<Record<SosStatus, ProgressStatus[]>> = {
  accepted: ["en_route"],
  en_route: ["arrived"],
  arrived: ["in_progress", "completed"],
  in_progress: ["completed"],
};

const STEP_BUTTON: Record<ProgressStatus, { en: string; bn: string }> = {
  en_route: { en: "We are on our way", bn: "আমরা রওনা দিয়েছি" },
  arrived: { en: "We have arrived", bn: "আমরা পৌঁছেছি" },
  in_progress: { en: "Help in progress", bn: "সাহায্য চলছে" },
  completed: { en: "Help completed", bn: "সাহায্য সম্পন্ন" },
};

type Filter = "open" | "available" | "mine" | "completed" | "cancelled";

/**
 * The shared rescue board. Every rescue team sees the same open requests;
 * one team accepts a request and the others see who is responding. Only
 * accounts with the role "rescuer" or "admin" get data, and only accounts in
 * a team can act: the backend decides, never this page.
 */
export const RescuePanel: React.FC<RescuePanelProps> = ({ user, lang = "en", onOpenLogin }) => {
  const isBn = lang === "bn";
  const tr = (en: string, bn: string) => (isBn ? bn : en);
  const num = (value: number | string) => (isBn ? toBnNum(value) : String(value));

  const allowed = user?.role === "rescuer" || user?.role === "admin";
  const myTeam = user?.team || null;

  const [filter, setFilter] = useState<Filter>("open");
  const [list, setList] = useState<SosList | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  // Two kinds of message: the board could not be loaded, or an action was refused.
  // A successful refresh clears only the first, so "another team was first" stays visible.
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [helped, setHelped] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!allowed) return;
    try {
      const options =
        filter === "mine" ? { mine: true } : filter === "open" ? {} : { status: filter as SosStatus };
      setList(await listSos(options));
      setLoadedAt(new Date());
      setLoadProblem(null);
    } catch (error) {
      // Keep the last list on screen; say that it could not be refreshed.
      setLoadProblem(error instanceof AuthError ? localError(error.message, isBn ? "bn" : "en") : tr("The board could not be loaded.", "বোর্ড আনা যায়নি।"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, filter]);

  useEffect(() => {
    setList(null);
    load();
    const timer = window.setInterval(load, REFRESH_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  /** Run one action; a 409 means someone else changed the request first: say so and refresh. */
  const act = async (request: SosRequest, action: () => Promise<SosRequest>, done: string) => {
    setBusyId(request.id);
    setNotice(null);
    setProblem(null);
    try {
      await action();
      setNotice(done);
      setProblem(null);
      setMessages((m) => ({ ...m, [request.id]: "" }));
    } catch (error) {
      const status = error instanceof AuthError ? error.status : 0;
      setProblem(
        status === 409
          ? `${(error as Error).message} ${tr("The board has been refreshed.", "বোর্ড হালনাগাদ করা হয়েছে।")}`
          : (error as Error).message
      );
    } finally {
      setBusyId(null);
      load();
    }
  };

  if (!allowed) {
    return (
      <Card className="border-rk-line bg-white rounded-3xl shadow-sm">
        <CardContent className="p-8 text-center space-y-3">
          <div className="text-xl font-extrabold text-rk-ink">
            {tr("This page is for rescue teams.", "এই পাতাটি উদ্ধারকারী দলের জন্য।")}
          </div>
          <p className="text-sm text-rk-muted">
            {user
              ? tr(
                  "Your account is a normal user account. An admin can give it the rescuer role and add it to a team.",
                  "আপনার অ্যাকাউন্টটি সাধারণ ব্যবহারকারীর। একজন অ্যাডমিন এটিকে উদ্ধারকারীর ভূমিকা দিয়ে একটি দলে যুক্ত করতে পারেন।"
                )
              : tr("Log in with a rescuer account to see the rescue board.", "উদ্ধার বোর্ড দেখতে উদ্ধারকারী অ্যাকাউন্ট দিয়ে লগ ইন করুন।")}
          </p>
          {!user && (
            <Button onClick={onOpenLogin} className="bg-rk-brand hover:bg-rk-brand-strong text-white font-bold rounded-xl">
              {tr("Log in", "লগ ইন")}
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
  const openCount = ["available", "accepted", "en_route", "arrived", "in_progress"].reduce(
    (sum, s) => sum + (counts[s as SosStatus] || 0),
    0
  );
  const tabs: Array<{ id: Filter; label: string; count?: number }> = [
    { id: "open", label: tr("All open", "সব চলমান"), count: openCount },
    { id: "available", label: tr("Waiting for a team", "দলের অপেক্ষায়"), count: counts.available || 0 },
    { id: "mine", label: tr("My team's", "আমার দলের") },
    { id: "completed", label: tr("Completed", "সম্পন্ন"), count: counts.completed || 0 },
    { id: "cancelled", label: tr("Cancelled", "বাতিল"), count: counts.cancelled || 0 },
  ];

  /** "Rescue Team Alpha is responding — Team en route" */
  const respondingLine = (request: SosRequest) => {
    if (!request.team) return null;
    const who = `${request.team.name} (${request.team.organization})`;
    const state = tr(STATUS_LABEL[request.status].en, STATUS_LABEL[request.status].bn);
    return tr(`${who} is responding — ${state}`, `${who} সাড়া দিচ্ছে — ${state}`);
  };

  return (
    <Card className="border-rk-line bg-white rounded-3xl shadow-sm overflow-hidden">
      <CardHeader className="px-5 sm:px-6 py-4 border-b border-rk-line space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-xl sm:text-2xl font-extrabold text-rk-ink tracking-tight">
            {tr("Shared rescue board", "যৌথ উদ্ধার বোর্ড")}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-rk-muted">
            {loadedAt && (
              <span>
                {tr("Updated", "হালনাগাদ")} {num(loadedAt.toLocaleTimeString(isBn ? "bn-BD" : undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }))}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={load} className="h-9 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              {tr("Refresh", "রিফ্রেশ")}
            </Button>
          </div>
        </div>
        <div className="text-sm font-semibold text-rk-ink">
          {myTeam
            ? tr(`Your team: ${myTeam.name} (${myTeam.organization})`, `আপনার দল: ${myTeam.name} (${myTeam.organization})`)
            : tr(
                "Your account is not in a team yet, so you can look but not accept requests. Ask an admin to add you to a team.",
                "আপনার অ্যাকাউন্ট এখনো কোনো দলে নেই, তাই আপনি দেখতে পারবেন কিন্তু অনুরোধ গ্রহণ করতে পারবেন না। একজন অ্যাডমিনকে দলে যুক্ত করতে বলুন।"
              )}
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              size="sm"
              variant={filter === tab.id ? "default" : "secondary"}
              onClick={() => setFilter(tab.id)}
              className="h-9 rounded-lg text-xs font-bold"
            >
              {tab.label}
              {tab.count !== undefined ? ` (${num(tab.count)})` : ""}
            </Button>
          ))}
        </div>
        <p className="text-xs text-rk-muted">
          {tr(
            "Requests no team has taken come first, someone seriously hurt first among them, then the longest-waiting. The board refreshes every 30 seconds; nothing here rings or notifies you. Requests are not verified. Phone numbers are shown only to the team that accepts.",
            "যে অনুরোধ কোনো দল নেয়নি সেগুলো আগে, তার মধ্যে গুরুতর আহত আগে, তারপর যিনি সবচেয়ে বেশি অপেক্ষা করছেন। বোর্ড প্রতি ৩০ সেকেন্ডে হালনাগাদ হয়; এখানে কোনো শব্দ বা নোটিফিকেশন আসে না। অনুরোধগুলো যাচাই করা নয়। ফোন নম্বর শুধু গ্রহণকারী দল দেখতে পায়।"
          )}
        </p>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-4">
        {[loadProblem, problem].filter(Boolean).map((text) => (
          <div key={text} role="alert" className="rounded-xl border border-rk-danger-accent/40 bg-rk-danger-soft px-3.5 py-2.5 text-sm font-semibold text-rk-danger">
            {text}
          </div>
        ))}
        {notice && (
          <div role="status" className="rounded-xl border border-rk-success/40 bg-rk-success-soft px-3.5 py-2.5 text-sm font-semibold text-rk-success">
            {notice}
          </div>
        )}

        {!list ? (
          <div className="py-10 text-center text-sm text-rk-muted animate-pulse">{tr("Loading the board...", "বোর্ড আনা হচ্ছে...")}</div>
        ) : list.requests.length === 0 ? (
          <div className="py-10 text-center text-sm text-rk-muted">{tr("No requests in this list.", "এই তালিকায় কোনো অনুরোধ নেই।")}</div>
        ) : (
          list.requests.map((request) => {
            const status = STATUS_LABEL[request.status];
            const district = isBn ? DISTRICTS_BN[request.district.pcode] || request.district.name : request.district.name;
            const isPrimary = !!myTeam && request.team?.id === myTeam.id;
            const isSupport = !!myTeam && request.support_teams.some((t) => t.id === myTeam.id);
            const busy = busyId === request.id;
            const point = request.location?.coordinates;
            const place = request.place
              ? [request.place.landmark, request.place.village, request.place.area, request.place.union, request.place.upazila]
                  .filter(Boolean)
                  .join(", ")
              : "";
            const lastRelease = request.releases[request.releases.length - 1];
            return (
              <article
                key={request.id}
                className={`rounded-2xl border p-4 space-y-3 ${isPrimary ? "border-rk-brand border-2" : "border-rk-line"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-md font-bold ${status.tone}`}>{tr(status.en, status.bn)}</span>
                    <span className="font-mono text-xs font-bold text-rk-muted">{request.reference}</span>
                    {request.serious_injury === true && (
                      <span className="text-xs px-2 py-1 rounded-md font-bold bg-rk-danger text-white">
                        {tr("Seriously ill or injured", "গুরুতর অসুস্থ বা আহত")}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-rk-muted">
                    {tr("Received", "পাওয়া গেছে")} {waited(request.received_at)}
                  </span>
                </div>

                {request.team && (
                  <div className="rounded-lg bg-rk-info-soft border border-rk-info/30 px-3 py-2 text-sm font-bold text-rk-info">
                    {respondingLine(request)}
                    {request.support_teams.length > 0 && (
                      <span className="block text-xs font-semibold">
                        {tr("Supported by", "সহায়তায়")}: {request.support_teams.map((t) => t.name).join(", ")}
                      </span>
                    )}
                  </div>
                )}
                {request.support_request && (
                  <div className="rounded-lg bg-rk-warning-soft border border-rk-warning-accent px-3 py-2 text-sm font-semibold text-rk-warning">
                    {tr("The responding team asks for support", "সাড়াদানকারী দল সহায়তা চাইছে")}
                    {request.support_request.note ? `: ${request.support_request.note}` : ""}
                  </div>
                )}
                {request.status === "available" && lastRelease && (
                  <div className="text-xs font-semibold text-rk-warning">
                    {tr(
                      `${lastRelease.team.name} gave this request back ${waited(lastRelease.at)}: ${RELEASE_LABEL[lastRelease.reason].en}`,
                      `${lastRelease.team.name} ${waited(lastRelease.at)} এই অনুরোধ ফিরিয়ে দিয়েছে: ${RELEASE_LABEL[lastRelease.reason].bn}`
                    )}
                    {lastRelease.note ? ` (${lastRelease.note})` : ""}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 text-base font-extrabold text-rk-ink">
                  {request.needs.map((n) => tr(NEED_LABEL[n].en, NEED_LABEL[n].bn)).join(" · ")}
                  <span className="flex items-center gap-1 text-sm font-bold">
                    <Users className="w-4 h-4" />
                    {num(request.people)}
                  </span>
                </div>
                {request.vulnerable.length > 0 && (
                  <div className="text-sm font-semibold text-rk-ink">
                    {request.vulnerable.map((v) => tr(VULNERABLE_LABEL[v].en, VULNERABLE_LABEL[v].bn)).join(", ")}
                  </div>
                )}

                <div className="text-sm text-rk-ink space-y-1">
                  <div className="text-base">
                    <span className="font-bold">{request.area_name || district}</span>
                    {place ? ` · ${place}` : ""}
                  </div>
                  {request.place?.details && <div className="text-rk-muted">{request.place.details}</div>}
                  {point ? (
                    <div className="text-xs text-rk-muted">
                      <span className="text-xs text-rk-muted">
                        {tr("Exact point", "নির্দিষ্ট বিন্দু")} (
                        {request.location_source === "gps"
                          ? request.accuracy_m !== null
                            ? tr(`GPS, ±${Math.round(request.accuracy_m)} m`, `জিপিএস, ±${num(Math.round(request.accuracy_m))} মি`)
                            : tr("GPS", "জিপিএস")
                          : request.location_source === "saved_place"
                            ? tr("the account's saved place", "অ্যাকাউন্টের সংরক্ষিত স্থান")
                            : tr("source not recorded", "উৎস জানা নেই")}
                        ){" "}
                      </span>
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${point[1]}&mlon=${point[0]}#map=16/${point[1]}/${point[0]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-rk-brand font-bold underline"
                      >
                        {tr("open map", "মানচিত্র খুলুন")} <ExternalLink className="w-3 h-3" />
                      </a>{" "}
                      {/* Teams may need to pass the exact point on by phone: copy it, without printing it on screen. */}
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(`${point[1].toFixed(5)}, ${point[0].toFixed(5)}`).then(
                            () => setNotice(tr(`${request.reference}: coordinates copied.`, `${request.reference}: স্থানাঙ্ক কপি হয়েছে।`)),
                            () => setProblem(tr("Could not copy; use 'open map' instead.", "কপি করা যায়নি; 'মানচিত্র খুলুন' ব্যবহার করুন।"))
                          );
                        }}
                        className="ml-1 font-bold text-rk-brand underline"
                      >
                        {tr("copy coordinates", "স্থানাঙ্ক কপি করুন")}
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs font-semibold text-rk-warning">
                      {tr("No GPS point: only the place described above.", "জিপিএস নেই: শুধু ওপরের বর্ণনা।")}
                    </div>
                  )}
                  {request.note && <div className="rounded-lg bg-rk-page border border-rk-line px-3 py-2">{request.note}</div>}
                  <div className="flex flex-wrap items-center gap-3">
                    {request.contact_hidden ? (
                      <span className="text-rk-muted text-xs">
                        {tr("Contact details are shown to the team that accepts.", "যোগাযোগের তথ্য গ্রহণকারী দল দেখতে পায়।")}
                      </span>
                    ) : (
                      <>
                        {request.contact_name && <span>{request.contact_name}</span>}
                        {request.contact_phone ? (
                          <a href={`tel:${request.contact_phone.replace(/[^0-9+]/g, "")}`} className="inline-flex items-center gap-1 font-bold text-rk-brand underline">
                            <Phone className="w-3.5 h-3.5" /> {request.contact_phone}
                          </a>
                        ) : (
                          <span className="text-rk-muted">{tr("No phone number given", "ফোন নম্বর দেওয়া হয়নি")}</span>
                        )}
                      </>
                    )}
                  </div>
                  {request.outcome && (
                    <div className="text-xs font-semibold text-rk-success">
                      {tr(`Outcome: ${request.outcome.people_helped} people helped`, `ফলাফল: ${num(request.outcome.people_helped)} জনকে সাহায্য করা হয়েছে`)}
                      {request.outcome.note ? ` · ${request.outcome.note}` : ""}
                    </div>
                  )}
                </div>

                {/* Actions: only what the backend would allow this account to do now. */}
                {myTeam && request.status === "available" && (
                  <div className="border-t border-rk-line pt-3">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        act(request, () => acceptSos(request.id), tr(`${myTeam.name} accepted ${request.reference}.`, `${myTeam.name} ${request.reference} গ্রহণ করেছে।`))
                      }
                      className="h-11 rounded-xl bg-rk-brand hover:bg-rk-brand-strong text-white font-bold"
                    >
                      {tr("Accept this request", "এই অনুরোধ গ্রহণ করুন")}
                    </Button>
                  </div>
                )}

                {isPrimary && NEXT_STEP[request.status] && (
                  <div className="space-y-2 border-t border-rk-line pt-3">
                    <Input
                      value={messages[request.id] || ""}
                      onChange={(e) => setMessages((m) => ({ ...m, [request.id]: e.target.value }))}
                      maxLength={300}
                      aria-label={tr("Message the person will see (optional)", "ব্যক্তি যে বার্তা দেখবেন (ঐচ্ছিক)")}
                      placeholder={tr("Message the person will see (optional)", "ব্যক্তি যে বার্তা দেখবেন (ঐচ্ছিক)")}
                      className="h-10 rounded-lg text-sm"
                    />
                    {NEXT_STEP[request.status]!.includes("completed") && (
                      <label className="flex items-center gap-2 text-sm font-semibold text-rk-ink">
                        {tr("People helped", "যতজনকে সাহায্য করা হয়েছে")}
                        <Input
                          type="number"
                          min={0}
                          max={1000}
                          value={helped[request.id] ?? String(request.people)}
                          onChange={(e) => setHelped((h) => ({ ...h, [request.id]: e.target.value }))}
                          className="h-10 w-24 rounded-lg"
                        />
                      </label>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {NEXT_STEP[request.status]!.map((step) => (
                        <Button
                          key={step}
                          disabled={busy}
                          onClick={() =>
                            act(
                              request,
                              () =>
                                progressSos(
                                  request.id,
                                  step,
                                  messages[request.id]?.trim() || undefined,
                                  step === "completed"
                                    ? { people_helped: Math.max(0, Math.min(1000, Number(helped[request.id] ?? request.people) || 0)), note: null }
                                    : undefined
                                ),
                              tr(`${request.reference}: ${STEP_BUTTON[step].en}.`, `${request.reference}: ${STEP_BUTTON[step].bn}।`)
                            )
                          }
                          className="h-10 rounded-lg text-sm font-bold bg-rk-brand hover:bg-rk-brand-strong text-white"
                        >
                          {tr(STEP_BUTTON[step].en, STEP_BUTTON[step].bn)}
                        </Button>
                      ))}
                      {!request.support_request && (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            act(
                              request,
                              () => askSupport(request.id, messages[request.id]?.trim() || undefined),
                              tr("Other teams now see that you need support.", "অন্য দলগুলো এখন দেখছে আপনার সহায়তা দরকার।")
                            )
                          }
                          className="h-10 rounded-lg text-sm font-bold"
                        >
                          {tr("Ask another team for support", "অন্য দলের সহায়তা চান")}
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(["unable_to_reach", "lacks_resources", "other"] as ReleaseReason[]).map((reason) => (
                        <Button
                          key={reason}
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            const ok = window.confirm(
                              tr(
                                `Give ${request.reference} back to the board (${RELEASE_LABEL[reason].en})? Another team can then take it.`,
                                `${request.reference} বোর্ডে ফিরিয়ে দেবেন (${RELEASE_LABEL[reason].bn})? তখন অন্য দল এটি নিতে পারবে।`
                              )
                            );
                            if (ok)
                              act(
                                request,
                                () => releaseSos(request.id, reason, messages[request.id]?.trim() || undefined),
                                tr(`${request.reference} is back on the board.`, `${request.reference} বোর্ডে ফিরে গেছে।`)
                              );
                          }}
                          className="h-9 rounded-lg text-xs font-bold text-rk-danger"
                        >
                          {tr(`Release: ${RELEASE_LABEL[reason].en}`, `ফিরিয়ে দিন: ${RELEASE_LABEL[reason].bn}`)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {myTeam && !isPrimary && !isSupport && request.support_request && request.team && (
                  <div className="border-t border-rk-line pt-3">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        act(request, () => joinSupport(request.id), tr(`${myTeam.name} now supports ${request.team!.name}.`, `${myTeam.name} এখন ${request.team!.name} কে সহায়তা করছে।`))
                      }
                      className="h-10 rounded-lg text-sm font-bold"
                    >
                      {tr(`Support ${request.team.name}`, `${request.team.name} কে সহায়তা করুন`)}
                    </Button>
                  </div>
                )}

                {user?.role === "admin" && request.team && !isPrimary && ["accepted", "en_route", "arrived", "in_progress"].includes(request.status) && (
                  <div className="border-t border-rk-line pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(tr("Release this request from its team (admin)?", "অ্যাডমিন হিসেবে এই অনুরোধ দলের কাছ থেকে ফিরিয়ে নেবেন?")))
                          act(request, () => releaseSos(request.id, "other", "Released by an admin"), tr("Released by an admin.", "অ্যাডমিন ফিরিয়ে নিয়েছেন।"));
                      }}
                      className="h-9 rounded-lg text-xs font-bold text-rk-danger"
                    >
                      {tr("Admin: release from this team", "অ্যাডমিন: দলের কাছ থেকে ফিরিয়ে নিন")}
                    </Button>
                  </div>
                )}
              </article>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
