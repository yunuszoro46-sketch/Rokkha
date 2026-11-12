"use client";

import React, { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
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
  const [tab, setTab] = useState<string>("register");
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
            Portal Access
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-[#4E5C55] font-normal">
            Access Live Flood Intelligence & Resource Dispatch
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
                LOG IN
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="text-xs sm:text-sm font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#12241C] data-[state=active]:shadow-sm text-[#5C6863]"
              >
                REGISTER / JOIN
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
                    Join as:
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
                      <span>RESCUER</span>
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
                      <span>USER</span>
                    </Button>
                  </div>
                </div>

                {/* Full Name Input */}
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

            {/* Mobile / Email Input */}
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
              /* Access Location Input */
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

            {/* Security Password Input */}
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
        </CardContent>

        {/* Card Footer with Switcher and Guest Link */}
        <CardFooter className="p-0 flex flex-col items-center mt-5 pt-4 border-t border-[#DFDDD3] space-y-2">
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
        </CardFooter>
      </Card>
    </div>
  );
}
