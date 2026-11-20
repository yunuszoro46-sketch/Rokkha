"use client";

import React, { useEffect, useId, useRef, useState } from "react";

// Definitions of specialised terms as they apply to Rokkha's implementation.
export const GLOSSARY: Record<string, { term: string; def: string }> = {
  sar: { term: "SAR (synthetic aperture radar)", def: "A satellite radar that sends its own microwave pulses, so it images the ground through cloud and at night. Calm open water reflects the pulse away from the satellite and looks dark, which is how flood water is mapped." },
  sentinel1: { term: "Sentinel-1", def: "European Copernicus radar (C-band SAR) satellites. Over Bangladesh a pass happens every few days, not daily." },
  gfm: { term: "GFM (Global Flood Monitoring)", def: "A Copernicus service that automatically maps flood water on every Sentinel-1 image, removing normal permanent and seasonal water and masking land where radar cannot see water reliably." },
  reanalysis: { term: "Reanalysis", def: "A best estimate of past weather, made by combining observations with a weather model on a regular grid. ERA5's grid is about 25 km; it is not a rain-gauge reading." },
  resolution: { term: "Spatial resolution", def: "The ground size that one pixel or grid cell represents. Differences smaller than one cell cannot be seen in that data." },
  discharge: { term: "River discharge", def: "The volume of water passing a river cross-section each second, in cubic metres per second (m³/s). GloFAS discharge is modelled, not measured by a gauge." },
  feature: { term: "Feature engineering", def: "Turning raw data into the variables a model uses, for example adding up seven days of rain or comparing today's river flow with its 30-day mean." },
  gbt: { term: "Gradient-boosted trees", def: "Many small decision trees built one after another, each one fitted to the errors left by the trees before it; their scores are added up. Rokkha uses XGBoost's implementation." },
  calibration: { term: "Calibration", def: "Adjusting a model's scores so that a stated probability matches how often the event really happens: of all days given about 20 %, about 20 % should flood." },
  inference: { term: "Inference", def: "Running the already-trained model on new inputs to produce an output. Rokkha does this once every morning for each district." },
  districtday: { term: "District-day", def: "One district on one day: the unit the model predicts and is evaluated on." },
  heldout: { term: "Held-out data", def: "Data kept away from training, tuning and threshold choice, used only to measure performance. Rokkha holds out whole years (2023–2024, then 2025)." },
  baseline: { term: "Baseline", def: "A simple rule to compare against. Persistence: “today looks like the latest satellite pass”. Climatology: “the usual flood rate for this district and month”." },
  prauc: { term: "PR-AUC", def: "Area under the precision–recall curve: how well flood days are ranked above non-flood days across all thresholds. Suited to rare events; a random guess scores about the flood rate (about 0.02 here), 1 is perfect." },
  rocauc: { term: "ROC-AUC", def: "The chance that a randomly chosen flood day gets a higher score than a randomly chosen dry day (0.5 = random, 1 = perfect). It can look high for rare events even when warnings are not precise." },
  brier: { term: "Brier score", def: "The mean squared difference between the predicted probability and what happened (0 or 1). Lower is better; it rewards honest probabilities." },
  precision: { term: "Precision", def: "Of the days a warning was raised, the share that really flooded. Low precision = many false alarms." },
  recall: { term: "Recall", def: "Of the days that really flooded, the share that had a warning. Low recall = many missed floods." },
  gain: { term: "Gain importance", def: "In tree models, the total improvement in the training objective from splits on an input. It shows what the model relies on overall — not what caused a particular prediction." },
  returnperiod: { term: "Return period", def: "A way to express how likely a flood is in any given year: a 100-year flood has about a 1 % chance each year. It does not mean it happens once every 100 years." },
  hazardmap: { term: "Modelled hazard map", def: "A map of where water could reach in a flood of a given return period, from hydrological and hydraulic models (JRC). It describes possibility, not current conditions, and ignores embankments." },
  onset: { term: "Onset day", def: "A day when the latest satellite pass showed no flood. Predicting a flood on such a day means predicting its start, the hardest case." },
};

/** A term with a short definition the visitor can open; keyboard and screen-reader friendly. */
export const Term: React.FC<{ k: keyof typeof GLOSSARY | string; children: React.ReactNode; dark?: boolean }> = ({ k, children, dark }) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const g = GLOSSARY[k as string];
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);
  if (!g) return <>{children}</>;
  return (
    <span ref={ref} className="relative inline">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={`underline decoration-dotted decoration-2 underline-offset-[3px] ${dark ? "decoration-rk-mist/70 hover:decoration-rk-mist" : "decoration-rk-brand/50 hover:decoration-rk-brand"}`}
      >
        {children}
      </button>
      {open && (
        <span id={id} role="note" className="absolute left-0 top-full z-30 mt-1.5 block w-[min(320px,80vw)] rounded-xl border border-rk-line bg-rk-surface p-3 text-left text-[13px] font-normal leading-snug text-rk-ink shadow-[var(--rk-shadow-float)]">
          <strong className="block text-rk-forest">{g.term}</strong>
          {g.def}
        </span>
      )}
    </span>
  );
};
