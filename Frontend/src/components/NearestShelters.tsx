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

interface NearestSheltersProps {
  currentCoords: { lat: number; lng: number };
  districtName: string;
}

export const NearestShelters: React.FC<NearestSheltersProps> = ({
  currentCoords,
  districtName,
}) => {
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
              <CardTitle>Nearest Flood Shelters & Healthcare Facilities</CardTitle>
            </div>
            <p className="text-base text-brand-forest/70 font-medium">
              Registered emergency shelters, clinics, and critical facilities
              within {radiusKm} km of {districtName} (
              {currentCoords.lat.toFixed(3)}°N, {currentCoords.lng.toFixed(3)}
              °E).
            </p>
          </div>

          {/* Radius selector using shadcn/ui Select */}
          <div className="flex items-center space-x-2">
            <span className="text-base text-brand-forest/70 font-medium">
              Radius:
            </span>
            <Select
              value={String(radiusKm)}
              onValueChange={(val) => setRadiusKm(Number(val))}
            >
              <SelectTrigger className="w-32 h-10">
                <SelectValue placeholder="Radius" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 km</SelectItem>
                <SelectItem value="10">10 km</SelectItem>
                <SelectItem value="25">25 km</SelectItem>
                <SelectItem value="50">50 km</SelectItem>
                <SelectItem value="100">100 km</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filter Pills using shadcn/ui Button */}
        <div className="flex flex-wrap items-center gap-2 pt-2 text-base">
          <span className="text-brand-forest/60 mr-1">Filter by type:</span>
          {["", "flood_shelter", "hospital", "clinic", "school"].map((type) => (
            <Button
              key={type}
              size="sm"
              variant={filterType === type ? "default" : "secondary"}
              onClick={() => setFilterType(type)}
            >
              {type === ""
                ? "All Types"
                : type === "flood_shelter"
                ? "Flood Shelters"
                : type.charAt(0).toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-3">
        {isLoading ? (
          <div className="py-6 text-center text-base text-brand-sage animate-pulse">
            Querying MongoDB geospatial 2dsphere index for nearby shelters...
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
                        ? `${Math.round(item.distance_meters)} m`
                        : `${item.distance_kilometers.toFixed(1)} km`}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <Badge variant="secondary" className="capitalize">
                      {item.asset.asset_type.replace("_", " ")}
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
                      {item.asset.criticality}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-base text-brand-forest/70">
                  <div className="flex items-center space-x-1.5">
                    <Users className="w-4 h-4 text-brand-forest/60" />
                    <span>
                      Capacity:{" "}
                      {item.asset.occupancy > 0
                        ? `${item.asset.occupancy.toLocaleString()} people`
                        : "Not specified"}
                    </span>
                  </div>
                  <div className="font-mono text-base text-brand-forest/50">
                    [{item.asset.location.coordinates[0].toFixed(3)},{" "}
                    {item.asset.location.coordinates[1].toFixed(3)}]
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-base text-brand-forest/60 bg-brand-warm rounded-lg border border-brand-limestone">
            No registered shelters or hospitals within {radiusKm} km of this
            coordinate. Expand the search radius above.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
