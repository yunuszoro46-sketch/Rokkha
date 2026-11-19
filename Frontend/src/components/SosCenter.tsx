"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Crosshair, LifeBuoy, MapPin, MessageSquare, Minus, Pencil, Phone, Plus, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Language, toBnNum, DISTRICTS_BN, localError } from "../lib/translations";
import { ALL_DISTRICTS } from "@/lib/districts";
import { readPreciseLocation } from "../services/location";
import { NEED_LABEL, NEED_ORDER, VULNERABLE_LABEL } from "../lib/rescueLabels";
import {
  LocationSource,
  Need,
  Place,
  SosDraft,
  Vulnerable,
  StoredSos,
  cancelSos,
  forgetSos,
  isOpen as checkIsOpen,
  lookupPlaceName,
  readQueue,
  saveSos,
  smsText,
  syncQueue,
} from "../services/rescue";

interface SosCenterProps {
  lang?: Language;
  /** The logged-in user's saved place, offered as the location. */
  savedPlace?: { lng: number; lat: number; label: string | null } | null;
  contactName?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideFloatingButton?: boolean;
  /** Needs to tick when the form opens (from the "Get Help" menu). */
  presetNeeds?: Need[];
}


const SYNC_EVERY_MS = 20000;

/**
 * The SOS button and everything behind it. Works without a login.
 *
 * A request is first saved on this phone, then sent. Until the server has
 * answered, the screen says "saved on this phone, not sent yet" and offers a
 * phone call and an SMS, which may work when mobile data does not.
 */
export const SosCenter: React.FC<SosCenterProps> = ({
  lang = "en",
  savedPlace = null,
  contactName = "",
  isOpen,
  onOpenChange,
  hideFloatingButton = false,
  presetNeeds,
}) => {
  const isBn = lang === "bn";
  const tr = (en: string, bn: string) => (isBn ? bn : en);
  const num = (value: number | string) => (isBn ? toBnNum(value) : String(value));

  const [isOpenPanel, setIsOpenPanel] = useState(false);

  useEffect(() => {
    if (isOpen !== undefined) {
      setIsOpenPanel(isOpen);
    }
  }, [isOpen]);

  const handleOpenChange = (open: boolean) => {
    setIsOpenPanel(open);
    onOpenChange?.(open);
  };

  // Dialog behaviour: focus moves into the dialog, Tab stays inside, Escape closes (same as the Close
  // button: nothing typed is lost), and focus returns to where it was before.
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpenPanel) return;
    const before = document.activeElement as HTMLElement | null;
    const box = dialogRef.current;
    box?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpenPanel(false);
        onOpenChange?.(false);
        return;
      }
      if (e.key !== "Tab" || !box) return;
      const items = Array.from(box.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (before && document.contains(before)) before.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpenPanel]);
  const [queue, setQueue] = useState<StoredSos[]>([]);
  // Only a point the phone (GPS) or the account (saved place) really gave. Never made up.
  const [position, setPosition] = useState<{ lng: number; lat: number; accuracy_m: number | null; source: LocationSource; label: string } | null>(null);
  const [showPlace, setShowPlace] = useState(false);
  const [place, setPlace] = useState<Place>({ district_pcode: "" });
  const [isLocating, setIsLocating] = useState(false);
  const [people, setPeople] = useState(1);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [seriousInjury, setSeriousInjury] = useState<boolean | null>(null);
  const [vulnerable, setVulnerable] = useState<Vulnerable[]>([]);
  const [note, setNote] = useState("");
  const [name, setName] = useState(contactName);
  const [phone, setPhone] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  // The request as it will be sent, shown for a last check before saving.
  const [review, setReview] = useState<SosDraft | null>(null);

  // Opened from a "Get Help" menu item: tick that need (the person can change it).
  useEffect(() => {
    if (isOpen && presetNeeds && presetNeeds.length > 0) setNeeds(presetNeeds);
  }, [isOpen, presetNeeds]);

  const districtName = (pcode: string | null | undefined) => {
    const d = ALL_DISTRICTS.find((item) => item.pcode === pcode);
    return d ? (isBn ? DISTRICTS_BN[d.pcode] || d.name : d.name) : "";
  };

  const setPlaceField = (field: keyof Place, value: string) => setPlace((current) => ({ ...current, [field]: value }));

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const sync = useCallback(async () => {
    setQueue(await syncQueue());
  }, []);

  // Load what this phone already holds, and keep trying to send / refresh while it matters.
  useEffect(() => {
    setQueue(readQueue());
    sync();
    const onOnline = () => sync();
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => {
      if (readQueue().some(checkIsOpen)) sync();
    }, SYNC_EVERY_MS);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [sync]);

  useEffect(() => {
    if (contactName) setName((current) => current || contactName);
  }, [contactName]);

  const useGps = async () => {
    setProblem(null);
    setIsLocating(true);
    try {
      // Rescuers need the most exact spot the phone can give, with its accuracy.
      const fix = await readPreciseLocation({ isBn });
      // Show a readable place, not raw coordinates. The coordinates are still sent for the rescue teams.
      const name = await lookupPlaceName(fix.lng, fix.lat);
      setPosition({
        lng: fix.lng,
        lat: fix.lat,
        accuracy_m: fix.accuracy_m,
        source: "gps",
        label: name
          ? tr(`Near ${name}`, `${name} এর কাছে`)
          : tr("My GPS location (place name could not be found)", "আমার জিপিএস অবস্থান (জায়গার নাম পাওয়া যায়নি)"),
      });
    } catch (error) {
      // No GPS (refused, switched off, no signal): the person can still describe the place.
      setProblem(
        `${(error as Error).message} ${tr("You can still send the request: describe the place below.", "আপনি তবুও অনুরোধ পাঠাতে পারেন: নিচে জায়গার বর্ণনা দিন।")}`
      );
      setShowPlace(true);
    } finally {
      setIsLocating(false);
    }
  };

  const placeText = (p: Place | null) =>
    p
      ? [p.village, p.area, p.union, p.upazila, p.landmark, districtName(p.district_pcode)]
          .map((v) => (v || "").trim())
          .filter(Boolean)
          .join(", ")
      : "";

  /** Check the form and show what will be sent. Nothing is saved yet. */
  const prepare = (e: React.FormEvent) => {
    e.preventDefault();
    const typed: Place | null = showPlace
      ? Object.fromEntries(Object.entries(place).map(([k, v]) => [k, (v || "").trim() || null])) as unknown as Place
      : null;
    const described = !!typed && !!typed.district_pcode && [typed.village, typed.area, typed.landmark, typed.details, typed.union, typed.upazila].some(Boolean);

    if (needs.length === 0) {
      setProblem(tr("Choose what help you need.", "কী সাহায্য দরকার তা বেছে নিন।"));
      return;
    }
    if (!position && !described) {
      setProblem(
        tr(
          "Give your location: use GPS, or choose the district and write the village, area or a landmark.",
          "অবস্থান দিন: জিপিএস ব্যবহার করুন, অথবা জেলা বেছে নিয়ে গ্রাম, এলাকা বা পরিচিত স্থান লিখুন।"
        )
      );
      return;
    }
    setProblem(null);
    const placeLabel = [position ? position.label : "", described ? placeText(typed) : ""].filter(Boolean).join(" · ");
    setReview({
      needs,
      people: Math.min(1000, Math.max(1, people)),
      serious_injury: seriousInjury,
      vulnerable,
      location: position ? { lng: position.lng, lat: position.lat } : null,
      location_source: position ? position.source : "manual",
      accuracy_m: position ? position.accuracy_m : null,
      place: described ? typed : null,
      place_label: placeLabel,
      note: note.trim().slice(0, 500),
      contact_name: name.trim().slice(0, 80),
      contact_phone: phone.trim().slice(0, 20),
    });
  };

  /** Saved on the phone first: it survives a dead connection and a closed page. Then sent. */
  const confirmAndSend = async () => {
    if (!review) return;
    saveSos(review);
    setQueue(readQueue());
    setReview(null);
    setNote("");
    setNeeds([]);
    setSeriousInjury(null);
    setVulnerable([]);
    await sync();
  };

  /** One honest line from what the server reported. */
  const stateLine = (item: StoredSos): { text: string; tone: string } => {
    const time = (iso: string) => num(new Date(iso).toLocaleTimeString(isBn ? "bn-BD" : undefined, { hour: "2-digit", minute: "2-digit" }));
    if (item.delivery === "refused") {
      return {
        text: tr(`Not accepted by the server: ${item.last_problem || ""}`, `সার্ভার গ্রহণ করেনি: ${localError(item.last_problem, "bn")}`),
        tone: "bg-rk-danger-soft text-rk-danger border-rk-danger-accent/40",
      };
    }
    if (item.delivery === "saved" || !item.receipt) {
      return {
        text: tr(
          "Saved on this phone. NOT sent yet. It is sent by itself when the connection returns and this page is open.",
          "এই ফোনে সংরক্ষিত। এখনো পাঠানো হয়নি। সংযোগ ফিরে এলে এবং এই পাতা খোলা থাকলে নিজে থেকেই পাঠানো হবে।"
        ),
        tone: "bg-rk-warning-soft text-rk-warning border-rk-warning-accent",
      };
    }
    const r = item.receipt;
    const last = r.history[r.history.length - 1];
    const at = time(last ? last.at : r.updated_at);
    const team = r.team ? `${r.team.name} (${r.team.organization})` : tr("The team", "দলটি");
    const blue = "bg-rk-info-soft text-rk-info border-rk-info/40";
    const green = "bg-rk-success-soft text-rk-success border-rk-success/40";
    switch (r.status) {
      case "available":
        if (last && last.event === "released") {
          const why = last.reason === "unable_to_reach"
            ? tr("The team could not reach your location.", "দলটি আপনার জায়গায় পৌঁছাতে পারেনি।")
            : tr("The team had to give the request back.", "দলটি অনুরোধটি ফিরিয়ে দিয়েছে।");
          return {
            text: `${why} (${at}) ${tr("Your request is open again for other rescue teams.", "আপনার অনুরোধ আবার অন্য উদ্ধারকারী দলের জন্য খোলা।")}`,
            tone: "bg-rk-warning-soft text-rk-warning border-rk-warning-accent",
          };
        }
        return {
          text: tr(
            `Your request has been received (${time(r.received_at)}). Rescue teams can see it. No team has accepted it yet.`,
            `আপনার অনুরোধ পৌঁছেছে (${time(r.received_at)})। উদ্ধারকারী দলগুলো এটি দেখতে পাচ্ছে। এখনো কোনো দল গ্রহণ করেনি।`
          ),
          tone: blue,
        };
      case "accepted":
        return {
          text: tr(`A rescue team has accepted your request: ${team} (${at}). They have not confirmed they are on the way yet.`, `একটি উদ্ধারকারী দল আপনার অনুরোধ গ্রহণ করেছে: ${team} (${at})। তারা এখনো রওনা হওয়ার খবর দেয়নি।`),
          tone: blue,
        };
      case "en_route":
        return { text: tr(`The rescue team is on its way: ${team} (${at}).`, `উদ্ধারকারী দল রওনা দিয়েছে: ${team} (${at})।`), tone: green };
      case "arrived":
        return { text: tr(`The rescue team has arrived: ${team} (${at}).`, `উদ্ধারকারী দল পৌঁছেছে: ${team} (${at})।`), tone: green };
      case "in_progress":
        return { text: tr(`Help is being given by ${team} (${at}).`, `${team} সাহায্য দিচ্ছে (${at})।`), tone: green };
      case "completed":
        return { text: tr(`${team} recorded that help was completed (${at}).`, `${team} জানিয়েছে সাহায্য সম্পন্ন হয়েছে (${at})।`), tone: "bg-rk-secondary text-rk-ink border-rk-line" };
      default:
        return {
          text: last && last.event === "closed"
            ? tr(`Closed by the Rokkha team (${at}). If you still need help, send a new request or call 999.`, `রক্ষা দল বন্ধ করেছে (${at})। এখনো সাহায্য লাগলে নতুন অনুরোধ পাঠান বা ৯৯৯ এ কল করুন।`)
            : tr(`Cancelled (${at}).`, `বাতিল করা হয়েছে (${at})।`),
          tone: "bg-rk-secondary text-rk-ink border-rk-line",
        };
    }
  };

  const openCount = queue.filter(checkIsOpen).length;
  const unsentCount = queue.filter((q) => q.delivery === "saved").length;

  return (
    <>
      {!hideFloatingButton && (
        <button
          type="button"
          onClick={() => handleOpenChange(true)}
          className="fixed bottom-5 right-5 z-[900] h-14 px-5 rounded-full bg-rk-brand hover:opacity-95 text-white font-extrabold shadow-[0_8px_24px_rgba(217,56,41,0.25)] flex items-center gap-3 transition-all hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
          aria-label={tr("Emergency Rescue Request", "জরুরি উদ্ধার অনুরোধ")}
        >
          <div className="w-8 h-8 rounded-full border-2 border-white/95 flex items-center justify-center shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
            <LifeBuoy className="w-4 h-4 text-white stroke-[2.5]" />
          </div>
          <div className="flex flex-col text-left leading-[1.1]">
            <span className="text-[10px] font-black tracking-wider text-white uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
              {tr("EMERGENCY", "জরুরি")}
            </span>
            <span className="text-[11px] font-black tracking-wider text-white uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
              {tr("RESCUE REQUEST", "উদ্ধার অনুরোধ")}
            </span>
          </div>
          {openCount > 0 && (
            <span className="ml-1 min-w-5 h-5 px-1.5 rounded-full bg-white text-rk-danger text-xs font-black flex items-center justify-center shadow-xs">
              {num(openCount)}
            </span>
          )}
        </button>
      )}

      {isOpenPanel && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="rk-sos-title" ref={dialogRef}>
          <div className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="sticky top-0 bg-rk-brand text-white px-5 py-4 flex items-center justify-between rounded-t-3xl">
              <h2 id="rk-sos-title" className="flex items-center gap-2 font-extrabold text-lg">
                <LifeBuoy className="w-5 h-5" aria-hidden="true" />
                {tr("Ask for emergency help", "জরুরি সাহায্য চান")}
              </h2>
              <button type="button" data-autofocus onClick={() => handleOpenChange(false)} aria-label={tr("Close", "বন্ধ করুন")} className="h-10 w-10 inline-flex items-center justify-center rounded-full hover:bg-white/20 transition-colors focus-visible:outline-white">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <a
                href="tel:999"
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-rk-ink text-white font-extrabold text-base"
              >
                <Phone className="w-4 h-4" />
                {tr("Call 999 (national emergency number)", "৯৯৯ নম্বরে কল করুন (জাতীয় জরুরি সেবা)")}
              </a>
              <p className="text-xs text-rk-muted -mt-3">
                {tr(
                  "If you can make a call, call first. This form sends your request to the Rokkha rescue volunteers; it is not the government emergency service.",
                  "কল করা সম্ভব হলে আগে কল করুন। এই ফর্ম আপনার অনুরোধ রক্ষা উদ্ধার স্বেচ্ছাসেবকদের কাছে পাঠায়; এটি সরকারি জরুরি সেবা নয়।"
                )}
              </p>

              {queue.length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm font-extrabold text-rk-ink">
                    {tr("Your requests on this phone", "এই ফোনে আপনার অনুরোধ")}
                    {unsentCount > 0 && (
                      <span className="ml-2 text-xs font-bold text-rk-warning">
                        {tr(`${unsentCount} not sent yet`, `${num(unsentCount)}টি এখনো পাঠানো হয়নি`)}
                      </span>
                    )}
                  </div>
                  {queue.map((item) => {
                    const line = stateLine(item);
                    return (
                      <div key={item.client_id} className="rounded-2xl border border-rk-line p-3.5 space-y-2.5">
                        {item.receipt && (
                          <div className="text-sm font-extrabold text-rk-ink">
                            {tr("Reference", "রেফারেন্স")}: <span className="font-mono tracking-wider">{item.receipt.reference}</span>
                          </div>
                        )}
                        <div className="text-sm font-bold text-rk-ink">
                          {item.draft.needs.map((n) => tr(NEED_LABEL[n].en, NEED_LABEL[n].bn)).join(", ")} ·{" "}
                          {tr(`${item.draft.people} ${item.draft.people === 1 ? "person" : "people"}`, `${num(item.draft.people)} জন`)}
                          {item.draft.place_label ? (
                            <span className="flex items-center gap-1 text-xs font-semibold text-rk-muted">
                              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                              {item.draft.place_label}
                            </span>
                          ) : null}
                        </div>
                        <div role="status" className={`rounded-lg border px-3 py-2 text-sm font-semibold ${line.tone}`}>
                          {line.text}
                          {item.delivery === "saved" && item.last_problem && (
                            <span className="block text-xs font-medium mt-1">
                              {tr("Last try:", "শেষ চেষ্টা:")} {localError(item.last_problem, isBn ? "bn" : "en")}
                            </span>
                          )}
                        </div>
                        {item.receipt?.message_to_sender && (
                          <div className="rounded-lg bg-rk-page border border-rk-line px-3 py-2 text-sm text-rk-ink">
                            <span className="font-bold">{tr("Message from the rescuers: ", "উদ্ধারকারীদের বার্তা: ")}</span>
                            {item.receipt.message_to_sender}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {item.delivery === "saved" && (
                            <>
                              <Button size="sm" variant="outline" onClick={sync} className="h-8 text-xs font-bold rounded-lg">
                                {tr("Try sending now", "এখনই পাঠানোর চেষ্টা করুন")}
                              </Button>
                              <a
                                href={`sms:?&body=${encodeURIComponent(smsText(item))}`}
                                className="h-8 px-3 rounded-lg border border-rk-line text-xs font-bold text-rk-ink flex items-center gap-1.5"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                {tr("Send as SMS to someone", "কাউকে এসএমএস করে পাঠান")}
                              </a>
                            </>
                          )}
                          {checkIsOpen(item) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  await cancelSos(item);
                                } catch (error) {
                                  setProblem((error as Error).message);
                                }
                                setQueue(readQueue());
                              }}
                              className="h-8 text-xs font-bold rounded-lg text-rk-danger"
                            >
                              {tr("I no longer need help", "আমার আর সাহায্য লাগবে না")}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                forgetSos(item.client_id);
                                setQueue(readQueue());
                              }}
                              className="h-8 text-xs font-bold rounded-lg"
                            >
                              {tr("Remove from this phone", "এই ফোন থেকে মুছুন")}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {review ? (
                <div className="space-y-4 border-t border-rk-line pt-4" aria-live="polite">
                  <div className="text-base font-extrabold text-rk-ink">{tr("Check before sending", "পাঠানোর আগে দেখে নিন")}</div>
                  <dl className="rounded-2xl border-2 border-rk-brand p-4 space-y-2 text-sm text-rk-ink">
                    <div>
                      <dt className="font-bold text-rk-muted">{tr("Your request will be sent for this place:", "এই জায়গার জন্য অনুরোধ পাঠানো হবে:")}</dt>
                      <dd className="font-extrabold">{review.place_label}</dd>
                      {review.location ? (
                        <dd className="text-xs text-rk-muted">
                          {tr("Your exact GPS point is sent too, and is shown only to rescue teams.", "আপনার সঠিক জিপিএস অবস্থানও পাঠানো হবে, যা শুধু উদ্ধারকারী দল দেখতে পায়।")}
                          {review.accuracy_m !== null ? ` ${tr(`Accuracy about ${Math.round(review.accuracy_m)} m.`, `নির্ভুলতা প্রায় ${num(Math.round(review.accuracy_m))} মিটার।`)}` : ""}
                        </dd>
                      ) : (
                        <dd className="text-xs text-rk-muted">{tr("No GPS point: teams will use the place you described.", "জিপিএস নেই: দলগুলো আপনার দেওয়া বর্ণনা ব্যবহার করবে।")}</dd>
                      )}
                    </div>
                    <div>
                      <dt className="font-bold text-rk-muted">{tr("Help needed", "যে সাহায্য দরকার")}</dt>
                      <dd className="font-bold">{review.needs.map((n) => tr(NEED_LABEL[n].en, NEED_LABEL[n].bn)).join(", ")}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-rk-muted">{tr("People", "মানুষ")}</dt>
                      <dd className="font-bold">
                        {num(review.people)}
                        {review.serious_injury === true ? ` · ${tr("someone is seriously ill or injured", "কেউ গুরুতর অসুস্থ বা আহত")}` : ""}
                        {review.vulnerable.length > 0 ? ` · ${review.vulnerable.map((v) => tr(VULNERABLE_LABEL[v].en, VULNERABLE_LABEL[v].bn)).join(", ")}` : ""}
                      </dd>
                    </div>
                  </dl>
                  <div className="grid grid-cols-2 gap-3">
                    <Button type="button" variant="outline" onClick={() => setReview(null)} className="h-12 rounded-xl font-bold flex items-center gap-2">
                      <Pencil className="w-4 h-4" />
                      {tr("Change", "পরিবর্তন")}
                    </Button>
                    <Button type="button" onClick={confirmAndSend} className="h-12 bg-rk-brand hover:bg-rk-brand-strong text-white font-extrabold rounded-xl">
                      {tr("Confirm and send", "নিশ্চিত করে পাঠান")}
                    </Button>
                  </div>
                </div>
              ) : (
              <form onSubmit={prepare} className="space-y-5 border-t border-rk-line pt-4" noValidate>
                <div className="text-sm font-extrabold text-rk-ink">{tr("New request", "নতুন অনুরোধ")}</div>

                <fieldset className="space-y-2">
                  <legend className="text-base sm:text-lg font-bold text-rk-ink mb-2">{tr("1. What help do you need?", "১. কী সাহায্য দরকার?")}</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {NEED_ORDER.map((id) => {
                      const on = needs.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setNeeds((list) => toggle(list, id))}
                          className={`min-h-12 px-3 rounded-xl border-2 text-left text-sm font-bold transition-colors ${
                            on ? "border-rk-brand bg-rk-brand-soft text-rk-ink" : "border-rk-line bg-white text-rk-ink"
                          }`}
                        >
                          {on && <Check className="inline w-4 h-4 mr-1 -mt-0.5" aria-hidden="true" />}
                          {tr(NEED_LABEL[id].en, NEED_LABEL[id].bn)}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className="text-base sm:text-lg font-bold text-rk-ink mb-2">{tr("2. Where are you?", "২. আপনি কোথায়?")}</legend>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={useGps} disabled={isLocating} className="h-11 rounded-xl text-sm font-bold flex items-center gap-2">
                      <Crosshair className="w-4 h-4" />
                      {isLocating ? tr("Reading location...", "অবস্থান নেওয়া হচ্ছে...") : tr("Use my GPS location", "আমার জিপিএস অবস্থান")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      aria-expanded={showPlace}
                      onClick={() => setShowPlace((prev) => !prev)}
                      className={`h-11 rounded-xl text-sm font-bold flex items-center gap-2 ${showPlace ? "bg-rk-brand text-white border-rk-brand hover:bg-rk-ink hover:text-white" : ""}`}
                    >
                      <MapPin className="w-4 h-4" />
                      {tr("Describe the place", "জায়গার বর্ণনা দিন")}
                    </Button>
                    {savedPlace && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setPosition({ lng: savedPlace.lng, lat: savedPlace.lat, accuracy_m: null, source: "saved_place", label: savedPlace.label || tr("My saved place", "আমার সংরক্ষিত স্থান") })
                        }
                        className="h-11 rounded-xl text-sm font-bold flex items-center gap-2"
                      >
                        <MapPin className="w-4 h-4" />
                        {savedPlace.label || tr("My saved place", "আমার সংরক্ষিত স্থান")}
                      </Button>
                    )}
                  </div>

                  {position && (
                    <div className="flex items-start justify-between gap-2 rounded-xl bg-rk-success-soft border border-rk-success/40 px-3 py-2 text-sm text-rk-success">
                      <span className="font-semibold flex items-start gap-1.5">
                        <MapPin className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                        <span>
                          {position.label}
                          {position.accuracy_m !== null ? (
                            <span className="block text-xs font-medium">{tr(`Accuracy about ${Math.round(position.accuracy_m)} m (from your phone)`, `নির্ভুলতা প্রায় ${num(Math.round(position.accuracy_m))} মিটার (আপনার ফোন থেকে)`)}</span>
                          ) : null}
                          {position.source === "gps" && (
                            <span className="block text-xs font-medium">{tr("Add the village or a landmark below so the team finds the house.", "দল যেন বাড়িটি খুঁজে পায়, নিচে গ্রাম বা পরিচিত স্থান লিখুন।")}</span>
                          )}
                        </span>
                      </span>
                      <button type="button" onClick={() => setPosition(null)} className="text-xs font-bold underline shrink-0">
                        {tr("Remove", "সরান")}
                      </button>
                    </div>
                  )}

                  {showPlace && (
                    <div className="p-3.5 rounded-2xl bg-rk-page border border-rk-line space-y-2.5">
                      <div className="text-xs font-bold text-rk-brand">
                        {position
                          ? tr("Optional: help the team find the house.", "ঐচ্ছিক: দলকে বাড়িটি খুঁজে পেতে সাহায্য করুন।")
                          : tr("Choose the district and write at least one of village, area or landmark.", "জেলা বেছে নিন এবং গ্রাম, এলাকা বা পরিচিত স্থানের অন্তত একটি লিখুন।")}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <label className="block text-[11px] font-bold text-rk-muted">
                          {tr("District", "জেলা")}{position ? "" : " *"}
                          <select
                            value={place.district_pcode || ""}
                            onChange={(e) => setPlaceField("district_pcode", e.target.value)}
                            className="mt-1 h-10 w-full rounded-xl border border-rk-line bg-white px-3 text-sm font-semibold text-rk-brand"
                          >
                            <option value="">{tr("-- Select district --", "-- জেলা নির্বাচন করুন --")}</option>
                            {ALL_DISTRICTS.map((d) => (
                              <option key={d.pcode} value={d.pcode}>
                                {isBn ? DISTRICTS_BN[d.pcode] || d.name : d.name} ({d.division})
                              </option>
                            ))}
                          </select>
                        </label>
                        {([
                          ["upazila", tr("Upazila", "উপজেলা")],
                          ["union", tr("Union", "ইউনিয়ন")],
                          ["village", tr("Village", "গ্রাম")],
                          ["area", tr("Area / neighbourhood", "এলাকা / পাড়া")],
                          ["landmark", tr("House or landmark", "বাড়ি বা পরিচিত স্থান")],
                        ] as Array<[keyof Place, string]>).map(([field, label]) => (
                          <label key={field} className="block text-[11px] font-bold text-rk-muted">
                            {label}
                            <Input
                              value={(place[field] as string) || ""}
                              onChange={(e) => setPlaceField(field, e.target.value)}
                              maxLength={field === "landmark" ? 160 : 120}
                              className="mt-1 h-10 rounded-xl text-sm bg-white"
                            />
                          </label>
                        ))}
                      </div>
                      <label className="block text-[11px] font-bold text-rk-muted">
                        {tr("More about the place (optional)", "জায়গা সম্পর্কে আরও (ঐচ্ছিক)")}
                        <textarea
                          value={place.details || ""}
                          onChange={(e) => setPlaceField("details", e.target.value)}
                          maxLength={300}
                          rows={2}
                          className="mt-1 w-full rounded-xl border border-rk-line px-3 py-2 text-sm bg-white"
                        />
                      </label>
                    </div>
                  )}
                </fieldset>

                <fieldset className="space-y-3">
                  <legend className="text-base sm:text-lg font-bold text-rk-ink mb-2">{tr("3. Who is with you?", "৩. আপনার সাথে কারা আছেন?")}</legend>
                  <div className="flex items-center gap-3">
                    <span id="sos-people-label" className="text-sm font-bold text-rk-muted">{tr("Number of people", "মানুষের সংখ্যা")}</span>
                    <div className="flex items-center gap-2" role="group" aria-labelledby="sos-people-label">
                      <Button type="button" variant="outline" aria-label={tr("One less", "একজন কম")} onClick={() => setPeople((n) => Math.max(1, n - 1))} className="h-11 w-11 rounded-xl p-0">
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-10 text-center text-xl font-extrabold" aria-live="polite">{num(people)}</span>
                      <Button type="button" variant="outline" aria-label={tr("One more", "একজন বেশি")} onClick={() => setPeople((n) => Math.min(1000, n + 1))} className="h-11 w-11 rounded-xl p-0">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div id="sos-injury-label" className="text-sm font-bold text-rk-muted mb-1.5">{tr("Is anyone seriously ill or injured?", "কেউ কি গুরুতর অসুস্থ বা আহত?")}</div>
                    <div className="flex gap-2" role="group" aria-labelledby="sos-injury-label">
                      {([[true, tr("Yes", "হ্যাঁ")], [false, tr("No", "না")]] as Array<[boolean, string]>).map(([value, label]) => (
                        <button
                          key={String(value)}
                          type="button"
                          aria-pressed={seriousInjury === value}
                          onClick={() => setSeriousInjury((current) => (current === value ? null : value))}
                          className={`h-11 px-5 rounded-xl border-2 text-sm font-bold ${seriousInjury === value ? "border-rk-danger bg-rk-danger-soft text-rk-danger" : "border-rk-line bg-white"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div id="sos-vulnerable-label" className="text-sm font-bold text-rk-muted mb-1.5">{tr("Anyone who needs extra care? (optional)", "বিশেষ যত্ন দরকার এমন কেউ? (ঐচ্ছিক)")}</div>
                    <div className="flex flex-wrap gap-2" role="group" aria-labelledby="sos-vulnerable-label">
                      {(Object.keys(VULNERABLE_LABEL) as Vulnerable[]).map((id) => (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={vulnerable.includes(id)}
                          onClick={() => setVulnerable((list) => toggle(list, id))}
                          className={`h-10 px-3 rounded-xl border-2 text-sm font-bold ${vulnerable.includes(id) ? "border-rk-brand bg-rk-brand text-white" : "border-rk-line bg-white"}`}
                        >
                          {tr(VULNERABLE_LABEL[id].en, VULNERABLE_LABEL[id].bn)}
                        </button>
                      ))}
                    </div>
                  </div>
                </fieldset>

                <fieldset className="space-y-3">
                  <legend className="text-base sm:text-lg font-bold text-rk-ink mb-2">{tr("4. How can the team reach you? (optional)", "৪. দল কীভাবে যোগাযোগ করবে? (ঐচ্ছিক)")}</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-bold text-rk-muted">
                      {tr("Your name", "আপনার নাম")}
                      <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="mt-1 h-10 rounded-xl" />
                    </label>
                    <label className="block text-xs font-bold text-rk-muted">
                      {tr("Phone number", "ফোন নম্বর")}
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^0-9+ ()-]/g, ""))}
                        maxLength={20}
                        className="mt-1 h-10 rounded-xl"
                      />
                    </label>
                  </div>
                  <label className="block text-xs font-bold text-rk-muted">
                    {tr("Anything else the team should know", "দলের আর কিছু জানা দরকার")}
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={500}
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-rk-line px-3 py-2 text-sm"
                    />
                  </label>
                </fieldset>

                {problem && (
                  <div role="alert" className="rounded-xl border border-rk-danger-accent/40 bg-rk-danger-soft px-3.5 py-2.5 text-sm font-semibold text-rk-danger">
                    {problem}
                  </div>
                )}

                <Button type="submit" className="w-full h-12 bg-rk-brand hover:bg-rk-brand-strong text-white font-extrabold text-base rounded-xl">
                  {tr("Next: check the request", "পরবর্তী: অনুরোধ দেখে নিন")}
                </Button>
                <p className="text-[11px] text-rk-muted leading-snug">
                  {tr(
                    "Your location and phone number are shown only to rescue teams, and your phone number only to the team that accepts the request. The request is saved on this phone first, so it is not lost if the connection drops. No SMS or call is made: teams see requests on the Rokkha rescue board. Sending a request does not mean help is on the way: watch the status above.",
                    "আপনার অবস্থান ও ফোন নম্বর শুধু উদ্ধারকারী দলগুলো দেখতে পায়, আর ফোন নম্বর শুধু যে দল অনুরোধ গ্রহণ করে সেই দল। অনুরোধটি আগে এই ফোনে সংরক্ষিত হয়, তাই সংযোগ বিচ্ছিন্ন হলেও হারায় না। কোনো এসএমএস বা কল করা হয় না: দলগুলো রক্ষা উদ্ধার বোর্ডে অনুরোধ দেখে। অনুরোধ পাঠানো মানে সাহায্য আসছে, তা নয়: ওপরের অবস্থা দেখুন।"
                  )}
                </p>
              </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
