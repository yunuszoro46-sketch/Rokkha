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
    cap_label: "Core Capabilities",
    cap_title: "A Complete Flood Intelligence Platform",
    cap_sub:
      "From historical analysis to real-time data and future prediction, Rokkha brings essential tools together for smarter, faster, and more resilient decisions.",

    // 8 Core Capability Cards
    cap_1_title: "Historical Analysis",
    cap_1_desc: "Analyze past flood events from 2016 to 2024",
    cap_2_title: "Flood Hazard Mapping",
    cap_2_desc: "Identify and visualize flood-prone areas",
    cap_3_title: "Geographical Analysis",
    cap_3_desc: "Explore rivers, canals and vulnerable regions",
    cap_4_title: "Asset Management",
    cap_4_desc: "Track hospitals, schools, shelters and other critical assets",
    cap_5_title: "Population Exposure",
    cap_5_desc: "Assess people and property at risk",
    cap_6_title: "Weather & River Data",
    cap_6_desc: "Collect and integrate real-time environmental data",
    cap_7_title: "Integrated Database",
    cap_7_desc: "MongoDB-powered, scalable and reliable data management",
    cap_8_title: "REST APIs",
    cap_8_desc: "Secure and well-tested APIs (187 automated tests)",

    // Up next section (24-Hour ML Prediction)
    up_next_badge: "Up next",
    up_next_title_1: "Towards",
    up_next_title_2: "24-Hour Flood Prediction",
    up_next_desc:
      "We are developing an ML-based prediction model to forecast flood risk up to 24 hours ahead, with automated alerts and real-time data updates.",
    up_next_check_1: "ML model training & evaluation",
    up_next_check_2: "Prediction API & automated alerts",
    up_next_check_3: "Scheduled weather-data collection",

    // Preview mockup card
    mock_risk_high: "Risk: High",
    mock_forecast_title: "Flood Forecast",
    mock_forecast_time: "Next 24 hours",
    mock_risk_level: "Risk Level",
    mock_high: "High",
    mock_affected_area: "Affected Area (est.)",
    mock_area_val: "≈ 312 km²",

    // CTA Section
    cta_title_1: "Building a more",
    cta_title_2: "flood-resilient Bangladesh",
    cta_desc: "Data, prediction, and preparedness—together for safer communities.",
    cta_btn: "Get Started",

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
    // Map Artwork Legend
    risk_level: "Risk Level",
    risk_low: "Low",
    risk_high: "High",
    loading_text: "Preparing flood intelligence",

    // Section 4: District Satellite Timeline & 64 Table
    timeline_card_title: "64-District Flood Frequency",
    timeline_badge: "2016–2024 UNOSAT",
    timeline_card_sub:
      "Click any district row to inspect its Copernicus Sentinel-1 satellite timeline and event history.",
    timeline_search_placeholder: "Filter 64 districts by name or division...",
    th_rank: "Rank",
    th_district: "District",
    th_events: "Events",
    th_peak: "Peak",
    timeline_right_title: "Sentinel-1 Timeline:",
    timeline_rank_of_64: "Rank #{rank} of 64",
    timeline_btn_2022: "2022 Monsoon",
    timeline_btn_2024: "2024 Monsoon",
    timeline_right_sub:
      "Share of observed district land covered by unusual flood water (Copernicus GFM). Gaps are days with no satellite pass, not dry days.",
    timeline_loading: "Loading Copernicus Sentinel-1 satellite passes...",
    timeline_radar_blind_title: "Satellite cannot observe floods in {district}",
    timeline_radar_blind_desc:
      "Sentinel-1 radar backscatter cannot map floods under hills, forest canopy, or dense city buildings (one of 8 radar-blind districts). This means no satellite data, not that the district is safe.",
    timeline_no_passes: "No satellite passes recorded for this window in {district}.",
    timeline_10_events_title: "10 Major Flood Events Record (2016–2024)",
    timeline_grey_sub: "Grey = Not observed by satellite (never implies safe)",
    timeline_no_data: "No Data",
    timeline_tooltip_flooded: "% unusual flood water",
    timeline_tooltip_flooded_share: "Flooded Share",
    timeline_pass_label: "Sentinel-1 Pass",

    // Section 3: Alerts Feed
    alerts_card_title: "District Flood Early Warnings",
    alerts_action_required: "Action Required",
    alerts_no_warnings: "No High-Level Warnings",
    alerts_card_sub:
      "Districts where 24h satellite-observable flood probability exceeds watch or alert thresholds for {date}.",
    alerts_disclaimer_title: "Public Advisory & Institutional Limitation",
    alerts_disclaimer_desc:
      "These alerts are machine learning estimations derived from precipitation and satellite backscatter. They are NOT official flood warnings. Official government flood forecasts and evacuation directives are issued exclusively by the Flood Forecasting and Warning Centre (FFWC) and Bangladesh Water Development Board (BWDB).",
    alerts_checking: "Checking district early warnings...",
    alerts_district_suffix: "District",
    alerts_likelihood: "Likelihood",
    alerts_registered_assets: "registered critical assets",
    alerts_people_served: "people sheltered/served",
    alerts_none_title: "No Districts Exceeded Alert Thresholds for {date}",
    alerts_none_sub:
      "Note: This indicates none of the 64 districts triggered the ML alert model on this date. It does not guarantee absence of localized waterlogging.",

    // Section 5: Hydro-Meteorological Observations
    hydro_card_title: "Hydro-Meteorological Observations:",
    hydro_card_sub:
      "Daily rainfall (ECMWF ERA5 / GFS) and river flow discharge (Copernicus GloFAS)",
    hydro_tab_rain: "Daily Rainfall (mm)",
    hydro_tab_river: "River Discharge (m³/s)",
    hydro_loading: "Querying Copernicus ERA5 and GloFAS hydrological feeds...",
    hydro_rainfall_label: "24h Rainfall",
    hydro_discharge_label: "River Discharge",
    hydro_rain_sources: "Sources: ECMWF ERA5 reanalysis + NOAA GFS",
    hydro_rain_note: "Note: Values over 100 mm indicate severe monsoon cloudburst",
    hydro_river_source: "Source: Copernicus GloFAS 30-day hydro-routed discharge",
    hydro_river_site: "Gauging site: Surma River at Sunamganj",

    // Section 6: Nearest Shelters
    shelters_card_title: "Nearest Flood Shelters & Healthcare Facilities",
    shelters_card_sub:
      "Registered emergency shelters, clinics, and critical facilities within {radius} km of {district} ({coords}).",
    shelters_radius_label: "Radius:",
    shelters_filter_label: "Filter by type:",
    shelters_type_all: "All Types",
    shelters_type_flood: "Flood Shelters",
    shelters_type_hospital: "Hospitals",
    shelters_type_clinic: "Clinics",
    shelters_type_school: "Schools",
    shelters_loading:
      "Querying MongoDB geospatial 2dsphere index for nearby shelters...",
    shelters_capacity: "Capacity:",
    shelters_people: "people",
    shelters_not_specified: "Not specified",
    shelters_empty:
      "No registered shelters or hospitals within {radius} km of this coordinate. Expand the search radius above.",

    // Interactive Map Inspection Card
    map_card_title: "National Flood Risk & Ground Inspection Map",
    map_card_hint: "(Tap any district or coordinate to inspect)",
    map_forecast_date_label: "Forecast Date:",
    map_legend_label: "Legend:",
    map_inspect_header: "Point & District Inspection",
    map_inspect_loading: "Querying satellite observations & flood hazard model...",
    map_division_suffix: "Division",
    map_rank_label: "Flood Rank #{rank} / 64",
    map_forecast_24h_title: "24h Model Forecast ({date})",
    map_radar_blindspot: "Radar Blindspot (No Forecast)",
    map_probability_label: "Probability:",
    map_badge_unsupported: "Unsupported",
    map_badge_no_alert: "No Alert",
    map_observed_satellite_label: "Observed satellite flooding:",
    map_of_major_events: "{times} of {total} major floods checked",
    map_jrc_glofas_title: "Modelled Flood Depth Hazard (JRC GloFAS):",
    map_10yr_flood: "10-Year Return Period Flood",
    map_100yr_flood: "100-Year Return Period Extreme Flood",
    map_inspect_disclaimer:
      "ML estimation for disaster awareness. FFWC issues official warnings.",

    // Clean & Meaningful Footer
    footer_title: "Rokkha Flood Intelligence",
    footer_sub: "Citizen Portal · Open Climate Safety for Bangladesh",
    footer_helplines_title: "Emergency Helplines",
    footer_sources_title: "Verified Data Feeds",
    footer_about_link: "Data Transparency & Limits",
    footer_copyright: "Rokkha. Open Public Safety Intelligence.",
    footer_coords_note: "WGS84 Geodesic Coordinates",
    footer_helpline_999: "999 (National Emergency)",
    footer_helpline_1090: "1090 (Flood & Disaster IVR)",
    footer_helpline_109: "109 (Women & Child Helpline)",
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
    cap_label: "প্রধান সুবিধাসমূহ",
    cap_title: "একটি স্বয়ংসম্পূর্ণ বন্যা বুদ্ধিমত্তা প্ল্যাটফর্ম",
    cap_sub:
      "ঐতিহাসিক বিশ্লেষণ থেকে শুরু করে রিয়েল-টাইম উপাত্ত এবং ভবিষ্যৎ পূর্বাভাস—ঝুঁকি মোকাবিলা ও দ্রুত কার্যকর সিদ্ধান্ত নিতে রক্ষার সমন্বিত উদ্যোগ।",

    // 8 Core Capability Cards
    cap_1_title: "ঐতিহাসিক বিশ্লেষণ",
    cap_1_desc: "২০১৬ থেকে ২০২৪ সালের অতীতের প্রধান বন্যা দুর্যোগ বিশ্লেষণ",
    cap_2_title: "বন্যা ঝুঁকি মানচিত্রায়ন",
    cap_2_desc: "বন্যাপ্রবণ এলাকা চিহ্নিতকরণ এবং সরাসরি ভিজ্যুয়ালাইজেশন",
    cap_3_title: "ভৌগোলিক বিশ্লেষণ",
    cap_3_desc: "নদী, খাল এবং চরম প্লাবনঝুঁকিপূর্ণ অঞ্চলের ভৌগোলিক অনুসন্ধান",
    cap_4_title: "সম্পদ ও স্থাপনা ব্যবস্থাপনা",
    cap_4_desc: "হাসপাতাল, বিদ্যালয়, আশ্রয়কেন্দ্র ও অন্যান্য জরুরি স্থাপনা ট্র্যাকিং",
    cap_5_title: "জনসংখ্যা ও ঝুঁকি পরিমাপ",
    cap_5_desc: "ঝুঁকিতে থাকা মানুষ ও ঘরবাড়ির সম্ভাব্য ক্ষতির মূল্যায়ন",
    cap_6_title: "আবহাওয়া ও নদীর উপাত্ত",
    cap_6_desc: "রিয়েল-টাইম বৃষ্টিপাত ও নদীর পানি প্রবাহ উপাত্ত সংগ্রহ ও একীভূতকরণ",
    cap_7_title: "সমন্বিত ডেটাবেস",
    cap_7_desc: "মঙ্গোডিবি (MongoDB) চালিত উচ্চ গতিসম্পন্ন ও নির্ভরযোগ্য তথ্য ব্যবস্থাপনা",
    cap_8_title: "রেস্ট এপিআই (REST APIs)",
    cap_8_desc: "নিরাপদ ও স্বয়ংক্রিয়ভাবে পরীক্ষিত ওপেন এপিআই (১৮৭টি টেস্ট ভেরিফায়েড)",

    // Up next section (24-Hour ML Prediction)
    up_next_badge: "পরবর্তী লক্ষ্য",
    up_next_title_1: "অগ্রযাত্রা",
    up_next_title_2: "২৪ ঘণ্টার বন্যা পূর্বাভাসের লক্ষ্যে",
    up_next_desc:
      "আমরা একটি মেশিন লার্নিং (এআই) মডেল প্রস্তুত করছি যা ২৪ ঘণ্টা আগেই বন্যার পূর্বাভাস দিতে পারে—সাথে স্বয়ংক্রিয় সতর্কবার্তা ও রিয়েল-টাইম ডেটা আপডেট।",
    up_next_check_1: "মেশিন লার্নিং মডেল প্রশিক্ষণ ও সঠিকতা যাচাই",
    up_next_check_2: "পূর্বাভাস এপিআই ও স্বয়ংক্রিয় সতর্কবার্তা",
    up_next_check_3: "নিয়মিত স্বয়ংক্রিয় আবহাওয়া উপাত্ত সংগ্রহ",

    // Preview mockup card
    mock_risk_high: "ঝুঁকি: উচ্চ",
    mock_forecast_title: "বন্যা পূর্বাভাস",
    mock_forecast_time: "পরবর্তী ২৪ ঘণ্টা",
    mock_risk_level: "ঝুঁকির মাত্রা",
    mock_high: "উচ্চ",
    mock_affected_area: "প্লাবিত এলাকা (আনুমানিক)",
    mock_area_val: "≈ ৩১২ বর্গ কিমি",

    // CTA Section
    cta_title_1: "বন্যা সহনশীল",
    cta_title_2: "বাংলাদেশ গড়ে তোলার প্রত্যয়ে",
    cta_desc: "উপাত্ত, পূর্বাভাস ও প্রস্তুতি—নিরাপদ জনপদের জন্য একসাথে।",
    cta_btn: "শুরু করুন",

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

    // Map Artwork Legend
    risk_level: "ঝুঁকির মাত্রা",
    risk_low: "কম",
    risk_high: "বেশি",
    loading_text: "বন্যা বুদ্ধিমত্তা প্রস্তুতি চলছে...",

    // Section 4: District Satellite Timeline & 64 Table
    timeline_card_title: "৬৪ জেলার বন্যা পুনরাবৃত্তি",
    timeline_badge: "২০১৬–২০২৪ ইউনস্যাট",
    timeline_card_sub:
      "কপারনিকাস সেন্টিনেল-১ স্যাটেলাইট সময়রেখা ও দুর্যোগের ইতিহাস দেখতে যেকোনো জেলা ক্লিক করুন।",
    timeline_search_placeholder: "নাম বা বিভাগ দিয়ে ৬৪ জেলা খুঁজুন...",
    th_rank: "র‍্যাংক",
    th_district: "জেলা",
    th_events: "দুর্যোগ",
    th_peak: "সর্বোচ্চ",
    timeline_right_title: "সেন্টিনেল-১ সময়রেখা:",
    timeline_rank_of_64: "৬৪ জেলার মধ্যে #{rank} তম",
    timeline_btn_2022: "২০২২ বর্ষা",
    timeline_btn_2024: "২০২৪ বর্ষা",
    timeline_right_sub:
      "অস্বাভাবিক প্লাবিত জমির শতকরা হার (কপারনিকাস GFM)। স্যাটেলাইট অনুপস্থিতির দিনগুলো ফাঁকা দেখানো হয়েছে, তা শুষ্ক বোঝায় না।",
    timeline_loading: "কপারনিকাস সেন্টিনেল-১ স্যাটেলাইট উপাত্ত লোড হচ্ছে...",
    timeline_radar_blind_title: "{district} জেলায় স্যাটেলাইট দ্বারা বন্যা নিরীক্ষণ সম্ভব নয়",
    timeline_radar_blind_desc:
      "পাহাড়, বনাঞ্চল বা ঘনবসতির কারণে সেন্টিনেল-১ রাডার এখানে বন্যা নিরীক্ষণ করতে পারে না (৮টি রাডার-অন্ধ জেলার একটি)। এর অর্থ হলো স্যাটেলাইট উপাত্তের অনুপস্থিতি, জেলাটি নিরাপদ তা নয়।",
    timeline_no_passes: "এই সময়সীমায় {district} জেলায় কোনো স্যাটেলাইট পর্যবেক্ষণ রেকর্ড নেই।",
    timeline_10_events_title: "১০টি প্রধান ঐতিহাসিক প্লাবন রেকর্ড (২০১৬–২০২৪)",
    timeline_grey_sub: "ধূসর = স্যাটেলাইট দ্বারা অপ্রত্যক্ষিত (নিরাপদ নয়)",
    timeline_no_data: "উপাত্ত নেই",
    timeline_tooltip_flooded: "% অস্বাভাবিক প্লাবিত ভূমি",
    timeline_tooltip_flooded_share: "প্লাবিত জমির হার",
    timeline_pass_label: "সেন্টিনেল-১ পর্যবেক্ষণ",

    // Section 3: Alerts Feed
    alerts_card_title: "জেলা পর্যায়ের আগাম বন্যা সতর্কতা",
    alerts_action_required: "জরুরি পদক্ষেপ প্রয়োজন",
    alerts_no_warnings: "উচ্চমাত্রার সতর্কতা নেই",
    alerts_card_sub:
      "{date} তারিখে যেসকল জেলায় ২৪ ঘণ্টার স্যাটেলাইট প্লাবন সম্ভাবনা নজরদারি বা সতর্কতা সীমার ওপরে।",
    alerts_disclaimer_title: "নাগরিক পরামর্শ ও প্রাতিষ্ঠানিক সীমাবদ্ধতা",
    alerts_disclaimer_desc:
      "এই সতর্কবার্তাগুলো বৃষ্টিপাত ও স্যাটেলাইট ব্যাকস্ক্যাটারের ওপর ভিত্তি করে তৈরি মেশিন লার্নিং অনুমান। এগুলো সরকারি কোনো আনুষ্ঠানিক ঘোষণা নয়। বাংলাদেশ পানি উন্নয়ন বোর্ডের (BWDB) বন্যা পূর্বাভাস ও সতর্কীকরণ কেন্দ্র (FFWC) থেকে আনুষ্ঠানিক বন্যা সতর্কতা ও নির্দেশনা প্রদান করা হয়।",
    alerts_checking: "জেলা পর্যায়ের আগাম সতর্কতা যাচাই করা হচ্ছে...",
    alerts_district_suffix: "জেলা",
    alerts_likelihood: "সম্ভাবনা",
    alerts_registered_assets: "নিবন্ধিত জরুরি স্থাপনা",
    alerts_people_served: "নাগরিককে আশ্রয় বা সেবা প্রদানে সক্ষম",
    alerts_none_title: "{date} তারিখে কোনো জেলায় সতর্কতা সীমা অতিক্রম করেনি",
    alerts_none_sub:
      "দ্রষ্টব্য: এই তারিখে ৬৪টি জেলার কোনোটিতেই এআই সতর্কবার্তা প্রযোজ্য হয়নি। তবে স্থানীয় জলাবদ্ধতা সম্পূর্ণ মুক্ত তা নির্দেশ করে না।",

    // Section 5: Hydro-Meteorological Observations
    hydro_card_title: "জলবায়ু ও পানিসম্পদ পর্যবেক্ষণ:",
    hydro_card_sub:
      "দৈনিক বৃষ্টিপাত (ECMWF ERA5 / GFS) এবং নদী অববাহিকার পানি প্রবাহ (Copernicus GloFAS)",
    hydro_tab_rain: "দৈনিক বৃষ্টিপাত (মিমি)",
    hydro_tab_river: "নদীর পানি প্রবাহ (ঘনমিটার/সে.)",
    hydro_loading: "কপারনিকাস ERA5 ও GloFAS আবহাওয়া ডেটা লোড হচ্ছে...",
    hydro_rainfall_label: "২৪ ঘণ্টার বৃষ্টিপাত",
    hydro_discharge_label: "নদীর পানি প্রবাহ",
    hydro_rain_sources: "উৎস: ECMWF ERA5 রিয়্যানালাইসিস + NOAA GFS",
    hydro_rain_note: "দ্রষ্টব্য: ১০০ মিমি-র বেশি বৃষ্টিপাত অতিভারী বর্ষণ নির্দেশ করে",
    hydro_river_source: "উৎস: কপারনিকাস GloFAS ৩০-দিনের নদী প্রবাহ মডেল",
    hydro_river_site: "পরিমাপক কেন্দ্র: সুরমা নদী, সুনামগঞ্জ",

    // Section 6: Nearest Shelters
    shelters_card_title: "নিকটস্থ বন্যা আশ্রয়কেন্দ্র ও চিকিৎসাকেন্দ্র",
    shelters_card_sub:
      "{district} এর {radius} কিলোমিটারের মধ্যে নিবন্ধিত জরুরি আশ্রয়কেন্দ্র, ক্লিনিক ও সেবাকেন্দ্র ({coords})।",
    shelters_radius_label: "অনুসন্ধান ব্যাসার্ধ:",
    shelters_filter_label: "ধরন অনুযায়ী বাছাই:",
    shelters_type_all: "সব ধরনের",
    shelters_type_flood: "বন্যা আশ্রয়কেন্দ্র",
    shelters_type_hospital: "হাসপাতাল",
    shelters_type_clinic: "ক্লিনিক",
    shelters_type_school: "বিদ্যালয়",
    shelters_loading:
      "নিকটস্থ আশ্রয়কেন্দ্রের ডেটাবেস অনুসন্ধান করা হচ্ছে...",
    shelters_capacity: "ধারণক্ষমতা:",
    shelters_people: "জন",
    shelters_not_specified: "অনির্দিষ্ট",
    shelters_empty:
      "এই অবস্থানের {radius} কিলোমিটারের মধ্যে কোনো নিবন্ধিত আশ্রয়কেন্দ্র বা হাসপাতাল পাওয়া যায়নি। উপরের অনুসন্ধান ব্যাসার্ধ বৃদ্ধি করুন।",

    // Interactive Map Inspection Card
    map_card_title: "জাতীয় বন্যা ঝুঁকি ও মাঠ পর্যায়ের মানচিত্র",
    map_card_hint: "(যেকোনো জেলা বা স্থানাঙ্কে ক্লিক করে তথ্য দেখুন)",
    map_forecast_date_label: "পূর্বাভাস তারিখ:",
    map_legend_label: "নির্দেশিকা:",
    map_inspect_header: "স্থানাঙ্ক ও জেলা ভিত্তিক তথ্য",
    map_inspect_loading: "স্যাটেলাইট উপাত্ত ও বন্যা মডেল যাচাই করা হচ্ছে...",
    map_division_suffix: "বিভাগ",
    map_rank_label: "বন্যা ঝুঁকি র‍্যাংক #{rank} / ৬৪",
    map_forecast_24h_title: "২৪ ঘণ্টার এআই পূর্বাভাস ({date})",
    map_radar_blindspot: "রাডার অন্ধবিন্দু (পূর্বাভাস অপ্রাপ্য)",
    map_probability_label: "সম্ভাবনা:",
    map_badge_unsupported: "অসমর্থিত",
    map_badge_no_alert: "সতর্কতা নেই",
    map_observed_satellite_label: "স্যাটেলাইটে প্লাবনের রেকর্ড:",
    map_of_major_events: "{total}টি বড় বন্যার মধ্যে {times} বার",
    map_jrc_glofas_title: "মডেল অনুযায়ী প্লাবন গভীরতার ঝুঁকি (JRC GloFAS):",
    map_10yr_flood: "১০-বছরের বন্যা",
    map_100yr_flood: "১০০-বছরের চরম প্লাবন",
    map_inspect_disclaimer:
      "দুর্যোগ সচেতনতার জন্য এআই পূর্বাভাস। সরকারি সতর্কবার্তা FFWC প্রদান করে।",

    // Clean & Meaningful Footer
    footer_title: "রক্ষা বন্যা বুদ্ধিমত্তা প্ল্যাটফর্ম",
    footer_sub: "নাগরিক পোর্টাল · বাংলাদেশের জন্য উন্মুক্ত জলবায়ু নিরাপত্তা",
    footer_helplines_title: "জরুরি সরকারি হটলাইন",
    footer_sources_title: "যাচাইকৃত উপাত্তের উৎস",
    footer_about_link: "উপাত্তের স্বচ্ছতা ও সীমাবদ্ধতা",
    footer_copyright: "রক্ষা। উন্মুক্ত নাগরিক নিরাপত্তা বুদ্ধিমত্তা প্ল্যাটফর্ম।",
    footer_coords_note: "WGS84 ভূস্থানিক স্থানাঙ্ক ব্যবস্থা",
    footer_helpline_999: "৯৯৯ (জাতীয় জরুরি সেবা)",
    footer_helpline_1090: "১০৯০ (বন্যা ও দুর্যোগ আইভিআর)",
    footer_helpline_109: "১০৯ (নারী ও শিশু সুরক্ষা হেল্পলাইন)",
  },
};
