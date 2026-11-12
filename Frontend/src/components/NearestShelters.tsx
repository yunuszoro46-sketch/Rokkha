"use client";

import React, { useState, useEffect } from "react";
import { AssetNearResult } from "../types/api";
import { getNearestAssets } from "../services/api";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import { LifeBuoy, Users } from "lucide-react";
import {
  Language,
  UI_TEXT,
  DISTRICTS_BN,
  toBnNum,
} from "../lib/translations";

interface NearestSheltersProps {
  currentCoords: { lat: number; lng: number };
  districtName: string;
  lang?: Language;
}

export const NearestShelters: React.FC<NearestSheltersProps> = ({
  currentCoords,
  districtName,
  lang = "en",
}) => {
  const t = UI_TEXT[lang] || UI_TEXT.en;
  const isBn = lang === "bn";
  const displayDistrict = isBn
    ? Object.entries(DISTRICTS_BN).find(([_, name]) => name === districtName)?.[1] || districtName
    : districtName;
  const coordsStr = `${isBn ? toBnNum(currentCoords.lat.toFixed(3)) : currentCoords.lat.toFixed(3)}°N, ${isBn ? toBnNum(currentCoords.lng.toFixed(3)) : currentCoords.lng.toFixed(3)}°E`;

  const [assets, setAssets] = useState<AssetNearResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("");
  const [radiusKm, setRadiusKm] = useState<number>(25);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    getNearestAssets(
      currentCoords.lng,
      currentCoords.lat,
      radiusKm * 1000,
      filterType || undefined
    ).then((res) => {
      if (!mounted) return;
      setIsLoading(false);
      setAssets(res || []);
    });

    return () => {
      mounted = false;
    };
  }, [currentCoords, radiusKm, filterType]);

  return (
    <Card className="border-brand-limestone bg-brand-white shadow-card" id="shelters">
      <CardHeader className="border-b border-brand-limestone pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <LifeBuoy className="w-6 h-6 text-brand-forest" />
              <CardTitle>{t.shelters_card_title}</CardTitle>
            </div>
            <p className="text-base text-brand-forest/70 font-medium">
              {t.shelters_card_sub
                .replace("{radius}", isBn ? toBnNum(radiusKm) : String(radiusKm))
                .replace("{district}", displayDistrict)
                .replace("{coords}", coordsStr)}
            </p>
          </div>

          {/* Radius selector using shadcn/ui Select */}
          <div className="flex items-center space-x-2">
            <span className="text-base text-brand-forest/70 font-medium">
              {t.shelters_radius_label}
            </span>
            <Select
              value={String(radiusKm)}
              onValueChange={(val) => setRadiusKm(Number(val))}
            >
              <SelectTrigger className="w-32 h-10">
                <SelectValue placeholder={t.shelters_radius_label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">{isBn ? "৫ কিমি" : "5 km"}</SelectItem>
                <SelectItem value="10">{isBn ? "১০ কিমি" : "10 km"}</SelectItem>
                <SelectItem value="25">{isBn ? "২৫ কিমি" : "25 km"}</SelectItem>
                <SelectItem value="50">{isBn ? "৫০ কিমি" : "50 km"}</SelectItem>
                <SelectItem value="100">{isBn ? "১০০ কিমি" : "100 km"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filter Pills using shadcn/ui Button */}
        <div className="flex flex-wrap items-center gap-2 pt-2 text-base">
          <span className="text-brand-forest/60 mr-1">{t.shelters_filter_label}</span>
          {[
            { id: "", label: t.shelters_type_all },
            { id: "flood_shelter", label: t.shelters_type_flood },
            { id: "hospital", label: t.shelters_type_hospital },
            { id: "clinic", label: t.shelters_type_clinic },
            { id: "school", label: t.shelters_type_school },
          ].map((type) => (
            <Button
              key={type.id}
              size="sm"
              variant={filterType === type.id ? "default" : "secondary"}
              onClick={() => setFilterType(type.id)}
            >
              {type.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-3">
        {isLoading ? (
          <div className="py-6 text-center text-base text-brand-sage animate-pulse">
            {t.shelters_loading}
          </div>
        ) : assets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assets.map((item) => (
              <Card
                key={item.asset.id}
                className="p-4 border-brand-limestone bg-brand-warm flex flex-col justify-between space-y-3 hover:border-brand-forest/30 transition shadow-sm"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-2xl text-brand-forest">
                      {item.asset.name}
                    </h4>
                    <Badge variant="watch" className="whitespace-nowrap">
                      {item.distance_kilometers < 1
                        ? `${isBn ? toBnNum(Math.round(item.distance_meters)) : Math.round(item.distance_meters)} ${isBn ? "মিটার" : "m"}`
                        : `${isBn ? toBnNum(item.distance_kilometers.toFixed(1)) : item.distance_kilometers.toFixed(1)} ${isBn ? "কিমি" : "km"}`}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <Badge variant="secondary" className="capitalize">
                      {item.asset.asset_type === "flood_shelter"
                        ? isBn ? "বন্যা আশ্রয়কেন্দ্র" : "Flood Shelter"
                        : item.asset.asset_type === "hospital"
                        ? isBn ? "হাসপাতাল" : "Hospital"
                        : item.asset.asset_type === "clinic"
                        ? isBn ? "ক্লিনিক" : "Clinic"
                        : item.asset.asset_type === "school"
                        ? isBn ? "বিদ্যালয়" : "School"
                        : item.asset.asset_type.replace("_", " ")}
                    </Badge>
                    <Badge
                      variant={
                        item.asset.criticality === "critical"
                          ? "alert"
                          : item.asset.criticality === "high"
                          ? "watch"
                          : "outline"
                      }
                      className="capitalize"
                    >
                      {item.asset.criticality === "critical"
                        ? isBn ? "জরুরি" : "Critical"
                        : item.asset.criticality === "high"
                        ? isBn ? "উচ্চ অগ্রাধিকার" : "High"
                        : isBn ? "সাধারণ" : item.asset.criticality}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-base text-brand-forest/70">
                  <div className="flex items-center space-x-1.5">
                    <Users className="w-4 h-4 text-brand-forest/60" />
                    <span>
                      {t.shelters_capacity}{" "}
                      {item.asset.occupancy > 0
                        ? `${isBn ? toBnNum(item.asset.occupancy.toLocaleString()) : item.asset.occupancy.toLocaleString()} ${t.shelters_people}`
                        : t.shelters_not_specified}
                    </span>
                  </div>
                  <div className="font-mono text-base text-brand-forest/50">
                    [{isBn ? toBnNum(item.asset.location.coordinates[0].toFixed(3)) : item.asset.location.coordinates[0].toFixed(3)},{" "}
                    {isBn ? toBnNum(item.asset.location.coordinates[1].toFixed(3)) : item.asset.location.coordinates[1].toFixed(3)}]
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-base text-brand-forest/60 bg-brand-warm rounded-lg border border-brand-limestone">
            {t.shelters_empty.replace(
              "{radius}",
              isBn ? toBnNum(radiusKm) : String(radiusKm)
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
