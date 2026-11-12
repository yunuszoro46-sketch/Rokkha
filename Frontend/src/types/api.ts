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

export interface PointFloodCheck {
  district: {
    pcode: string;
    name: string;
    division: string;
    flood_rank?: number;
    events_observed?: number;
    events_flooded?: number;
  } | null;
  cell: {
    observed?: {
      times_observed: number;
      times_flooded: number;
      flooded_event_ids: string[];
      last_flooded_event_id: string | null;
    };
    hazard?: Array<{
      return_period_years: number;
      depth_class: number;
      depth_label: string;
    }>;
    permanent_water?: boolean;
  } | null;
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
    occupancy: number;
    replacement_value_bdt: number;
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

