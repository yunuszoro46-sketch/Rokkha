import React from "react";
import { AlertItem } from "../types/api";
import { formatProbability } from "../lib/utils";
import { Badge } from "./ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { Separator } from "./ui/separator";
import {
  ShieldAlert,
  Building2,
  Users,
  AlertOctagon,
  CheckCircle2,
} from "lucide-react";

interface AlertsFeedProps {
  alerts: AlertItem[];
  targetDate: string;
  isLoading: boolean;
  onSelectDistrict: (pcode: string, name: string) => void;
}

export const AlertsFeed: React.FC<AlertsFeedProps> = ({
  alerts,
  targetDate,
  isLoading,
  onSelectDistrict,
}) => {
  return (
    <Card className="border-brand-limestone bg-brand-white shadow-card">
      <CardHeader className="border-b border-brand-limestone pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <AlertOctagon className="w-6 h-6 text-brand-clay" />
            <CardTitle>
              District Flood Early Warnings ({alerts.length})
            </CardTitle>
          </div>
          <Badge variant={alerts.length > 0 ? "alert" : "none"}>
            {alerts.length > 0 ? "Action Required" : "No High-Level Warnings"}
          </Badge>
        </div>
        <p className="text-base text-brand-forest/70 font-medium">
          Districts where 24h satellite-observable flood probability exceeds
          watch or alert thresholds for {targetDate}.
        </p>
      </CardHeader>

      <CardContent className="pt-5 space-y-4">
        {/* Official Warning Disclaimer using shadcn/ui Alert */}
        <Alert variant="warning">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>Public Advisory & Institutional Limitation</AlertTitle>
          <AlertDescription>
            These alerts are machine learning estimations derived from
            precipitation and satellite backscatter.{" "}
            <strong>They are NOT official flood warnings.</strong> Official
            government flood forecasts and evacuation directives are issued
            exclusively by the Flood Forecasting and Warning Centre (FFWC) and
            Bangladesh Water Development Board (BWDB).
          </AlertDescription>
        </Alert>

        {/* Alerts List */}
        {isLoading ? (
          <div className="py-6 text-center text-base text-brand-sage animate-pulse">
            Checking district early warnings...
          </div>
        ) : alerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map((alert) => (
              <Card
                key={alert.alert_id}
                className="p-5 border-brand-limestone bg-brand-warm hover:border-brand-forest/40 transition shadow-sm space-y-3 cursor-pointer"
                onClick={() =>
                  onSelectDistrict(alert.district.pcode, alert.district.name)
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-2xl text-brand-forest">
                        {alert.district.name} District
                      </span>
                      <Badge
                        variant={alert.level === "alert" ? "alert" : "watch"}
                        className="uppercase tracking-wide"
                      >
                        {alert.level === "alert" ? "ALERT" : "WATCH"}
                      </Badge>
                    </div>
                    <p className="text-base text-brand-forest/80 font-normal leading-relaxed">
                      {alert.message}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-base text-brand-forest/60 uppercase font-semibold">
                      Likelihood
                    </div>
                    <div className="text-2xl font-black text-brand-clay">
                      {formatProbability(alert.probability)}
                    </div>
                  </div>
                </div>

                {/* Assets at Risk in Alerted District */}
                {alert.assets_at_risk &&
                  alert.assets_at_risk.total.assets > 0 && (
                    <div className="space-y-2">
                      <Separator />
                      <div className="flex flex-wrap items-center gap-4 text-base text-brand-forest/80">
                        <div className="flex items-center space-x-1.5 font-medium">
                          <Building2 className="w-4 h-4 text-brand-forest" />
                          <span>
                            {alert.assets_at_risk.total.assets} registered
                            critical assets
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5 font-medium">
                          <Users className="w-4 h-4 text-brand-forest" />
                          <span>
                            ~
                            {alert.assets_at_risk.total.occupancy.toLocaleString()}{" "}
                            people sheltered/served
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-lg bg-brand-warm border border-brand-limestone text-center space-y-2">
            <CheckCircle2 className="w-6 h-6 text-brand-sage mx-auto" />
            <div className="text-2xl font-bold text-brand-forest">
              No Districts Exceeded Alert Thresholds for {targetDate}
            </div>
            <p className="text-base text-brand-forest/60">
              Note: This indicates none of the 64 districts triggered the ML
              alert model on this date. It does not guarantee absence of
              localized waterlogging.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
