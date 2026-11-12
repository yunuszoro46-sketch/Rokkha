"use client";

import React, { useState, useEffect } from "react";
import logoAsset from "@/assets/logo.png";
import {
  LifeBuoy,
  User as UserIcon,
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

interface PortalAccessPageProps {
  isOpen?: boolean;
  onClose?: () => void;
  onLoginSuccess: () => void;
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
  const [role, setRole] = useState<"rescuer" | "user">("rescuer");
  const [fullName, setFullName] = useState("");
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Instant authentic session transition
    setTimeout(() => {
      setIsSubmitting(false);
      onLoginSuccess();
    }, 350);
  };

  const handleGuestAccess = () => {
    onLoginSuccess();
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
                {/* Join as: Role Selector with shadcn Buttons */}
                <div>
                  <label className="block text-xs font-semibold text-[#3B4740] mb-2">
                    {isBn ? "ভূমিকা নির্বাচন করুন:" : "Join as:"}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRole("rescuer")}
                      className={`h-11 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                        role === "rescuer"
                          ? "border-[#16A34A] border-2 bg-[#DCFCE7] text-[#15803D] hover:bg-[#DCFCE7] hover:text-[#15803D] shadow-sm"
                          : "border-[#DFDDD3] bg-white text-[#526058] hover:bg-[#F5F3EC]"
                      }`}
                    >
                      <LifeBuoy size={16} className={role === "rescuer" ? "text-[#16A34A]" : ""} />
                      <span>{isBn ? "উদ্ধারকারী" : "RESCUER"}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRole("user")}
                      className={`h-11 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                        role === "user"
                          ? "border-[#16A34A] border-2 bg-[#DCFCE7] text-[#15803D] hover:bg-[#DCFCE7] hover:text-[#15803D] shadow-sm"
                          : "border-[#DFDDD3] bg-white text-[#526058] hover:bg-[#F5F3EC]"
                      }`}
                    >
                      <UserIcon size={16} className={role === "user" ? "text-[#16A34A]" : ""} />
                      <span>{isBn ? "নাগরিক ব্যবহারকারী" : "USER"}</span>
                    </Button>
                  </div>
                </div>

                {/* Full Name Input */}
                <div>
                  <label className="block text-xs font-semibold text-[#3B4740] mb-1.5">
                    {isBn ? "পূর্ণ নাম" : "Full Name"}
                  </label>
                  <Input
                    type="text"
                    required
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
                {isBn ? "মোবাইল / ইমেইল" : "Mobile / Email"}
              </label>
              <Input
                type="text"
                required
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="+880 ... or email"
                className="bg-white border-[#DFDDD3] text-[#12241C] placeholder:text-[#88948D] h-11 rounded-xl focus-visible:ring-[#16A34A]"
              />
            </div>

            {tab === "register" && (
              /* Access Location Input */
              <div>
                <label className="block text-xs font-semibold text-[#3B4740] mb-1.5">
                  {isBn ? "অবস্থান / এলাকা" : "Access Location"}
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={isBn ? "জেলা / উপজেলা / গ্রাম" : "District / Sub-district / Village"}
                    className="bg-white border-[#DFDDD3] text-[#12241C] placeholder:text-[#88948D] h-11 rounded-xl pr-10 focus-visible:ring-[#16A34A]"
                  />
                  <MapPin
                    size={16}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none"
                  />
                </div>
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

            {/* Submit Action Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-base rounded-xl transition-all shadow-md mt-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span>{isBn ? "যাচাই করা হচ্ছে..." : "Authenticating..."}</span>
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
