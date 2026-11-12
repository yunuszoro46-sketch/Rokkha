"use client";

import React, { useState } from "react";
import {
  Shield,
  LifeBuoy,
  User,
  MapPin,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Language } from "@/lib/translations";

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
    // Instant local authentication
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
      {/* Background Image: Satellite Flood Radar with Street Flow */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 scale-105"
        style={{
          backgroundImage: "url('/satellite-flood-bg.jpg')",
        }}
      />
      {/* Backdrop Overlay */}
      <div className="fixed inset-0 bg-[#06140E]/60 backdrop-blur-[3px]" />

      {/* Main Form Card - Warm Cream Color (#EDEBE2) matching User Reference Image 2 */}
      <div className="relative z-10 w-full max-w-[490px] my-auto bg-[#EDEBE2] border border-[#D5D2C5] rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.45)] text-[#12241C] animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#DFDDD3] hover:bg-[#D5D2C5] text-[#3E4D45] hover:text-[#12241C] flex items-center justify-center transition shadow-sm"
            aria-label="Close portal modal"
          >
            <X size={16} />
          </button>
        )}

        {/* Rokkha Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-8 h-8 rounded-lg bg-[#D8EADB] border border-[#23583A]/30 flex items-center justify-center text-[#1E5638] shadow-sm">
              <Shield size={19} className="fill-[#23583A]/20" />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-[#12241C]">
              Rokkha
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#12241C] tracking-tight">
            Portal Access
          </h2>
          <p className="text-xs sm:text-sm text-[#4E5C55] mt-1">
            Access Live Flood Intelligence & Resource Dispatch
          </p>
        </div>

        {/* Tab Switcher: LOG IN vs REGISTER / JOIN */}
        <div className="grid grid-cols-2 p-1 bg-[#DFDDD3] rounded-xl border border-[#D0CDC0] mb-5">
          <button
            type="button"
            onClick={() => setTab("login")}
            className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
              tab === "login"
                ? "bg-white text-[#12241C] shadow-sm"
                : "text-[#5C6863] hover:text-[#12241C]"
            }`}
          >
            LOG IN
          </button>
          <button
            type="button"
            onClick={() => setTab("register")}
            className={`py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
              tab === "register"
                ? "bg-white text-[#12241C] shadow-sm"
                : "text-[#5C6863] hover:text-[#12241C]"
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
                <label className="block text-xs font-semibold text-[#3B4740] mb-2">
                  Join as:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("rescuer")}
                    className={`py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                      role === "rescuer"
                        ? "border-[#16A34A] bg-[#DCFCE7] text-[#15803D] shadow-sm"
                        : "border-[#DFDDD3] bg-white text-[#526058] hover:bg-[#F5F3EC]"
                    }`}
                  >
                    <LifeBuoy size={16} className={role === "rescuer" ? "text-[#16A34A]" : ""} />
                    <span>RESCUER</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("user")}
                    className={`py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                      role === "user"
                        ? "border-[#16A34A] bg-[#DCFCE7] text-[#15803D] shadow-sm"
                        : "border-[#DFDDD3] bg-white text-[#526058] hover:bg-[#F5F3EC]"
                    }`}
                  >
                    <User size={16} className={role === "user" ? "text-[#16A34A]" : ""} />
                    <span>USER</span>
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-[#3B4740] mb-1.5">
                  Full Name
                </label>
                <Input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name"
                  className="bg-white border-[#DFDDD3] text-[#12241C] placeholder:text-[#88948D] h-11 rounded-xl focus-visible:ring-[#16A34A]"
                />
              </div>
            </>
          )}

          {/* Mobile / Email */}
          <div>
            <label className="block text-xs font-semibold text-[#3B4740] mb-1.5">
              Mobile / Email
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
            /* Access Location */
            <div>
              <label className="block text-xs font-semibold text-[#3B4740] mb-1.5">
                Access Location
              </label>
              <div className="relative">
                <Input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="District / Sub-district / Village"
                  className="bg-white border-[#DFDDD3] text-[#12241C] placeholder:text-[#88948D] h-11 rounded-xl pr-10 focus-visible:ring-[#16A34A]"
                />
                <MapPin
                  size={16}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none"
                />
              </div>
            </div>
          )}

          {/* Security Password */}
          <div>
            <label className="block text-xs font-semibold text-[#3B4740] mb-1.5">
              Security Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Security Password"
                className="bg-white border-[#DFDDD3] text-[#12241C] placeholder:text-[#88948D] h-11 rounded-xl pr-10 focus-visible:ring-[#16A34A]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#12241C] transition"
              >
                {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Action Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-base rounded-xl transition-all shadow-md mt-2"
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
        <div className="mt-5 pt-4 border-t border-[#DFDDD3] text-center space-y-2">
          <p className="text-xs text-[#526058]">
            {tab === "register" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setTab("login")}
                  className="text-[#16A34A] font-bold hover:underline"
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
                  className="text-[#16A34A] font-bold hover:underline"
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
              className="text-xs font-semibold text-[#4B5563] hover:text-[#111827] underline underline-offset-4 transition"
            >
              Access Public Guest Map (No login needed)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
