// Bilingual (English & Bengali) Dictionary for Rokkha Citizen Platform

export type Language = "en" | "bn";

export function toBnNum(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return "";
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(val).replace(/\d/g, (d) => bnDigits[parseInt(d, 10)]);
}

export const DIVISIONS_BN: Record<string, string> = {
  Barishal: "বরিশাল",
  Chattogram: "চট্টগ্রাম",
  Dhaka: "ঢাকা",
  Khulna: "খুলনা",
  Mymensingh: "ময়মনসিংহ",
  Rajshahi: "রাজশাহী",
  Rangpur: "রংপুর",
  Sylhet: "সিলেট",
};

export const DISTRICTS_BN: Record<string, string> = {
  BD1004: "বরগুনা",
  BD1006: "বরিশাল",
  BD1009: "ভোলা",
  BD1042: "ঝালকাঠি",
  BD1078: "পটুয়াখালী",
  BD1079: "পিরোজপুর",
  BD2003: "বান্দরবান",
  BD2012: "ব্রাহ্মণবাড়িয়া",
  BD2013: "চাঁদপুর",
  BD2015: "চট্টগ্রাম",
  BD2022: "কক্সবাজার",
  BD2019: "কুমিল্লা",
  BD2030: "ফেনী",
  BD2046: "খাগড়াছড়ি",
  BD2051: "লক্ষ্মীপুর",
  BD2075: "নোয়াখালী",
  BD2084: "রাঙ্গামাটি",
  BD3026: "ঢাকা",
  BD3029: "ফরিদপুর",
  BD3033: "গাজীপুর",
  BD3035: "গোপালগঞ্জ",
  BD3048: "কিশোরগঞ্জ",
  BD3054: "মাদারীপুর",
  BD3056: "মানিকগঞ্জ",
  BD3059: "মুন্সীগঞ্জ",
  BD3067: "নারায়ণগঞ্জ",
  BD3068: "নরসিংদী",
  BD3082: "রাজবাড়ী",
  BD3086: "শরীয়তপুর",
  BD3093: "টাঙ্গাইল",
  BD4001: "বাগেরহাট",
  BD4018: "চুয়াডাঙ্গা",
  BD4041: "যশোর",
  BD4044: "ঝিনাইদহ",
  BD4047: "খুলনা",
  BD4050: "কুষ্টিয়া",
  BD4055: "মাগুরা",
  BD4057: "মেহেরপুর",
  BD4065: "নড়াইল",
  BD4087: "সাতক্ষীরা",
  BD4539: "জামালপুর",
  BD4561: "ময়মনসিংহ",
  BD4572: "নেত্রকোণা",
  BD4589: "শেরপুর",
  BD5010: "বগুড়া",
  BD5038: "জয়পুরহাট",
  BD5064: "নওগাঁ",
  BD5069: "নাটোর",
  BD5070: "চাঁপাইনবাবগঞ্জ",
  BD5076: "পাবনা",
  BD5081: "রাজশাহী",
  BD5088: "সিরাজগঞ্জ",
  BD5527: "দিনাজপুর",
  BD5532: "গাইবান্ধা",
  BD5549: "কুড়িগ্রাম",
  BD5552: "লালমনিরহাট",
  BD5573: "নীলফামারী",
  BD5577: "পঞ্চগড়",
  BD5585: "রংপুর",
  BD5594: "ঠাকুরগাঁও",
  BD6036: "হবিগঞ্জ",
  BD6058: "মৌলভীবাজার",
  BD6090: "সুনামগঞ্জ",
  BD6091: "সিলেট",
};

export const UI_TEXT = {
  en: {
    // Top Nav
    nav_home: "Home",
    nav_map: "Live Risk Map",
    nav_alerts: "Early Warnings",
    nav_data: "Data & Coverage",
    nav_about: "About & Limits",
    btn_about_data: "About Data",
    btn_get_started: "Get Started",

    // Sidebar
    side_overview: "Platform Overview",
    side_map: "Flood Map & Point Check",
    side_alerts: "Forecast & Early Warnings",
    side_satellite: "District Ranking & Satellite",
    side_hydro: "Rain & River Gauges",
    side_shelters: "Nearest Emergency Shelters",
    side_about: "About & Data Limits",
    side_status_active: "National Early Warning Active",
    side_status_feed: "Live Satellite & Sensor Feed",

    // Hero
    hero_tagline: "Climate Intelligence for a Safer Bangladesh",
    hero_title_1: "Predict. Prepare.",
    hero_title_2: "Protect.",
    hero_desc:
      "Rokkha is a climate intelligence platform for flood analysis, risk mapping, and early prediction—helping communities and organizations stay one step ahead.",
    btn_see_how: "See How It Works",

    // Metrics
    metric_years: "9 Years",
    metric_years_sub: "Historical Analysis (2016 – 2024)",
    metric_districts: "64",
    metric_districts_sub: "Districts Covered (National)",
    metric_assets: "1,200+",
    metric_assets_sub: "Critical Assets (Hospitals, Shelters)",
    metric_tests: "187",
    metric_tests_sub: "Automated Tests & Verifications",

    // Capabilities Section
    cap_title: "A Complete Flood Intelligence Platform",
    cap_sub:
      "Engineered for humanitarian responders, municipal authorities, and vulnerable communities across Bangladesh.",

    // Context Card
    label_district: "District:",
    label_date: "Date:",
    btn_my_district: "My District Report",
    btn_gps: "GPS",
    placeholder_select_district: "Select District",

    // Map Section
    map_legend_alert: "Alert",
    map_legend_watch: "Watch",
    map_legend_normal: "No Active Alert",
    map_legend_unsupported: "Unsupported / Radar Blind",
    map_scenarios_label: "Major Flood Scenarios & Forecast Timeline:",
    scenario_sylhet: "Sylhet (2022-06-18)",
    scenario_feni: "Feni / Eastern (2024-08-22)",
    scenario_dry: "Dry (2023-04-10)",

    // Modal
    report_tag: "Official Local Risk Report",
    btn_print: "Print Report",
    btn_gps_detect: "GPS Detect",
    btn_close: "Close Report",
    kpi_rank: "National Flood Rank",
    kpi_rank_sub_top: "Top 10 highest risk",
    kpi_rank_sub_mid: "Moderate risk belt",
    kpi_rank_sub_low: "Low flood frequency",
    kpi_forecast: "24H ML Forecast",
    kpi_events: "Satellite Flood Events",
    kpi_events_sub: "Major historical events inundated",
    kpi_land: "Peak Inundated Land",
    kpi_land_sub: "Max recorded land coverage",
    sec_hazard: "Modelled Flood Depth Hazard (JRC GloFAS)",
    ret_10yr: "10-Year Return Period Flood",
    ret_10yr_depth_high: "1 to 3 meters",
    ret_10yr_depth_low: "0.5 to 1 meter",
    ret_10yr_sub: "Expected water depth in non-embanked lower terraces",
    ret_100yr: "100-Year Return Period Extreme Flood",
    ret_100yr_depth_high: "Over 3 meters",
    ret_100yr_depth_low: "1 to 3 meters",
    ret_100yr_sub: "Catastrophic regional surge or unprecedented basin breach",
    sec_shelters: "Critical Assets & Emergency Shelters",
    sec_shelters_all: "Explore All in",
    sec_helplines: "Official Emergency Helplines & Action Protocol",
    helpline_999: "National Emergency (Police, Fire, Ambulance)",
    helpline_1090: "Disaster & Flood Warning (Toll-Free IVR)",
    helpline_109: "Helpline for Women & Children",
    helpline_red_crescent: "+880-2-49350158 Disaster Cell",
    protocol_title: "Citizen Flood Preparedness Protocol:",
    protocol_1:
      "Store 3–5 days of clean drinking water, halogen water purification tablets, and dry rations (chira, gur, biscuits).",
    protocol_2:
      "Pack national identity cards, land deeds, and prescription medications into double-sealed watertight plastic pouches.",
    protocol_3:
      "Identify the fastest elevated walkway route to your assigned community shelter before water cuts off feeder roads.",
    protocol_4:
      "Turn off primary household electrical main breakers if standing flood water enters dwelling plinth level.",
  },
  bn: {
    // Top Nav
    nav_home: "নীড়পাতা",
    nav_map: "সরাসরি ঝুঁকি মানচিত্র",
    nav_alerts: "আগাম সতর্কবার্তা",
    nav_data: "উপাত্ত ও কভারেজ",
    nav_about: "সীমাবদ্ধতা ও স্বচ্ছতা",
    btn_about_data: "উপাত্ত পরিচিতি",
    btn_get_started: "শুরু করুন",

    // Sidebar
    side_overview: "প্ল্যাটফর্ম ওভারভিউ",
    side_map: "বন্যা মানচিত্র ও পয়েন্ট চেক",
    side_alerts: "পূর্বাভাস ও আগাম সতর্কতা",
    side_satellite: "জেলা র‍্যাঙ্কিং ও স্যাটেলাইট",
    side_hydro: "বৃষ্টিপাত ও নদীর পরিমাপক",
    side_shelters: "নিকটস্থ জরুরি আশ্রয়কেন্দ্র",
    side_about: "উপাত্ত ও ব্যবহারের সীমাবদ্ধতা",
    side_status_active: "জাতীয় আগাম সতর্কতা সক্রিয়",
    side_status_feed: "লাইভ স্যাটেলাইট ও সেন্সর ফিড",

    // Hero
    hero_tagline: "সুরক্ষিত বাংলাদেশের জন্য জলবায়ু বুদ্ধিমত্তা",
    hero_title_1: "পূর্বাভাস। প্রস্তুতি।",
    hero_title_2: "সুরক্ষা।",
    hero_desc:
      "রক্ষা হলো বন্যা বিশ্লেষণ, ঝুঁকি মানচিত্র এবং আগাম পূর্বাভাসের একটি নির্ভরযোগ্য প্ল্যাটফর্ম—যা ঝুঁকিপূর্ণ সম্প্রদায় ও সংস্থাকে এক ধাপ এগিয়ে রাখতে সহায়তা করে।",
    btn_see_how: "কীভাবে কাজ করে",

    // Metrics
    metric_years: "৯ বছর",
    metric_years_sub: "ঐতিহাসিক বিশ্লেষণ (২০১৬ – ২০২৪)",
    metric_districts: "৬৪",
    metric_districts_sub: "জেলা আওতাভুক্ত (জাতীয় কভারেজ)",
    metric_assets: "১,২০০+",
    metric_assets_sub: "গুরুত্বপূর্ণ অবকাঠামো (হাসপাতাল, আশ্রয়কেন্দ্র)",
    metric_tests: "১৮৭",
    metric_tests_sub: "স্বয়ংক্রিয় পরীক্ষা ও সঠিকতা যাচাই",

    // Capabilities Section
    cap_title: "একটি স্বয়ংসম্পূর্ণ বন্যা বুদ্ধিমত্তা প্ল্যাটফর্ম",
    cap_sub:
      "বাংলাদেশের দুর্যোগ মোকাবিলা কর্মী, স্থানীয় কর্তৃপক্ষ এবং ঝুঁকিপূর্ণ জনগণের জন্য বিশেষভাবে নকশা করা।",

    // Context Card
    label_district: "জেলা:",
    label_date: "তারিখ:",
    btn_my_district: "আমার জেলা প্রতিবেদন",
    btn_gps: "জিপিএস",
    placeholder_select_district: "জেলা নির্বাচন করুন",

    // Map Section
    map_legend_alert: "জরুরি সতর্কতা (অ্যালার্ট)",
    map_legend_watch: "নজরদারি (ওয়াচ)",
    map_legend_normal: "স্বাভাবিক অবস্থা",
    map_legend_unsupported: "পাহাড় বা ঘনবসতি (রাডার অন্ধ)",
    map_scenarios_label: "প্রধান ঐতিহাসিক বন্যা দৃশ্যপট ও পূর্বাভাসের সময়রেখা:",
    scenario_sylhet: "সিলেট প্লাবন (১৮/০৬/২০২২)",
    scenario_feni: "ফেনী/পূর্বাঞ্চল প্লাবন (২২/০৮/২০২৪)",
    scenario_dry: "শুষ্ক মৌসুম (১০/০৪/২০২৩)",

    // Modal
    report_tag: "অফিসিয়াল স্থানীয় ঝুঁকি প্রতিবেদন",
    btn_print: "প্রতিবেদন প্রিন্ট করুন",
    btn_gps_detect: "জিপিএস নির্ণয়",
    btn_close: "বন্ধ করুন",
    kpi_rank: "জাতীয় বন্যা ঝুঁকি র‍্যাংক",
    kpi_rank_sub_top: "শীর্ষ ১০ সর্বোচ্চ ঝুঁকিপূর্ণ",
    kpi_rank_sub_mid: "মাঝারি ঝুঁকি অঞ্চল",
    kpi_rank_sub_low: "কম প্লাবন প্রবণ জেলা",
    kpi_forecast: "২৪ ঘণ্টার এআই পূর্বাভাস",
    kpi_events: "স্যাটেলাইটে প্লাবিত দুর্যোগ",
    kpi_events_sub: "প্রধান ঐতিহাসিক দুর্যোগে প্লাবিত",
    kpi_land: "সর্বোচ্চ প্লাবিত ভূমির হার",
    kpi_land_sub: "রেকর্ডকৃত সর্বোচ্চ ভূমির বিস্তৃতি",
    sec_hazard: "মডেল অনুযায়ী বন্যার গভীরতার ঝুঁকি (JRC GloFAS)",
    ret_10yr: "১০-বছরের পুনরাবৃত্তিমূলক স্বাভাবিক বন্যা",
    ret_10yr_depth_high: "১ থেকে ৩ মিটার",
    ret_10yr_depth_low: "০.৫ থেকে ১ মিটার",
    ret_10yr_sub: "বাঁধহীন নিচু এলাকার প্রত্যাশিত পানির গভীরতা",
    ret_100yr: "১০০-বছরের চরম ভয়াবহ প্লাবন ঝুঁকি",
    ret_100yr_depth_high: "৩ মিটারের বেশি",
    ret_100yr_depth_low: "১ থেকে ৩ মিটার",
    ret_100yr_sub: "নদী অববাহিকা ভেঙে যাওয়া বা নজিরবিহীন প্লাবন",
    sec_shelters: "নিকটস্থ জরুরি আশ্রয়কেন্দ্র ও সেবাকেন্দ্র",
    sec_shelters_all: "সকল আশ্রয়কেন্দ্র দেখুন -",
    sec_helplines: "অফিসিয়াল জরুরি হেল্পলাইন ও নাগরিক প্রস্তুতি",
    helpline_999: "জাতীয় জরুরি সেবা (পুলিশ, ফায়ার সার্ভিস, অ্যাম্বুলেন্স)",
    helpline_1090: "দুর্যোগ ও বন্যা বিষয়ক সতর্কবার্তা (টোল-ফ্রি IVR)",
    helpline_109: "নারী ও শিশু সুরক্ষা হেল্পলাইন",
    helpline_red_crescent: "+৮৮০-২-৪৯৩৫০১৫৮ দুর্যোগ নিয়ন্ত্রণ সেল",
    protocol_title: "বন্যা পূর্বপ্রস্তুতি ও নাগরিক নির্দেশিকা:",
    protocol_1:
      "৩–৫ দিনের বিশুদ্ধ খাওয়ার পানি, পানি বিশুদ্ধকরণ ট্যাবলেট এবং শুকনা খাবার (চিঁড়া, গুড়, বিস্কুট) মজুত রাখুন।",
    protocol_2:
      "জাতীয় পরিচয়পত্র, জমির দলিল এবং প্রেসক্রিপশনের ওষুধ বায়ুরোধী প্লাস্টিকের প্যাকেটে মুড়ে রাখুন।",
    protocol_3:
      "রাস্তাঘাট পানিতে ডুবে যাওয়ার আগেই আপনার নিকটতম আশ্রয়কেন্দ্রে যাওয়ার উঁচু পথ আগে থেকেই চিনে রাখুন।",
    protocol_4:
      "বসতবাড়ির ঘরের মেঝেতে পানি ঢুকে পড়লে বাড়ির প্রধান বিদ্যুৎ সংযোগ (মেইন সুইচ) দ্রুত বন্ধ করে দিন।",
  },
};
