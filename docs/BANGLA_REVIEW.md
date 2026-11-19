# Bangla UI text review

> **This review was written by an AI model (Claude), not by a native Bangla speaker. No native speaker has checked it.**
> Treat every proposal as a draft. Items marked *medium* or *low* confidence, and everything under
> "Needs a native-speaker check", should be confirmed by a fluent Bangla reader before release.

- **Scope:** `Frontend/src` on the frontend worktree, as of 19 Nov 2026. All paths below are relative to `Frontend/src/`. Line numbers are from that snapshot. Another engineer is editing these files, so check each line before applying a fix.
- **Method:** every Bangla string in the files that are still in use was read next to its English twin.
- **Not reviewed (no longer used):** code that no page renders today is skipped. This covers most of `UI_TEXT` in `lib/translations.ts`. The live keys are `btn_gps`, `btn_my_district`, `label_district`, `placeholder_select_district` and `shelters_*`. The `nav_*`, `hero_*`, `kpi_*`, `map_*`, `alerts_*`, `timeline_*`, `hydro_*`, `side_*`, `cap_*` and `footer_*` keys are not used. Also skipped: `MapArtwork` and `getCapabilities` in `CitizenPortalApp.tsx`, the `eyebrow` and `subtitle` fields of `PAGE_METADATA` (only `title` is shown, and only for shelters, rescue and admin), and `SideDashboard.tsx`, `LeafletFloodMap.tsx`, `DistrictSatelliteTimeline.tsx` and `RainRiverCharts.tsx`. That dead text contains wording that should **not** come back as it is, for example "এআই পূর্বাভাস", "অফিসিয়াল স্থানীয় ঝুঁকি প্রতিবেদন" ("Official local risk report") and "বৃষ্টিপাত ও নদীর পরিমাপক" for a page that says it is *not* gauge data. Delete it, or review it before reusing it.
- **What is already good:** the rescue-request flow (SOS form, status messages, rescue board) is consistent and natural. The status words are used the same way across `rescueLabels.ts`, `SosCenter.tsx` and `RescuePanel.tsx`. District and division names are complete (64 + 8), and the code mostly converts digits.

---

## 1. Glossary: one term per concept

| Concept | English | Recommended Bangla | Variants found now (where) |
|---|---|---|---|
| Rokkha's **higher** forecast level | Alert | **সতর্কতা** | বিপদ (HomePage, mapLayers, CitizenPortalApp 1220, FloodMapExplorer 1908, SiteNavigation 53); বিপদ সংকেত (HomePage 393, 403); অ্যালার্ট (AlertsFeed 178, MyLocationReport 122); জরুরি সতর্কতা (অ্যালার্ট) (CitizenPortalApp 654); জরুরি অ্যালার্ট (CitizenPortalApp 1293) |
| Rokkha's **lower** forecast level | Watch | **নজরদারি** | সতর্কতা (HomePage, mapLayers, CitizenPortalApp 1221, FloodMapExplorer 1908, IntelligencePage 913, SiteNavigation 53); নজরদারি (AlertsFeed 182, MyLocationReport 124); নজরদারি (ওয়াচ) (CitizenPortalApp 659); সতর্কবার্তা (CitizenPortalApp 1293) |
| Below both levels | Low chance | **কম সম্ভাবনা** | কম; নিম্ন (CitizenPortalApp 1222); সতর্কতা সীমার নিচে (CitizenPortalApp 664, MyLocationReport 126) |
| Official FFWC level | danger level | **বিপদসীমা** (only for FFWC) | বিপদসীমা: already correct in mapLayers 331 and FloodMapExplorer 1357 |
| Warning message (general or official) | warning / official warning | **সতর্কবার্তা**; "not an official warning" = **সরকারি সতর্কবার্তা নয়** | সরকারি সতর্কতা নয় (AlertsFeed 79); সরকারি বন্যা সতর্কতা নয় (MyLocationReport 259) |
| Forecast | forecast | পূর্বাভাস | consistent |
| Model estimate | model estimate | মডেলের অনুমান | consistent |
| Probability / chance / likelihood | probability | সম্ভাবনা | "ঝুঁকি" (CitizenPortalApp 1296); "বন্যা পূর্বাভাস নির্দেশক" (AlertsFeed 187) |
| Shelter | (flood) shelter | (বন্যা) আশ্রয়কেন্দ্র | consistent |
| Facility | facility | স্থাপনা | consistent |
| Rescue team | rescue team | উদ্ধারকারী দল | consistent |
| Rescue board | rescue board | উদ্ধার বোর্ড | "যৌথ উদ্ধার বোর্ড" (RescuePanel 180) is acceptable |
| Request | request | অনুরোধ | consistent |
| Ask for help (button) | Request help / assistance | **সাহায্য চান** | সহায়তা চান (HomePage 139, 561; CitizenPortalApp 1371) |
| Request status | waiting / accepted / en route / arrived / in progress / completed / cancelled / released | দলের অপেক্ষায় / গ্রহণ করা হয়েছে / দল রওনা দিয়েছে / দল পৌঁছেছে / সাহায্য চলছে / সম্পন্ন / বাতিল / ফিরিয়ে দেওয়া | consistent: keep |
| Point Check | Point Check / Check a place | **জায়গা যাচাই** | পয়েন্ট চেক (FloodMapExplorer 2104); বিন্দু যাচাই (FloodMapExplorer 1389, IntelligencePage 438); একটি জায়গা যাচাই (SiteNavigation 44, HomePage 422) |
| Evacuation | evacuation | সরিয়ে নেওয়া / নিরাপদ স্থানে সরে যাওয়া | **উচ্ছেদ** (CitizenPortalApp 1314). This word means *eviction* and is wrong here. |
| Log in / Log out | log in / log out | **লগ ইন / লগ আউট** | লগইন, লগইন করুন, লগআউট |
| Update (data) | update | হালনাগাদ | consistent |
| Flood intelligence | flood intelligence | বন্যা তথ্য | রক্ষা ইন্টেলিজেন্স (SiteNavigation 76); বন্যার বোঝাপড়া (IntelligencePage 396) |
| Units | mm / m / km / m³/s | মিমি / মি / কিমি / ঘনমি/সে | ASCII units appear in Bangla mode in FloodMapExplorer, Hydrograph and DistrictDetailMap |

**Why Alert = সতর্কতা and Watch = নজরদারি, and not বিপদ / সতর্কতা.** Bangladeshis know **সতর্ক সংকেত / বিপদ সংকেত** from the official cyclone signals and **সতর্কসীমা / বিপদসীমা** from FFWC river levels. If Rokkha's model output is labelled "বিপদ" or "বিপদ সংকেত", it sounds like an official danger level. The rest of the UI works to say the opposite ("সরকারি সতর্কবার্তা নয়"). The map legend already places "বিপদ" (Rokkha) next to "বিপদসীমা (FFWC)" (mapLayers 121 and 331). The English words are *Watch* and *Alert*, not *Warning* and *Danger*. The other way to fix it is to keep বিপদ / সতর্কতা everywhere, which is the majority usage today. That is shorter, but it carries the official-level risk. This is a product decision, so it is listed under "Needs a native-speaker check". Whichever option is chosen, use it everywhere: today the same level gets three or four different names.

---

## 2. Concrete fixes

Confidence: **high** means a clear error or mismatch, with an obvious fix. **medium** means the fix is clearly better but the wording should be confirmed. **low** means a style preference or an uncertain call.
Rows marked *(glossary)* depend on adopting the Alert / Watch choice in section 1.

### 2a. Safety, risk and "not official" meaning (fix first)

| # | file:line | current bn | proposed bn | reason | conf. |
|---|---|---|---|---|---|
| 1 | `components/CitizenPortalApp.tsx:1314` | `জরুরি উচ্ছেদ ও নিরাপত্তা নির্দেশনা` | `জরুরি অবস্থায় সরে যাওয়া ও নিরাপত্তা নির্দেশনা` | "উচ্ছেদ" means eviction or demolition, not evacuation. | high |
| 2 | `components/site/HomePage.tsx:393` | `` `${num(onAlert.length)}টি জেলায় বিপদ সংকেত` `` | `` `${num(onAlert.length)}টি জেলায় সতর্কতা` `` | "বিপদ সংকেত" is official signal vocabulary (cyclone signals). English says only "Alert in N districts". *(glossary)* | high |
| 3 | `components/site/HomePage.tsx:403` | `কোনো জেলায় সতর্কতা বা বিপদ সংকেত নেই` | `কোনো জেলা নজরদারি বা সতর্কতা স্তরে নেই` | Same issue as #2. *(glossary)* | high |
| 4 | `components/MyLocationReport.tsx:259` | `পূর্বাভাস পুরো জেলার জন্য, আপনার নির্দিষ্ট স্থানের জন্য নয়। এটি সরকারি বন্যা সতর্কতা নয় (এফএফডব্লিউসি দেখুন)।` | `পূর্বাভাস পুরো জেলার জন্য, আপনার নির্দিষ্ট স্থানের জন্য নয়। এটি মডেলের অনুমান, সরকারি বন্যা সতর্কবার্তা নয় (FFWC দেখুন)।` | The Bangla drops "it is a model estimate". The rest of the UI keeps FFWC in Latin script. | high |
| 5 | `components/map/mapLayers.ts:342` | `যাচাই করা ক্ষয়ক্ষতি বা রাস্তার অবস্থার কোনো উৎস নেই।` | `যাচাই করা ক্ষয়ক্ষতি বা রাস্তার অবস্থার কোনো উৎস নেই। সাহায্যের অনুরোধ গোপন থাকে, কখনো দেখানো হয় না।` | The Bangla drops the privacy promise ("Help requests are private and never shown"). | high |
| 6 | `components/AlertsFeed.tsx:187` | `বন্যা পূর্বাভাস নির্দেশক` | `মডেলের বন্যা সম্ভাবনা` | English is "Model flood probability". The Bangla ("flood forecast indicator") loses both "model" and "probability". | high |
| 7 | `components/CitizenPortalApp.tsx:1296` | `` `${toBnNum(Math.round(alert.probability * 100))}% ঝুঁকি` `` | `` `${toBnNum(Math.round(alert.probability * 100))}% সম্ভাবনা` `` | The value is a probability, not a risk (the English "% Risk" has the same issue). On the same line, `alert.district.name` shows the English district name in Bangla mode. Use `DISTRICTS_BN[alert.district.pcode] \|\| alert.district.name` when `lang === "bn"`. | high |
| 8 | `components/DistrictDetailMap.tsx:165` | `ঝুঁকিপূর্ণ কেন্দ্র` | `জেলার কেন্দ্র` | The marker is the district's centre point. The Bangla says "risky centre", which is a risk claim the data does not make. The English "District Epicenter" is also odd; "District centre" is suggested. | high |
| 9 | `lib/rescueLabels.ts:11` | `ঘর ভেঙে পড়ার ঝুঁকি` | `ঘর নিরাপদ নয়` | English is "House is unsafe". The Bangla narrows it to "risk of collapse", so people whose house is flooding but not collapsing may not pick it. The same string is the hint in `components/site/SiteNavigation.tsx:65` (`hint.bn`), so change both. | high |
| 10 | `components/AlertsFeed.tsx:79` | `রক্ষা মডেলের এক দিনের পূর্বাভাস · সরকারি সতর্কতা নয় (ffwc.gov.bd)` | `রক্ষা মডেলের এক দিনের পূর্বাভাস · সরকারি সতর্কবার্তা নয় (ffwc.gov.bd)` | Use one phrase for "not an official warning" everywhere, and keep "সতর্কতা" for the Alert level. | medium |
| 11 | `components/CitizenPortalApp.tsx:1305` | `এই জেলায় বর্তমানে কোনো চরম লাল সতর্কবার্তা নেই।` | `এই দিনে এই জেলা বা বিভাগের কোনো জেলা নজরদারি বা সতর্কতা স্তরে নেই। কম সম্ভাবনা মানে শূন্য ঝুঁকি নয়।` | The list above it (line 1281) covers the district **and its division**, at either level. "চরম লাল" (extreme red) suggests that milder warnings might still exist. Update the English to match. | medium |
| 12 | `components/map/FloodMapExplorer.tsx:1369` | `সংরক্ষিত নমুনা` | `সংরক্ষিত নমুনা (সার্ভারে পৌঁছানো যায়নি)` | Drops "(server not reachable)", which tells the user the data is not live. | medium |
| 13 | `components/map/mapLayers.ts:238` | `সর্বশেষ দৈনিক সংগ্রহের পরের ৭২ ঘণ্টায় জেলার বিন্দুতে আবহাওয়া মডেলের পূর্বাভাসিত মোট বৃষ্টি। বৃষ্টির পূর্বাভাস, বন্যার নয়।` | `সর্বশেষ দৈনিক সংগ্রহের পরের ৭২ ঘণ্টায় জেলার বিন্দুতে আবহাওয়া মডেলের পূর্বাভাসিত মোট বৃষ্টি। বৃষ্টির পূর্বাভাস, বন্যার পূর্বাভাস নয়; বৃষ্টিমাপকের মাপও নয়।` | Drops "not a gauge reading". | medium |
| 14 | `components/map/mapLayers.ts:300` | `জেলার জমির কত অংশ মডেলের ১০০ বছরে একবারের নদী-বন্যা এলাকায়। দীর্ঘমেয়াদি মডেল, বাঁধ ধরে না; আজকের অবস্থা বলে না।` | `জেলার জমির কত অংশ মডেলের ১০০ বছরে একবারের নদী-বন্যা এলাকায়। দীর্ঘমেয়াদি মডেল, বাঁধের প্রভাব হিসাবে নেয় না; আজকের অবস্থা বলে না।` | "বাঁধ ধরে না" can read as "does not hold back the embankment" or "dam doesn't hold". The meaning is "ignores embankments". | medium |
| 15 | `components/map/FloodMapExplorer.tsx:1531` | `নির্দিষ্ট জায়গার উচ্চতা দেখানো হয় না।` | `নির্দিষ্ট জায়গার উচ্চতা দেখানো হয় না: ভূপ্রকৃতির টাইলগুলো ছবি, মাপ নয়।` | Drops the reason. | medium |
| 16 | `components/map/FloodMapExplorer.tsx:1801` | `ছায়াসহ ভূমির উচ্চতা (Copernicus DEM, ৯০ মি)।` | `ছায়াসহ ভূমির উচ্চতা (Copernicus DEM, ৯০ মি)। বন্যার রঙ পরিষ্কার রাখতে শুরুতে বন্ধ থাকে।` | Drops "Off by default so flood colours stay clear". | low |

### 2b. Alert / Watch / Low levels, made consistent *(glossary)*

| # | file:line | current bn | proposed bn | reason | conf. |
|---|---|---|---|---|---|
| 17 | `components/CitizenPortalApp.tsx:1293` | `জরুরি অ্যালার্ট` / `সতর্কবার্তা` | `সতর্কতা` / `নজরদারি` | Watch is rendered as "সতর্কবার্তা" (warning message). That is wrong whichever glossary option is chosen. | high |
| 18 | `components/CitizenPortalApp.tsx:1220-1222` | `বিপদ` / `সতর্কতা` / `নিম্ন` | `সতর্কতা` / `নজরদারি` / `কম` | Consistency. "নিম্ন" is formal; the map and home page use "কম". | medium |
| 19 | `components/CitizenPortalApp.tsx:654` | `জরুরি সতর্কতা (অ্যালার্ট)` | `সতর্কতা` | Consistency. Remove the English in brackets. (The English "CRITICAL ALERT" also differs from the "Alert" used elsewhere.) | medium |
| 20 | `components/CitizenPortalApp.tsx:659` | `নজরদারি (ওয়াচ)` | `নজরদারি` | Remove the transliterated English in brackets. | medium |
| 21 | `components/CitizenPortalApp.tsx:664` and `components/MyLocationReport.tsx:126` | `সতর্কতা সীমার নিচে` | `কম সম্ভাবনা` | Level "none" is below **Watch**, not only below Alert. The English "BELOW ALERT LEVEL" has the same flaw; "LOW CHANCE" is suggested. | medium |
| 22 | `components/AlertsFeed.tsx:178` and `components/MyLocationReport.tsx:122` | `অ্যালার্ট` | `সতর্কতা` | Transliteration; consistency. | medium |
| 23 | `components/site/HomePage.tsx:160` | `জেলায় বিপদ` | `জেলায় সতর্কতা` | Consistency. | medium |
| 24 | `components/site/HomePage.tsx:164` | `জেলায় সতর্কতা` | `জেলায় নজরদারি` | Consistency. | medium |
| 25 | `components/site/HomePage.tsx:215` | `সতর্কতা` | `নজরদারি` | Legend chip for Watch. | medium |
| 26 | `components/site/HomePage.tsx:216` | `বিপদ` | `সতর্কতা` | Legend chip for Alert. | medium |
| 27 | `components/site/HomePage.tsx:239` (`dbn`) | `সম্ভাবনা বেশি হলে জেলা সতর্কতা বা বিপদ স্তরে যায়, সাথে সেই জেলার নিবন্ধিত আশ্রয়কেন্দ্র ও হাসপাতাল।` | `সম্ভাবনা বেশি হলে জেলা নজরদারি বা সতর্কতা স্তরে যায়, সাথে সেই জেলার নিবন্ধিত আশ্রয়কেন্দ্র ও হাসপাতাল।` | Consistency. | medium |
| 28 | `components/site/HomePage.tsx:326` (`dbn`) | `সম্ভাবনা বেশি হলে জেলা সতর্কতা বা বিপদ স্তরে যায়। এটি মডেলের অনুমান, সরকারি সতর্কবার্তা নয়।` | `সম্ভাবনা বেশি হলে জেলা নজরদারি বা সতর্কতা স্তরে যায়। এটি মডেলের অনুমান, সরকারি সতর্কবার্তা নয়।` | Consistency. | medium |
| 29 | `components/site/HomePage.tsx:398` | `` `${num(onWatch.length)}টি জেলায় সতর্কতা` `` | `` `${num(onWatch.length)}টি জেলায় নজরদারি` `` | Consistency. | medium |
| 30 | `components/site/SiteNavigation.tsx:53` (`hint.bn`) | `সতর্কতা বা বিপদ স্তরের জেলা` | `নজরদারি বা সতর্কতা স্তরের জেলা` | Consistency. | medium |
| 31 | `components/map/mapLayers.ts:115` | `…রক্ষার মেশিন-লার্নিং মডেল থেকে। সতর্কতা ও বিপদ মডেলের সতর্কসংকেত।` | `…রক্ষার মেশিন-লার্নিং মডেল থেকে। নজরদারি ও সতর্কতা হলো মডেলের নিজস্ব স্তর।` | Consistency. Replace only the last sentence. | medium |
| 32 | `components/map/mapLayers.ts:121` | `বিপদ — সরে যাওয়ার প্রস্তুতি` | `সতর্কতা — সরে যাওয়ার প্রস্তুতি নিন` | Consistency. Adding "নিন" matches the imperative on line 122. | medium |
| 33 | `components/map/mapLayers.ts:122` | `সতর্কতা — প্রস্তুতি নিন` | `নজরদারি — প্রস্তুতি নিন` | Consistency. | medium |
| 34 | `components/map/mapLayers.ts:134` | `` `বিপদ · ${chance}` `` | `` `সতর্কতা · ${chance}` `` | Consistency. | medium |
| 35 | `components/map/mapLayers.ts:135` | `` `সতর্কতা · ${chance}` `` | `` `নজরদারি · ${chance}` `` | Consistency. | medium |
| 36 | `components/map/FloodMapExplorer.tsx:1908` | `` `২০২৩–২০২৪ এ (অদেখা): বিপদ স্তরের জেলার …% এ বন্যা হয়েছে; সতর্কতা স্তর …% বন্যা ধরেছে।` `` | `` `২০২৩–২০২৪ এ (প্রশিক্ষণে না-দেখা বছর): সতর্কতা স্তরের জেলার …% এ বন্যা হয়েছে; নজরদারি স্তর …% বন্যা ধরেছে।` `` | Consistency. "(অদেখা)" alone is unclear. Keep the `${n(...)}` expressions unchanged. | medium |
| 37 | `components/intelligence/IntelligencePage.tsx:913` | `…; সতর্কতা স্তরে …টি ধরেছে, …টি মিস।` | `…; নজরদারি স্তরে …টি ধরেছে, …টি ধরতে পারেনি।` | This is the Watch level (`at_watch`). "মিস" is transliterated. | medium |
| 38 | `components/intelligence/IntelligencePage.tsx:1006` | `Watch ≥ … · Alert ≥ … → Alert` / `Watch` (English with no Bangla branch) | `{tr("Watch", "নজরদারি")} ≥ … · {tr("Alert", "সতর্কতা")} ≥ … → {lvl === "alert" ? tr("Alert", "সতর্কতা") : lvl === "watch" ? tr("Watch", "নজরদারি") : …}` | English is shown in Bangla mode. | high |

### 2c. English shown in Bangla mode

| # | file:line | current (shown in bn) | proposed bn | reason | conf. |
|---|---|---|---|---|---|
| 39 | `services/rescue.ts:234` | `No connection to the server.` | `সার্ভারের সঙ্গে সংযোগ নেই।` (needs an `isBn` parameter, or store a code and translate it in `SosCenter.tsx:410`) | A citizen sees this under "শেষ চেষ্টা:" on the SOS card. | high |
| 40 | `services/auth.ts:110` | `The server could not be reached. Accounts need a connection.` | `সার্ভারে পৌঁছানো যায়নি। অ্যাকাউন্ট ব্যবহারে ইন্টারনেট সংযোগ লাগে।` | Shown on the login page and on the rescue and admin pages. Backend `detail` messages (line 125) are also English only. | medium |
| 41 | `components/map/FloodMapExplorer.tsx:1518` and `components/MyLocationReport.tsx:283` | `depth_label` raw (`1 to 3 m`, `< 1 m`, …) | Reuse the map at `CitizenPortalApp.tsx:1238`: `{"< 1 m": "১ মি.-এর কম", "1 to 3 m": "১–৩ মি.", "3 to 10 m": "৩–১০ মি.", "> 10 m": "১০ মি.-এর বেশি"}` | The depth value, the most concrete number in the report, appears in English. | high |
| 42 | `components/intelligence/IntelligencePage.tsx:590, 594, 597, 600, 711, 746, 749, 948, 1160, 1163, 1166, 1169, 1172, 1175` | `action="Read the technical methodology: "` and similar English labels (the Bangla fallback at line 88 never runs because `action` is always passed) | Pass `action={tr(…)}`: "Read the technical methodology: " → `প্রযুক্তিগত পদ্ধতি পড়ুন: `; "Read the technical explanation: " → `প্রযুক্তিগত ব্যাখ্যা পড়ুন: `; "Explore all 15 inputs: " → `১৫টি ইনপুট দেখুন: `; "View the evaluation methodology: " → `যাচাইয়ের পদ্ধতি দেখুন: `; "Explore the underlying architecture: " → `ভেতরের কাঠামো দেখুন: `; "See how the data is processed: " → `তথ্য কীভাবে প্রক্রিয়া হয় দেখুন: `; "View the model architecture: " → `মডেলের কাঠামো দেখুন: `; "Explore the methodology: " → `পদ্ধতি দেখুন: ` | English labels in Bangla mode. | high |
| 43 | `components/intelligence/IntelligencePage.tsx:590, 594, 597, 600` (`title=`) | `satellite flood labels (Copernicus GFM)`, `rain (ERA5 and GFS)`, `river flow (GloFAS)`, `boundaries, UNOSAT and JRC` | `স্যাটেলাইটের বন্যা-লেবেল (Copernicus GFM)`, `বৃষ্টি (ERA5 ও GFS)`, `নদী-প্রবাহ (GloFAS)`, `সীমানা, UNOSAT ও JRC` | English titles. The 1160–1175 titles are in a section the page itself labels "English only" (line 1158), so they can stay. | medium |
| 44 | `components/AdminPanel.tsx:202, 238, 109` | role names `user` / `rescuer` / `admin` shown raw, in the help text and the role `<select>` | Add a label map: `user` → `সাধারণ ব্যবহারকারী`, `rescuer` → `উদ্ধারকারী`, `admin` → `অ্যাডমিন`. Line 202: `সাধারণ ব্যবহারকারী: পূর্বাভাস দেখেন ও সাহায্য চাইতে পারেন। উদ্ধারকারী: সাহায্যের অনুরোধও দেখেন ও সামলান। অ্যাডমিন: ভূমিকা ও স্থানও পরিচালনা করেন। নিজের ভূমিকা নিজে বদলানো যায় না।` | English values, though this is a staff-only page. | medium |
| 45 | `components/AdminPanel.tsx:337`, `components/DistrictDetailMap.tsx:137` | `asset_type` raw (`flood_shelter`, `hospital`, …) | Reuse the labels from `NearestShelters.tsx:169-175` (বন্যা আশ্রয়কেন্দ্র / হাসপাতাল / ক্লিনিক / বিদ্যালয়) | English codes are shown. DistrictDetailMap is on the citizen district report. | medium |
| 46 | `components/map/FloodMapExplorer.tsx:1646` | `` `রক্ষার তথ্য জেলা-ভিত্তিক। ${current.name} এ …` `` | Use `${placeName(current, true)}` instead of `${current.name}` | The upazila name is shown in English inside a Bangla sentence. Line 1395 (`place.upazila`) has the same issue. | medium |
| 47 | `data/floodContacts.ts:67` | `bn: null`, so the English name "Bangladesh Red Crescent Society" is shown | `বাংলাদেশ রেড ক্রিসেন্ট সোসাইটি` | The only contact without a Bangla name. It may have been left null on purpose until the name was checked against the source. | medium |
| 48 | `components/intelligence/IntelligencePage.tsx:963` | `` `সাম্প্রতিক স্যাটেলাইট ইনপুট মডেলের ~৫৯% gain; এগুলো ছাড়া PR-AUC ${…} থেকে ${…}।` `` | `` `সাম্প্রতিক স্যাটেলাইট ইনপুটে মডেলের শেখার (gain) প্রায় ৫৯%; এগুলো বাদ দিলে PR-AUC ${…} থেকে নেমে ${…} হয়।` `` | The bare English word "gain", and the sentence has no verb. | medium |

### 2d. Awkward, transliterated or inconsistent wording

| # | file:line | current bn | proposed bn | reason | conf. |
|---|---|---|---|---|---|
| 49 | `services/location.ts:42` | `লোকেশন পারমিশন বন্ধ` | `অবস্থানের অনুমতি বন্ধ` | Transliteration. "অবস্থান" is used everywhere else. Still 3 words. | high |
| 50 | `services/location.ts:50` | `সময় শেষ হয়েছে` | `সময়মতো অবস্থান মেলেনি` | Without context, "time is up" does not say what timed out. English: "Location timed out". | medium |
| 51 | `components/map/FloodMapExplorer.tsx:2104` | `একটি বিভাগ বা জেলা বেছে নিন, স্থান খুঁজুন, অথবা পয়েন্ট চেকের জন্য মানচিত্রে চাপুন।` | `একটি বিভাগ বা জেলা বেছে নিন, স্থান খুঁজুন, অথবা কোনো জায়গা যাচাই করতে মানচিত্রে চাপুন।` | Transliteration. The nav and home page call this feature "জায়গা যাচাই". | high |
| 52 | `components/map/FloodMapExplorer.tsx:1389` | `বিন্দু যাচাই` | `জায়গা যাচাই` | Point Check consistency. The same applies to `IntelligencePage.tsx:438` (`বিন্দু যাচাই`). | medium |
| 53 | `components/MyLocationReport.tsx:160` | `লগআউট` | `লগ আউট` | Matches SiteNavigation 261 and 336. | medium |
| 54 | `components/AdminPanel.tsx:97`, `components/RescuePanel.tsx:138` | `লগইন` | `লগ ইন` | Matches SiteNavigation 341 and PortalAccessPage 200 and 344. | medium |
| 55 | `components/AdminPanel.tsx:93` | `অ্যাডমিন অ্যাকাউন্ট দিয়ে লগইন করুন।` | `অ্যাডমিন অ্যাকাউন্ট দিয়ে লগ ইন করুন।` | Same as #54. `RescuePanel.tsx:134` also has `…লগইন করুন।` → `…লগ ইন করুন।` | medium |
| 56 | `components/PortalAccessPage.tsx:361` | `লগইন করুন` | `লগ ইন করুন` | Same as #54. | medium |
| 57 | `components/PortalAccessPage.tsx:366` | `নতুন অ্যাকাউন্ট প্রয়োজন?` | `অ্যাকাউন্ট নেই?` | English is "Don't have an account?". The Bangla ("Need a new account?") is a stiff literal phrasing. | medium |
| 58 | `components/site/HomePage.tsx:139`, `:561`; `components/CitizenPortalApp.tsx:1371` | `সহায়তা চান` | `সাহায্য চান` | The header button (SiteNavigation 251) and SOS flow say "সাহায্য চান". Use one label for the same action. | medium |
| 59 | `components/site/SiteNavigation.tsx:76` | `রক্ষা ইন্টেলিজেন্স` | `রক্ষার তথ্য ও মডেল` | Transliteration. The same page is already called "রক্ষার তথ্য ও মডেল" at line 45. | medium |
| 60 | `components/intelligence/IntelligencePage.tsx:396` | `পরিবেশের তথ্য থেকে বন্যার বোঝাপড়া।` | `পরিবেশের তথ্য থেকে বন্যার আগাম ধারণা।` | "বোঝাপড়া" usually means a mutual understanding or settlement between people. | medium |
| 61 | `components/intelligence/IntelligencePage.tsx:611` | `তিনটি আলাদা প্রবাহ, একটি মডেল, একটি মানচিত্র।` | `তিনটি আলাদা তথ্য-ধারা, একটি মডেল, একটি মানচিত্র।` | On this page "প্রবাহ" means river flow, so it should not also translate "pipeline". | medium |
| 62 | `components/intelligence/IntelligencePage.tsx:844` | `সম্ভাবনা কি সৎ?` | `সম্ভাবনার হিসাব কি বাস্তবের সঙ্গে মেলে?` | "সৎ" (morally honest) is a literal rendering of a statistics metaphor (calibration). | medium |
| 63 | `components/intelligence/IntelligencePage.tsx:965` | `সম্ভাবনা মোটামুটি সৎ` | `সম্ভাবনার হিসাব মোটামুটি বাস্তবসম্মত` | Same issue as #62. | medium |
| 64 | `components/site/HomePage.tsx:351` | `…এটি বন্যা মিস করতে পারে বা ভুল সতর্কতা দিতে পারে; …` | `…এটি কিছু বন্যা ধরতে না-ও পারে, আবার ভুল সতর্কবার্তাও দিতে পারে; …` | "মিস করতে" is transliterated. Using "সতর্কবার্তা" also avoids a clash with the Alert-level term. | low |
| 65 | `components/AlertsFeed.tsx:227` | `ধারণক্ষমতা` (renders as "১,২০০ ধারণক্ষমতা") | `জনের ধারণক্ষমতা` | Renders as "১,২০০ জনের ধারণক্ষমতা". The number on its own before "ধারণক্ষমতা" reads awkwardly. | medium |
| 66 | `data/floodContacts.ts:68` | `রেড ক্রিসেন্টের সেবা, দুর্যোগে ত্রাণসহ, সম্পর্কে তথ্য।` | `দুর্যোগে ত্রাণসহ রেড ক্রিসেন্টের বিভিন্ন সেবার তথ্য।` | Copies the English comma structure, which is hard to read in Bangla. | medium |
| 67 | `components/site/SiteNavigation.tsx:30` (`hint.bn`) | `আপনার দলের জন্য যৌথ অনুরোধ` | `সব উদ্ধারকারী দলের একই অনুরোধ-তালিকা` | "যৌথ অনুরোধ" reads as "a joint request", but the meaning is one request list shared by all teams. | low |
| 68 | `components/AlertsFeed.tsx:148`, `components/MyLocationReport.tsx:116`, `components/CitizenPortalApp.tsx:680` | `৯৫% এর বেশি` | `৯৫%-এর বেশি` | Standard hyphenation of the case ending after a symbol. | low |
| 69 | `lib/translations.ts:570` | `অনুসন্ধান ব্যাসার্ধ` | `কত দূর পর্যন্ত খুঁজবেন` | "ব্যাসার্ধ" (radius) is a textbook word. A plain phrase suits a citizen page better. | low |

### 2e. Numbers, dates and units in Bangla mode

| # | file:line | what shows now (bn) | proposed change | conf. |
|---|---|---|---|---|
| 70 | `components/site/HomePage.tsx:99` | Issued time uses `toLocaleString("en-GB", …)`, then `num()`, which gives "১৮ Nov, ০৯:৩০" with an English month | Use `toLocaleString(isBn ? "bn-BD" : "en-GB", …)` (bn-BD already gives Bangla digits and month names) | high |
| 71 | `components/map/FloodMapExplorer.tsx:1072` (`formatIssued`) | Same as #70 ("Nov") | Use `toLocaleString(bn ? "bn-BD" : "en-GB", …)` | high |
| 72 | `components/map/FloodMapExplorer.tsx:1171` | `{p.target_date}` and `{p.data_through}` show raw ISO dates in ASCII ("2026-11-18") | Wrap in `n(...)`, or format with `bn-BD` like `dateLabel` | high |
| 73 | `components/RescuePanel.tsx:185`, `components/SosCenter.tsx:255` | `toLocaleTimeString([], …)` uses the browser locale, so an English-locale phone shows "০২:৩০ PM" | Use `toLocaleTimeString(isBn ? "bn-BD" : undefined, …)` | medium |
| 74 | `components/map/FloodMapExplorer.tsx:1227-1229` | `… m`, `… %` | `{tr("m", "মি")}`. For percentages, drop the space: `%` | medium |
| 75 | `components/map/FloodMapExplorer.tsx:1463, 1464, 1471` | `… mm` | `{tr("mm", "মিমি")}` | medium |
| 76 | `components/map/FloodMapExplorer.tsx:1491, 2021` | `… km` | `{tr("km", "কিমি")}` | medium |
| 77 | `components/map/FloodMapExplorer.tsx:1339, 1368` | `… m³/s`; on line 1368 `Math.round(st.usual)` is also not converted to Bangla digits | `{tr("m³/s", "ঘনমি/সে")}`, and `n(Math.round(st.usual))` on 1368 | medium |
| 78 | `components/map/Hydrograph.tsx:105` | Hover label `fmt(h.value) + " m³/s"` | `fmt(h.value) + tr(" m³/s", " ঘনমি/সে")` | medium |
| 79 | `components/DistrictDetailMap.tsx:139` | `${distKm} km দূরে` (ASCII digits and unit) | `${isBn ? toBnNum(distKm) : distKm} ${isBn ? "কিমি দূরে" : "km away"}` | medium |
| 80 | `components/intelligence/IntelligencePage.tsx:421-422, 983, 1004, 1075, 1077, 1099` | ASCII counts, dates and percentages (`{supported.size}`, `{ex.date}`, `{ex.count}`, `… %`, `{hs.events_flooded} / {hs.events_observed}`, `{m.date}`) | Wrap in the page's Bangla-digit helper when `bn` | low (research page) |
| 81 | `components/CitizenPortalApp.tsx:638` | `"N/A"` passed through `toBnNum`, so it stays "N/A" | `isBn ? "তথ্য নেই" : "N/A"` | low |

**Leave as is:** the latitude and longitude examples in `AdminPanel.tsx:305-306` and `FloodMapExplorer.tsx:1051` (`24.8474`, `24.85, 91.14`) should stay in ASCII. They are typed into number inputs and must be ASCII.

---

## 3. Needs a native-speaker check

1. **Alert / Watch terms (rows 2–3 and 17–38).** Choose between নজরদারি / সতর্কতা (recommended here, because it avoids sounding like official FFWC or cyclone signals) and সতর্কতা / বিপদ (the current majority, shorter and more urgent). Also check whether "নজরদারি" sounds right to rural readers as a flood level ("under watch"). Other candidates: "সতর্ক থাকুন" for Watch and "উচ্চ সতর্কতা" for Alert.
2. **"সরে যাওয়ার প্রস্তুতি নিন" (row 32).** Check that this is strong enough for the Alert level without sounding like an official evacuation order. The English is "be ready to move".
3. **Evacuation heading (row 1).** "জরুরি অবস্থায় সরে যাওয়া" or "নিরাপদ স্থানে সরে যাওয়া": which is more natural in a heading?
4. **"ঘর নিরাপদ নয়" (row 9).** Confirm that a flood-affected person would choose this option for "water entering / walls cracking / roof at risk".
5. **"বাঁধের প্রভাব হিসাবে নেয় না" (row 14).** Confirm that বাঁধ is the right word for river embankments in this context, as opposed to "বেড়িবাঁধ" (the common word for coastal embankments).
6. **IntelligencePage metaphors (rows 60–63).** Check "বন্যার আগাম ধারণা", "তথ্য-ধারা" and "বাস্তবসম্মত" for tone.
7. **Red Crescent Bangla name (row 47).** Confirm the exact official spelling on bdrcs.org before filling it in.
8. **"হ্যালোজেন ট্যাবলেট" (`CitizenPortalApp.tsx:1333`).** Is this the term people use in Bangladesh? It is widely used in DPHE/NGO messaging, but "পানি বিশুদ্ধকরণ ট্যাবলেট" may be clearer. The English says "Halazone". No change is proposed until someone checks.
9. **"সময়মতো অবস্থান মেলেনি" (row 50)** and **"কত দূর পর্যন্ত খুঁজবেন" (row 69).** These are plain-language rewrites; check the tone.
10. **"নির্ভুলতা প্রায় … মিটার" (SosCenter 481, 576).** It reads fine to the reviewer, but "আনুমানিক ভুল … মিটার পর্যন্ত" may be easier for non-technical users to understand.
11. **District spellings.** `নেত্রকোণা`, `রাঙ্গামাটি` and `মুন্সীগঞ্জ` in `DISTRICTS_BN` match the districts' own .gov.bd portals as far as the reviewer knows, but other official sources spell them differently (নেত্রকোনা, রাঙামাটি, মুন্সিগঞ্জ). Choose one standard.

## 4. Structural notes (not single-string fixes)

- **Server text.** `alert.message` (`CitizenPortalApp.tsx:1297`), backend error `detail` strings and `last_problem` are shown unchanged in Bangla mode. They are English unless the backend localises them. Either send a code that the frontend translates, or show a short Bangla fallback in Bangla mode.
- **`intelligence/glossary.tsx` and `intelligence/charts.tsx` are English only.** Their definitions and chart labels appear in Bangla mode on the Intelligence page (line 810, and every `<Term>` tooltip). That page is aimed at researchers, so this is lower priority than the citizen pages, but it is the largest block of untranslated text left.
- **The English side has the same inconsistencies.** The same level is called "CRITICAL ALERT", "Alert" and "ALERT", and the same probability is called "% Risk", "Likelihood" and "Model probability". Fix both languages together so that the Bangla terms map one-to-one.

---

## 5. What was applied (19 Nov 2026, same day; still not checked by a native speaker)

- **Applied:**
  - **Safety and meaning (§2a):** rows 1–10 and 12–14 (15 and 16 not yet), plus the district-report wording for row 11. Row 11 now says "neither this district nor another district in its division" and uses a neutral box instead of a green one.
  - **Levels (§2b):** the recommended pair, **Alert = সতর্কতা** and **Watch = নজরদারি**, is used everywhere users see it. That covers the homepage, map legend and values, district report, Alerts page, location report and Intelligence page. বিপদ is kept only for FFWC's বিপদসীমা. The low level is "কম সম্ভাবনা" on a neutral colour, never green.
  - **English shown in Bangla mode (§2c):**
    - rows 38, 39–40 (client error messages are translated where they are shown), 41, 42–43, 44 and 45 (district report popup only; the admin list still shows type codes);
    - the depth labels now come from one shared helper.
  - **Wording (§2d):** rows 49–63, 65 and 67; row 57 no longer applies because the duplicate footer link was removed.
    - Log in / log out is written "লগ ইন / লগ আউট" everywhere.
    - "সাহায্য চান" is used for every help button.
    - "জায়গা যাচাই" is used for Point Check.
  - **Numbers and dates (§2e):** rows 70–73 and 75–77 (mm → মিমি, km → কিমি, m → মি; m³/s kept as the international unit), and 79.
  - **Also changed:** the Alerts page heading is now "জেলার বন্যা সতর্কবার্তা", so it no longer clashes with the Alert level name.
- **Not applied and still open:**
  - row 47 (Red Crescent Bangla name; confirm the spelling on bdrcs.org first);
  - rows 15, 16, 46, 48 and 66 (medium; not yet done);
  - rows 64, 68, 69, 74, 78, 80 and 81 (low-confidence style items);
  - the structural notes in §4 (server messages stay English; glossary and chart text on the Intelligence page are English only).
- **Everything in §3 still needs a native speaker,** especially the সতর্কতা / নজরদারি choice.
