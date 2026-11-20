// Flood-relevant public contacts for Bangladesh.
//
// RULE: only numbers seen on an official source (the organisation's own site or a
// government page) are listed, each with its source and the date it was checked.
// Research notes: research_notes/Rokkha production readiness roadmap/flood_contacts_verified.json
// Never add a number from memory, a news article or a private person.

export type ContactKind = "rescue" | "relief" | "medical" | "information";

export interface FloodContact {
  id: string;
  kind: ContactKind;
  name: { en: string; bn: string | null };
  provides: { en: string; bn: string };
  number: string; // as published
  tel: string; // what the phone dials
  coverage: { en: string; bn: string };
  hours: { en: string; bn: string } | null;
  emergencyLine: boolean;
  source: string;
  checkedOn: string; // YYYY-MM-DD
}

export const FLOOD_CONTACTS: FloodContact[] = [
  {
    id: "fire-102",
    kind: "rescue",
    name: { en: "Fire Service and Civil Defence", bn: "ফায়ার সার্ভিস ও সিভিল ডিফেন্স" },
    provides: { en: "Fire and rescue emergencies. Answered at the central control room in Dhaka.", bn: "অগ্নি ও উদ্ধার জরুরি সেবা। ঢাকার কেন্দ্রীয় নিয়ন্ত্রণ কক্ষ থেকে উত্তর দেওয়া হয়।" },
    number: "102",
    tel: "102",
    coverage: { en: "Whole country · toll-free", bn: "সারা দেশ · টোল-ফ্রি" },
    hours: null,
    emergencyLine: true,
    source: "https://bangladesh.gov.bd/site/page/aaebba14-f52a-4a3d-98fd-a3f8b911d3d9",
    checkedOn: "2026-11-18",
  },
  {
    id: "coastguard-16111",
    kind: "rescue",
    name: { en: "Bangladesh Coast Guard", bn: "বাংলাদেশ কোস্ট গার্ড" },
    provides: { en: "Emergencies on the coast, in coastal areas, at sea and on waterways.", bn: "উপকূল, উপকূলীয় অঞ্চল, সমুদ্র ও নৌপথে জরুরি অবস্থা।" },
    number: "16111",
    tel: "16111",
    coverage: { en: "Coast, sea and waterways", bn: "উপকূল, সমুদ্র ও নৌপথ" },
    hours: { en: "24 hours", bn: "২৪ ঘণ্টা" },
    emergencyLine: true,
    source: "https://bangladesh.gov.bd/site/page/aaebba14-f52a-4a3d-98fd-a3f8b911d3d9",
    checkedOn: "2026-11-18",
  },
  {
    id: "gov-333",
    kind: "relief",
    name: { en: "Government information and service line 333", bn: "সরকারি তথ্য ও সেবা ৩৩৩" },
    provides: { en: "Ask the Deputy Commissioner or UNO for help during a disaster, and get information on government services.", bn: "দুর্যোগের সময় জেলা প্রশাসক বা ইউএনওর কাছে সাহায্যের আবেদন, এবং সরকারি সেবার তথ্য।" },
    number: "333",
    tel: "333",
    coverage: { en: "Whole country (from Bangladesh)", bn: "সারা দেশ (বাংলাদেশ থেকে)" },
    hours: { en: "24 hours", bn: "২৪ ঘণ্টা" },
    emergencyLine: false,
    source: "https://bangladesh.gov.bd/site/page/aaebba14-f52a-4a3d-98fd-a3f8b911d3d9",
    checkedOn: "2026-11-18",
  },
  {
    id: "bdrcs-16226",
    kind: "relief",
    name: { en: "Bangladesh Red Crescent Society", bn: null },
    provides: { en: "Information about Red Crescent services, including disaster relief.", bn: "রেড ক্রিসেন্টের সেবা, দুর্যোগে ত্রাণসহ, সম্পর্কে তথ্য।" },
    number: "16226",
    tel: "16226",
    coverage: { en: "Toll-free", bn: "টোল-ফ্রি" },
    hours: { en: "9 am to 5 pm, every day", bn: "প্রতিদিন সকাল ৯টা থেকে বিকাল ৫টা" },
    emergencyLine: false,
    source: "https://bdrcs.org/bdrcs-promotes-its-toll-free-number/",
    checkedOn: "2026-11-18",
  },
  {
    id: "dghs-16263",
    kind: "medical",
    name: { en: "Health call centre (Shastho Batayon)", bn: "স্বাস্থ্য বাতায়ন" },
    provides: { en: "Medical advice by phone from the Directorate General of Health Services. Not an ambulance.", bn: "স্বাস্থ্য অধিদপ্তরের ফোনে চিকিৎসা পরামর্শ। এটি অ্যাম্বুলেন্স সেবা নয়।" },
    number: "16263",
    tel: "16263",
    coverage: { en: "Whole country", bn: "সারা দেশ" },
    hours: { en: "24 hours", bn: "২৪ ঘণ্টা" },
    emergencyLine: false,
    source: "https://dghs.gov.bd/",
    checkedOn: "2026-11-18",
  },
  {
    id: "modmr-1090",
    kind: "information",
    name: { en: "Disaster early-warning line 1090", bn: "দুর্যোগের আগাম বার্তা ১০৯০" },
    provides: { en: "Recorded warnings, free from any mobile. Press 5 for flood and river levels. Not a rescue line.", bn: "রেকর্ড করা সতর্কবার্তা, যেকোনো মোবাইল থেকে বিনামূল্যে। বন্যা ও নদীর পানির খবরের জন্য ৫ চাপুন। এটি উদ্ধার সেবা নয়।" },
    number: "1090",
    tel: "1090",
    coverage: { en: "Whole country · toll-free", bn: "সারা দেশ · টোল-ফ্রি" },
    hours: { en: "24 hours", bn: "২৪ ঘণ্টা" },
    emergencyLine: false,
    source: "https://bangladesh.gov.bd/site/page/aaebba14-f52a-4a3d-98fd-a3f8b911d3d9",
    checkedOn: "2026-11-18",
  },
];
