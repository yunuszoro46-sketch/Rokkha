"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Crosshair, LifeBuoy, MapPin, MessageSquare, Phone, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Language, toBnNum, DISTRICTS_BN } from "../lib/translations";
import districtGeoData from "@/data/bangladesh_districts.json";
import benchmarkData from "@/data/benchmark_predictions.json";
import { readPreciseLocation } from "../services/location";
import {
  Need,
  SosDraft,
  StoredSos,
  cancelSos,
  forgetSos,
  isOpen as checkIsOpen,
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
}

const ALL_DISTRICTS: Array<{ pcode: string; name: string; division: string }> = (
  districtGeoData as any
).features
  .map((f: any) => ({
    pcode: f.properties.pcode,
    name: f.properties.name,
    division: f.properties.parent_name || "",
  }))
  .sort((a: any, b: any) => a.name.localeCompare(b.name));

const DISTRICT_CENTERS: Record<string, [number, number]> =
  (benchmarkData as any).centroids || {
    BD6090: [24.9602, 91.3992],
    BD3026: [23.8103, 90.4125],
    BD6091: [24.8949, 91.8687],
  };

const NEEDS: Array<{ id: Need; en: string; bn: string }> = [
  { id: "rescue", en: "Rescue (trapped by water)", bn: "উদ্ধার (পানিতে আটকা)" },
  { id: "medical", en: "Medical help", bn: "চিকিৎসা সহায়তা" },
  { id: "food_water", en: "Food and drinking water", bn: "খাবার ও পানি" },
  { id: "shelter", en: "A safe shelter", bn: "নিরাপদ আশ্রয়" },
  { id: "other", en: "Other", bn: "অন্যান্য" },
];

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
  const [queue, setQueue] = useState<StoredSos[]>([]);
  const [position, setPosition] = useState<{ lng: number; lat: number; accuracy_m: number | null; label?: string } | null>(null);
  const [showOtherLocation, setShowOtherLocation] = useState(false);
  const [otherDistrict, setOtherDistrict] = useState("");
  const [otherArea, setOtherArea] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [people, setPeople] = useState("1");
  const [need, setNeed] = useState<Need>("rescue");
  const [note, setNote] = useState("");
  const [name, setName] = useState(contactName);
  const [phone, setPhone] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const handleSelectDistrict = (pcode: string) => {
    setOtherDistrict(pcode);
    const center = DISTRICT_CENTERS[pcode];
    const d = ALL_DISTRICTS.find((item) => item.pcode === pcode);
    if (center && d) {
      const distName = isBn ? (DISTRICTS_BN[pcode] || d.name) : d.name;
      const label = otherArea.trim() ? `${otherArea.trim()}, ${distName}` : distName;
      setPosition({
        lat: center[0],
        lng: center[1],
        accuracy_m: null,
        label,
      });
    }
  };

  const handleOtherAreaChange = (val: string) => {
    setOtherArea(val);
    if (otherDistrict) {
      const center = DISTRICT_CENTERS[otherDistrict];
      const d = ALL_DISTRICTS.find((item) => item.pcode === otherDistrict);
      if (center && d) {
        const distName = isBn ? (DISTRICTS_BN[otherDistrict] || d.name) : d.name;
        const label = val.trim() ? `${val.trim()}, ${distName}` : distName;
        setPosition({
          lat: center[0],
          lng: center[1],
          accuracy_m: null,
          label,
        });
      }
    }
  };

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
      setPosition({ lng: fix.lng, lat: fix.lat, accuracy_m: fix.accuracy_m, label: tr("My GPS location", "আমার জিপিএস অবস্থান") });
      setShowOtherLocation(false);
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setIsLocating(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!position) {
      setProblem(tr("Choose your location first.", "আগে আপনার অবস্থান দিন।"));
      return;
    }
    const locationPrefix = position.label ? `[${position.label}] ` : "";
    const noteWithLocation = note.trim().startsWith(locationPrefix)
      ? note.trim()
      : `${locationPrefix}${note.trim()}`;
    const draft: SosDraft = {
      lng: position.lng,
      lat: position.lat,
      accuracy_m: position.accuracy_m,
      people: Math.min(1000, Math.max(1, Number(people) || 1)),
      need,
      note: noteWithLocation.trim().slice(0, 500),
      contact_name: name.trim().slice(0, 80),
      contact_phone: phone.trim().slice(0, 20),
    };
    // Saved on the phone first: it survives a dead connection and a closed page.
    saveSos(draft);
    setQueue(readQueue());
    setNote("");
    setProblem(null);
    await sync();
  };

  const stateLine = (item: StoredSos): { text: string; tone: string } => {
    const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (item.delivery === "refused") {
      return {
        text: tr(`Not accepted by the server: ${item.last_problem || ""}`, `সার্ভার গ্রহণ করেনি: ${item.last_problem || ""}`),
        tone: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
      };
    }
    if (item.delivery === "saved" || !item.receipt) {
      return {
        text: tr(
          "Saved on this phone. NOT sent yet. It is sent by itself when the connection returns and this page is open.",
          "এই ফোনে সংরক্ষিত। এখনো পাঠানো হয়নি। সংযোগ ফিরে এলে এবং এই পাতা খোলা থাকলে নিজে থেকেই পাঠানো হবে।"
        ),
        tone: "bg-[#FEF3C7] text-[#78350F] border-[#F59E0B]",
      };
    }
    const r = item.receipt;
    const at = num(time(r.updated_at));
    switch (r.status) {
      case "new":
        return {
          text: tr(`Received by the server at ${num(time(r.received_at))}. No rescuer has opened it yet.`, `সার্ভার ${num(time(r.received_at))} টায় পেয়েছে। এখনো কোনো উদ্ধারকারী দেখেননি।`),
          tone: "bg-[#DBEAFE] text-[#1E3A8A] border-[#93C5FD]",
        };
      case "acknowledged":
        return {
          text: tr(`A rescuer has seen your request (${at}).`, `একজন উদ্ধারকারী আপনার অনুরোধ দেখেছেন (${at})।`),
          tone: "bg-[#DBEAFE] text-[#1E3A8A] border-[#93C5FD]",
        };
      case "team_sent":
        return {
          text: tr(`The rescuers marked a team as sent (${at}).`, `উদ্ধারকারীরা জানিয়েছেন একটি দল পাঠানো হয়েছে (${at})।`),
          tone: "bg-[#DCFCE7] text-[#166534] border-[#86EFAC]",
        };
      case "resolved":
        return {
          text: tr(`Marked as resolved by the rescuers (${at}).`, `উদ্ধারকারীরা সমাধান হয়েছে বলে চিহ্নিত করেছেন (${at})।`),
          tone: "bg-[#F3F4F6] text-[#374151] border-[#D1D5DB]",
        };
      default:
        return {
          text: tr(`Cancelled (${at}).`, `বাতিল করা হয়েছে (${at})।`),
          tone: "bg-[#F3F4F6] text-[#374151] border-[#D1D5DB]",
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
          className="fixed bottom-5 right-5 z-[900] h-14 px-5 rounded-full bg-[#183026] hover:bg-[#0E1D16] border border-[#2B4B3D] text-white font-extrabold shadow-[0_8px_24px_rgba(18,36,28,0.35)] flex items-center gap-3 transition-transform hover:scale-105"
          aria-label={tr("Emergency Rescue Request", "জরুরি উদ্ধার অনুরোধ")}
        >
          <LifeBuoy className="w-6 h-6 text-white stroke-[2.5]" />
          <div className="flex flex-col text-left leading-none">
            <span className="text-[10px] font-black tracking-wider uppercase text-white/90">
              {tr("EMERGENCY", "জরুরি")}
            </span>
            <span className="text-xs font-black tracking-wider uppercase text-white">
              {tr("RESCUE REQUEST", "উদ্ধার অনুরোধ")}
            </span>
          </div>
          {openCount > 0 && (
            <span className="ml-1 min-w-5 h-5 px-1.5 rounded-full bg-white text-[#183026] text-xs font-black flex items-center justify-center">
              {num(openCount)}
            </span>
          )}
        </button>
      )}

      {isOpenPanel && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true">
          <div className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
            <div className="sticky top-0 bg-[#C9443A] text-white px-5 py-4 flex items-center justify-between rounded-t-3xl">
              <div className="flex items-center gap-2 font-extrabold text-lg">
                <LifeBuoy className="w-5 h-5" />
                {tr("Ask for emergency help", "জরুরি সাহায্য চান")}
              </div>
              <button type="button" onClick={() => handleOpenChange(false)} aria-label={tr("Close", "বন্ধ করুন")} className="p-1.5 rounded-full hover:bg-white/20">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <a
                href="tel:999"
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[#11241C] text-white font-extrabold text-base"
              >
                <Phone className="w-4 h-4" />
                {tr("Call 999 (national emergency number)", "৯৯৯ নম্বরে কল করুন (জাতীয় জরুরি সেবা)")}
              </a>
              <p className="text-xs text-[#5C6863] -mt-3">
                {tr(
                  "If you can make a call, call first. This form sends your request to the Rokkha rescue volunteers; it is not the government emergency service.",
                  "কল করা সম্ভব হলে আগে কল করুন। এই ফর্ম আপনার অনুরোধ রক্ষা উদ্ধার স্বেচ্ছাসেবকদের কাছে পাঠায়; এটি সরকারি জরুরি সেবা নয়।"
                )}
              </p>

              {queue.length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm font-extrabold text-[#12241C]">
                    {tr("Your requests on this phone", "এই ফোনে আপনার অনুরোধ")}
                    {unsentCount > 0 && (
                      <span className="ml-2 text-xs font-bold text-[#92400E]">
                        {tr(`${unsentCount} not sent yet`, `${num(unsentCount)}টি এখনো পাঠানো হয়নি`)}
                      </span>
                    )}
                  </div>
                  {queue.map((item) => {
                    const line = stateLine(item);
                    const needLabel = NEEDS.find((n) => n.id === item.draft.need);
                    return (
                      <div key={item.client_id} className="rounded-2xl border border-[#DFDDD3] p-3.5 space-y-2.5">
                        <div className="text-sm font-bold text-[#12241C]">
                          {needLabel ? tr(needLabel.en, needLabel.bn) : item.draft.need} ·{" "}
                          {tr(`${item.draft.people} people`, `${num(item.draft.people)} জন`)} ·{" "}
                          {num(item.draft.lat.toFixed(4))}°N, {num(item.draft.lng.toFixed(4))}°E
                        </div>
                        <div role="status" className={`rounded-lg border px-3 py-2 text-sm font-semibold ${line.tone}`}>
                          {line.text}
                          {item.delivery === "saved" && item.last_problem && (
                            <span className="block text-xs font-medium mt-1">
                              {tr("Last try:", "শেষ চেষ্টা:")} {item.last_problem}
                            </span>
                          )}
                        </div>
                        {item.receipt?.message_to_sender && (
                          <div className="rounded-lg bg-[#FAF9F5] border border-[#EDEBE2] px-3 py-2 text-sm text-[#12241C]">
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
                                className="h-8 px-3 rounded-lg border border-[#DFDDD3] text-xs font-bold text-[#12241C] flex items-center gap-1.5"
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
                              className="h-8 text-xs font-bold rounded-lg text-[#991B1B]"
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

              <form onSubmit={submit} className="space-y-4 border-t border-[#EDEBE2] pt-4">
                <div className="text-sm font-extrabold text-[#12241C]">{tr("New request", "নতুন অনুরোধ")}</div>

                <div className="space-y-2">
                  <label className="block text-base sm:text-lg font-bold text-[#12241C]">{tr("Where are you?", "আপনি কোথায়?")}</label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={useGps} disabled={isLocating} className="h-10 rounded-xl text-sm font-bold flex items-center gap-2">
                      <Crosshair className="w-4 h-4" />
                      {isLocating ? tr("Reading location...", "অবস্থান নেওয়া হচ্ছে...") : tr("Use my current location", "আমার বর্তমান অবস্থান")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowOtherLocation((prev) => !prev)}
                      className={`h-10 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                        showOtherLocation
                          ? "bg-[#183026] text-white border-[#183026] hover:bg-[#12241C] hover:text-white"
                          : "border-[#DFDDD3] hover:border-[#12241C]"
                      }`}
                    >
                      <MapPin className={`w-4 h-4 ${showOtherLocation ? "text-white" : "text-[#C9443A]"}`} />
                      {tr("Use others location", "অন্যের অবস্থান")}
                    </Button>
                    {savedPlace && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setPosition({ lng: savedPlace.lng, lat: savedPlace.lat, accuracy_m: null, label: savedPlace.label || undefined });
                          setShowOtherLocation(false);
                        }}
                        className="h-10 rounded-xl text-sm font-bold flex items-center gap-2"
                      >
                        <MapPin className="w-4 h-4" />
                        {savedPlace.label || tr("My saved place", "আমার সংরক্ষিত স্থান")}
                      </Button>
                    )}
                  </div>

                  {showOtherLocation && (
                    <div className="p-3.5 rounded-2xl bg-[#FAFAF7] border border-[#DFDDD3] space-y-3 mt-2">
                      <div className="text-xs font-bold text-[#183026]">
                        {tr("Specify location for someone else:", "অন্য কারো অবস্থান নির্বাচন করুন:")}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-[#5C6863] mb-1">
                            {tr("District (Required)", "জেলা (আবশ্যক)")}
                          </label>
                          <select
                            value={otherDistrict}
                            onChange={(e) => handleSelectDistrict(e.target.value)}
                            className="h-10 w-full rounded-xl border border-[#DFDDD3] bg-white px-3 text-xs font-semibold text-[#183026]"
                          >
                            <option value="">{tr("-- Select District --", "-- জেলা নির্বাচন করুন --")}</option>
                            {ALL_DISTRICTS.map((d) => (
                              <option key={d.pcode} value={d.pcode}>
                                {isBn ? (DISTRICTS_BN[d.pcode] || d.name) : d.name} ({d.division})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#5C6863] mb-1">
                            {tr("Upazila / Area / Landmark (Optional)", "উপজেলা / গ্রাম / পরিচিত স্থান (ঐচ্ছিক)")}
                          </label>
                          <Input
                            type="text"
                            value={otherArea}
                            onChange={(e) => handleOtherAreaChange(e.target.value)}
                            placeholder={tr("e.g. Chhagalnaiya, near flood shelter", "যেমন: ছাগলনাইয়া, বন্যা আশ্রয়কেন্দ্রের কাছে")}
                            className="h-10 rounded-xl text-xs bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-[#12241C]">
                    {position ? (
                      <span className="font-semibold">
                        {position.label ? <span className="text-[#183026] mr-1.5 font-bold">📍 {position.label} —</span> : null}
                        {num(position.lat.toFixed(5))}°N, {num(position.lng.toFixed(5))}°E
                        {position.accuracy_m !== null ? <span className="ml-1.5 text-[#5C6863]">({tr("within", "নির্ভুলতা")} ±{num(String(position.accuracy_m))} {tr("m", "মি")})</span> : null}
                      </span>
                    ) : (
                      tr("No location chosen yet.", "এখনো অবস্থান দেওয়া হয়নি।")
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#3B4740] mb-1">{tr("How many people?", "কতজন মানুষ?")}</label>
                    <Input type="number" min={1} max={1000} required value={people} onChange={(e) => setPeople(e.target.value)} className="h-10 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#3B4740] mb-1">{tr("What do you need most?", "সবচেয়ে বেশি কী দরকার?")}</label>
                    <select
                      value={need}
                      onChange={(e) => setNeed(e.target.value as Need)}
                      className="h-10 w-full rounded-xl border border-[#DFDDD3] bg-white px-3 text-sm"
                    >
                      {NEEDS.map((n) => (
                        <option key={n.id} value={n.id}>
                          {tr(n.en, n.bn)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#3B4740] mb-1">
                    {tr("Anything rescuers should know (optional)", "উদ্ধারকারীদের যা জানা দরকার (ঐচ্ছিক)")}
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder={tr("Children, elderly, injuries, landmark nearby...", "শিশু, বয়স্ক, আহত, কাছের পরিচিত স্থান...")}
                    className="w-full rounded-xl border border-[#DFDDD3] px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#3B4740] mb-1">{tr("Your name (optional)", "আপনার নাম (ঐচ্ছিক)")}</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-10 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#3B4740] mb-1">{tr("Phone number (optional)", "ফোন নম্বর (ঐচ্ছিক)")}</label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9+ ()-]/g, ""))}
                      maxLength={20}
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>

                {problem && (
                  <div role="alert" className="rounded-xl border border-[#FCA5A5] bg-[#FEE2E2] px-3.5 py-2.5 text-sm font-semibold text-[#991B1B]">
                    {problem}
                  </div>
                )}

                <Button type="submit" className="w-full h-12 bg-[#C9443A] hover:bg-[#A9362E] text-white font-extrabold text-base rounded-xl">
                  {tr("Save and send the request", "অনুরোধ সংরক্ষণ করে পাঠান")}
                </Button>
                <p className="text-[11px] text-[#5C6863] leading-snug">
                  {tr(
                    "Your location, note and phone number are shown only to rescuers. The request is saved on this phone first, so it is not lost if the connection drops. Sending a request does not mean help is on the way: watch the status above.",
                    "আপনার অবস্থান, বার্তা ও ফোন নম্বর শুধু উদ্ধারকারীরা দেখতে পান। অনুরোধটি আগে এই ফোনে সংরক্ষিত হয়, তাই সংযোগ বিচ্ছিন্ন হলেও হারায় না। অনুরোধ পাঠানো মানে সাহায্য আসছে, তা নয়: ওপরের অবস্থা দেখুন।"
                  )}
                </p>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
