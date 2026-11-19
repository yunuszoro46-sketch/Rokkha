import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import path from "path";
import { ALL_DISTRICTS, districtAtPoint } from "../../src/lib/districts";

// The boundary file is loaded on demand in the app; here it is read from disk.
const geo = JSON.parse(readFileSync(path.join(__dirname, "..", "..", "src", "data", "bangladesh_districts.json"), "utf8"));

// The small name list must stay identical to the boundary file it was derived from.
test("district list matches the boundary file (64 districts, same pcodes, names, divisions)", () => {
  const fromGeo = geo.features
    .map((f: any) => ({ pcode: f.properties.pcode, name: f.properties.name, division: f.properties.parent_name || "" }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
  expect(ALL_DISTRICTS).toHaveLength(64);
  expect(ALL_DISTRICTS).toEqual(fromGeo);
});

test("point lookup finds the right district and nothing outside Bangladesh", () => {
  expect(districtAtPoint(geo, 91.3992, 24.9602)?.name).toBe("Sunamganj");
  expect(districtAtPoint(geo, 90.4125, 23.8103)?.name).toBe("Dhaka");
  expect(districtAtPoint(geo, 80, 10)).toBeNull();
});
