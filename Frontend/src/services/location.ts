// Reading the user's own position as accurately as the device allows.
//
// One quick getCurrentPosition() call often returns the first, rough fix
// (Wi-Fi or cell tower, hundreds of metres off) or nothing at all on laptops.
// Instead we watch the position for a few seconds and keep the most accurate
// reading, stopping early once it is good enough. The flood check works on
// ~90 m grid cells, so a fix within about 50 m is enough.
//
// If the precise (GPS) reading fails, we try once more with the device's
// rough location, which works on most laptops without a GPS chip.

export type LocationProblem = "unsupported" | "insecure" | "denied" | "unavailable" | "timeout";

export interface GpsFix {
  lng: number;
  lat: number;
  /** Radius in metres the device is ~68% sure the user is inside, or null if not given. */
  accuracy_m: number | null;
}

export class LocationError extends Error {
  problem: LocationProblem;
  constructor(problem: LocationProblem, isBn = false) {
    super(locationProblemText(problem, isBn));
    this.problem = problem;
  }
}

/** A short explanation of what went wrong (max 3 words to avoid breaking layouts). */
export function locationProblemText(problem: LocationProblem, isBn = false): string {
  switch (problem) {
    case "unsupported":
      return isBn
        ? "ব্রাউজারে অবস্থান অনুপলব্ধ"
        : "Location unsupported";
    case "insecure":
      return isBn
        ? "নিরাপদ সংযোগ প্রয়োজন"
        : "HTTPS required";
    case "denied":
      return isBn
        ? "লোকেশন পারমিশন বন্ধ"
        : "Location permission blocked";
    case "unavailable":
      return isBn
        ? "অবস্থান পাওয়া যায়নি"
        : "Location unavailable";
    case "timeout":
      return isBn
        ? "সময় শেষ হয়েছে"
        : "Location timed out";
  }
}

function problemFromCode(code: number): LocationProblem {
  // GeolocationPositionError: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "unavailable";
}

function toFix(pos: GeolocationPosition): GpsFix {
  const accuracy = pos.coords.accuracy;
  return {
    lng: pos.coords.longitude,
    lat: pos.coords.latitude,
    accuracy_m: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
  };
}

/** Watch the position and keep the best reading. Rejects with the browser's error code. */
function watchForBestFix(goodEnoughM: number, maxWaitMs: number): Promise<GpsFix> {
  return new Promise((resolve, reject) => {
    let best: GpsFix | null = null;
    let done = false;
    let watchId: number | null = null;

    const finish = (fix: GpsFix | null, errorCode?: number) => {
      if (done) return;
      done = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      window.clearTimeout(timer);
      if (fix) resolve(fix);
      else reject(errorCode ?? 3);
    };

    // When time is up, use the best reading so far (if any).
    const timer = window.setTimeout(() => finish(best, 3), maxWaitMs);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = toFix(pos);
        if (!best || (fix.accuracy_m ?? Infinity) < (best.accuracy_m ?? Infinity)) best = fix;
        if ((best.accuracy_m ?? Infinity) <= goodEnoughM) finish(best);
      },
      (error) => {
        // Permission refused: stop at once. Other errors: keep any reading we already have.
        if (error.code === 1 || !best) finish(best, error.code);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs }
    );
  });
}

/** One rough reading (Wi-Fi / network). Accepts a reading up to 5 minutes old. */
function roughFix(timeoutMs: number): Promise<GpsFix> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(toFix(pos)),
      (error) => reject(error.code),
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: timeoutMs }
    );
  });
}

/**
 * The user's position, as accurate as the device allows. Asks for permission.
 * Throws LocationError with a message the page can show as it is.
 */
export async function readPreciseLocation(
  options: { isBn?: boolean; goodEnoughM?: number; maxWaitMs?: number } = {}
): Promise<GpsFix> {
  const { isBn = false, goodEnoughM = 50, maxWaitMs = 12000 } = options;

  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    throw new LocationError("unsupported", isBn);
  }
  if (window.isSecureContext === false) {
    throw new LocationError("insecure", isBn);
  }

  try {
    return await watchForBestFix(goodEnoughM, maxWaitMs);
  } catch (code) {
    const problem = problemFromCode(code as number);
    if (problem === "denied") throw new LocationError("denied", isBn);
  }

  // No precise reading: fall back to the device's rough location.
  try {
    return await roughFix(10000);
  } catch (code) {
    throw new LocationError(problemFromCode(code as number), isBn);
  }
}

/** "±20 m" style text for a reading's accuracy. */
export function accuracyText(fix: GpsFix, isBn = false): string {
  if (fix.accuracy_m === null) return "";
  const m = fix.accuracy_m >= 1000 ? `${(fix.accuracy_m / 1000).toFixed(1)} km` : `${fix.accuracy_m} m`;
  if (!isBn) return `±${m}`;
  const bnDigits = "০১২৩৪৫৬৭৮৯";
  return `±${m.replace(/\d/g, (d) => bnDigits[Number(d)]).replace("km", "কিমি").replace(" m", " মি")}`;
}
