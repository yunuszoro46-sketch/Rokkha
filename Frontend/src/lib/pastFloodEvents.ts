// Ten verified historical flood events & predictions for Rokkha (2016–2024)
export interface PastFloodEvent {
  id: string;
  label: string;       // Exact label e.g. "30 Jun–24 Jul 2016"
  labelBn: string;     // Bangla label
  name: string;        // Descriptive name
  nameBn: string;      // Bangla descriptive name
  targetDate: string;  // Default prediction date (YYYY-MM-DD)
  startDate: string;   // Start date (YYYY-MM-DD)
  endDate: string;     // End date (YYYY-MM-DD)
  floodedAreaSqkm?: number;
}

export const PAST_FLOOD_EVENTS: PastFloodEvent[] = [
  {
    id: "2016-07-monsoon",
    label: "30 Jun–24 Jul 2016",
    labelBn: "৩০ জুন–২৪ জুলাই ২০১৬",
    name: "Monsoon flood, Central & Eastern",
    nameBn: "বর্ষাকালীন বন্যা, মধ্য ও পূর্ব বাংলাদেশ",
    targetDate: "2016-07-24",
    startDate: "2016-06-30",
    endDate: "2016-07-24",
    floodedAreaSqkm: 10830.5,
  },
  {
    id: "2017-08-monsoon",
    label: "12–22 Aug 2017",
    labelBn: "১২–২২ আগস্ট ২০১৭",
    name: "Monsoon flood, Central, Northern & Southern",
    nameBn: "বর্ষাকালীন বন্যা, মধ্য, উত্তর ও দক্ষিণ বাংলাদেশ",
    targetDate: "2017-08-16",
    startDate: "2017-08-12",
    endDate: "2017-08-22",
    floodedAreaSqkm: 21491.6,
  },
  {
    id: "2018-06-sylhet",
    label: "15 Jun 2018",
    labelBn: "১৫ জুন ২০১৮",
    name: "Flash flood, Sylhet Division",
    nameBn: "আকস্মিক বন্যা, সিলেট বিভাগ",
    targetDate: "2018-06-15",
    startDate: "2018-06-15",
    endDate: "2018-06-15",
    floodedAreaSqkm: 5967.8,
  },
  {
    id: "2020-05-cyclone-amphan",
    label: "25–31 May 2020",
    labelBn: "২৫–৩১ মে ২০২০",
    name: "Cyclone Amphan, Khulna Division",
    nameBn: "ঘূর্ণিঝড় আম্পান, খুলনা বিভাগ",
    targetDate: "2020-05-31",
    startDate: "2020-05-25",
    endDate: "2020-05-31",
    floodedAreaSqkm: 1367.1,
  },
  {
    id: "2020-07-monsoon",
    label: "9 Jul–8 Aug 2020",
    labelBn: "৯ জুলাই–৮ আগস্ট ২০২০",
    name: "Monsoon flood, Nationwide",
    nameBn: "বর্ষাকালীন বন্যা, দেশব্যাপী",
    targetDate: "2020-07-21",
    startDate: "2020-07-09",
    endDate: "2020-08-08",
    floodedAreaSqkm: 30623.2,
  },
  {
    id: "2021-07-chattogram",
    label: "27 Jul–10 Aug 2021",
    labelBn: "২৭ জুলাই–১০ আগস্ট ২০২১",
    name: "Flood, Chattogram Division",
    nameBn: "বন্যা, চট্টগ্রাম বিভাগ",
    targetDate: "2021-07-29",
    startDate: "2021-07-27",
    endDate: "2021-08-10",
    floodedAreaSqkm: 8471.1,
  },
  {
    id: "2022-05-northeast",
    label: "25 May–21 Jun 2022",
    labelBn: "২৫ মে–২১ জুন ২০২২",
    name: "Flood, Sylhet & North-East",
    nameBn: "বন্যা, সিলেট ও উত্তর-পূর্বাঞ্চল",
    targetDate: "2022-06-18",
    startDate: "2022-05-25",
    endDate: "2022-06-21",
    floodedAreaSqkm: 15424.1,
  },
  {
    id: "2024-05-cyclone-remal",
    label: "1 Jun 2024",
    labelBn: "১ জুন ২০২৪",
    name: "Cyclone Remal, Southern Bangladesh",
    nameBn: "ঘূর্ণিঝড় রিমাল, দক্ষিণ বাংলাদেশ",
    targetDate: "2024-06-01",
    startDate: "2024-06-01",
    endDate: "2024-06-01",
    floodedAreaSqkm: 1030.3,
  },
  {
    id: "2024-06-monsoon",
    label: "19 Jun–23 Jul 2024",
    labelBn: "১৯ জুন–২৩ জুলাই ২০২৪",
    name: "Monsoon flood, Sylhet then Nationwide",
    nameBn: "বর্ষাকালীন বন্যা, সিলেট ও দেশব্যাপী",
    targetDate: "2024-06-26",
    startDate: "2024-06-19",
    endDate: "2024-07-23",
    floodedAreaSqkm: 17283.8,
  },
  {
    id: "2024-08-eastern",
    label: "18 Aug–4 Sep 2024",
    labelBn: "১৮ আগস্ট–৪ সেপ্টেম্বর ২০২৪",
    name: "Flash flood, Eastern Bangladesh",
    nameBn: "আকস্মিক বন্যা, পূর্ব বাংলাদেশ",
    targetDate: "2024-08-22",
    startDate: "2024-08-18",
    endDate: "2024-09-04",
    floodedAreaSqkm: 13466.3,
  },
];

/** Check if a given date falls within any of the 10 past flood event windows */
export function findMatchingPastEvent(isoDate: string): PastFloodEvent | undefined {
  if (!isoDate) return undefined;
  // Exact target date match
  const exact = PAST_FLOOD_EVENTS.find((e) => e.targetDate === isoDate);
  if (exact) return exact;
  // Date within [startDate, endDate]
  return PAST_FLOOD_EVENTS.find((e) => isoDate >= e.startDate && isoDate <= e.endDate);
}

/** Get index of past event or -1 */
export function getPastEventIndex(isoDate: string): number {
  const match = findMatchingPastEvent(isoDate);
  if (!match) return -1;
  return PAST_FLOOD_EVENTS.findIndex((e) => e.id === match.id);
}
