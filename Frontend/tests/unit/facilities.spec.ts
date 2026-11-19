import { test, expect } from "@playwright/test";
import { displayName, possibleDuplicates } from "../../src/lib/facilities";

test("display names are tidied without changing their meaning", () => {
  expect(displayName("koitok hospital")).toBe("Koitok Hospital");
  expect(displayName("  Sylhet  Eye   Hospital ")).toBe("Sylhet Eye Hospital");
  expect(displayName(", Community Clinic,")).toBe("Community Clinic");
  expect(displayName("Foo Clinic)")).toBe("Foo Clinic");
  expect(displayName("BRAC Health Centre (Unit 2)")).toBe("BRAC Health Centre (Unit 2)"); // balanced brackets kept
  expect(displayName("ICDDR,B")).toBe("ICDDR,B"); // acronyms and mixed case untouched
  expect(displayName("সিলেট সদর হাসপাতাল")).toBe("সিলেট সদর হাসপাতাল"); // Bangla untouched
});

test("possible duplicates: same name close together only; similar names are not merged", () => {
  const ids = possibleDuplicates([
    { id: "a", name: "Kalikapur Cyclone Shelter", coordinates: [90.0, 22.0] },
    { id: "b", name: "kalikapur cyclone shelter ", coordinates: [90.0005, 22.0005] }, // ~70 m
    { id: "c", name: "Kalikapur Cyclone Shelter", coordinates: [90.05, 22.0] }, // ~5 km: different place
    { id: "d", name: "Bangladesh Eye Hospital", coordinates: [90.4, 23.7] },
    { id: "e", name: "Bangladesh ENT Hospital", coordinates: [90.4001, 23.7001] }, // similar name, different place
  ]);
  expect([...ids].sort()).toEqual(["a", "b"]);
});
