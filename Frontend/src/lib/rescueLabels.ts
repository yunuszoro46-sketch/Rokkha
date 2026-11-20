// Words for rescue requests, shared by the citizen form (SosCenter) and the
// teams' board (RescuePanel). English first, Bangla second.

import { Need, ReleaseReason, SosStatus, Vulnerable } from "../services/rescue";

export type Words = { en: string; bn: string };

export const NEED_LABEL: Record<Need, Words> = {
  food_water: { en: "Food and drinking water", bn: "খাবার ও খাবার পানি" },
  medical: { en: "Medical help", bn: "চিকিৎসা সহায়তা" },
  house_danger: { en: "House is unsafe", bn: "ঘর নিরাপদ নয়" },
  evacuation: { en: "Rescue / evacuation", bn: "উদ্ধার / সরিয়ে নেওয়া" },
  other: { en: "Other help", bn: "অন্য সাহায্য" },
};

export const NEED_ORDER: Need[] = ["evacuation", "medical", "food_water", "house_danger", "other"];

export const VULNERABLE_LABEL: Record<Vulnerable, Words> = {
  children: { en: "Children", bn: "শিশু" },
  elderly: { en: "Elderly people", bn: "বয়স্ক মানুষ" },
  disability: { en: "Person with a disability", bn: "প্রতিবন্ধী ব্যক্তি" },
  pregnant: { en: "Pregnant woman", bn: "গর্ভবতী নারী" },
};

export const STATUS_LABEL: Record<SosStatus, Words & { tone: string }> = {
  available: { en: "Waiting for a team", bn: "দলের অপেক্ষায়", tone: "bg-rk-danger-soft text-rk-danger" },
  accepted: { en: "Accepted", bn: "গ্রহণ করা হয়েছে", tone: "bg-rk-warning-soft text-rk-warning" },
  en_route: { en: "Team en route", bn: "দল রওনা দিয়েছে", tone: "bg-rk-info-soft text-rk-info" },
  arrived: { en: "Team arrived", bn: "দল পৌঁছেছে", tone: "bg-rk-info-soft text-rk-info" },
  in_progress: { en: "Help in progress", bn: "সাহায্য চলছে", tone: "bg-rk-info-soft text-rk-info" },
  completed: { en: "Completed", bn: "সম্পন্ন", tone: "bg-rk-success-soft text-rk-success" },
  cancelled: { en: "Cancelled", bn: "বাতিল", tone: "bg-rk-secondary text-rk-muted" },
};

export const RELEASE_LABEL: Record<ReleaseReason, Words> = {
  unable_to_reach: { en: "Could not reach the place", bn: "জায়গায় পৌঁছানো যায়নি" },
  lacks_resources: { en: "Not enough resources", bn: "প্রয়োজনীয় সামগ্রী নেই" },
  other: { en: "Other reason", bn: "অন্য কারণ" },
};
