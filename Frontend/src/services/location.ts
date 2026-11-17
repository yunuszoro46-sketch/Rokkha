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

/** A short explanation of what went wrong and what the user can do instead. */
export function locationProblemText(problem: LocationProblem, isBn = false): string {
  switch (problem) {
    case "unsupported":
      return isBn
        ? "এই ব্রাউজার অবস্থান দিতে পারে না। মানচিত্রে আপনার জায়গায় ট্যাপ করুন বা জেলা বেছে নিন।"
        : "This browser cannot share a location. Tap your place on the map or choose your district.";
    case "insecure":
      return isBn
        ? "অবস্থান শুধু নিরাপদ (https) ঠিকানায় কাজ করে। মানচিত্রে আপনার জায়গায় ট্যাপ করুন।"
        : "Location only works on a secure (https) address. Tap your place on the map instead.";
    case "denied":
      return isBn
        ? "অবস্থানের অনুমতি বন্ধ আছে। ঠিকানা বারের পাশে লক চিহ্নে ট্যাপ করে \"অবস্থান\" চালু করুন, তারপর আবার চেষ্টা করুন।"
        : "Location permission is blocked. Tap the lock icon next to the address bar, allow \"Location\", then try again.";
    case "unavailable":
      return isBn
        ? "এই ডিভাইস এখন অবস্থান খুঁজে পাচ্ছে না। লোকেশন/জিপিএস চালু করুন, অথবা মানচিত্রে আপনার জায়গায় ট্যাপ করুন।"
        : "This device could not find its location. Turn on Location/GPS, or tap your place on the map.";
    case "timeout":
      return isBn
        ? "অবস্থান পেতে বেশি সময় লাগছে। খোলা জায়গায় গিয়ে আবার চেষ্টা করুন, অথবা মানচিত্রে ট্যাপ করুন।"
        : "Finding your location took too long. Try again near a window or outdoors, or tap your place on the map.";
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
