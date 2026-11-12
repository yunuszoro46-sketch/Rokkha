"use client";

import React, { useState } from "react";
import {
  Shield,
  LifeBuoy,
  User,
  MapPin,
  Eye,
  EyeOff,
  ArrowRight,
  X,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Language, UI_TEXT } from "@/lib/translations";

interface PortalAccessPageProps {
  isOpen?: boolean;
  onClose?: () => void;
  onLoginSuccess: () => void;
  lang?: Language;
}

export function PortalAccessPage({
  isOpen = true,
  onClose,
  onLoginSuccess,
  lang = "en",
}: PortalAccessPageProps) {
  const [tab, setTab] = useState<"login" | "register">("register");
  const [role, setRole] = useState<"rescuer" | "user">("rescuer");
  const [fullName, setFullName] = useState("");
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate instantaneous local auth session
    setTimeout(() => {
      setIsSubmitting(false);
      onLoginSuccess();
    }, 400);
  };

  const handleGuestAccess = () => {
    onLoginSuccess();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Background Image: Satellite Flood Radar with Street Flow */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 scale-105"
        style={{
          backgroundImage: "url('/satellite-flood-bg.jpg')",
        }}
      />
      {/* Dark Translucent Backdrop Overlay */}
      <div className="fixed inset-0 bg-[#06140E]/75 backdrop-blur-[4px]" />

      {/* Main Glassmorphic Portal Access Card */}
      <div className="relative z-10 w-full max-w-[490px] my-auto bg-[#13261C]/90 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-white animate-in fade-in zoom-in-95 duration-200">
        {/* Optional Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition"
            aria-label="Close portal modal"
          >
            <X size={16} />
          </button>
        )}

        {/* Rokkha Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-8 h-8 rounded-lg bg-[#2E5E44] border border-[#4ADE80]/40 flex items-center justify-center text-[#4ADE80] shadow-md">
              <Shield size={19} className="fill-[#4ADE80]/20" />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-white">
              Rokkha
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Portal Access
          </h2>
          <p className="text-xs sm:text-sm text-gray-300/90 mt-1">
            Access Live Flood Intelligence & Resource Dispatch
          </p>
        </div>

        {/* Tab Switcher: LOG IN vs REGISTER / JOIN */}
        <div className="grid grid-cols-2 p-1 bg-black/40 rounded-xl border border-white/10 mb-5">
          <button
            type="button"
            onClick={() => setTab("login")}
            className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
              tab === "login"
                ? "bg-[#284234] text-white shadow-sm border border-white/10"
                : "text-gray-400 hover:text-white"
            }`}
          >
            LOG IN
          </button>
          <button
            type="button"
            onClick={() => setTab("register")}
            className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
              tab === "register"
                ? "bg-[#284234] text-white shadow-sm border border-white/10"
                : "text-gray-400 hover:text-white"
            }`}
          >
            REGISTER / JOIN
          </button>
        </div>

        {/* Portal Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "register" && (
            <>
              {/* Join as: Role Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2">
                  Join as:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("rescuer")}
                    className={`py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                      role === "rescuer"
                        ? "border-[#4ADE80] bg-[#1F4532] text-white shadow-[0_0_15px_rgba(74,222,128,0.25)]"
                        : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
                    }`}
                  >
                    <LifeBuoy size={16} className={role === "rescuer" ? "text-[#4ADE80]" : ""} />
                    <span>RESCUER</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("user")}
                    className={`py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                      role === "user"
                        ? "border-[#4ADE80] bg-[#1F4532] text-white shadow-[0_0_15px_rgba(74,222,128,0.25)]"
                        : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
                    }`}
                  >
                    <User size={16} className={role === "user" ? "text-[#4ADE80]" : ""} />
                    <span>USER</span>
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Full Name
                </label>
                <Input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name"
                  className="bg-[#183225]/80 border-white/15 text-white placeholder:text-gray-400 h-11 rounded-xl focus-visible:ring-[#4ADE80]"
                />
              </div>
            </>
          )}

          {/* Mobile / Email */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Mobile / Email
            </label>
            <Input
              type="text"
              required
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="+880 ... or email"
              className="bg-[#183225]/80 border-white/15 text-white placeholder:text-gray-400 h-11 rounded-xl focus-visible:ring-[#4ADE80]"
            />
          </div>

          {tab === "register" && (
            /* Access Location */
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Access Location
              </label>
              <div className="relative">
                <Input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="District / Sub-district / Village"
                  className="bg-[#183225]/80 border-white/15 text-white placeholder:text-gray-400 h-11 rounded-xl pr-10 focus-visible:ring-[#4ADE80]"
                />
                <MapPin
                  size={16}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            </div>
          )}

          {/* Security Password */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Security Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Security Password"
                className="bg-[#183225]/80 border-white/15 text-white placeholder:text-gray-400 h-11 rounded-xl pr-10 focus-visible:ring-[#4ADE80]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
              >
                {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Action Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-base rounded-xl transition-all shadow-lg hover:shadow-[#16A34A]/30 mt-2"
          >
            {isSubmitting ? (
              <span>Authenticating...</span>
            ) : tab === "register" ? (
              <span>Register & Access</span>
            ) : (
              <span>Log In & Access</span>
            )}
          </Button>
        </form>

        {/* Footer Switcher & Guest Link */}
        <div className="mt-5 pt-4 border-t border-white/10 text-center space-y-2">
          <p className="text-xs text-gray-300">
            {tab === "register" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setTab("login")}
                  className="text-[#4ADE80] font-bold hover:underline"
                >
                  Log In
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setTab("register")}
                  className="text-[#4ADE80] font-bold hover:underline"
                >
                  Register
                </button>
              </>
            )}
          </p>
          <div>
            <button
              type="button"
              onClick={handleGuestAccess}
              className="text-xs font-semibold text-gray-400 hover:text-white underline underline-offset-4 transition"
            >
              Access Public Guest Map (No login needed)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
