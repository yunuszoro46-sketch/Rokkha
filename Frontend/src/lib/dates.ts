// Shared day helpers. Forecast days are ISO dates (YYYY-MM-DD) in Bangladesh time.
import { toBnNum } from "./translations";

export const dhakaToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** "19 Nov 2026" (English) or the Bangla equivalent; falls back to the input if it is not a date. */
export const formatDay = (iso: string, lang: "en" | "bn" = "en") => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const s = new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return lang === "bn" ? toBnNum(s) : s;
};
