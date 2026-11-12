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
import {
  Language,
  UI_TEXT,
  DISTRICTS_BN,
  toBnNum,
} from "../lib/translations";

interface AlertsFeedProps {
  alerts: AlertItem[];
  targetDate: string;
  isLoading: boolean;
  lang?: Language;
  onSelectDistrict: (pcode: string, name: string) => void;
}

export const AlertsFeed: React.FC<AlertsFeedProps> = ({
  alerts,
  targetDate,
  isLoading,
  lang = "en",
  onSelectDistrict,
}) => {
  const t = UI_TEXT[lang] || UI_TEXT.en;
  const isBn = lang === "bn";
  const displayDate = isBn ? toBnNum(targetDate) : targetDate;

  return (
    <Card className="border-brand-limestone bg-brand-white shadow-card">
      <CardHeader className="border-b border-brand-limestone pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <AlertOctagon className="w-6 h-6 text-brand-clay" />
            <CardTitle>
              {t.alerts_card_title} ({isBn ? toBnNum(alerts.length) : alerts.length})
            </CardTitle>
          </div>
          <Badge variant={alerts.length > 0 ? "alert" : "none"}>
            {alerts.length > 0 ? t.alerts_action_required : t.alerts_no_warnings}
          </Badge>
        </div>
        <p className="text-base text-brand-forest/70 font-medium">
          {t.alerts_card_sub.replace("{date}", displayDate)}
        </p>
      </CardHeader>

      <CardContent className="pt-5 space-y-4">
        {/* Official Warning Disclaimer using shadcn/ui Alert */}
        <Alert variant="warning">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>{t.alerts_disclaimer_title}</AlertTitle>
          <AlertDescription>
            {t.alerts_disclaimer_desc}
          </AlertDescription>
        </Alert>

        {/* Alerts List */}
        {isLoading ? (
          <div className="py-6 text-center text-base text-brand-sage animate-pulse">
            {t.alerts_checking}
          </div>
        ) : alerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map((alert) => {
              const dName = isBn
                ? DISTRICTS_BN[alert.district.pcode] || alert.district.name
                : alert.district.name;

              return (
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
                          {dName} {t.alerts_district_suffix}
                        </span>
                        <Badge
                          variant={alert.level === "alert" ? "alert" : "watch"}
                          className="uppercase tracking-wide"
                        >
                          {alert.level === "alert"
                            ? isBn ? "জরুরি অ্যালার্ট" : "ALERT"
                            : isBn ? "নজরদারি" : "WATCH"}
                        </Badge>
                      </div>
                      <p className="text-base text-brand-forest/80 font-normal leading-relaxed">
                        {alert.message}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-base text-brand-forest/60 uppercase font-semibold">
                        {t.alerts_likelihood}
                      </div>
                      <div className="text-2xl font-black text-brand-clay">
                        {isBn
                          ? toBnNum(formatProbability(alert.probability))
                          : formatProbability(alert.probability)}
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
                              {isBn
                                ? toBnNum(alert.assets_at_risk.total.assets)
                                : alert.assets_at_risk.total.assets}{" "}
                              {t.alerts_registered_assets}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5 font-medium">
                            <Users className="w-4 h-4 text-brand-forest" />
                            <span>
                              ~
                              {isBn
                                ? toBnNum(alert.assets_at_risk.total.occupancy.toLocaleString())
                                : alert.assets_at_risk.total.occupancy.toLocaleString()}{" "}
                              {t.alerts_people_served}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-lg bg-brand-warm border border-brand-limestone text-center space-y-2">
            <CheckCircle2 className="w-6 h-6 text-brand-sage mx-auto" />
            <div className="text-2xl font-bold text-brand-forest">
              {t.alerts_none_title.replace("{date}", displayDate)}
            </div>
            <p className="text-base text-brand-forest/60">
              {t.alerts_none_sub}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
