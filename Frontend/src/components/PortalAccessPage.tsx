"use client";

import React, { useState, useEffect } from "react";
import logoAsset from "@/assets/logo.png";
import {
  MapPin,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Language } from "@/lib/translations";
import {
  AccountUser,
  AuthError,
  logIn,
  registerAccount,
  readGpsPosition,
  saveMyLocation,
} from "@/services/auth";

interface PortalAccessPageProps {
  isOpen?: boolean;
  onClose?: () => void;
  /** Called with the account after a real login, or with null for guest access. */
  onLoginSuccess: (user: AccountUser | null) => void;
  lang?: Language;
  onToggleLanguage?: () => void;
}

export function PortalAccessPage({
  isOpen = true,
  onClose,
  onLoginSuccess,
  lang = "en",
  onToggleLanguage,
}: PortalAccessPageProps) {
  const [tab, setTab] = useState<string>("register");
  const [fullName, setFullName] = useState("");
  const [contact, setContact] = useState("");
  // GPS position [longitude, latitude] the user chose to share, saved after registering.
  const [gpsPosition, setGpsPosition] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The free server sleeps when unused; its first answer can take up to a minute.
  const [isSlow, setIsSlow] = useState(false);
  useEffect(() => {
    if (!isSubmitting) {
      setIsSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setIsSlow(true), 5000);
    return () => window.clearTimeout(timer);
  }, [isSubmitting]);
  const [currentLang, setCurrentLang] = useState<Language>(lang);

  useEffect(() => {
    setCurrentLang(lang);
  }, [lang]);

  const isBn = currentLang === "bn";

  const handleToggleLang = () => {
    const next = currentLang === "en" ? "bn" : "en";
    setCurrentLang(next);
    onToggleLanguage?.();
  };

  const handleUseGps = async () => {
    setFormError(null);
    setIsLocating(true);
    try {
      setGpsPosition(await readGpsPosition(isBn));
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setIsLocating(false);
    }
  };

  // Real accounts on the backend: nothing is "logged in" unless the server says so.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      let user =
        tab === "register"
          ? await registerAccount(fullName, contact, password)
          : await logIn(contact, password);

      if (tab === "register" && gpsPosition) {
        try {
          user = await saveMyLocation(gpsPosition[0], gpsPosition[1]);
        } catch (error) {
          // The account exists; only the location was refused (e.g. outside Bangladesh).
          // The report panel will ask for it again.
        }
      }
      setPassword("");
      onLoginSuccess(user);
    } catch (error) {
      setFormError(
        error instanceof AuthError
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestAccess = () => {
    onLoginSuccess(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Background Image: Satellite Flood Radar with balanced street water flow on both sides */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/satellite-flood-bg.jpg')",
        }}
      />
      {/* Backdrop overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Main Login Card - shadcn Card with Warm Cream Theme (#EDEBE2) */}
      <Card className="relative z-10 w-full max-w-[490px] my-auto bg-[#EDEBE2] border-[#D5D2C5] rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.5)] text-[#12241C] animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header Actions: EN | BN System & Close Button */}
        <div className="absolute top-5 right-5 flex items-center gap-2 z-20">
          <button
            type="button"
            onClick={handleToggleLang}
            className="h-8 px-2.5 rounded-full border border-[#DFDDD3] bg-white hover:bg-[#FAF9F5] text-xs font-bold text-[#183026] shadow-xs transition flex items-center gap-1 cursor-pointer"
            title="Switch Language / ভাষা পরিবর্তন করুন"
          >
            <span className={!isBn ? "text-[#183026] font-extrabold" : "text-[#183026]/40"}>
              EN
            </span>
            <span className="text-[#183026]/30">|</span>
            <span className={isBn ? "text-[#183026] font-extrabold" : "text-[#183026]/40"}>
              BN
            </span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#DFDDD3] hover:bg-[#D5D2C5] text-[#3E4D45] hover:text-[#12241C] flex items-center justify-center transition shadow-xs cursor-pointer"
              aria-label="Close portal modal"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Card Header with Official Rokkha Brand Logo */}
        <CardHeader className="p-0 text-center mb-5 space-y-1">
          <div className="flex items-center justify-center mb-2">
            <img
              src={logoAsset.src}
              alt="Rokkha"
              className="h-11 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-black text-[#12241C] tracking-tight">
            {isBn ? "পোর্টাল এক্সেস" : "Portal Access"}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-[#4E5C55] font-normal">
            {isBn
              ? "সরাসরি বন্যা তথ্য ও জরুরি সহায়তা গ্রহণ"
              : "Access Live Flood Intelligence & Resource Dispatch"}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {/* shadcn Tabs for LOG IN vs REGISTER / JOIN */}
          <Tabs
            value={tab}
            onValueChange={setTab}
            className="w-full mb-5"
          >
            <TabsList className="grid grid-cols-2 w-full h-12 p-1 bg-[#DFDDD3] rounded-xl border border-[#D0CDC0]">
              <TabsTrigger
                value="login"
                className="text-xs sm:text-sm font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#12241C] data-[state=active]:shadow-sm text-[#5C6863]"
              >
                {isBn ? "লগইন" : "LOG IN"}
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="text-xs sm:text-sm font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#12241C] data-[state=active]:shadow-sm text-[#5C6863]"
              >
                {isBn ? "নিবন্ধন / যোগ দিন" : "REGISTER / JOIN"}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "register" && (
              <>
                {/* Full Name Input */}
                <div>
                  <label className="block text-xs font-semibold text-[#3B4740] mb-1.5">
                    {isBn ? "পূর্ণ নাম" : "Full Name"}
                  </label>
                  <Input
                    type="text"
                    required
                    maxLength={80}
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={isBn ? "আপনার পূর্ণ নাম" : "Full Name"}
                    className="bg-white border-[#DFDDD3] text-[#12241C] placeholder:text-[#88948D] h-11 rounded-xl focus-visible:ring-[#16A34A]"
                  />
                </div>
              </>
            )}

            {/* Mobile / Email Input */}
            <div>
              <label className="block text-xs font-semibold text-[#3B4740] mb-1.5">
                {isBn ? "ইমেইল" : "Email"}
              </label>
              <Input
                type="email"
                required
                autoComplete="email"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="name@example.org"
                className="bg-white border-[#DFDDD3] text-[#12241C] placeholder:text-[#88948D] h-11 rounded-xl focus-visible:ring-[#16A34A]"
              />
            </div>

            {tab === "register" && (
              /* Optional: share the current GPS position so the report covers the user's own place */
              <div>
                <label className="block text-xs font-semibold text-[#3B4740] mb-1.5">
                  {isBn ? "আমার অবস্থান (ঐচ্ছিক)" : "My location (optional)"}
                </label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUseGps}
                  disabled={isLocating}
                  className="w-full h-11 rounded-xl border-[#DFDDD3] bg-white text-[#12241C] hover:bg-[#F5F3EC] text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
                >
                  <MapPin size={16} className={gpsPosition ? "text-[#16A34A]" : "text-[#6B7280]"} />
                  <span>
                    {isLocating
                      ? isBn ? "অবস্থান নেওয়া হচ্ছে..." : "Reading location..."
                      : gpsPosition
                      ? `${gpsPosition[1].toFixed(4)}°N, ${gpsPosition[0].toFixed(4)}°E`
                      : isBn ? "আমার বর্তমান অবস্থান ব্যবহার করুন" : "Use my current location"}
                  </span>
                </Button>
                <p className="mt-1.5 text-[11px] text-[#5C6863] leading-snug">
                  {isBn
                    ? "এটি আপনার অ্যাকাউন্টে সংরক্ষিত হয় যাতে আপনার এলাকার বন্যা প্রতিবেদন দেখানো যায়। শুধু আপনিই এটি দেখতে পারবেন, এবং পরে মুছে ফেলতে পারবেন।"
                    : "Saved with your account so the flood report can cover your own place. Only you can see it, and you can remove it later."}
                </p>
              </div>
            )}

            {/* Security Password Input */}
            <div>
              <label className="block text-xs font-semibold text-[#3B4740] mb-1.5">
                {isBn ? "নিরাপত্তা পাসওয়ার্ড" : "Security Password"}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={tab === "register" ? 8 : 1}
                  maxLength={128}
                  autoComplete={tab === "register" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isBn ? "পাসওয়ার্ড" : "Security Password"}
                  className="bg-white border-[#DFDDD3] text-[#12241C] placeholder:text-[#88948D] h-11 rounded-xl pr-10 focus-visible:ring-[#16A34A]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#12241C] transition cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </div>

            {tab === "register" && (
              <p className="-mt-2 text-[11px] text-[#5C6863]">
                {isBn ? "কমপক্ষে ৮ অক্ষর।" : "At least 8 characters."}
              </p>
            )}

            {formError && (
              <div
                role="alert"
                className="rounded-xl border border-[#FCA5A5] bg-[#FEE2E2] px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#991B1B]"
              >
                {formError}
              </div>
            )}

            {isSubmitting && isSlow && (
              <p role="status" aria-live="polite" className="text-xs sm:text-sm text-[#526058]">
                {isBn
                  ? "সার্ভার চালু হচ্ছে, প্রথমবার এক মিনিট পর্যন্ত লাগতে পারে। অনুগ্রহ করে অপেক্ষা করুন..."
                  : "Waking the server up — the first sign-in can take up to a minute. Please wait..."}
              </p>
            )}

            {/* Submit Action Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-base rounded-xl transition-all shadow-md mt-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span>{tab === "register" ? (isBn ? "অ্যাকাউন্ট তৈরি হচ্ছে..." : "Creating account...") : (isBn ? "লগ ইন হচ্ছে..." : "Logging in...")}</span>
              ) : tab === "register" ? (
                <span>{isBn ? "নিবন্ধন ও প্রবেশ" : "Register & Access"}</span>
              ) : (
                <span>{isBn ? "লগইন ও প্রবেশ" : "Log In & Access"}</span>
              )}
            </Button>
          </form>
        </CardContent>

        {/* Card Footer with Switcher and Guest Link */}
        <CardFooter className="p-0 flex flex-col items-center mt-5 pt-4 border-t border-[#DFDDD3] space-y-2">
          <p className="text-xs text-[#526058]">
            {tab === "register" ? (
              <>
                {isBn ? "ইতিমধ্যে অ্যাকাউন্ট আছে?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => setTab("login")}
                  className="text-[#16A34A] font-bold hover:underline cursor-pointer"
                >
                  {isBn ? "লগইন করুন" : "Log In"}
                </button>
              </>
            ) : (
              <>
                {isBn ? "নতুন অ্যাকাউন্ট প্রয়োজন?" : "Don't have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => setTab("register")}
                  className="text-[#16A34A] font-bold hover:underline cursor-pointer"
                >
                  {isBn ? "নিবন্ধন করুন" : "Register"}
                </button>
              </>
            )}
          </p>
          <div>
            <button
              type="button"
              onClick={handleGuestAccess}
              className="text-xs font-semibold text-[#4B5563] hover:text-[#111827] underline underline-offset-4 transition cursor-pointer"
            >
              {isBn
                ? "গেস্ট ম্যাপে সরাসরি প্রবেশ (লগইন ছাড়াই)"
                : "Access Public Guest Map (No login needed)"}
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
