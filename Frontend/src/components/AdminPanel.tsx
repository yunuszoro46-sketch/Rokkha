"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Language, DISTRICTS_BN, toBnNum } from "../lib/translations";
import { AccountUser, Role } from "../services/auth";
import { createAsset, deleteAsset, listDistrictAssets, listUsers, setUserRole } from "../services/rescue";
import { RegisteredAsset } from "../types/api";

interface AdminPanelProps {
  user: AccountUser | null;
  lang?: Language;
  onOpenLogin: () => void;
  /** The district chosen in the page's district box. */
  districtPcode: string;
  districtName: string;
  /** A point picked on the map (Flood Map page), offered for a new place. */
  pickedPoint: { lat: number; lng: number } | null;
}

const ASSET_TYPES = ["flood_shelter", "hospital", "clinic", "school", "other"];
const ROLES: Role[] = ["user", "rescuer", "admin"];

/**
 * Admin tools: who has which role, and the registered places. Only accounts
 * with the role "admin" get data: the backend refuses everyone else.
 */
export const AdminPanel: React.FC<AdminPanelProps> = ({
  user,
  lang = "en",
  onOpenLogin,
  districtPcode,
  districtName,
  pickedPoint,
}) => {
  const isBn = lang === "bn";
  const tr = (en: string, bn: string) => (isBn ? bn : en);
  const num = (value: number | string) => (isBn ? toBnNum(value) : String(value));
  const isAdmin = user?.role === "admin";

  const [users, setUsers] = useState<AccountUser[] | null>(null);
  const [assets, setAssets] = useState<RegisteredAsset[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("flood_shelter");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [capacity, setCapacity] = useState("");

  const fail = (error: unknown) => {
    setNotice(null);
    setProblem((error as Error).message || "Something went wrong.");
  };

  const loadUsers = useCallback(() => {
    if (!isAdmin) return;
    listUsers().then(setUsers).catch(fail);
  }, [isAdmin]);

  const loadAssets = useCallback(() => {
    if (!isAdmin) return;
    setAssets(null);
    listDistrictAssets(districtPcode).then(setAssets).catch(fail);
  }, [isAdmin, districtPcode]);

  useEffect(loadUsers, [loadUsers]);
  useEffect(loadAssets, [loadAssets]);

  useEffect(() => {
    if (pickedPoint) {
      setLatitude(pickedPoint.lat.toFixed(5));
      setLongitude(pickedPoint.lng.toFixed(5));
    }
  }, [pickedPoint]);

  if (!isAdmin) {
    return (
      <Card className="border-[#DFDDD3] bg-white rounded-3xl shadow-sm">
        <CardContent className="p-8 text-center space-y-3">
          <div className="text-xl font-extrabold text-[#12241C]">{tr("This page is for admins.", "এই পাতাটি অ্যাডমিনদের জন্য।")}</div>
          <p className="text-sm text-[#5C6863]">
            {user
              ? tr("Your account does not have the admin role.", "আপনার অ্যাকাউন্টে অ্যাডমিনের ভূমিকা নেই।")
              : tr("Log in with an admin account.", "অ্যাডমিন অ্যাকাউন্ট দিয়ে লগইন করুন।")}
          </p>
          {!user && (
            <Button onClick={onOpenLogin} className="bg-[#122B1E] hover:bg-[#0C1F15] text-white font-bold rounded-xl">
              {tr("Log in", "লগইন")}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const changeRole = async (target: AccountUser, role: Role) => {
    try {
      await setUserRole(target.id, role);
      setProblem(null);
      setNotice(tr(`${target.email} is now: ${role}`, `${target.email} এখন: ${role}`));
      loadUsers();
    } catch (error) {
      fail(error);
    }
  };

  const addPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createAsset({
        name: name.trim(),
        asset_type: assetType,
        lat: Number(latitude),
        lng: Number(longitude),
        // A fixed rule, the same as for imported places: hospitals critical, the rest high.
        criticality: assetType === "hospital" ? "critical" : "high",
        occupancy: capacity.trim() ? Number(capacity) : null,
      });
      setProblem(null);
      setNotice(tr(`Added: ${created.name}`, `যোগ করা হয়েছে: ${created.name}`));
      setName("");
      setCapacity("");
      loadAssets();
    } catch (error) {
      fail(error);
    }
  };

  const removePlace = async (asset: RegisteredAsset) => {
    if (!window.confirm(tr(`Delete "${asset.name}"? This cannot be undone.`, `"${asset.name}" মুছবেন? এটি ফেরানো যাবে না।`))) return;
    try {
      await deleteAsset(asset.id);
      setProblem(null);
      setNotice(tr(`Deleted: ${asset.name}`, `মুছে ফেলা হয়েছে: ${asset.name}`));
      loadAssets();
    } catch (error) {
      fail(error);
    }
  };

  const district = isBn ? DISTRICTS_BN[districtPcode] || districtName : districtName;

  return (
    <div className="space-y-5">
      {problem && (
        <div role="alert" className="rounded-xl border border-[#FCA5A5] bg-[#FEE2E2] px-3.5 py-2.5 text-sm font-semibold text-[#991B1B]">
          {problem}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-[#86EFAC] bg-[#DCFCE7] px-3.5 py-2.5 text-sm font-semibold text-[#166534]">
          {notice}
        </div>
      )}

      <Card className="border-[#DFDDD3] bg-white rounded-3xl shadow-sm overflow-hidden">
        <CardHeader className="px-5 sm:px-6 py-4 border-b border-[#EBE8DC]">
          <CardTitle className="text-xl font-extrabold text-[#12241C]">
            {tr("Accounts and roles", "অ্যাকাউন্ট ও ভূমিকা")} {users ? `(${num(users.length)})` : ""}
          </CardTitle>
          <p className="text-xs text-[#5C6863] mt-1">
            {tr(
              "user: sees forecasts and can ask for help. rescuer: also sees and handles requests for help. admin: also manages roles and places. You cannot change your own role.",
              "user: পূর্বাভাস দেখেন ও সাহায্য চাইতে পারেন। rescuer: সাহায্যের অনুরোধও দেখেন ও সামলান। admin: ভূমিকা ও স্থানও পরিচালনা করেন। নিজের ভূমিকা নিজে বদলানো যায় না।"
            )}
          </p>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 space-y-2">
          {!users ? (
            <div className="py-6 text-center text-sm text-[#5C6863] animate-pulse">{tr("Loading accounts...", "অ্যাকাউন্ট আনা হচ্ছে...")}</div>
          ) : (
            users.map((account) => (
              <div key={account.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#EDEBE2] px-3.5 py-2.5">
                <div className="text-sm text-[#12241C]">
                  <span className="font-bold">{account.name}</span> · {account.email}
                  {account.district ? ` · ${account.district.name}` : ""}
                </div>
                <select
                  value={account.role}
                  disabled={account.id === user!.id}
                  onChange={(e) => changeRole(account, e.target.value as Role)}
                  className="h-9 rounded-lg border border-[#DFDDD3] bg-white px-2 text-sm font-semibold disabled:opacity-60"
                  aria-label={tr(`Role of ${account.email}`, `${account.email} এর ভূমিকা`)}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-[#DFDDD3] bg-white rounded-3xl shadow-sm overflow-hidden">
        <CardHeader className="px-5 sm:px-6 py-4 border-b border-[#EBE8DC]">
          <CardTitle className="text-xl font-extrabold text-[#12241C]">{tr("Add a place", "একটি স্থান যোগ করুন")}</CardTitle>
          <p className="text-xs text-[#5C6863] mt-1">
            {tr(
              "Only add places you know exist. Coordinates in decimal degrees; a point picked on the Flood Map page is filled in for you.",
              "শুধু সেই স্থান যোগ করুন যা সত্যিই আছে বলে জানেন। স্থানাঙ্ক দশমিক ডিগ্রিতে; বন্যা মানচিত্র পাতায় বেছে নেওয়া বিন্দু এখানে বসে যায়।"
            )}
          </p>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          <form onSubmit={addPlace} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input required minLength={2} maxLength={150} value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Name", "নাম")} className="h-10 rounded-xl sm:col-span-2" />
            <select value={assetType} onChange={(e) => setAssetType(e.target.value)} className="h-10 rounded-xl border border-[#DFDDD3] bg-white px-3 text-sm">
              {ASSET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <Input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder={tr("People it holds (if known)", "ধারণক্ষমতা (জানা থাকলে)")} className="h-10 rounded-xl" />
            <Input required type="number" step="any" min={20} max={27} value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder={tr("Latitude, e.g. 24.8474", "অক্ষাংশ, যেমন 24.8474")} className="h-10 rounded-xl" />
            <Input required type="number" step="any" min={88} max={93} value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder={tr("Longitude, e.g. 91.1428", "দ্রাঘিমাংশ, যেমন 91.1428")} className="h-10 rounded-xl" />
            <Button type="submit" className="sm:col-span-2 h-10 bg-[#122B1E] hover:bg-[#0C1F15] text-white font-bold rounded-xl">
              {tr("Add place", "স্থান যোগ করুন")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-[#DFDDD3] bg-white rounded-3xl shadow-sm overflow-hidden">
        <CardHeader className="px-5 sm:px-6 py-4 border-b border-[#EBE8DC]">
          <CardTitle className="text-xl font-extrabold text-[#12241C]">
            {tr(`Registered places in ${district}`, `${district} জেলার নিবন্ধিত স্থান`)} {assets ? `(${num(assets.length)})` : ""}
          </CardTitle>
          <p className="text-xs text-[#5C6863] mt-1">
            {tr(
              "Choose another district in the box above. Places marked OpenStreetMap were imported and are not checked on the ground (© OpenStreetMap contributors).",
              "ওপরের বাক্সে অন্য জেলা বেছে নিন। OpenStreetMap চিহ্নিত স্থানগুলো আমদানি করা, সরেজমিনে যাচাই করা নয় (© OpenStreetMap contributors)।"
            )}
          </p>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 space-y-2 max-h-[520px] overflow-y-auto">
          {!assets ? (
            <div className="py-6 text-center text-sm text-[#5C6863] animate-pulse">{tr("Loading places...", "স্থান আনা হচ্ছে...")}</div>
          ) : assets.length === 0 ? (
            <div className="py-6 text-center text-sm text-[#5C6863]">{tr("No registered places in this district.", "এই জেলায় কোনো নিবন্ধিত স্থান নেই।")}</div>
          ) : (
            assets.map((asset) => (
              <div key={asset.id} className="flex items-center justify-between gap-2 rounded-xl border border-[#EDEBE2] px-3.5 py-2">
                <div className="text-sm text-[#12241C] min-w-0">
                  <span className="font-bold">{asset.name}</span>{" "}
                  <span className="text-[#5C6863]">
                    · {asset.asset_type.replace(/_/g, " ")} · {asset.source || tr("added by an admin", "অ্যাডমিন যোগ করেছেন")}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => removePlace(asset)} className="h-8 px-2 rounded-lg text-[#991B1B] shrink-0" aria-label={tr(`Delete ${asset.name}`, `${asset.name} মুছুন`)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
