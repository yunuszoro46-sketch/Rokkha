export interface DistrictPrediction {
  pcode: string;
  name: string;
  division: string;
  target_date: string;
  status: "predicted" | "unsupported" | "inputs_missing";
  probability: number | null;
  alert_level: "none" | "watch" | "alert" | null;
  reason: string | null;
  features?: {
    rain_1d?: number | null;
    rain_3d?: number | null;
    last_flooded_share?: number | null;
    days_since_last_observation?: number | null;
    recent_rain_days?: number | null;
    [key: string]: any;
  };
  data_through?: string;
  issued_at?: string;
}

export interface AlertItem {
  alert_id: string;
  level: "watch" | "alert";
  district: {
    pcode: string;
    name: string;
    division: string;
  };
  target_date: string;
  probability: number;
  message: string;
  assets_at_risk?: {
    total: {
      assets: number;
      occupancy: number;
      replacement_value_bdt: number;
    };
    with_observed_flooding: {
      assets: number;
      occupancy: number;
      replacement_value_bdt: number;
    };
    with_modelled_hazard_10yr: {
      assets: number;
      occupancy: number;
      replacement_value_bdt: number;
    };
    assets: Array<{
      asset_id: string;
      name: string;
      asset_type: string;
      criticality: string;
      occupancy: number;
      flags: {
        observed_flooding: boolean;
        modelled_hazard_10yr: boolean;
        modelled_hazard_100yr: boolean;
      };
    }>;
  };
  issued_at: string;
}

// Exactly what POST /geospatial/flood/check returns.
export interface PointFloodCheck {
  district: {
    pcode: string;
    name: string;
    division: string;
    // Place among the 64 districts by how often they flooded (1 = most often).
    rank?: number;
    events_observed?: number;
    events_flooded?: number;
    max_flooded_share?: number;
  } | null;
  // The ~90 m map cell under the point. null = no cell data (e.g. the saved sample).
  cell: {
    times_observed: number;
    times_flooded: number;
    observed_event_ids?: string[];
    flooded_event_ids?: string[];
    // depth_label is null when the point is outside the modelled flood area.
    hazard?: Array<{
      return_period_years: number;
      depth_class: number | null;
      depth_label: string | null;
    }>;
    permanent_water?: boolean;
    grid_cell_size_m?: number;
  } | null;
  attribution?: string;
  limitations?: string[];
}

export interface SatelliteObservation {
  date: string;
  observed_share: number;
  flooded_share: number;
  advisory_share?: number;
  flooded: boolean | null;
}

export interface AssetNearResult {
  asset: {
    id: string;
    name: string;
    asset_type: string;
    location: {
      type: "Point";
      coordinates: [number, number]; // [lng, lat]
    };
    criticality: "low" | "medium" | "high" | "critical";
    /** null = not recorded (most OpenStreetMap places); never read as 0 or unlimited. */
    occupancy: number | null;
    replacement_value_bdt: number | null;
    /** e.g. "OpenStreetMap"; null = entered by hand. */
    source?: string | null;
    notes?: string | null;
    updated_at?: string;
    district?: {
      pcode: string;
      name: string;
      division: string;
    };
  };
  distance_meters: number;
  distance_kilometers: number;
}

export interface ModelStatus {
  status: "ready" | "not_trained";
  message?: string;
  model?: {
    version?: string;
    test_results?: Record<string, any>;
  };
}


// One district in GET /geospatial/flood/satellite-observations/latest.
export interface DistrictLatestObservation {
  pcode: string;
  name: string;
  division: string;
  // false = the radar can never map this district (hills, forest, city).
  observable: boolean;
  // null = no satellite pass in the last days (not "dry").
  observation: SatelliteObservation | null;
  days_ago: number | null;
}

export interface RegisteredAsset {
  id: string;
  name: string;
  asset_type: string;
  location: { type: "Point"; coordinates: [number, number] }; // [lng, lat]
  criticality: string;
  occupancy?: number | null;
  // "OpenStreetMap" for imported places; null/absent = entered by an admin.
  source?: string | null;
}

export interface RiverSite {
  site_id: string;
  name: string;
  river: string | null;
  location: { type: "Point"; coordinates: [number, number] }; // [lng, lat]
}
