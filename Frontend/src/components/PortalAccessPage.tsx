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
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsContent,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Language, localError } from "@/lib/translations";
import { usePlaceLabel } from "@/lib/placeName";
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

// Demo logins for the LOCAL preview only: read from .env.local (git-ignored). Never set on Vercel, so the live
// site shows nothing here. Format: "email|password".
const DEMO_LOGINS = [
  { key: "rescuer", label: "Rescue team demo", raw: process.env.NEXT_PUBLIC_DEMO_RESCUER },
  { key: "admin", label: "Admin demo", raw: process.env.NEXT_PUBLIC_DEMO_ADMIN },
]
  .filter((d) => d.raw && d.raw.includes("|"))
  .map((d) => ({ key: d.key, label: d.label, email: d.raw!.split("|")[0], password: d.raw!.slice(d.raw!.indexOf("|") + 1) }));

export function PortalAccessPage({
  isOpen = true,
  onClose,
  onLoginSuccess,
  lang = "en",
  onToggleLanguage,
}: PortalAccessPageProps) {
  const [tab, setTab] = useState<string>("login");
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
  // Show where the GPS point is by name, never as latitude / longitude.
  const gpsPlace = usePlaceLabel(gpsPosition ? { lat: gpsPosition[1], lng: gpsPosition[0] } : null, isBn ? "bn" : "en");

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
      setFormError(localError((error as Error).message, isBn ? "bn" : "en"));
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
          ? localError(error.message, isBn ? "bn" : "en")
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
      {/* Calm earth background (design system: Earth & Emerald) */}
      <div className="fixed inset-0 bg-grad-earth" />

      <Card className="relative z-10 w-full max-w-[460px] my-auto bg-rk-surface border-rk-line rounded-3xl p-6 sm:p-8 shadow-[var(--rk-shadow-float)] text-rk-ink">
        {/* Top Header Actions: EN | BN System & Close Button */}
        <div className="absolute top-5 right-5 flex items-center gap-2 z-20">
          <button
            type="button"
            onClick={handleToggleLang}
            className="h-8 px-2.5 rounded-full border border-rk-line bg-white hover:bg-rk-page text-xs font-bold text-rk-brand shadow-xs transition flex items-center gap-1 cursor-pointer"
            title="Switch Language / ভাষা পরিবর্তন করুন"
          >
            <span className={!isBn ? "text-rk-brand font-extrabold" : "text-rk-muted"}>
              EN
            </span>
            <span className="text-rk-forest/30">|</span>
            <span className={isBn ? "text-rk-brand font-extrabold" : "text-rk-muted"}>
              BN
            </span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-rk-page hover:bg-rk-sand text-rk-muted hover:text-rk-ink flex items-center justify-center transition shadow-xs cursor-pointer"
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
          <h1 className="font-display text-2xl sm:text-[28px] font-extrabold leading-tight tracking-tight text-rk-forest">
            {isBn ? "রক্ষায় লগ ইন" : "Log in to Rokkha"}
          </h1>
          <CardDescription className="text-sm text-rk-muted font-normal">
            {isBn
              ? "উদ্ধারকারী দল, অ্যাডমিন ও নিবন্ধিত ব্যবহারকারীদের জন্য। সাহায্য চাইতে অ্যাকাউন্ট লাগে না।"
              : "For rescue teams, administrators and registered users. You do not need an account to ask for help."}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {/* shadcn Tabs for LOG IN vs REGISTER / JOIN */}
          <Tabs
            value={tab}
            onValueChange={setTab}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 w-full h-12 p-1 bg-rk-secondary rounded-xl border border-rk-line">
              <TabsTrigger
                value="login"
                className="text-xs sm:text-sm font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-rk-ink data-[state=active]:shadow-sm text-rk-muted"
              >
                {isBn ? "লগ ইন" : "Log in"}
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="text-xs sm:text-sm font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-rk-ink data-[state=active]:shadow-sm text-rk-muted"
              >
                {isBn ? "অ্যাকাউন্ট খুলুন" : "Create account"}
              </TabsTrigger>
            </TabsList>

          {/* Form Content: one form, shown as the panel of whichever tab is active (valid tab/panel pairing). */}
          <TabsContent value={tab} className="mt-5">
          {tab === "login" && DEMO_LOGINS.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2" aria-label={isBn ? "ডেমো লগ ইন" : "Demo logins"} role="group">
              {DEMO_LOGINS.map((d) => (
                <span key={d.label} className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      setTab("login");
                      setContact(d.email);
                      setPassword(d.password);
                    }}
                    className="min-h-10 rounded-lg border border-dashed border-rk-brand/50 bg-rk-brand-soft px-3 text-sm font-semibold text-rk-brand-strong hover:bg-rk-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rk-brand"
                    aria-describedby={`demo-${d.key}`}
                  >
                    {d.label} {isBn ? "(চাপলে পূরণ হবে)" : "(click to fill)"}
                  </button>
                  <span id={`demo-${d.key}`} role="tooltip" className="pointer-events-none invisible absolute left-0 top-full z-30 mt-1 w-max max-w-[18rem] rounded-lg bg-rk-forest px-3 py-2 text-left text-xs text-white shadow-lg group-hover:visible group-focus-within:visible">
                    {isBn ? "ইমেইল" : "Email"}: <span className="font-mono">{d.email}</span>
                    <br />
                    {isBn ? "পাসওয়ার্ড" : "Password"}: <span className="font-mono">{d.password}</span>
                    <br />
                    <span className="text-white/75">{isBn ? "শুধু ডেমোর জন্য (স্থানীয় প্রিভিউ)" : "Demo account (local preview only)"}</span>
                  </span>
                </span>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "register" && (
              <>
                {/* Full Name Input */}
                <div>
                  <label htmlFor="rk-auth-name" className="block text-sm font-semibold text-rk-forest mb-1.5">
                    {isBn ? "পূর্ণ নাম" : "Full name"}
                  </label>
                  <Input
                    id="rk-auth-name"
                    type="text"
                    required
                    maxLength={80}
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    
                    className="bg-white border-rk-line text-rk-ink placeholder:text-rk-muted h-11 rounded-xl focus-visible:ring-rk-brand"
                  />
                </div>
              </>
            )}

            {/* Mobile / Email Input */}
            <div>
              <label htmlFor="rk-auth-email" className="block text-sm font-semibold text-rk-forest mb-1.5">
                {isBn ? "ইমেইল" : "Email"}
              </label>
              <Input
                id="rk-auth-email"
                type="email"
                required
                autoComplete="email"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="name@example.org"
                className="bg-white border-rk-line text-rk-ink placeholder:text-rk-muted h-11 rounded-xl focus-visible:ring-rk-brand"
              />
            </div>

            {tab === "register" && (
              /* Optional: share the current GPS position so the report covers the user's own place */
              <div>
                <p className="block text-sm font-semibold text-rk-forest mb-1.5">
                  {isBn ? "আমার অবস্থান (ঐচ্ছিক)" : "My location (optional)"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUseGps}
                  disabled={isLocating}
                  className="w-full h-11 rounded-xl border-rk-line bg-white text-rk-ink hover:bg-rk-secondary text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
                >
                  <MapPin size={16} className={gpsPosition ? "text-rk-success" : "text-rk-muted"} />
                  <span>
                    {isLocating
                      ? isBn ? "অবস্থান নেওয়া হচ্ছে..." : "Reading location..."
                      : gpsPosition
                      ? `${isBn ? "অবস্থান নেওয়া হয়েছে" : "Location taken"}${gpsPlace ? `: ${gpsPlace}` : ""}`
                      : isBn ? "আমার বর্তমান অবস্থান ব্যবহার করুন" : "Use my current location"}
                  </span>
                </Button>
                <p className="mt-1.5 text-[13px] text-rk-muted leading-snug">
                  {isBn
                    ? "এটি আপনার অ্যাকাউন্টে সংরক্ষিত হয় যাতে আপনার এলাকার বন্যা প্রতিবেদন দেখানো যায়। শুধু আপনিই এটি দেখতে পারবেন, এবং পরে মুছে ফেলতে পারবেন।"
                    : "Saved with your account so the flood report can cover your own place. Only you can see it, and you can remove it later."}
                </p>
              </div>
            )}

            {/* Security Password Input */}
            <div>
              <label htmlFor="rk-auth-password" className="block text-sm font-semibold text-rk-forest mb-1.5">
                {isBn ? "পাসওয়ার্ড" : "Password"}
              </label>
              <div className="relative">
                <Input
                  id="rk-auth-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={tab === "register" ? 8 : 1}
                  maxLength={128}
                  autoComplete={tab === "register" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white border-rk-line text-rk-ink placeholder:text-rk-muted h-11 rounded-xl pr-10 focus-visible:ring-rk-brand"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 inline-flex items-center justify-center rounded-lg text-rk-muted hover:text-rk-ink transition cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </div>

            {tab === "register" && (
              <p className="-mt-2 text-[13px] text-rk-muted">
                {isBn ? "কমপক্ষে ৮ অক্ষর।" : "At least 8 characters."}
              </p>
            )}

            {formError && (
              <div
                role="alert"
                className="rounded-xl border border-rk-danger-accent/40 bg-rk-danger-soft px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-rk-danger"
              >
                {formError}
              </div>
            )}

            {isSubmitting && isSlow && (
              <p role="status" aria-live="polite" className="text-xs sm:text-sm text-rk-muted">
                {isBn
                  ? "সার্ভার চালু হচ্ছে, প্রথমবার এক মিনিট পর্যন্ত লাগতে পারে। অনুগ্রহ করে অপেক্ষা করুন..."
                  : "Waking the server up — the first sign-in can take up to a minute. Please wait..."}
              </p>
            )}

            {/* Submit Action Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-rk-brand hover:bg-rk-brand-strong text-white font-bold text-base rounded-xl transition-colors mt-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span>{tab === "register" ? (isBn ? "অ্যাকাউন্ট তৈরি হচ্ছে..." : "Creating account...") : (isBn ? "লগ ইন হচ্ছে..." : "Logging in...")}</span>
              ) : tab === "register" ? (
                <span>{isBn ? "অ্যাকাউন্ট খুলুন" : "Create account"}</span>
              ) : (
                <span>{isBn ? "লগ ইন" : "Log in"}</span>
              )}
            </Button>
          </form>
          </TabsContent>
          </Tabs>
        </CardContent>

        {/* Card Footer with Switcher and Guest Link */}
        <CardFooter className="p-0 flex flex-col items-center mt-5 pt-4 border-t border-rk-line space-y-2">
          {/* Switching between log in and create account is the tab control above (no second link here). */}
          <div>
            <button
              type="button"
              onClick={handleGuestAccess}
              className="min-h-11 text-sm font-semibold text-rk-muted hover:text-rk-forest underline underline-offset-4 transition cursor-pointer"
            >
              {isBn
                ? "অ্যাকাউন্ট ছাড়াই বন্যার মানচিত্র দেখুন"
                : "Continue to the flood map without an account"}
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
