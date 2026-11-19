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
// const DEMO_LOGINS = [
//   { key: "rescuer", label: "Rescue team demo", raw: process.env.NEXT_PUBLIC_DEMO_RESCUER },
//   { key: "admin", label: "Admin demo", raw: process.env.NEXT_PUBLIC_DEMO_ADMIN },
// ]
//   .filter((d) => d.raw && d.raw.includes("|"))
//   .map((d) => ({ key: d.key, label: d.label, email: d.raw!.split("|")[0], password: d.raw!.slice(d.raw!.indexOf("|") + 1) }));

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

    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto  pt-16">
      {/* Calm earth background (design system: Earth & Emerald) */}
      <div className="fixed inset-0 bg-grad-earth" />

      <Card className="relative z-10 w-full max-w-[460px] shrink-0 mx-auto my-auto bg-rk-surface border-rk-line rounded-3xl p-6 sm:p-8 shadow-[var(--rk-shadow-float)] text-rk-ink">
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

            {/* Form Content */}
            <TabsContent value={tab} className="mt-5">
              <form onSubmit={handleSubmit} className="space-y-4">

                {tab === "register" && (
                  <>
                    {/* Full Name Input */}
                    <div>
                      <label
                        htmlFor="rk-auth-name"
                        className="block text-sm font-semibold text-rk-forest mb-1.5"
                      >
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

                {/* Email Input */}
                <div>
                  <label
                    htmlFor="rk-auth-email"
                    className="block text-sm font-semibold text-rk-forest mb-1.5"
                  >
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

                {/* Security Password Input */}
                <div>
                  <label
                    htmlFor="rk-auth-password"
                    className="block text-sm font-semibold text-rk-forest mb-1.5"
                  >
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

                {/* Form Error */}
                {formError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-rk-danger-accent/40 bg-rk-danger-soft px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-rk-danger"
                  >
                    {formError}
                  </div>
                )}

                {/* Server Loading Message */}
                {isSubmitting && isSlow && (
                  <p
                    role="status"
                    aria-live="polite"
                    className="text-xs sm:text-sm text-rk-muted"
                  >
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
                    <span>
                      {tab === "register"
                        ? (isBn ? "অ্যাকাউন্ট তৈরি হচ্ছে..." : "Creating account...")
                        : (isBn ? "লগ ইন হচ্ছে..." : "Logging in...")}
                    </span>
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

        {/* Card Footer with Guest Link */}
        <CardFooter className="p-0 flex flex-col items-center mt-5 pt-4 border-t border-rk-line space-y-2">
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
