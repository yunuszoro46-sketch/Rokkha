# Shelter and facility data audit

Audit date: 19 November 2026. Read-only: no database document and no source file was changed.

**Data audited:** the `assets` collection in the LOCAL MongoDB test copy (`mongodb://127.0.0.1:27018`, database
`rokkha_preview`), 3,164 documents. This is a copy; the production database was not touched. Numbers below are for
this copy and should match production only if the copy is current.

**Where the data comes from:** `Backend/scripts/import_osm_facilities.py` (read in full for this audit). It takes the
Humanitarian OpenStreetMap Team (HOT) Bangladesh exports on HDX (snapshot 4 November 2026), keeps named features and
writes them as assets:

| Field | Where it comes from (import script) |
|---|---|
| `name` | OSM `name`, else `name_en`, else `name_bn`; trimmed, cut at 150 characters, must be at least 2 characters. Never edited. |
| `asset_type` | `hospital`: `amenity=hospital` or `healthcare=hospital`. `clinic`: `amenity=clinic` or `healthcare=clinic/centre`. `flood_shelter`: **only because the name** matches "cyclone shelter / cyclone centre / flood shelter / আশ্রয় কেন্দ্র / ঘূর্ণিঝড় কেন্দ্র". The health file is read first, so a health tag wins. |
| `location` | The OSM point, or a point inside the building outline (`representative_point`). |
| `occupancy` | OSM `capacity_persons`, kept only if it is a plain positive whole number; otherwise `null`. |
| `criticality` | A fixed rule, not a measurement: hospital = `critical`, clinic and shelter = `high`. |
| `source` / `notes` | `"OpenStreetMap"` and a note with the snapshot date and the ODbL credit. |
| `source_id` | `osm:<node/way/relation>/<id>` (see the finding below: missing in this copy). |
| `district` | Point-in-polygon on the district boundaries; points outside every district were skipped at import (98 of 3,260). |

There is **no `school` asset type in the data** (the type exists in the API vocabulary, but nothing uses it). Schools appear
only as `flood_shelter` when the name says "school cum cyclone shelter" and similar.

## Summary

| Check | Result |
|---|---|
| Total documents | 3,164 |
| By type | hospital 2,108 · clinic 891 · flood_shelter 164 · other 1 · school 0 |
| By source | OpenStreetMap 3,162 · no source 2 |
| Missing coordinates | 0 |
| Outside Bangladesh box (lon 88.0–92.7, lat 20.5–26.7) | 0 |
| Missing district | 0 |
| `source_id` (OSM id) stored | **0 of 3,162 OSM documents** (the import script writes it; this copy does not have it) |
| `occupancy` > 0 / = 0 / null | 7 / 0 / 3,157 |
| Exact-name duplicates within 200 m | 84 pairs (55 likely same place, 19 likely same institution, 10 unclear) |
| Near-identical names within 1 km | 97 pairs (47 likely same, 41 probably different, 9 unclear) |
| Different names within 30 m | 525 pairs (21 likely same, 3 same institution, 11 unclear, 27 already in 3b, 463 probably different) |
| Places shown more than once (from "likely same" pairs only) | 237 assets in 116 groups, so about **121 extra pins** |
| Animal / veterinary hospitals typed `hospital` | 26 |
| Pharmacies / drug shops typed hospital or clinic | 13 |
| Names with a Google-Maps-style ", Hospital" category tail | 528 (449 end in ", Hospital") |
| Test/junk names | 3 (`ghdgn`, `tyu`, `ozpitalez 24 orillaz :v`) |

## 1. Counts by type and source

| asset_type | OpenStreetMap | no source (made by hand through the API) | Total | criticality (rule) |
|---|---|---|---|---|
| hospital | 2,107 | 1 | 2,108 | critical |
| clinic | 891 | 0 | 891 | high |
| flood_shelter | 164 | 0 | 164 | high |
| other | 0 | 1 | 1 | high |
| school | 0 | 0 | 0 | — |
| **Total** | **3,162** | **2** | **3,164** | |

OSM element kinds in the build file (`data/assets/osm_facilities.json`, 3,260 rows): node 2,832, way (building outline)
424, relation 4.

Shelters are concentrated on the coast: Barguna 36, Bagerhat 35, Khulna 27, Bhola 21, Patuakhali 15, Chattogram 15,
Cox's Bazar 7, Kurigram 3, and one each in Jhalokati, Cumilla, Kishoreganj, Satkhira, Sunamganj. 164 named shelters is
far below the real number (the government lists several thousand cyclone shelters); the import README says this too.

All by division: Dhaka 1,169 · Chattogram 430 · Khulna 408 · Rajshahi 338 · Rangpur 310 · Mymensingh 202 · Barishal 197
· Sylhet 110.

### The two documents without a source

| id | name | type | occupancy | value (BDT) | note |
|---|---|---|---|---|---|
| `feb2ba2f-570b-4f37-9529-aff93c448fab` | Dhaka Medical College Hospital | hospital | 2,600 | 5,000,000,000 | Created by hand on 10 Nov 2026 (`notes`: "Major referral hospital"). The OSM copy of the same hospital is also present 26 m away ("Dhaka Medical College Hospital, Government hospital, Secretariat Rd, Dhaka", `osm:node/11821823342`). |
| `d62224b8-b6c5-4338-9f76-e00c91efaa4e` | Sadarghat river terminal | other | 2,000 | 1,000,000,000 | Created by hand the same day. Not a shelter or health facility. |

These look like early demo/test records. Their occupancy and value were typed in by a person; there is no source
saying where the 2,600 and 5 billion come from.

## 2. Names

Method: see the appendix. Letters only are compared for case (Bangla has no case). Counts overlap: one name can be in
several rows.

| Problem | Count | Notes |
|---|---|---|
| All lowercase (≥ 3 Latin letters, none uppercase) | 44 | Mostly just the mapper's typing; a few are junk. |
| All uppercase (≥ 4 Latin letters) | 24 | Acronyms (CSCR, BSBA, MSF ...) are legitimately uppercase. |
| Stray whitespace (leading/trailing, double spaces, tabs) | 4 | Only internal double spaces; nothing leading/trailing (the import strips it). |
| Leading or trailing punctuation | 5 | Trailing comma, or a leading `(…)`. |
| Odd punctuation (space before comma, `( `, `__`, `~` ...) | 32 | |
| Name carries a full address (2 or more commas) | 192 | E.g. "Genome Hospital, Jurain Railgate, Haji Khorshed Ali Sarkar Road., Dhaka". |
| Google-Maps-style category tail (", Hospital", ", Private hospital", ", Government hospital" ...) | 528 | 449 end with exactly ", Hospital". Almost all are recent OSM nodes (ids 11.x–13.x billion), i.e. a 2024–2026 wave of edits. |
| ", OS" / "(OS)" tag in the name | 7 | All in Chattogram; an editing tag, not part of the name. |
| Name is only a type ("Community clinic", "Cyclone Shelter", "Hospital" ...) | 63 | Breakdown below. |
| Empty or missing | 0 | The import drops nameless features; the API needs ≥ 2 characters. |
| Very short (≤ 3 characters) | 3 | `CPC`, `CMH` (real acronyms), `tyu` (junk). |
| Test/junk | 3 | `ghdgn` (Brahmanbaria, `osm:node/6583188418`), `tyu` (Rajshahi, `osm:way/1189587863`), `ozpitalez 24 orillaz :v` (Tangail, `osm:way/568495405`). |
| Bangla only (informational, not an error) | 199 | |
| Bangla and Latin mixed (informational) | 100 | Usually "English name বাংলা নাম"; useful, not a defect. |

Generic names (normalised; 63 in total): community clinic 21 · school cum cyclone centre 5 · school cum cyclone shelter 4 ·
clinic 4 · cyclone centre 4 · cyclone shelter 3 · কমিউনিটি ক্লিনিক 3 · upazila health complex 3 · eye hospital 3 · union
health and family welfare center 3 · general hospital 2 · health centre 1 · school cum cyclone center 1 · medical center 1 ·
pharmacy 1 · আশ্রয় কেন্দ্র 1 · ঘূর্ণিঝড় আশ্রয় কেন্দ্র 1 · cyclone center 1 · hospital 1.

A generic name is a real problem for a flood portal: three pins called "Cyclone Shelter" cannot be told apart by a
person reading a list, and a rescuer cannot name them over the phone.

### Examples (up to 15 each)

**All lowercase** (44, first 15 shown)

| Name | Type | OSM id | District |
|---|---|---|---|
| cyclone centre cum school | flood_shelter | osm:node/6102351162 | Barguna |
| ghdgn | hospital | osm:node/6583188418 | Brahmanbaria |
| labaid diagnostic center | hospital | osm:node/2209597857 | Chattogram |
| popular diagonstic center | hospital | osm:node/10169372155 | Chattogram |
| pharmacy | hospital | osm:node/4365087444 | Cumilla |
| jaitiyo jolatonko protiroth o niyotnron kendro | hospital | osm:node/12056962193 | Dhaka |
| radda | hospital | osm:node/3734803537 | Dhaka |
| shakti foundation(শক্তি ফাউন্ডেশন) | clinic | osm:node/4322833432 | Dhaka |
| banani dental | clinic | osm:node/4845545530 | Dhaka |
| banani dental | clinic | osm:node/4845546824 | Dhaka |
| jaitiyo jolatonko protiroth o niyotnron kendro | hospital | osm:way/375518677 | Dhaka |
| matanity | hospital | osm:way/1487278891 | Manikganj |
| niramoy nursing home | hospital | osm:way/436904627 | Manikganj |
| ozpitalez 24 orillaz :v | hospital | osm:way/568495405 | Tangail |
| bagerhat sadar hospital | hospital | osm:node/2343351848 | Bagerhat |

**All uppercase** (24, first 15 shown)

| Name | Type | OSM id | District |
|---|---|---|---|
| SBMCH CCU | hospital | osm:node/10047992154 | Barishal |
| AFCCL HOSPITAL | hospital | osm:way/680036106 | Brahmanbaria |
| CSCR | hospital | osm:way/212430510 | Chattogram |
| BSBA | hospital | osm:node/7260625103 | Chattogram |
| DOYAMOY PHARMACY | hospital | osm:node/4365113104 | Cumilla |
| SRI KISNA PHARMACY | hospital | osm:node/4365113694 | Cumilla |
| MSF-F OPD2 | clinic | osm:way/555978681 | Cox's Bazar |
| MSF BKL OPD 1 | clinic | osm:way/559196080 | Cox's Bazar |
| MSF-F OPD1 | clinic | osm:way/587190566 | Cox's Bazar |
| DR. AZMAL HOSPITAL LTD. | hospital | osm:node/11947042146 | Dhaka |
| AALOK HEALTHCARE | hospital | osm:node/11947045499 | Dhaka |
| MALAYSIA CLINIC | clinic | osm:node/11957949949 | Dhaka |
| BANGKOK HOSPITAL | hospital | osm:node/11962958198 | Dhaka |
| OGSB HOSPITAL ওজিএসবি হাসপাতাল | hospital | osm:node/12809436001 | Dhaka |
| GUK EYE HOSPITAL | hospital | osm:node/13798510101 | Dhaka |

**Stray whitespace (each double space shown as ␣␣)** (4, first 4 shown)

| Name | Type | OSM id | District |
|---|---|---|---|
| Upazilla Health Complex, Madhupur,␣␣Tangail | hospital | osm:way/1464204972 | Tangail |
| Dr. Muqtadir Eye Hospital␣␣ডাঃ মুক্তাদির চক্ষু হাসপাতাল | hospital | osm:node/13848377102 | Mymensingh |
| Rainbow Community Hospital and Diagnostic␣␣␣Centre | hospital | osm:node/9798924621 | Bogura |
| Jalalabad Ragib Rabeya Medical␣␣College␣␣& Hospital | hospital | osm:node/9812388576 | Sylhet |

**Leading/trailing punctuation** (5, first 5 shown)

| Name | Type | OSM id | District |
|---|---|---|---|
| The Barakah General Hospital Limited, | hospital | osm:node/12039837605 | Dhaka |
| (ইউনিপ্যাথ)Unipath Diagnostic Center | clinic | osm:node/4759888421 | Dhaka |
| Apex Medical and Diagnostic Centre, Hospital, | hospital | osm:node/5209557021 | Gazipur |
| A.K Memorial Hospital, Hospital, | hospital | osm:node/12155198812 | Gazipur |
| Bodor Uddin General Hospital, | hospital | osm:node/13165013170 | Moulvibazar |

**Odd punctuation** (32, first 15 shown)

| Name | Type | OSM id | District |
|---|---|---|---|
| __চক্ষু হাসপাতাল | hospital | osm:node/3388662566 | Barishal |
| Centre Point Hospital , OS | hospital | osm:node/1963093210 | Chattogram |
| Appolo Diagnostic Center , OS | hospital | osm:node/2210381424 | Chattogram |
| Pioneer hospital And diagnostic center Ltd. , OS | hospital | osm:node/2210381459 | Chattogram |
| Belle Vue Hospital ( under construction) | hospital | osm:node/6533811093 | Chattogram |
| Royal Community Eye Hospital & Phaco Centre., Rd No 5, Chattogram | hospital | osm:node/11254347225 | Chattogram |
| Midpoint Hospital and Maternity Center Ltd., Midpoint Hospital, Pathantuli Rd, Chattogram | hospital | osm:node/11353414812 | Chattogram |
| Middle Bakalia Mother And Childwellfare Center., Sathish Babu Ln, Chattogram | hospital | osm:node/11779809634 | Chattogram |
| Hathazari Digital Diagonstic Center ,Hathazari, Kacari Rd, Hathazari, Chattogram | hospital | osm:node/11586184621 | Chattogram |
| BN DY SICK BAY Hospital, Dockyard Rd , Chattogram | hospital | osm:node/11734830904 | Chattogram |
| Genome Hospital, Jurain Railgate, Haji Khorshed Ali Sarkar Road., Dhaka | hospital | osm:node/11730079486 | Dhaka |
| Asgar Ali Hospital , Dhaka | hospital | osm:node/11760464566 | Dhaka |
| Al Noor Eye Hospital ( Permanent Building ) | hospital | osm:node/12022698666 | Dhaka |
| Ad-Din Medical College Hospital ~ MaghBazar | hospital | osm:node/12033287068 | Dhaka |
| Atlas Hospital Ltd., Hospital | hospital | osm:node/12285156896 | Dhaka |

**Name is only a type** (63, first 15 shown)

| Name | Type | OSM id | District |
|---|---|---|---|
| School cum cyclone centre | flood_shelter | osm:node/6123685488 | Barguna |
| School cum cyclone shelter | flood_shelter | osm:node/6113445236 | Barguna |
| School cum cyclone shelter | flood_shelter | osm:node/6113445240 | Barguna |
| School Cum Cyclone Shelter | flood_shelter | osm:node/6116231631 | Barguna |
| Clinic | clinic | osm:node/6123392282 | Barguna |
| Cyclone Shelter | flood_shelter | osm:node/6123392283 | Barguna |
| Community clinic | clinic | osm:node/6123464494 | Barguna |
| Health centre | clinic | osm:node/6123464514 | Barguna |
| School cum cyclone shelter | flood_shelter | osm:node/6113445207 | Barguna |
| Community clinic | clinic | osm:node/6212951686 | Barguna |
| School cum cyclone center | flood_shelter | osm:node/6096318617 | Barguna |
| Cyclone centre | flood_shelter | osm:node/6102348656 | Barguna |
| Cyclone centre | flood_shelter | osm:node/6102348683 | Barguna |
| Cyclone Shelter | flood_shelter | osm:node/6102350722 | Barguna |
| Community clinic | clinic | osm:node/6102351176 | Barguna |


## 3. Duplicates

### How pairs were found and judged

- Distance is the great-circle (haversine) distance between the stored points.
- Names are normalised before comparing: Unicode NFKC, lowercase, `য়` unified, every run of punctuation/space turned
  into one space, trimmed.
- **3a** identical normalised names within 200 m. **3b** different normalised names with edit distance ≤ 2, or one
  name (≥ 5 characters) contained in the other, within 1 km. **3c** different names within 30 m.
- OSM ids: the documents in this copy have **no `source_id`** (see section 5), so the OSM id was recovered by matching
  each document's exact name and exact coordinates to `data/assets/osm_facilities.json`. All 3,162 OSM documents
  matched; 14 matched two OSM ids each (7 pairs of OSM nodes with the same name and the same coordinates).
- Verdicts are a first pass by rule plus a manual reading of every 3a/3b row and every 3c row that shares a word.
  **None of them is a merge instruction.** "Likely same place" means: a person should look at this pair in OSM first.

Rules used (in order):

| Verdict | When |
|---|---|
| likely same place | Identical name and identical coordinates (two OSM nodes on top of each other); or identical name ≤ 50 m; or identical name where one is an OSM point and the other a building outline ≤ 60 m (the most common OSM double-mapping); or the same name plus a "Ltd / Pvt / , Hospital / address" tail ≤ 150 m; or a spelling variant (edit distance ≤ 2) ≤ 150 m. |
| likely same institution | Identical name of a large public or teaching facility (medical college, institute, sadar/general hospital, upazila health complex) 50–200 m apart. One campus, several buildings or entrances; possibly mapped on purpose. |
| probably different | Numbered posts/units/branches (Health Post 1/2/3, Building 02); one feature is a part of, or next to, the other (tube-well of, pond, gate, ICU, emergency department, head office, "mosque beside"); the match comes only from a generic phrase ("Diagonostic Center", "Cyclone Shelter", "Sheba Hospital"); or a different first word. |
| unclear | Generic name on both sides; identical name but far apart; same brand with different services at one address. |

### 3a. Identical names within 200 m: 84 pairs

55 likely same place, 19 likely same institution, 10 unclear.

Notable patterns:

- **7 pairs are two OSM nodes with the same name at exactly the same point** (Bagerhat ×5 shelters/clinic,
  Bhola, Chattogram). Ids like `6039685705` and `6126592806` differ by a constant offset, which looks like one batch
  uploaded twice. These are the clearest duplicates in the data. Because this copy stores no `source_id`, the two
  database documents of each such pair cannot even be told apart by OSM id.
- **Point + building outline** for one place (e.g. Japan Bangladesh Friendship Hospital, Narail General Hospital,
  Beanibazar Cancer Hospital): the import keeps both, so the map shows two pins.
- **The same place with two different types** (Gangra Community Clinic clinic/hospital; Sono Diagonistic and Clinic;
  Mukti Clinic; Bushra Hospital).
- **Campuses** (NITOR has 3 outlines within 141 m; Bagerhat Sadar Hospital 3 points within 161 m; Satkhira Medical
  College 3 within 176 m): the map shows a cluster of identical pins.

| Name A | Name B | Dist (m) | OSM ids | Asset ids (first 8) | Lat, lon (A) | District | Verdict | Reason |
|---|---|---|---|---|---|---|---|---|
| Union Health Family Planning Center (clinic) | Union Health Family Planning Center (clinic) | 0.0 | osm:node/5983449610,osm:node/6039694264<br>osm:node/5983449610,osm:node/6039694264 | `de00e54f`<br>`c9f9ca7f` | 22.724690, 90.643293 | Bhola | **likely same** | Two OSM nodes with identical name and identical coordinates (a duplicated upload in OSM). |
| Jemison redcrescent maternity hospital,Anderkilla (hospital) | Jemison redcrescent maternity hospital,Anderkilla (hospital) | 0.0 | osm:node/2211572832,osm:node/2211572833<br>osm:node/2211572832,osm:node/2211572833 | `9394bfc1`<br>`1c742895` | 22.342437, 91.837451 | Chattogram | **likely same** | Two OSM nodes with identical name and identical coordinates (a duplicated upload in OSM). |
| Cyclone Center beside of Dhanshagor United School (flood_shelter) | Cyclone Center beside of Dhanshagor United School (flood_shelter) | 0.0 | osm:node/6039685709,osm:node/6126592810<br>osm:node/6039685709,osm:node/6126592810 | `e407795c`<br>`650a6a5b` | 22.386870, 89.813501 | Bagerhat | **likely same** | Two OSM nodes with identical name and identical coordinates (a duplicated upload in OSM). |
| Radha Laxmi Cyclone Shelter (flood_shelter) | Radha Laxmi Cyclone Shelter (flood_shelter) | 0.0 | osm:node/6039685708,osm:node/6126592809<br>osm:node/6039685708,osm:node/6126592809 | `d5eefc7c`<br>`e52936a4` | 22.385240, 89.803373 | Bagerhat | **likely same** | Two OSM nodes with identical name and identical coordinates (a duplicated upload in OSM). |
| Bonda Ghata Community Clinic (clinic) | Bonda Ghata Community Clinic (clinic) | 0.0 | osm:node/6039685706,osm:node/6126592807<br>osm:node/6039685706,osm:node/6126592807 | `e9d4667b`<br>`a074e55e` | 22.374990, 89.787338 | Bagerhat | **likely same** | Two OSM nodes with identical name and identical coordinates (a duplicated upload in OSM). |
| Cyclone Shelter 1 no Ketrur Baria (flood_shelter) | Cyclone Shelter 1 no Ketrur Baria (flood_shelter) | 0.0 | osm:node/6039685705,osm:node/6126592806<br>osm:node/6039685705,osm:node/6126592806 | `fc755523`<br>`4acac89e` | 22.371567, 89.792247 | Bagerhat | **likely same** | Two OSM nodes with identical name and identical coordinates (a duplicated upload in OSM). |
| 2 storied Cyclone Shelter of Dr Masum Billah D N (flood_shelter) | 2 storied Cyclone Shelter of Dr Masum Billah D N (flood_shelter) | 0.0 | osm:node/6039685687,osm:node/6126592788<br>osm:node/6039685687,osm:node/6126592788 | `63d5e7ab`<br>`f83b3b78` | 22.360559, 89.817497 | Bagerhat | **likely same** | Two OSM nodes with identical name and identical coordinates (a duplicated upload in OSM). |
| AMZ Hospital Ltd (hospital) | AMZ HOSPITAL LTD (hospital) | 0.2 | osm:node/13952233846<br>osm:way/1530853738 | `7df53a8d`<br>`ddef2761` | 23.784302, 90.425985 | Dhaka | **likely same** | Same name; one is a point, the other a building outline, 0 m apart (classic OSM double mapping). |
| কমিউনিটি ক্লিনিক (clinic) | কমিউনিটি ক্লিনিক (clinic) | 0.2 | osm:way/589604743<br>osm:node/5642267075 | `16c77a4e`<br>`88af5a92` | 25.605791, 89.874917 | Kurigram | **unclear** | Name is generic; proximity alone is not proof. |
| surjer hasi satellite clinic (clinic) | surjer hasi satellite clinic (clinic) | 0.2 | osm:way/591527847<br>osm:node/5647230890 | `97ad4675`<br>`6a467a62` | 25.570119, 89.837136 | Kurigram | **likely same** | Same name; one is a point, the other a building outline, 0 m apart (classic OSM double mapping). |
| Abedin Hospital (Pvt.) (hospital) | Abedin Hospital (Pvt.) (hospital) | 0.3 | osm:node/7387955487<br>osm:way/533504783 | `a0384f6b`<br>`2cdeb54c` | 24.055771, 90.974794 | Kishoreganj | **likely same** | Same name; one is a point, the other a building outline, 0 m apart (classic OSM double mapping). |
| Surjer Hasi Paribarik Health Clinic (clinic) | Surjer Hasi Paribarik Health Clinic (clinic) | 0.6 | osm:way/354996591<br>osm:node/3606431697 | `8c66d056`<br>`f4e96d60` | 22.888890, 89.513940 | Khulna | **likely same** | Same name; one is a point, the other a building outline, 1 m apart (classic OSM double mapping). |
| মৈশাতুয়া কমিউনিটি ক্লিনিক (clinic) | মৈশাতুয়া কমিউনিটি ক্লিনিক (clinic) | 0.7 | osm:way/1201907043<br>osm:node/11143301063 | `3f1c953d`<br>`c8453345` | 23.187272, 91.066976 | Cumilla | **likely same** | Same name; one is a point, the other a building outline, 1 m apart (classic OSM double mapping). |
| City Lab diagnostic and specialized consultation center (hospital) | City Lab diagnostic and specialized consultation center (hospital) | 1.1 | osm:node/9575842322<br>osm:way/589226576 | `b14afcf3`<br>`ed0f7533` | 22.660698, 89.794907 | Bagerhat | **likely same** | Same name; one is a point, the other a building outline, 1 m apart (classic OSM double mapping). |
| jaitiyo jolatonko protiroth o niyotnron kendro (hospital) | jaitiyo jolatonko protiroth o niyotnron kendro (hospital) | 1.4 | osm:node/12056962193<br>osm:way/375518677 | `36314762`<br>`30d5a640` | 23.775749, 90.405784 | Dhaka | **likely same** | Same name; one is a point, the other a building outline, 1 m apart (classic OSM double mapping). |
| Mourashi Community Clinic (clinic) | Mourashi Community Clinic (clinic) | 1.5 | osm:way/610529765<br>osm:node/5781733629 | `4e2675e6`<br>`804e394d` | 22.263533, 89.838343 | Bagerhat | **likely same** | Same name; one is a point, the other a building outline, 2 m apart (classic OSM double mapping). |
| Fresh Health Clinic (clinic) | Fresh Health Clinic (clinic) | 2.7 | osm:way/350947243<br>osm:node/3566600297 | `82c4daf0`<br>`473655fd` | 22.897500, 89.508439 | Khulna | **likely same** | Same name; one is a point, the other a building outline, 3 m apart (classic OSM double mapping). |
| BRAC Health Service Center (clinic) | BRAC Health Service Center (clinic) | 3.3 | osm:node/5909299469<br>osm:node/5983449612 | `c02a67bd`<br>`d776f28b` | 22.723564, 90.638500 | Bhola | **likely same** | Identical name, 3 m apart. |
| EPI Tika Kendra Chowkider Bari (clinic) | EPI Tika Kendra Chowkider Bari (clinic) | 3.5 | osm:node/5909299474<br>osm:node/5983449617 | `35953265`<br>`d921bd9c` | 22.733267, 90.651863 | Bhola | **likely same** | Identical name, 4 m apart. |
| Union Health Family Planning Center (clinic) | Union Health Family Planning Center (clinic) | 3.6 | osm:node/5983449610,osm:node/6039694264<br>osm:node/5909299467 | `de00e54f`<br>`1dc2d3c6` | 22.724690, 90.643293 | Bhola | **likely same** | Identical name, 4 m apart. |
| Union Health Family Planning Center (clinic) | Union Health Family Planning Center (clinic) | 3.6 | osm:node/5909299467<br>osm:node/5983449610,osm:node/6039694264 | `1dc2d3c6`<br>`c9f9ca7f` | 22.724665, 90.643271 | Bhola | **likely same** | Identical name, 4 m apart. |
| Chakaria Unique Hospital (hospital) | Chakaria Unique Hospital (hospital) | 4.0 | osm:way/1132394635<br>osm:node/10315954847 | `c1dda0e4`<br>`0be32e4b` | 21.767084, 92.076280 | Cox's Bazar | **likely same** | Same name; one is a point, the other a building outline, 4 m apart (classic OSM double mapping). |
| দৌলতদিয়া গণস্বাস্থ্য কেন্দ্র (hospital) | দৌলতদিয়া গণস্বাস্থ্য কেন্দ্র (hospital) | 4.1 | osm:node/11328746544<br>osm:way/1221478014 | `e67a551a`<br>`3009a8b4` | 23.761140, 89.780737 | Rajbari | **likely same** | Same name; one is a point, the other a building outline, 4 m apart (classic OSM double mapping). |
| 4 No Warder Cyclone Center Cum Govt. Primary School (flood_shelter) | 4 No Warder Cyclone Center Cum Govt. Primary School (flood_shelter) | 5.6 | osm:node/6087481691<br>osm:node/6087481693 | `d86fe549`<br>`4ebaf1be` | 22.148914, 90.561872 | Patuakhali | **likely same** | Identical name, 6 m apart. |
| Gangra Community Clinic (clinic) | Gangra Community Clinic (hospital) | 5.8 | osm:way/1132138008<br>osm:node/10241366020 | `1fa2fcf4`<br>`3af1f132` | 23.111120, 91.335034 | Cumilla | **likely same** | Same name; one is a point, the other a building outline, 6 m apart (classic OSM double mapping). Types differ (clinic / hospital): the same place is tagged differently by two mappers. |
| Japan Bangladesh Friendship Hospital (hospital) | Japan Bangladesh Friendship Hospital (hospital) | 5.9 | osm:node/3315890963<br>osm:way/262511010 | `3c45820f`<br>`31bb43ce` | 23.739545, 90.375045 | Dhaka | **likely same** | Same name; one is a point, the other a building outline, 6 m apart (classic OSM double mapping). |
| radda (hospital) | RADDA (hospital) | 6.4 | osm:node/3734803537<br>osm:way/369448879 | `d2228efb`<br>`9db4bcce` | 23.807559, 90.369693 | Dhaka | **unclear** | Name is generic; proximity alone is not proof. |
| Life Care Hospital (hospital) | Life Care Hospital (hospital) | 6.6 | osm:node/8692906995<br>osm:way/938321798 | `5a025e37`<br>`05bbdd9f` | 25.628471, 88.629333 | Dinajpur | **likely same** | Same name; one is a point, the other a building outline, 7 m apart (classic OSM double mapping). |
| শামসুন নাহার ক্লিনিক (clinic) | শামসুন নাহার ক্লিনিক (clinic) | 8.5 | osm:way/605244002<br>osm:node/9589861821 | `2cd39c5a`<br>`62f9acc4` | 24.832040, 89.375755 | Bogura | **likely same** | Same name; one is a point, the other a building outline, 8 m apart (classic OSM double mapping). |
| banani dental (clinic) | banani dental (clinic) | 9.0 | osm:node/4845545530<br>osm:node/4845546824 | `ed08132e`<br>`3a65667c` | 23.792912, 90.403138 | Dhaka | **likely same** | Identical name, 9 m apart. |
| Sono Diagonistic and Clinic (hospital) | Sono Diagonistic and Clinic (clinic) | 9.5 | osm:node/5788924447<br>osm:way/604550518 | `d204f8f2`<br>`d49bb733` | 23.779032, 88.641817 | Meherpur | **likely same** | Same name; one is a point, the other a building outline, 10 m apart (classic OSM double mapping). Types differ (hospital / clinic): the same place is tagged differently by two mappers. |
| Beanibazar Cancer Hospital (hospital) | Beanibazar Cancer Hospital (hospital) | 10.0 | osm:way/508427366<br>osm:node/4977329873 | `1424c15a`<br>`adf45a4c` | 24.822271, 92.150288 | Sylhet | **likely same** | Same name; one is a point, the other a building outline, 10 m apart (classic OSM double mapping). |
| Maa O Shishu Hospital Pvt. (hospital) | Maa O Shishu Hospital Pvt. (hospital) | 10.8 | osm:node/8813733736<br>osm:way/604872659 | `a83a4187`<br>`285c30de` | 22.871557, 91.089467 | Noakhali | **likely same** | Same name; one is a point, the other a building outline, 11 m apart (classic OSM double mapping). |
| Lin Nissa Fertility Center (clinic) | Lin Nissa Fertility Center (clinic) | 11.5 | osm:way/1464577310<br>osm:node/13434315000 | `c5fe61eb`<br>`5c2dbfe6` | 22.360092, 91.827886 | Chattogram | **likely same** | Same name; one is a point, the other a building outline, 12 m apart (classic OSM double mapping). |
| স্কয়ার হাসপাতাল (hospital) | স্কয়ার হাসপাতাল (hospital) | 11.5 | osm:node/12056943177<br>osm:way/263802748 | `d58575e3`<br>`d1931fae` | 23.753028, 90.381710 | Dhaka | **likely same** | Same name; one is a point, the other a building outline, 12 m apart (classic OSM double mapping). |
| Feni Diabetic Hospital (hospital) | Feni diabetic hospital (hospital) | 12.1 | osm:node/2813443337<br>osm:way/972289231 | `c29686f2`<br>`bf377f23` | 23.012935, 91.397574 | Feni | **likely same** | Same name; one is a point, the other a building outline, 12 m apart (classic OSM double mapping). |
| Narail General Hospital (hospital) | Narail General Hospital (hospital) | 15.0 | osm:node/2343411551<br>osm:way/438169614 | `c17f7be4`<br>`afb48886` | 23.172189, 89.499297 | Narail | **likely same** | Same name; one is a point, the other a building outline, 15 m apart (classic OSM double mapping). |
| EverCare Hospital Dhaka (hospital) | Evercare Hospital Dhaka (hospital) | 16.6 | osm:node/12056962174<br>osm:way/974287986 | `a43142e5`<br>`3ff05f05` | 23.810188, 90.431355 | Dhaka | **likely same** | Same name; one is a point, the other a building outline, 17 m apart (classic OSM double mapping). |
| Govt Primary School Cum Cyclone Center (flood_shelter) | Govt Primary School Cum Cyclone Center (flood_shelter) | 17.0 | osm:way/610769712<br>osm:node/5783957149 | `7030f77a`<br>`8304c909` | 22.252006, 89.832623 | Bagerhat | **likely same** | Same name; one is a point, the other a building outline, 17 m apart (classic OSM double mapping). |
| RUET Medical Center (hospital) | RUET Medical Center (hospital) | 19.2 | osm:way/1447378455<br>osm:way/1040919993 | `e7a19c3b`<br>`133ee8a0` | 24.368712, 88.626642 | Rajshahi | **likely same** | Identical name, 19 m apart. |
| Dhobaura Upazila Health Complex (hospital) | Dhobaura Upazila Health Complex (hospital) | 20.8 | osm:way/723080799<br>osm:node/2332856875 | `9b08c3c4`<br>`a10ada80` | 25.090057, 90.513264 | Mymensingh | **likely same** | Same name; one is a point, the other a building outline, 21 m apart (classic OSM double mapping). |
| Bagerhat Sadar Hospital (hospital) | Bagerhat Sadar Hospital (hospital) | 21.0 | osm:node/11765674620<br>osm:node/11765674618 | `c65a1d8b`<br>`f39d886b` | 22.670693, 89.766050 | Bagerhat | **likely same** | Identical name, 21 m apart. |
| Matri Sadan (hospital) | Matri Sadan (hospital) | 21.1 | osm:way/402318150<br>osm:way/324365704 | `59b89c56`<br>`02c79a73` | 22.813071, 89.563806 | Khulna | **unclear** | Name is generic; proximity alone is not proof. |
| Bangladesh ENT Hospital (hospital) | Bangladesh ENT Hospital (hospital) | 21.7 | osm:node/12009447140<br>osm:node/6968431040 | `f79b6aea`<br>`0905dd08` | 23.755542, 90.376201 | Dhaka | **likely same** | Identical name, 22 m apart. |
| Laksham Upazila Health Complex (hospital) | Laksham Upazila Health Complex (hospital) | 22.8 | osm:way/660867780<br>osm:node/2382263483 | `68e8f360`<br>`144b194b` | 23.233994, 91.117510 | Cumilla | **likely same** | Same name; one is a point, the other a building outline, 23 m apart (classic OSM double mapping). |
| Brothers Lab (clinic) | Brothers Lab (clinic) | 23.3 | osm:node/9596532346<br>osm:way/447857761 | `3d0f8aaa`<br>`2af6a434` | 25.762783, 89.234697 | Rangpur | **likely same** | Same name; one is a point, the other a building outline, 23 m apart (classic OSM double mapping). |
| Dental Care (hospital) | Dental Care (hospital) | 26.6 | osm:node/1801801222<br>osm:node/1801796034 | `ccf95904`<br>`524caf8d` | 21.442302, 91.976740 | Cox's Bazar | **unclear** | Name is generic; proximity alone is not proof. |
| Terokhada Upazila Health Complex (hospital) | Terokhada Upazila Health Complex (hospital) | 27.4 | osm:way/1098503017<br>osm:node/2343395447 | `2f897a9e`<br>`eb84f503` | 22.928395, 89.672699 | Khulna | **likely same** | Same name; one is a point, the other a building outline, 27 m apart (classic OSM double mapping). |
| Bangladesh Medical College Hospital (hospital) | Bangladesh Medical College Hospital (hospital) | 28.0 | osm:node/12012276822<br>osm:node/1787174815 | `902aa5d8`<br>`a3443a6a` | 23.750410, 90.369892 | Dhaka | **likely same** | Identical name, 28 m apart. |
| National Heart foundation Feni (hospital) | National Heart foundation Feni (hospital) | 28.7 | osm:way/972300624<br>osm:way/1376927983 | `53d340f0`<br>`261f8f5c` | 23.012864, 91.398667 | Feni | **likely same** | Identical name, 29 m apart. |
| প্যান প্যাসিফিক হাসপাতাল (hospital) | প্যান প্যাসিফিক হাসপাতাল (hospital) | 28.9 | osm:node/4389421503<br>osm:node/6517470807 | `7cfed283`<br>`06460178` | 23.738045, 90.422260 | Dhaka | **likely same** | Identical name, 29 m apart. |
| USAID School cum Flood shelter (flood_shelter) | USAID School cum Flood shelter (flood_shelter) | 31.8 | osm:node/6282107991<br>osm:way/531542068 | `645623c1`<br>`a7595a7b` | 25.436410, 89.782014 | Kurigram | **likely same** | Same name; one is a point, the other a building outline, 32 m apart (classic OSM double mapping). |
| Mostan Nagar Hospital (hospital) | Mostan Nagar Hospital (hospital) | 33.8 | osm:node/10963292533<br>osm:node/10970475800 | `73ed14ac`<br>`141d74f9` | 22.840651, 91.546909 | Chattogram | **likely same** | Identical name, 34 m apart. |
| Thanchi Upazila Health Complex (hospital) | Thanchi Upazila Health Complex (hospital) | 35.2 | osm:node/11425781538<br>osm:way/1231918450 | `19404a50`<br>`2d59ebed` | 21.823819, 92.438350 | Bandarban | **likely same** | Same name; one is a point, the other a building outline, 35 m apart (classic OSM double mapping). |
| Sonagazi Upazila Health Complex (hospital) | Sonagazi Upazila Health Complex (hospital) | 37.6 | osm:way/1065856280<br>osm:node/9692137604 | `9651e552`<br>`0b87f203` | 22.850465, 91.396596 | Feni | **likely same** | Same name; one is a point, the other a building outline, 38 m apart (classic OSM double mapping). |
| Zia Heart Foundation Hospital & Recharch Institute (hospital) | Zia Heart Foundation Hospital & Recharch Institute (hospital) | 44.0 | osm:node/9529696591<br>osm:way/344940612 | `ad840b22`<br>`d23bde9d` | 25.619752, 88.646252 | Dinajpur | **likely same** | Same name; one is a point, the other a building outline, 44 m apart (classic OSM double mapping). |
| Monohorgonj Upazila Health Complex (hospital) | Monohorgonj Upazila Health Complex (hospital) | 46.3 | osm:node/9610301355<br>osm:way/957593891 | `10658412`<br>`8ee856fc` | 23.153768, 91.058144 | Cumilla | **likely same** | Same name; one is a point, the other a building outline, 46 m apart (classic OSM double mapping). |
| Feni general hospital (hospital) | Feni General Hospital (hospital) | 50.1 | osm:way/972288122<br>osm:node/2333176631 | `e4ddae97`<br>`586be62e` | 23.029981, 91.405881 | Feni | **likely same** | Same name; one is a point, the other a building outline, 50 m apart (classic OSM double mapping). |
| Satkhira Medical College (hospital) | Satkhira Medical College (hospital) | 52.4 | osm:relation/8536925<br>osm:node/5836135506 | `ebe9c44c`<br>`b44fce06` | 22.691356, 89.045210 | Satkhira | **likely same** | Same name; one is a point, the other a building outline, 52 m apart (classic OSM double mapping). |
| National Institute of Traumatology and Orthopaedic Rehabilitation (hospital) | National Institute of Traumatology and Orthopaedic Rehabilitation (hospital) | 59.5 | osm:way/305117870<br>osm:way/305118924 | `bf4859dc`<br>`8d660596` | 23.773133, 90.369471 | Dhaka | **likely same institution** | Large public/teaching facility; 60 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| Mukti Clinic (hospital) | Mukti Clinic (clinic) | 59.9 | osm:node/9587894839<br>osm:node/9587894858 | `222466c9`<br>`8cc36fb5` | 24.371591, 88.583093 | Rajshahi | **unclear** | Identical name but 60 m apart; could be two branches or two buildings. Types differ (hospital / clinic): the same place is tagged differently by two mappers. |
| Tanore Upazila Health Complex (hospital) | Tanore Upazila Health Complex (hospital) | 63.2 | osm:node/9692911670<br>osm:node/2349386854 | `aa5e3050`<br>`c79b2973` | 24.575248, 88.574969 | Rajshahi | **likely same institution** | Large public/teaching facility; 63 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| Meherpur General Hospital (hospital) | Meherpur General Hospital (hospital) | 72.4 | osm:node/2344312573<br>osm:way/547967442 | `2b6897b1`<br>`5cccf9cf` | 23.777963, 88.642099 | Meherpur | **likely same institution** | Large public/teaching facility; 72 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| National Institute of Diseases of the Chest & Hospital (hospital) | National Institute of Diseases of the Chest & Hospital (hospital) | 73.2 | osm:node/12056962192<br>osm:node/2993197559 | `fae70edf`<br>`e8175e24` | 23.775837, 90.409285 | Dhaka | **likely same institution** | Large public/teaching facility; 73 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| Nawabganj Upazila Health Complex (hospital) | Nawabganj Upazila Health Complex (hospital) | 74.4 | osm:node/2332804905<br>osm:node/2365535325 | `420bd6b2`<br>`e8895ac2` | 25.418015, 89.081961 | Dinajpur | **likely same institution** | Large public/teaching facility; 74 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| Badalgachhi Upazila Health Complex, Naogaon - Badalgachhi Hwy, Badalgachhi, Naogaon (hospital) | Badalgachhi Upazila Health Complex, Naogaon - Badalgachhi Hwy, Badalgachhi, Naogaon (hospital) | 75.4 | osm:node/10716121188<br>osm:node/10716172336 | `9194700f`<br>`2e85b0bf` | 24.961310, 88.905739 | Naogaon | **likely same institution** | Large public/teaching facility; 75 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| ডক্টর'স ক্লিনিক ইউনিট-২ (clinic) | ডক্টর'স ক্লিনিক ইউনিট-২ (clinic) | 80.5 | osm:way/1041682454<br>osm:node/9589956981 | `8c1d40a9`<br>`8f9eb781` | 24.832903, 89.376265 | Bogura | **unclear** | Identical name but 80 m apart; could be two branches or two buildings. |
| Appollo Diagonestics Center (clinic) | Appollo Diagonestics Center (clinic) | 86.8 | osm:node/9596436427<br>osm:node/9596434711 | `8b29d734`<br>`491f96b0` | 25.764251, 89.232467 | Rangpur | **unclear** | Identical name but 87 m apart; could be two branches or two buildings. |
| National Institute of Traumatology and Orthopaedic Rehabilitation (hospital) | National Institute of Traumatology and Orthopaedic Rehabilitation (hospital) | 98.3 | osm:way/305109465<br>osm:way/305118924 | `6826fd27`<br>`8d660596` | 23.772986, 90.370843 | Dhaka | **likely same institution** | Large public/teaching facility; 98 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| Raninagar Upazila Health Complex (hospital) | Raninagar Upazila Health Complex (hospital) | 102.5 | osm:node/2349386848<br>osm:node/9692896249 | `0f366736`<br>`341b08f6` | 24.742842, 88.960775 | Naogaon | **likely same institution** | Large public/teaching facility; 102 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| রিয়া জেনারেল হাসপাতাল এন্ড ডায়াগনস্টিক সেন্টার (hospital) | রিয়া জেনারেল হাসপাতাল এন্ড ডায়াগনস্টিক সেন্টার (hospital) | 108.0 | osm:node/9923632475<br>osm:node/9923632476 | `acf44821`<br>`c30f5061` | 23.907064, 90.054860 | Manikganj | **unclear** | Identical name but 108 m apart; could be two branches or two buildings. |
| Shibganj Upazila Health Complex (hospital) | Shibganj Upazila Health Complex (hospital) | 111.5 | osm:node/2365539233<br>osm:node/9692896250 | `4d0bc584`<br>`c7627d2f` | 25.006045, 89.315724 | Bogura | **likely same institution** | Large public/teaching facility; 112 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| Companygonj Upazila Health Complex (hospital) | Companygonj Upazila Health Complex (hospital) | 123.8 | osm:way/558368069<br>osm:node/2332856867 | `4a0380cf`<br>`f1371e43` | 25.085377, 91.756640 | Sylhet | **likely same institution** | Large public/teaching facility; 124 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| Chittagong Medical College (hospital) | Chittagong Medical College (hospital) | 131.9 | osm:node/2209597822<br>osm:node/1329007641 | `5438f831`<br>`5be18b36` | 22.360605, 91.830382 | Chattogram | **likely same institution** | Large public/teaching facility; 132 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| Kachua Upazila Health Complex (hospital) | Kachua Upazila Health Complex (hospital) | 133.5 | osm:node/2333164537<br>osm:node/2382262625 | `43a899ee`<br>`0df05411` | 23.341085, 90.889473 | Chandpur | **likely same institution** | Large public/teaching facility; 134 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| National Institute of Traumatology and Orthopaedic Rehabilitation (hospital) | National Institute of Traumatology and Orthopaedic Rehabilitation (hospital) | 140.6 | osm:way/305109465<br>osm:way/305117870 | `6826fd27`<br>`bf4859dc` | 23.772986, 90.370843 | Dhaka | **likely same institution** | Large public/teaching facility; 141 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| Bagerhat Sadar Hospital (hospital) | Bagerhat Sadar Hospital (hospital) | 147.9 | osm:node/11765674621<br>osm:node/11765674618 | `f2e577ba`<br>`f39d886b` | 22.672114, 89.765768 | Bagerhat | **likely same institution** | Large public/teaching facility; 148 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| Bagherpara Upazila Health Complex (hospital) | Bagherpara Upazila Health Complex (hospital) | 150.1 | osm:node/9692896254<br>osm:node/2343411488 | `0abcf86f`<br>`1f41af5f` | 23.218849, 89.344526 | Jashore | **likely same institution** | Large public/teaching facility; 150 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| Faridpur Medical College Hospital (hospital) | Faridpur Medical College Hospital (hospital) | 151.5 | osm:node/9692137610<br>osm:node/2365517022 | `377caac1`<br>`f2b4125f` | 23.588129, 89.835258 | Faridpur | **likely same institution** | Large public/teaching facility; 152 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| Bagerhat Sadar Hospital (hospital) | Bagerhat Sadar Hospital (hospital) | 160.6 | osm:node/11765674621<br>osm:node/11765674620 | `f2e577ba`<br>`c65a1d8b` | 22.672114, 89.765768 | Bagerhat | **likely same institution** | Large public/teaching facility; 161 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| Sundarban clinic (clinic) | Sundarban Clinic (clinic) | 167.6 | osm:node/11777847637<br>osm:node/9576105484 | `bab2c304`<br>`21a1f5f0` | 22.722028, 89.069861 | Satkhira | **unclear** | Identical name but 168 m apart; could be two branches or two buildings. |
| Satkhira Medical College (hospital) | Satkhira Medical College (hospital) | 176.4 | osm:node/5836135506<br>osm:node/5836010389 | `b44fce06`<br>`ba5f5c7b` | 22.691344, 89.045721 | Satkhira | **likely same institution** | Large public/teaching facility; 176 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |
| Bushra Hospital (hospital) | Bushra Hospital (clinic) | 177.4 | osm:node/9590532211<br>osm:node/11777847608 | `c6510ff3`<br>`74998e1c` | 22.722411, 89.071806 | Satkhira | **unclear** | Identical name but 177 m apart; could be two branches or two buildings. Types differ (hospital / clinic): the same place is tagged differently by two mappers. |
| M.A.G Osmani Medical College Hospital, Sylhet (hospital) | M.A.G Osmani Medical College Hospital, Sylhet (hospital) | 187.3 | osm:way/368010825<br>osm:node/265945386 | `bfb37427`<br>`c69170b2` | 24.902025, 91.853577 | Sylhet | **likely same institution** | Large public/teaching facility; 187 m apart is within one campus. May be separate buildings or entrances mapped on purpose. |

### 3b. Near-identical names within 1 km: 97 pairs

47 likely same place, 41 probably different, 9 unclear. Note how easily name similarity misleads: "Bangladesh Eye
Hospital" / "Bangladesh ENT Hospital" (edit distance 2) and "Desh Diagnostic" / "Bangladesh Diagnostic" (one inside
the other) are different places; "MSF BKL Health Post 1/2/3" are three real posts.

| Name A | Name B | Dist (m) | OSM ids | Asset ids (first 8) | Lat, lon (A) | District | Verdict | Reason |
|---|---|---|---|---|---|---|---|---|
| Pioneer hospital and diagnostic center Ltd. (hospital) | Pioneer hospital And diagnostic center Ltd. , OS (hospital) | 0.2 | osm:node/2210227362<br>osm:node/2210381459 | `9e888c16`<br>`2c11f9df` | 22.441375, 91.907927 | Chattogram | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 0 m apart. |
| Bodor Uddin General Hospital, Hospital (hospital) | Bodor Uddin General Hospital, (hospital) | 1.9 | osm:node/13168901571<br>osm:node/13165013170 | `2194eefb`<br>`28e5d83d` | 24.599152, 92.116658 | Moulvibazar | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 2 m apart. |
| Popular Medical College, Road No. 2, Dhaka (hospital) | Popular Medical College (hospital) | 2.5 | osm:node/11824640904<br>osm:way/1568502560 | `9325862e`<br>`53d999b4` | 23.738565, 90.379751 | Dhaka | **likely same** | Same name plus an address ('Road No. 2' is the street, not a branch), 2 m apart. |
| Jamalpur Central Hospital (hospital) | Jamalpur Central Hospital Ltd., General hospital (hospital) | 4.1 | osm:way/250181205<br>osm:node/12683720305 | `c2375a11`<br>`6368a747` | 24.933207, 89.942229 | Jamalpur | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 4 m apart. |
| Swapna Pharmacy (hospital) | Sopna Pharmacy (hospital) | 4.4 | osm:node/5494022722<br>osm:node/6902628635 | `5ddddce0`<br>`5d3213e8` | 23.758175, 90.366977 | Dhaka | **likely same** | Spelling variant (edit distance 2), 4 m apart. |
| Al-Noor Eye Hospital, Hospita (hospital) | Al-Noor Eye Hospital (hospital) | 5.4 | osm:node/12014805277<br>osm:way/1240697232 | `cdd7f12d`<br>`0bd3c9da` | 23.753814, 90.365772 | Dhaka | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 5 m apart. |
| Sondhani Clinic (clinic) | Sondhany Clinic (clinic) | 7.9 | osm:node/9596532319<br>osm:node/4449205753 | `cc4f300e`<br>`b05999d7` | 25.763918, 89.232834 | Rangpur | **likely same** | Spelling variant (edit distance 1), 8 m apart. |
| Farazy Hospital Ltd (hospital) | Farazy Hospital (hospital) | 8.7 | osm:node/8860305337<br>osm:way/440313767 | `8c69502c`<br>`52610fdd` | 23.762555, 90.436253 | Dhaka | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 9 m apart. |
| Maula Buksh Sardar Datobbo Chokkhu Hospital (hospital) | Maula Buksh Sardar Datobbo Chokkhu Haspatal (hospital) | 10.6 | osm:node/6053977478<br>osm:way/478317268 | `aeaecf5c`<br>`f9cafeaa` | 23.703428, 90.415294 | Dhaka | **likely same** | Spelling variant (edit distance 2), 11 m apart. |
| Padma General Hospital, Sonargaon Road, Dhaka (hospital) | Padma General Hospital (hospital) | 10.8 | osm:node/11834684953<br>osm:way/296578259 | `9db8944a`<br>`e9579b97` | 23.747225, 90.392475 | Dhaka | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 11 m apart. |
| জাতীয় চক্ষুবিজ্ঞান ইনস্টিটিউট এবং হাসপাতাল (hospital) | জাতীয় চক্ষুবিজ্ঞান ইনিস্টিটিউট এবং হাসপাতাল (hospital) | 11.0 | osm:node/5033788421<br>osm:way/263804515 | `dc5f2c55`<br>`3ba0dc90` | 23.774589, 90.369560 | Dhaka | **likely same** | Spelling variant (edit distance 1), 11 m apart. |
| Mother Care Hospital (hospital) | Mother Care Hospital (Pvt) Ltd. (hospital) | 12.5 | osm:node/4531545620<br>osm:way/1530967946 | `52f9cedb`<br>`ddaa87d6` | 23.756797, 90.374459 | Dhaka | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 12 m apart. |
| Green Life Medical College Hospital, Bir Uttam Shafiullah Sarak, Green Rd, Dhaka (hospital) | Green Life Medical College (hospital) | 13.5 | osm:node/11834742028<br>osm:node/4561237386 | `461b4128`<br>`542bdb99` | 23.746509, 90.385887 | Dhaka | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 14 m apart. |
| niramoy nursing home (hospital) | Niramoy Nursing Home and Diagnostic Centre, Hospital (hospital) | 13.5 | osm:way/436904627<br>osm:node/12536075351 | `245aba4d`<br>`d04ae1f0` | 23.861670, 90.000660 | Manikganj | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 14 m apart. |
| Saic General Hospital (hospital) | SAIC General Hospital Ltd., Hospital (hospital) | 13.6 | osm:node/9798961883<br>osm:node/12883355747 | `60c0d8bd`<br>`18fd9e7f` | 24.831470, 89.376717 | Bogura | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 14 m apart. |
| Saic General Hospital (hospital) | Saik General Hospital (hospital) | 13.9 | osm:node/9798961883<br>osm:node/5219734321 | `60c0d8bd`<br>`4e8ca1cc` | 24.831470, 89.376717 | Bogura | **likely same** | Spelling variant (edit distance 1), 14 m apart. |
| Bishwamvpur Upazila Health Complex (hospital) | Bishwamvarpur Upazila Health Complex (hospital) | 14.3 | osm:way/1075303059<br>osm:way/1075303043 | `89c9c35e`<br>`138385e8` | 25.101637, 91.303519 | Sunamganj | **likely same** | Spelling variant (edit distance 2), 14 m apart. |
| Uttar - Purba Govt Primary school & Cyclone Shelter (flood_shelter) | Tube-well of Uttar - Purba Govt Primary school & Cyclone Shelter (flood_shelter) | 14.4 | osm:node/6103803786<br>osm:node/6125962568 | `c172b1c0`<br>`17013150` | 22.551678, 90.717446 | Bhola | **probably different** | One feature is a part of, or next to, the other (unit, gate, pond, tube-well, building, office). |
| Central Lab Hospital (clinic) | Central Lab & Hospital, Naogaon (hospital) | 15.3 | osm:node/9772071763<br>osm:node/10765580017 | `2eb77845`<br>`18748fda` | 24.818969, 88.936438 | Naogaon | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 15 m apart. Types differ (clinic / hospital). |
| Chittagong Shishu Hospital (hospital) | Chittagong shishu hospital pvt ltd (hospital) | 17.5 | osm:node/2209597873<br>osm:node/6056491685 | `af85eced`<br>`dd33389b` | 22.361091, 91.831206 | Chattogram | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 18 m apart. |
| Barlekha Upazila Health Complex (hospital) | Barlekha Upazila Health Complex, Hospital (hospital) | 20.1 | osm:node/2332872326<br>osm:node/13195457969 | `60fb70d6`<br>`33f37e19` | 24.693879, 92.184857 | Moulvibazar | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 20 m apart. |
| Mother and Child Care Hospital (hospital) | Mother And Child Care Hospital, Plot No 2 and 3, 2nd - 5th Floor M.K Plaza, Chattogram (hospital) | 21.2 | osm:node/6134476643<br>osm:node/11266005071 | `a124935f`<br>`da37d52a` | 22.329116, 91.792022 | Chattogram | **likely same** | Same name plus an address, 21 m apart. |
| National Center for Hearing and Speech for Children (SAHIC) (hospital) | SAHIC (hospital) | 21.5 | osm:node/11939542170<br>osm:way/337808705 | `d85a32cb`<br>`a8c6f475` | 23.777347, 90.399604 | Dhaka | **likely same** | 'SAHIC' is the acronym given in the other name; 22 m apart. |
| Cyclone Shelter (flood_shelter) | GPS cum cyclone Shelter (flood_shelter) | 25.6 | osm:node/6102350722<br>osm:node/6102350723 | `1d170853`<br>`d1b52152` | 22.003052, 90.025960 | Barguna | **probably different** | Match only through a generic name ('cyclone shelter'); the longer name is a specific place. |
| Dhaka Medical College Hospital (hospital) | Dhaka Medical College Hospital, Government hospital, Secretariat Rd, Dhaka (hospital) | 26.3 | none (manual)<br>osm:node/11821823342 | `feb2ba2f`<br>`29ce5c6a` | 23.725800, 90.397600 | Dhaka | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 26 m apart. |
| SP Hospital (hospital) | SP Hospital and Diagonostic center (hospital) | 26.3 | osm:node/11997699250<br>osm:way/438590536 | `9056bb21`<br>`1626cf59` | 23.766610, 90.358482 | Dhaka | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 26 m apart. |
| School cum cyclone centre (flood_shelter) | Noli Muslim High School cum cyclone centre (flood_shelter) | 28.1 | osm:node/6123685488<br>osm:node/6123685489 | `887e6575`<br>`bc991c13` | 22.073323, 90.039201 | Barguna | **probably different** | Match only through a generic name ('school cum cyclone centre'); the longer name is a specific place. |
| Monira General Hospitl (hospital) | Monira General Hospital (clinic) | 33.0 | osm:node/11993425026<br>osm:node/6900268994 | `197c1e4d`<br>`adec4766` | 23.779282, 90.368214 | Dhaka | **likely same** | Spelling variant (edit distance 1), 33 m apart. Types differ (hospital / clinic). |
| Patnitala Upazila Health Complex (hospital) | Patnitala Upazila Health Complex, Patnitola (hospital) | 33.1 | osm:node/4933643639<br>osm:node/10657557743 | `5b1adab6`<br>`ec200558` | 25.049551, 88.755371 | Naogaon | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 33 m apart. |
| Asgar Ali Hospital Emergency Department (hospital) | Asgar Ali Hospital (hospital) | 35.3 | osm:node/12925755865<br>osm:node/4527964655 | `e6f141dd`<br>`acc96b7d` | 23.707550, 90.423762 | Dhaka | **probably different** | One feature is a part of, or next to, the other (unit, gate, pond, tube-well, building, office). |
| Radda MCH-FP Centre (Mirpur-10), Hospital (hospital) | RADDA (hospital) | 36.3 | osm:node/13266865265<br>osm:way/369448879 | `0fadf7e3`<br>`9db4bcce` | 23.807346, 90.370032 | Dhaka | **unclear** | RADDA is an organisation; the centre may be the same site or a separate one. |
| Kalihati Upazila Health Complex (hospital) | Kalihati Upazilla Health Complex (hospital) | 38.0 | osm:node/2381384473<br>osm:node/2332679845 | `0902af3b`<br>`89a209bd` | 24.389905, 89.990551 | Tangail | **likely same** | Spelling variant (edit distance 1), 38 m apart. |
| Sharankhola Upazila Health Complex (hospital) | upazila Health Complex (clinic) | 38.5 | osm:node/2343347189<br>osm:node/5894705970 | `1e0068c9`<br>`6ac3df29` | 22.312859, 89.850154 | Bagerhat | **probably different** | Match only through a generic name ('upazila health complex'); the longer name is a specific place. Types differ (hospital / clinic). |
| Nahar Diagnostic Centre (clinic) | Nahar Diagnostic Center (clinic) | 41.4 | osm:node/9578950503<br>osm:node/11777847727 | `14aea376`<br>`9c2eb4c9` | 22.722868, 89.070311 | Satkhira | **likely same** | Spelling variant (edit distance 2), 41 m apart. |
| Radda MCH-FP Centre (Mirpur-10), Hospital (hospital) | radda (hospital) | 41.8 | osm:node/13266865265<br>osm:node/3734803537 | `0fadf7e3`<br>`d2228efb` | 23.807346, 90.370032 | Dhaka | **unclear** | RADDA is an organisation; the centre may be the same site or a separate one. |
| Dhaka Central International Medical College & Hospital (Building 02) (hospital) | Dhaka Central International Medical College & Hospital (hospital) | 42.6 | osm:node/13849726001<br>osm:node/6900268980 | `103e9280`<br>`78fc64d1` | 23.773921, 90.361797 | Dhaka | **probably different** | Second building of the same institution, mapped on purpose; not a duplicate pin. |
| Patnitola Upazila Health Complex (hospital) | Patnitala Upazila Health Complex (hospital) | 42.9 | osm:node/2349386844<br>osm:node/4933643639 | `d96e67f4`<br>`5b1adab6` | 25.049209, 88.755569 | Naogaon | **likely same** | Spelling variant (edit distance 1), 43 m apart. |
| Chest Diseases Hospital, Hospital (hospital) | Chest Diseases Hospital (hospital) | 43.3 | osm:node/12969380561<br>osm:way/243705028 | `3893b25b`<br>`c3218c3e` | 24.862424, 89.359647 | Bogura | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 43 m apart. |
| Shibalaya Upazila Health Complex, Government hospital (hospital) | Shibalaya Upazila Health Complex (hospital) | 43.4 | osm:node/12558767936<br>osm:node/2382256252 | `503b306a`<br>`1999aa6f` | 23.846138, 89.821463 | Manikganj | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 43 m apart. |
| Police Lines Hospital (hospital) | Police Line Hospital (hospital) | 48.5 | osm:node/2333045235<br>osm:node/9855627399 | `efbf27fe`<br>`1fb19586` | 22.352487, 91.820210 | Chattogram | **likely same** | Spelling variant (edit distance 1), 48 m apart. |
| fulbari community clinic (clinic) | community clinic (clinic) | 53.2 | osm:way/591123360<br>osm:node/5645299377 | `9d6eb906`<br>`3cfba90e` | 25.539571, 89.845032 | Kurigram | **probably different** | Match only through a generic name ('community clinic'); the longer name is a specific place. |
| Universal Medical College Hospital Ltd. (hospital) | Universal Medical College Hospital (hospital) | 60.2 | osm:node/11936872273<br>osm:way/444013582 | `b0294e4c`<br>`97a3ab21` | 23.776203, 90.395748 | Dhaka | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 60 m apart. |
| Rainbow Clinic (clinic) | Rainbow Clinic, Private hospital (hospital) | 60.7 | osm:way/447855707<br>osm:node/13075837210 | `b626a44f`<br>`f27e3e4a` | 25.764212, 89.232979 | Rangpur | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 61 m apart. Types differ (clinic / hospital). |
| Patuakhali Medical College Hospital (hospital) | Patuakhli Medical College Hospital (hospital) | 62.4 | osm:relation/8718178<br>osm:node/5723734480 | `90be238e`<br>`d9c2396f` | 22.362971, 90.327461 | Patuakhali | **likely same** | Spelling variant (edit distance 1), 62 m apart. |
| District Veterinary Hospital (hospital) | District Veterinary Hospital, Hospital (hospital) | 65.1 | osm:node/12973590170<br>osm:node/12969315090 | `614086d1`<br>`f2335d6e` | 24.854788, 89.358988 | Bogura | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 65 m apart. |
| Neuro ICU, IBN SINA HOSPITAL (hospital) | IBN SINA HOSPITAL (hospital) | 65.5 | osm:node/12012260642<br>osm:node/6968431018 | `e2bf0f69`<br>`5c3a4d48` | 23.751629, 90.368341 | Dhaka | **probably different** | One feature is a part of, or next to, the other (unit, gate, pond, tube-well, building, office). |
| DigiLab (hospital) | DGLab (clinic) | 66.1 | osm:node/11949327413<br>osm:node/4580049596 | `80aa504d`<br>`c0019e9f` | 23.811607, 90.367565 | Dhaka | **unclear** | Possibly the same brand spelled two ways, 66 m apart; types differ. |
| Eye hospital (hospital) | Eye Hospital, Hospital (hospital) | 72.0 | osm:way/535518363<br>osm:node/13017178395 | `1035b700`<br>`09665dae` | 25.146201, 89.389013 | Gaibandha | **unclear** | Both names are generic ('Eye hospital'); 72 m apart. |
| Central (clinic) | Central Clinic and Diagonestics Centr (clinic) | 78.6 | osm:way/447855706<br>osm:node/9596436417 | `1acfbf80`<br>`7e20c1e3` | 25.764241, 89.232831 | Rangpur | **unclear** | 'Central' is too short to compare; one is a building outline, 79 m apart. |
| Phulbari Upazila Health complex ফুলবাড়ীর উপজেলা স্বাস্থ্য কমপ্লেক্স (hospital) | Phulbari Upazila Health Complex (hospital) | 79.5 | osm:way/540123465<br>osm:node/2365532473 | `ed03d4e5`<br>`ad74345e` | 25.501650, 88.948799 | Dinajpur | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 80 m apart. |
| Joyrumkurra Hospital (hospital) | Joyrumkura Hospital (hospital) | 85.7 | osm:way/721576505<br>osm:node/6768847372 | `0d811422`<br>`3d38cf7b` | 25.144457, 90.324725 | Mymensingh | **likely same** | Spelling variant (edit distance 1), 86 m apart. |
| Mother Teresa Diagnostic Centre (clinic) | Mother Teresa diagnostic (clinic) | 85.9 | osm:node/9578950507<br>osm:node/11777785858 | `3e7b0a45`<br>`5b476d32` | 22.722328, 89.070736 | Satkhira | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 86 m apart. |
| Dhamairhat Upazila Health Complex (hospital) | Dhamoirhat Upazila Health Complex (hospital) | 99.6 | osm:node/9692896253<br>osm:node/2349386830 | `c5336ab1`<br>`a37eb9e8` | 25.150889, 88.851858 | Naogaon | **likely same** | Spelling variant (edit distance 1), 100 m apart. |
| Sheba Hospital (hospital) | Manob Sheba Hospital (hospital) | 108.4 | osm:node/9603841731<br>osm:node/9603841729 | `dad575db`<br>`bb36907e` | 24.266599, 89.925229 | Tangail | **probably different** | 'Sheba' (service) is a common word in clinic names; different first word, 108 m apart. |
| Gaibandha General hospital pond (hospital) | Gaibandha General Hospital (hospital) | 108.9 | osm:way/1043311624<br>osm:node/2332802122 | `23a9b53e`<br>`875ed7fd` | 25.326306, 89.537370 | Gaibandha | **probably different** | One feature is a part of, or next to, the other (unit, gate, pond, tube-well, building, office). |
| Asgar Ali Hospital , Dhaka (hospital) | Asgar Ali Hospital (hospital) | 109.4 | osm:node/11760464566<br>osm:node/4527964655 | `adf2affb`<br>`acc96b7d` | 23.708584, 90.422915 | Dhaka | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 109 m apart. |
| Rangpur Medical College Hospital (hospital) | Rangpur Medial College Hospital (hospital) | 120.8 | osm:way/180018211<br>osm:node/1950821381 | `2120ddb8`<br>`80988fe8` | 25.767324, 89.232715 | Rangpur | **likely same** | Spelling variant (edit distance 1), 121 m apart. |
| Boda Upazila Health Complex (hospital) | Boda Upazila Health Complex, Hospital (hospital) | 124.6 | osm:node/2381388292<br>osm:node/13232613789 | `ae9f1593`<br>`d89cd89a` | 26.203481, 88.553258 | Panchagarh | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 125 m apart. |
| Chittagong Medical College Hospital (hospital) | Chittagong Medical College (hospital) | 124.9 | osm:node/842543448<br>osm:node/1329007641 | `8b6ee84f`<br>`5be18b36` | 22.359335, 91.830657 | Chattogram | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 125 m apart. |
| Uttara Cresent (hospital) | Uttara Cresent Hospital (hospital) | 128.0 | osm:node/266885101<br>osm:node/3907717965 | `e9fad6af`<br>`0d385a2e` | 23.867307, 90.396671 | Dhaka | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 128 m apart. |
| TMSS Medical College (hospital) | TMSS Medical College Hospital (hospital) | 128.0 | osm:way/531201398<br>osm:way/531200948 | `01ead6a4`<br>`d7d78712` | 24.908195, 89.355404 | Bogura | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 128 m apart. |
| Mohammad Ali Hospital (hospital) | Multipurpose Building, 250-bed Mohammad Ali Hospital Extension Building, Hospital (hospital) | 128.7 | osm:way/243852557<br>osm:node/12886230122 | `a2173b9a`<br>`31b42ba3` | 24.835698, 89.373749 | Bogura | **probably different** | One feature is a part of, or next to, the other (unit, gate, pond, tube-well, building, office). |
| Chittagong Medical College (hospital) | Chittagong Medical College Hospital (hospital) | 144.0 | osm:node/2209597822<br>osm:node/842543448 | `5438f831`<br>`8b6ee84f` | 22.360605, 91.830382 | Chattogram | **likely same** | Same name plus suffix/prefix (Ltd, category, address), 144 m apart. |
| Physiotherapy Centre (clinic) | Sathi Pharmacy And Physiotherapy Centre (clinic) | 163.1 | osm:node/11876057719<br>osm:node/11876057747 | `87ea5095`<br>`d4018d96` | 23.747507, 90.428779 | Dhaka | **probably different** | Match only through a generic name ('physiotherapy centre'); the longer name is a specific place. |
| Al Raji Diagonostic center (clinic) | Diagonostic Center (clinic) | 208.3 | osm:node/3559112805<br>osm:node/3558445435 | `0ae98131`<br>`18823229` | 24.871000, 90.731833 | Netrakona | **probably different** | Match only through a generic name ('diagonostic center'); the longer name is a specific place. |
| Diagonostic Center (clinic) | Fatema Diagonostic Center (clinic) | 211.0 | osm:node/3558445435<br>osm:node/3559115596 | `18823229`<br>`d7f3303d` | 24.871380, 90.733855 | Netrakona | **probably different** | Match only through a generic name ('diagonostic center'); the longer name is a specific place. |
| Dhaka Medical College Hospital (hospital) | Burn & Plastic Surgery Unit, Hospital, Secretariate Road, Dhaka Medical College Hospital, Dhaka (hospital) | 230.7 | none (manual)<br>osm:node/11821795271 | `feb2ba2f`<br>`32540582` | 23.725800, 90.397600 | Dhaka | **probably different** | One feature is a part of, or next to, the other (unit, gate, pond, tube-well, building, office). |
| Desh Diagnostic & Medical Centre (clinic) | Bangladesh Diagnostic & Medical Centre (clinic) | 273.7 | osm:node/9528956536<br>osm:node/9528996422 | `cc68ef73`<br>`39cc4a92` | 23.733444, 90.415492 | Dhaka | **probably different** | Different first word ('Desh' is inside 'Bangladesh' by chance), 274 m apart. |
| Sheba Hospital (hospital) | Uttomsheba Hospital, Hospital (hospital) | 293.4 | osm:node/9596436433<br>osm:node/13075784450 | `be3041aa`<br>`924e73c6` | 25.764201, 89.232546 | Rangpur | **probably different** | Match only through a generic name ('sheba hospital'); the longer name is a specific place. |
| Diagonostic Center (clinic) | Nabila Diagonostic Center (clinic) | 295.1 | osm:node/3558445435<br>osm:node/3559007771 | `18823229`<br>`5bed73d9` | 24.871380, 90.733855 | Netrakona | **probably different** | Match only through a generic name ('diagonostic center'); the longer name is a specific place. |
| Uttam Sheba Hospital (hospital) | Sheba Hospital (hospital) | 306.4 | osm:node/9596532351<br>osm:node/9596436433 | `a7180f03`<br>`be3041aa` | 25.762297, 89.234758 | Rangpur | **probably different** | Match only through a generic name ('sheba hospital'); the longer name is a specific place. |
| Diagonostic Center (clinic) | Apollo Diagonostic Center (clinic) | 314.7 | osm:node/3558445435<br>osm:node/3559007759 | `18823229`<br>`241f7584` | 24.871380, 90.733855 | Netrakona | **probably different** | Match only through a generic name ('diagonostic center'); the longer name is a specific place. |
| Diagonostic Center (clinic) | Nova Diagonostic Center (clinic) | 340.7 | osm:node/3558445435<br>osm:node/3559007773 | `18823229`<br>`f05e3fba` | 24.871380, 90.733855 | Netrakona | **probably different** | Match only through a generic name ('diagonostic center'); the longer name is a specific place. |
| Euro Asia Diagnostic & Medical Centre (clinic) | Asia Diagnostic & Medical Centre (clinic) | 364.0 | osm:node/9528999625<br>osm:node/9529540775 | `5c9c3266`<br>`fd880956` | 23.732304, 90.415065 | Dhaka | **probably different** | Different brand ('Euro Asia' vs 'Asia'), 364 m apart. |
| cyclone Center (flood_shelter) | Mosque beside cyclone center on the west side of Zillbuwania Vere Bada (flood_shelter) | 376.6 | osm:node/5894705972<br>osm:node/5876233966 | `cdfb6a95`<br>`b1415375` | 22.304713, 89.847034 | Bagerhat | **probably different** | One feature is a part of, or next to, the other (unit, gate, pond, tube-well, building, office). |
| Nagor Health Care 2 (hospital) | Nagor Health Care (hospital) | 384.3 | osm:node/4077212339<br>osm:way/326136440 | `11873b7d`<br>`0fa29dda` | 23.751428, 90.404796 | Dhaka | **probably different** | Numbered units/posts/branches (1, 2, 3). |
| Ashrayan Foundation Cyclone Center (flood_shelter) | cyclone Center (flood_shelter) | 406.0 | osm:node/5894705973<br>osm:node/5894705972 | `6d767c90`<br>`cdfb6a95` | 22.301845, 89.849477 | Bagerhat | **probably different** | Match only through a generic name ('cyclone center'); the longer name is a specific place. |
| Cyclone centre (flood_shelter) | Madrasa cum cyclone centre (flood_shelter) | 485.6 | osm:node/6102348683<br>osm:node/6102350771 | `cf10b6e7`<br>`54fa5279` | 22.003915, 90.006240 | Barguna | **probably different** | Match only through a generic name ('cyclone centre'); the longer name is a specific place. |
| cyclone Center (flood_shelter) | Private Primary School near Zilbunia Cyclone Center (flood_shelter) | 502.1 | osm:node/5894705972<br>osm:node/5876233965 | `cdfb6a95`<br>`76fdd6b0` | 22.304713, 89.847034 | Bagerhat | **probably different** | One feature is a part of, or next to, the other (unit, gate, pond, tube-well, building, office). |
| MSF BKL Health Post 1 (clinic) | MSF BKL Health Post 2 (clinic) | 553.6 | osm:way/559220988<br>osm:node/5344036821 | `64bf50de`<br>`8f8bfbda` | 21.195269, 92.161363 | Cox's Bazar | **probably different** | Numbered units/posts/branches (1, 2, 3). |
| MSF BKL Health Post 1 (clinic) | MSF BKL Health Post 3 (clinic) | 580.5 | osm:way/559220988<br>osm:way/563724022 | `64bf50de`<br>`2604aeba` | 21.195269, 92.161363 | Cox's Bazar | **probably different** | Numbered units/posts/branches (1, 2, 3). |
| Dhaka EPZ Hospital (hospital) | Dhaka EPZ Hospital, Hospital (hospital) | 631.4 | osm:node/12309263250<br>osm:node/12311790514 | `e998973a`<br>`614e06e9` | 23.946839, 90.275922 | Dhaka | **unclear** | Same name plus suffix/prefix but 631 m apart (could be a branch or a misplaced pin). |
| MSF BKL Health Post 3 (clinic) | MSF BKL Health Post 2 (clinic) | 770.3 | osm:way/563724022<br>osm:node/5344036821 | `2604aeba`<br>`8f8bfbda` | 21.193849, 92.155975 | Cox's Bazar | **probably different** | Numbered units/posts/branches (1, 2, 3). |
| Ibn Sina Hospital (head office) (hospital) | IBN SINA HOSPITAL (hospital) | 780.5 | osm:node/5209803187<br>osm:node/6968431018 | `d1ce8fe8`<br>`5c3a4d48` | 23.745237, 90.372377 | Dhaka | **probably different** | One feature is a part of, or next to, the other (unit, gate, pond, tube-well, building, office). |
| Al Noor Eye Hospital ( Permanent Building ) (hospital) | Al-Noor Eye Hospital (hospital) | 805.8 | osm:node/12022698666<br>osm:way/1240697232 | `2891cea7`<br>`0bd3c9da` | 23.752045, 90.358039 | Dhaka | **probably different** | One feature is a part of, or next to, the other (unit, gate, pond, tube-well, building, office). |
| Eye hospital (hospital) | Mirpur Eye Hospital (hospital) | 818.4 | osm:node/3740064551<br>osm:node/8356460312 | `86d27e2a`<br>`46ae4791` | 23.816653, 90.367458 | Dhaka | **probably different** | Match only through a generic name ('eye hospital'); the longer name is a specific place. |
| School cum cyclone shelter (flood_shelter) | Cyclone shelter (flood_shelter) | 861.3 | osm:node/6113445236<br>osm:node/6112328793 | `2980d440`<br>`1dc7c5f2` | 22.195813, 90.038773 | Barguna | **probably different** | Match only through a generic name ('cyclone shelter'); the longer name is a specific place. |
| Marie Stopes (hospital) | Marie Stopes Clinic (clinic) | 899.1 | osm:node/3529312405<br>osm:node/4508575874 | `0d367b9a`<br>`3887cc56` | 23.717712, 90.368018 | Dhaka | **unclear** | Same name plus suffix/prefix but 899 m apart (could be a branch or a misplaced pin). Types differ (hospital / clinic). |
| CARE And CURE, Hospital (hospital) | Care And Cure Hospital, Hospital (hospital) | 900.6 | osm:node/12883391996<br>osm:node/12883373830 | `1f416d00`<br>`8357c62f` | 24.822809, 89.381877 | Bogura | **unclear** | Same name plus suffix/prefix but 901 m apart (could be a branch or a misplaced pin). |
| Diagonostic Center (clinic) | New Swadesh Hospital and Diagonostic Center (hospital) | 921.1 | osm:node/3558445435<br>osm:node/3561656524 | `18823229`<br>`036c9fa4` | 24.871380, 90.733855 | Netrakona | **probably different** | Match only through a generic name ('diagonostic center'); the longer name is a specific place. Types differ (clinic / hospital). |
| Diagonostic Center (clinic) | City Digital Diagonostic Center (clinic) | 938.1 | osm:node/3558445435<br>osm:node/3561656512 | `18823229`<br>`c1d08049` | 24.871380, 90.733855 | Netrakona | **probably different** | Match only through a generic name ('diagonostic center'); the longer name is a specific place. |
| MSF KTP Health Post 3 (clinic) | MSF KTP Health Post 2 (clinic) | 947.2 | osm:node/5636696509<br>osm:way/554097108 | `bec63f27`<br>`f6a8515e` | 21.203732, 92.150656 | Cox's Bazar | **probably different** | Numbered units/posts/branches (1, 2, 3). |
| Marie Stopes Clinic (clinic) | Marie Stopes (hospital) | 952.5 | osm:node/3328121544<br>osm:way/326624837 | `9dde008a`<br>`bf99c50d` | 23.739301, 90.361979 | Dhaka | **unclear** | Same name plus suffix/prefix but 952 m apart (could be a branch or a misplaced pin). Types differ (clinic / hospital). |
| Diagonostic Center (clinic) | Model Diagonostic Center (clinic) | 961.1 | osm:node/3558445435<br>osm:node/3561656520 | `18823229`<br>`47f8a39a` | 24.871380, 90.733855 | Netrakona | **probably different** | Match only through a generic name ('diagonostic center'); the longer name is a specific place. |
| Bangladesh Eye Hospital (hospital) | Bangladesh ENT Hospital (hospital) | 971.5 | osm:node/364419618<br>osm:node/6968431040 | `0b08a9d9`<br>`0905dd08` | 23.751745, 90.367370 | Dhaka | **probably different** | Eye vs ENT: different specialities, about 1 km apart. |
| Bangladesh ENT Hospital (hospital) | Bangladesh Eye Hospital (hospital) | 993.0 | osm:node/12009447140<br>osm:node/364419618 | `f79b6aea`<br>`0b08a9d9` | 23.755542, 90.376201 | Dhaka | **probably different** | Eye vs ENT: different specialities, about 1 km apart. |
| Diagonostic Center (clinic) | Nirapod Diagonostic Center (clinic) | 994.5 | osm:node/3558445435<br>osm:node/3561656525 | `18823229`<br>`cd5d3422` | 24.871380, 90.733855 | Netrakona | **probably different** | Match only through a generic name ('diagonostic center'); the longer name is a specific place. |

### 3c. Different names at the same spot (< 30 m): 525 pairs

525 pairs form 223 clusters. The big ones are medical markets where many separate diagnostic centres, chambers and
clinics share one building or one street front: 18 places in one Rangpur cluster, 15 in Satkhira, 15 in Rangpur, 11 in
Rajshahi, two of 8 in Rajshahi. By district: Dhaka 83 clusters, Chattogram 22, Rangpur 13, Satkhira 8.

| Verdict | Pairs |
|---|---|
| probably different (no distinctive word in common, or only a street/area/generic word) | 463 |
| already listed in 3b | 27 |
| likely same place | 21 |
| likely same institution | 3 |
| unclear | 11 |

Only one 3c pair has exactly the same coordinates ("Shanta Diginotic" / "Shanta Diagnostic", Dhaka). Every pair that is
not "probably different" or "see 3b" is listed here:

| Name A | Name B | Dist (m) | OSM ids | Asset ids (first 8) | Lat, lon (A) | District | Verdict | Reason |
|---|---|---|---|---|---|---|---|---|
| Shanta Diginotic (clinic) | Shanta Diagnostic (clinic) | 0.0 | osm:node/5622154509<br>osm:node/5622155062 | `94272d33`<br>`99faf40b` | 23.783724, 90.409808 | Dhaka | **likely same** | Shares a distinctive word: shanta; the rest of the name is a spelling/format variant. |
| Premier Hospital (hospital) | Premiere Hospital & Sheba Diagnostic (hospital) | 2.2 | osm:node/9601138199<br>osm:way/250943035 | `743e72d8`<br>`a7815401` | 22.360010, 91.827758 | Chattogram | **likely same** | Shares a distinctive word: premier~premiere; the rest of the name is a spelling/format variant. |
| Aichi Medical College Hospital (hospital) | Aichi Hospital (hospital) | 3.2 | osm:node/11097917006<br>osm:node/11117416963 | `13d5fc78`<br>`acc31af4` | 23.740981, 90.478513 | Dhaka | **likely same** | Shares a distinctive word: aichi; the rest of the name is a spelling/format variant. |
| CDM Dental (hospital) | CDM Hospital (hospital) | 3.9 | osm:node/9589195164<br>osm:node/9589195163 | `455f448e`<br>`cc2feb30` | 24.371979, 88.581787 | Rajshahi | **unclear** | Same brand, different services (dental/clinic/maternity) at one address; may be one building with two listings. |
| Surgiscope hospital unit 1 OS (hospital) | Sergioscope 01 (hospital) | 4.1 | osm:node/2214704498<br>osm:way/514945774 | `a528a071`<br>`70247eb5` | 22.360479, 91.833543 | Chattogram | **likely same** | Shares a distinctive word: surgiscope~sergioscope; the rest of the name is a spelling/format variant. |
| Mamata Maternal Hospital (hospital) | Mamata Clinic (hospital) | 4.3 | osm:way/514716815<br>osm:node/11118498436 | `a09ad50b`<br>`475d16a9` | 22.353386, 91.816212 | Chattogram | **unclear** | Same brand, different services (dental/clinic/maternity) at one address; may be one building with two listings. |
| Community Clinic, Ward 14 (hospital) | Community Clinic, Ward no 14 (clinic) | 4.3 | osm:way/305106655<br>osm:node/3098853086 | `a3b3feb8`<br>`6fec0843` | 22.837951, 89.523497 | Khulna | **likely same** | Shares a distinctive word: ward; the rest of the name is a spelling/format variant. |
| Saphena General Hospital (hospital) | Saphena Womens Dental College & Hospital (hospital) | 4.7 | osm:node/4381071794<br>osm:node/4381094290 | `16614417`<br>`c41374e0` | 23.748218, 90.412379 | Dhaka | **unclear** | Same brand, different services (dental/clinic/maternity) at one address; may be one building with two listings. |
| Unique pain and paralysis center (clinic) | Unique Pain & Paralysis Centre (hospital) | 5.0 | osm:node/11947046270<br>osm:node/8244931863 | `dcd95094`<br>`600bd545` | 23.818292, 90.365730 | Dhaka | **likely same** | Shares a distinctive word: pain, paralysis, unique; the rest of the name is a spelling/format variant. |
| BSBA (hospital) | BHBA HOSPITAL, Bhatiari Station Road, Bhatiari, Chattogram (hospital) | 5.4 | osm:node/7260625103<br>osm:node/11147894495 | `82d528de`<br>`3252bcf7` | 22.429844, 91.747899 | Chattogram | **unclear** | Acronyms differ by one letter, 5 m apart; could be a typo. |
| Padma Homeo Medicare (hospital) | Padma Nursing (clinic) | 5.7 | osm:way/1041699316<br>osm:node/12700376301 | `53cde03e`<br>`feebf524` | 24.360883, 88.624944 | Rajshahi | **unclear** | Same brand, different services (dental/clinic/maternity) at one address; may be one building with two listings. |
| Transfusion Unit (hospital) | Transfusion Medicine Department (hospital) | 6.5 | osm:node/5298993124<br>osm:node/5299015622 | `e468361c`<br>`2ba8fdf1` | 23.740358, 90.394958 | Dhaka | **unclear** | Same department named twice, or a unit inside a department. |
| Chittagong Maa-O-Shishu Hospital (hospital) | Chittagong Ma O Shishu Haspatal (hospital) | 7.6 | osm:way/252855506<br>osm:way/252855893 | `8c3c5bce`<br>`3eaa5ac8` | 22.322725, 91.806231 | Chattogram | **likely same** | Shares a distinctive word: shishu; the rest of the name is a spelling/format variant. |
| Asgar Ali Hospital (hospital) | Ali Asgar Hospital (hospital) | 7.6 | osm:node/4527964655<br>osm:way/368246944 | `acc96b7d`<br>`e1533fe8` | 23.707838, 90.423615 | Dhaka | **likely same** | Same two words in a different order, 8 m apart. |
| Ekushe Hospital (hospital) | Ekushey Hospital,Mirzapul(OS) (hospital) | 7.8 | osm:node/2342005239<br>osm:node/5031604362 | `f86ddf9c`<br>`33ea43de` | 22.366103, 91.833482 | Chattogram | **likely same** | Shares a distinctive word: ekushe~ekushey; the rest of the name is a spelling/format variant. |
| Saik General Hospital (hospital) | SAIC General Hospital Ltd., Hospital (hospital) | 8.3 | osm:node/5219734321<br>osm:node/12883355747 | `4e8ca1cc`<br>`18fd9e7f` | 24.831359, 89.376653 | Bogura | **likely same** | Saik/SAIC spelling variant with a ', Hospital' suffix, 8 m apart (see also 3b). |
| Rido Shastho Kendro (hospital) | Rido Dental Clinic (clinic) | 9.5 | osm:node/9576134390<br>osm:node/9576134389 | `5a9f64f5`<br>`9eaa8d37` | 22.859285, 89.040644 | Satkhira | **unclear** | Same brand, different services (dental/clinic/maternity) at one address; may be one building with two listings. |
| Al Razi Hospital (Ext) (hospital) | Al Razi Hospital Complex (hospital) | 10.4 | osm:node/3003562592<br>osm:way/296574025 | `e05e94f4`<br>`b76203e5` | 23.759208, 90.390086 | Dhaka | **likely same institution** | Several buildings of one hospital (Ext, Complex, Building) mapped on purpose. |
| Classic Diagonestics (clinic) | Classic Dignostic center (clinic) | 11.9 | osm:node/9596532339<br>osm:way/447855716 | `f2967504`<br>`16a44aa6` | 25.762850, 89.234363 | Rangpur | **likely same** | Shares a distinctive word: classic; the rest of the name is a spelling/format variant. |
| Puraton Haar Vanga Dokan-1 (clinic) | Puraton Haar Vanga Chikotshaloy (clinic) | 12.4 | osm:node/11876057750<br>osm:node/11876057756 | `77cfffeb`<br>`c20a7419` | 23.747701, 90.430180 | Dhaka | **unclear** | Same brand; a shop (Dokan-1) and a treatment place side by side. |
| Royal Diagonestics (clinic) | Royal Diagnostic Center (clinic) | 12.4 | osm:node/9596532341<br>osm:way/447857764 | `004aea99`<br>`f5564bd2` | 25.762844, 89.234589 | Rangpur | **likely same** | Shares a distinctive word: royal; the rest of the name is a spelling/format variant. |
| Al Razi Hospital Complex (hospital) | Al RAzi Hospital Building (hospital) | 13.8 | osm:way/296574025<br>osm:way/296574308 | `b76203e5`<br>`24a61d7d` | 23.759143, 90.390159 | Dhaka | **likely same institution** | Several buildings of one hospital (Ext, Complex, Building) mapped on purpose. |
| Alam Ex Re Diagonestics (clinic) | Alam X-Ray and Diagnostic Center (clinic) | 14.6 | osm:node/9596532340<br>osm:way/447855717 | `9eaeba3d`<br>`7022d891` | 25.762831, 89.234394 | Rangpur | **likely same** | Shares a distinctive word: alam; the rest of the name is a spelling/format variant. |
| Green Life Medical College Hospital, Bir Uttam Shafiullah Sarak, Green Rd, Dhaka (hospital) | Green Life Centre for Rheumatic Care and Research (clinic) | 14.9 | osm:node/11834742028<br>osm:node/4518976289 | `461b4128`<br>`83672e38` | 23.746509, 90.385887 | Dhaka | **unclear** | Same brand, different services (dental/clinic/maternity) at one address; may be one building with two listings. |
| Delta Dygonestic & Health Service (hospital) | Delta Digonestic & Healt Care Center (clinic) | 14.9 | osm:node/3744967700<br>osm:way/343539310 | `46551e02`<br>`acad48bf` | 23.702465, 90.419431 | Dhaka | **likely same** | Shares a distinctive word: delta, dygonestic~digonestic; the rest of the name is a spelling/format variant. |
| মুগদা মেডিক্যাল কলেজ হাসপাতাল (hospital) | মুগদা মেডিকেল কলেজ ও হাসপাতাল (hospital) | 17.4 | osm:way/1100986259<br>osm:way/499441489 | `442669d7`<br>`abbfe94b` | 23.732505, 90.430127 | Dhaka | **likely same** | Same name, 'মেডিক্যাল' vs 'মেডিকেল' spelling and an added 'ও', 17 m apart. |
| National Institute of Traumatology & Orthopaedic Rehabilitation (NITOR) (hospital) | National Institute Of Traumtology & Orthopedic Rehabilitation (hospital) | 17.5 | osm:node/3450283986<br>osm:node/6900268991 | `205a3ae9`<br>`62d79285` | 23.773511, 90.369589 | Dhaka | **likely same** | Same institute (NITOR), spelling variant, 18 m apart. |
| Pulse General Hospital- পালস জেনারেল হাসপাতাল (hospital) | Pulse General Hospital, Private hospital (hospital) | 18.0 | osm:way/529921371<br>osm:node/12864387931 | `23221967`<br>`84b2d550` | 24.656840, 89.423379 | Bogura | **likely same** | Shares a distinctive word: pulse; the rest of the name is a spelling/format variant. |
| Institute Of Cardio-Vascular Diseaqses (hospital) | National medical Institute of Cardiovascular Diseases &Hospital (hospital) | 19.8 | osm:node/4929887711<br>osm:node/6900269011 | `26282a3f`<br>`e553f08e` | 23.770367, 90.369431 | Dhaka | **likely same** | Same institute name with a typo, 20 m apart. |
| Centre Point Hospital , OS (hospital) | Centre Point Hospital (Pvt) Limited (hospital) | 22.1 | osm:node/1963093210<br>osm:node/9845671541 | `336c86be`<br>`1c929ba9` | 22.343781, 91.833969 | Chattogram | **likely same** | Shares a distinctive word: point; the rest of the name is a spelling/format variant. |
| Green Life Centre for Rheumatic Care and Research (clinic) | Green Life Medical College (hospital) | 22.5 | osm:node/4518976289<br>osm:node/4561237386 | `83672e38`<br>`542bdb99` | 23.746376, 90.385869 | Dhaka | **unclear** | Same brand, different services (dental/clinic/maternity) at one address; may be one building with two listings. |
| Kotchandpur Upazila Health Complex (hospital) | Kotchandpur Health Complex (hospital) | 23.2 | osm:node/2344158198<br>osm:way/1300936193 | `47b6ccdd`<br>`04b9f5a6` | 23.411486, 89.005420 | Jhenaidah | **likely same** | Shares a distinctive word: kotchandpur; the rest of the name is a spelling/format variant. |
| Al Razi Hospital (Ext) (hospital) | Al RAzi Hospital Building (hospital) | 24.2 | osm:node/3003562592<br>osm:way/296574308 | `e05e94f4`<br>`24a61d7d` | 23.759208, 90.390086 | Dhaka | **likely same institution** | Several buildings of one hospital (Ext, Complex, Building) mapped on purpose. |
| Ghior Hospital (50 Beds), Hospital (hospital) | Ghior Upazilla Health Complex (hospital) | 27.1 | osm:node/12573937029<br>osm:node/2332686515 | `cdbc78f3`<br>`90fa9b3a` | 23.890705, 89.877020 | Manikganj | **unclear** | A 50-bed Ghior hospital and the Ghior Upazila Health Complex 27 m apart: very likely the same campus, but names differ. |
| Esquire Hospital ইস্কয়ার হাসপাতাল (hospital) | Esquire Hospital, Hospital (hospital) | 27.4 | osm:way/525078640<br>osm:node/12846665997 | `dc50e67a`<br>`85c7e9ba` | 24.395426, 89.693156 | Sirajganj | **likely same** | Shares a distinctive word: esquire; the rest of the name is a spelling/format variant. |

The full list of the 463 "probably different" pairs is not printed; the script in the appendix reproduces it.

## 4. Capacity (`occupancy`)

| occupancy | Count | Where from |
|---|---|---|
| > 0 | 7 | 5 from OSM `capacity_persons`, 2 typed by hand (the two no-source records) |
| = 0 | 0 | |
| null (missing) | 3,157 | |
| field absent | 0 | every document has the key |

The 7 with a number:

| Name | Type | occupancy | Source |
|---|---|---|---|
| Dhaka Medical College Hospital | hospital | 2,600 | none (hand-made) |
| Sadarghat river terminal | other | 2,000 | none (hand-made) |
| Brac Clinic | clinic | 50 | OSM `osm:node/12196751278` |
| Radda HmSfp centre | clinic | 20 | OSM `osm:node/12196803239` |
| King Abdul Aziz Programme | clinic | 10 | OSM `osm:node/12177906487` |
| PHC Medical and Dental Clinic | clinic | 10 | OSM `osm:node/13085544660` |
| Alo Clinic | clinic | 8 | OSM `osm:node/12198821913` |

**What 0 and null mean.** The import script never writes 0: it keeps `capacity_persons` only when it is a plain
positive whole number (`int(capacity) > 0`) and otherwise writes `null`. So in OSM-imported data, `null` means
**"not mapped / unknown"**, and a 0 could only come from a person entering it through the API (where `occupancy ≥ 0`
is allowed and would mean "truly zero"). There are no zeros now. No shelter has a capacity. Any total of "people
protected" over these assets is therefore almost entirely unknown, not small.

Two documentation mismatches: `data/assets/README.md` says "OpenStreetMap had a capacity for none of the selected
places" — 5 do (all small Dhaka clinics). It also says totals "are therefore 0"; that is only true if the code adds
nulls as 0, which should be shown as "unknown".

`replacement_value_bdt`: null for all 3,162 OSM documents; set only on the two hand-made records.

## 5. Source attribution and coordinates

| Check | Result |
|---|---|
| `source` missing | 2 (the hand-made Dhaka Medical College Hospital and Sadarghat records above) |
| OSM documents whose `notes` lack the OSM/ODbL credit | 0 |
| `source_id` present | **0 of 3,164.** The import script writes `source_id: "osm:<type>/<id>"` and relies on it to avoid double imports (`stored = {doc["source_id"] ...}`). In this copy the field is absent from every document. The cause was not checked (possibly the copy was built from API output, which does not include `source_id`). If production is the same, re-running `import` would add every facility a second time, and no asset can be traced back to its OSM feature. **Check production before anything else.** |
| Missing or malformed coordinates | 0 |
| Outside lon 88.0–92.7, lat 20.5–26.7 | 0 (the import already dropped 98 points outside every district) |
| Missing district | 0 |
| Distinct coordinate points shared by 2+ documents | 8 (7 are the duplicated OSM node pairs in 3a, 1 is Shanta Diagnostic in 3c) |

## 6. Categorisation signals

Rules are keyword searches on the normalised name (appendix). A hit is a signal for review, not proof.

| Signal | Count | Examples | Reading |
|---|---|---|---|
| Animal / veterinary / livestock hospital typed `hospital` (criticality critical) | 26 | Satkhira Animal Hospital; Upazila Veterinary Hospital (Bagerhat); National Veterinary Hospital (Dhaka); কটিয়াদি পশু হাসপাতাল; Vet-RX | OSM tags them `amenity=hospital` (OSM wants `amenity=veterinary`). They are not places for people. **Clear error for a flood portal.** |
| Pharmacy / drug shop typed hospital (10) or clinic (3) | 13 | DOYAMOY PHARMACY, SRI KISNA PHARMACY, "pharmacy" (Cumilla), Swapna/Sopna Pharmacy (Dhaka), Seba Drug House (Rangpur) | Mis-tagged in OSM. |
| Not a facility at all | 1+ | "M/s MF Traders, Construction equipment supplier" (hospital, Mymensingh) | Mis-tagged in OSM. |
| Test/junk names typed hospital | 3 | ghdgn, tyu, ozpitalez 24 orillaz :v | Probably vandalism or test edits in OSM. |
| Shelter that is not a shelter but something next to it | 10 | "Tube-well of Uttar-Purba Govt Primary school & Cyclone Shelter"; "Mosque beside cyclone center ..."; "Private Primary School near Zilbunia Cyclone Center"; "Cyclone Shelter Bazar"; "Char Borhan Cyclone Center Bazar Jame Masjid" | The import makes anything whose **name contains** "cyclone center" a shelter. A tube-well or a mosque near a shelter is not a shelter. |
| Part of a hospital typed as its own hospital | 55 | "Navy Hospital Gate"; "Gaibandha General hospital pond"; "Neuro ICU, IBN SINA HOSPITAL"; "Burn & Plastic Surgery Unit ... Dhaka Medical College Hospital"; "Bangkok Hospital Office Chattogram"; "Bumrungrad International Hospital Referral Office" | Gates, ponds, units, referral/sales offices. Offices of foreign hospitals do not treat patients. |
| Under construction / old | 7 | "Under Construction Cyclone Center" (Bhola); "Belle Vue Hospital ( under construction)"; "Old Hospital, Hospital" ×2 (Tangail) | May not be usable. |
| Name says school, type hospital | 4 | Bunagati High School (Magura); Green Life College; Dhaka Central International Nursing College; SAHIC pre-school | Bunagati High School is the clearest error. |
| Name says school/college, type clinic | 2 | Barisal Cadet College Medical Center; Army Medical College | Both plausible (medical centre inside a college). |
| Shelter whose name says school | 99 | "School cum cyclone shelter" and similar | **Correct**: schools that double as shelters. Shows that `school` and `flood_shelter` are not exclusive. |
| Health name typed shelter | 0 | | |
| Shelter name typed clinic | 1 | "Kata Khali GPS Kam Cyclone Center" (clinic, Patuakhali) | Health tag won over the shelter name; it is a school/shelter. |
| Diagnostic centre / lab typed hospital (no "hospital" in the name) | 56 | Popular Diagnostic Center; Lab one diagnostic center; The fair lab | Diagnostic centres do not admit patients. |
| Community clinic / family welfare centre typed hospital | 32 | Gangra Community Clinic; Batisa Union Health and Family Welfare Centre | Small primary-care posts, shown as critical hospitals. |
| Dental practice typed hospital | 31 (some are real dental college hospitals) | Orin Dental Care; KR Dental Care; Dental Care ×2 (Cox's Bazar) | |
| Homeopathy / herbal / unani | 23 (hospital 13, clinic 10) | Sojib Homeo Hall; Modern Herbal | |
| General hospital / health complex typed clinic | 15 | Jamuna General Hospital; Sreepur Health Complex; "upazila Health Complex" | Under-rated: shown as `high`, not `critical`. |

Because `criticality` follows the type, every animal hospital, pharmacy, gate and diagnostic centre typed `hospital`
is shown as **critical**, the same as a medical college hospital.


## Recommended handling

### Safe to fix in presentation only (the stored record stays as OSM has it)

- **Tidy the displayed name**: collapse double spaces; drop a trailing comma; drop a trailing Google-Maps category tail
  (", Hospital", ", Private hospital", ", Government hospital" ...) and the ", OS" / "(OS)" tag; show an address tail
  (after the second comma) in a smaller second line instead of in the title. Do not change letter case automatically:
  acronyms (CMH, CSCR, MSF, BSMMU) would break, and Bangla has no case.
- **Generic names**: show the type and place next to the name, e.g. "Cyclone Shelter · Barguna, near Amtali", so three
  "Cyclone Shelter" pins can be told apart.
- **Possible duplicates on the map**: cluster pins closer than about 30 m and list all names in the popup, instead of
  hiding any of them. Label the group "may be the same place".
- **Capacity**: show `null` as "Capacity not recorded" and never add it into totals as 0. Totals should say how many
  places have a known capacity (today 7 of 3,164).
- **Criticality**: label it "set by type, not assessed".
- **Attribution**: keep "© OpenStreetMap contributors" visible wherever these places are shown (ODbL requires it).
- **Optional filters, off by default only after review**: a client-side warning badge for names matching the
  veterinary/pharmacy/gate/tube-well patterns in section 6. Hiding them silently is not recommended; a badge is.

### Needs manual review at the source (OpenStreetMap), by a person

Fixes belong in OSM so they survive the next import. Each edit should be made by someone who checks imagery or local
knowledge, following OSM's rules (no copying from Google Maps).

1. The 7 pairs of identical nodes at identical coordinates (3a, distance 0.0): one of each pair is a duplicate upload.
2. The 55 + 47 + 21 "likely same place" pairs: decide whether the point and the building outline describe the same
   place, and if so move the tags onto one feature.
3. The 26 veterinary hospitals: should be `amenity=veterinary`.
4. The 13 pharmacies and "M/s MF Traders": should be `amenity=pharmacy` / `shop=*`.
5. The 3 junk names (`ghdgn`, `tyu`, `ozpitalez 24 orillaz :v`): check whether the feature exists; report or revert.
6. Gates, ponds, offices and tube-wells tagged as hospitals or named like shelters (sections 6 and 3b).
7. Bunagati High School (hospital) and the 15 general hospitals / health complexes tagged as clinics.
8. The 528 names with a ", Hospital" category tail: a 2024–2026 wave of edits whose names look copied from a map
   listing. Worth raising with the OSM Bangladesh community before relying on them.

### Can be fixed in the Rokkha import (code change, separate decision)

- Store and keep `source_id`; find out why this copy has none.
- Do not make a feature a shelter only because its name contains "cyclone center" when the name starts with
  "Tube-well of", "Mosque beside", "... near ...".
- Skip `amenity=hospital` features whose name says veterinary / animal / পশু, and pharmacies.
- Prefer one feature when an OSM point lies inside an OSM building outline with the same name.

### Must not be done

- **Do not merge or delete records on name similarity or distance alone.** 3b shows why: "Bangladesh Eye Hospital" and
  "Bangladesh ENT Hospital", "MSF Health Post 1/2/3", and the 463 neighbouring diagnostic centres in 3c are different
  places. A wrongly merged shelter disappears from the map during a flood.
- Do not edit names, types or coordinates in the Rokkha database by hand: the next import would not overwrite them, the
  copy would drift from OSM, and the ODbL "share-alike" duty would apply to the changed data.
- Do not bulk-edit OSM from this list (mass edits need the OSM import/automated-edit process and community agreement).
- Do not fill missing capacity with 0, an average or a guess, and do not present criticality as an assessment.
- Do not delete the two hand-made records without checking who uses them; if they stay, give them a `source`.
- Do not run any write against a database while investigating; everything here was done read-only on the local copy.

## Appendix: method and queries

Everything was run with the backend virtualenv (`Backend/.venv/bin/python`, pymongo) against
`mongodb://127.0.0.1:27018/rokkha_preview` only, read-only (`find` only; no update, insert or delete).

Load and counts:

```python
from pymongo import MongoClient
db = MongoClient("mongodb://127.0.0.1:27018")["rokkha_preview"]
docs = list(db["assets"].find({}))
Counter(d.get("asset_type") for d in docs)
Counter(d.get("source") for d in docs)
db["assets"].count_documents({"source_id": {"$exists": True}})      # 0
db["assets"].count_documents({"occupancy": None})                   # 3157 (null)
db["assets"].count_documents({"occupancy": 0})                      # 0
db["assets"].count_documents({"occupancy": {"$gt": 0}})             # 7
db["assets"].count_documents({"$or": [{"source": None}, {"source": ""}]})  # 2
# outside the box: checked in Python on location.coordinates [lon, lat]
not (88.0 <= lon <= 92.7 and 20.5 <= lat <= 26.7)
```

OSM id recovery (the documents carry no `source_id`):

```python
fac = json.load(open("Backend/data/assets/osm_facilities.json"))["facilities"]
key = {(f["name"], tuple(f["location"]["coordinates"])): f["source_id"] for f in fac}   # list when two match
osm_id = key.get((doc["name"], tuple(doc["location"]["coordinates"])))
```

Name checks:

```python
letters = re.sub(r"[^A-Za-z]", "", name)
all_lower  = len(letters) >= 3 and letters == letters.lower()
all_upper  = len(letters) >= 4 and letters == letters.upper()
whitespace = name != name.strip() or "  " in name or "\t" in name
edge_punct = re.search(r"^[\W_]|[\W_]$", name) and not re.search(r"[)\]ঀ-৿.]$", name)
odd_punct  = re.search(r"[,.;:\-]{2,}|\s[,.;:]|\(\s|\s\)|[!?*#@_~`|\\]", name)
category_tail = re.search(r",\s*(Hospital|Private hospital|General hospital|Government hospital|Animal hospital|"
                          r"Medical clinic|Medical Center|Specialized hospital|Maternity hospital|Parapharmacy|"
                          r"Government office)\s*(,|$)", name)
generic = norm(name) in {"community clinic", "cyclone shelter", "clinic", "hospital", ...}   # full list in section 2
```

Normalisation, distance and pairing:

```python
def norm(n):
    n = unicodedata.normalize("NFKC", n).lower().replace("য়", "য়")
    return re.sub(r"\s+", " ", re.sub(r"[^\wঀ-৿]+", " ", n)).strip()

# haversine, R = 6,371,008.8 m; candidate pairs from a 0.01° grid (about 1.1 km), then exact distance
# 3a: norm(a) == norm(b) and dist <= 200
# 3b: norm(a) != norm(b) and dist <= 1000 and (levenshtein(norm(a), norm(b)) <= 2
#       or (min(len) >= 5 and (norm(a) in norm(b) or norm(b) in norm(a))))
# 3c: norm(a) != norm(b) and dist < 30
```

Categorisation keywords (applied to `norm(name)`):

```python
veterinary = r"vet\b|vet-|veterinar|animal|livestock|poultry|পশু|প্রাণিসম্পদ"
pharmacy   = r"pharmac|drug house|medicine corner|ফার্মেসী|ফার্মেসি"
part_of    = r"\bgate\b|\bpond\b|\boffice\b|department|\bunit\b|building|\bward\b|canteen|parking|mosque|masjid|referral|morgue|quarter|\bhostel\b|গেট"
not_shelter= r"tube.?well|mosque|masjid|\bnear\b|\bbeside\b|\bpond\b|\broad\b|\bbazar\b|latrine|toilet|\bghat\b|killa|mound"
school     = r"\bschool\b|\bvidyalay|\bbidyalay|\bmadrasa|\bmadrasah|\bcollege\b|বিদ্যালয়|মাদ্রাসা|স্কুল"
diagnostic = r"^(?!.*(hospital|হাসপাতাল)).*(diagno|diagon|\blab\b|pathology|x-?ray|imaging)"
```

The audit scripts (`audit.py`, `extra.py`, `classify.py`) were kept in a temporary scratch folder and are not part of
the repository; the snippets above are enough to reproduce every number.
