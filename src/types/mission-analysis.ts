/** Describe sampled lunar geometry, its provenance and explicit availability. @author Sultan */
export type MissionObserver = {
  latitude: number;
  longitude: number;
  heightMeters: number;
  coordinateBasis: "adopted_mean_earth";
};

export type MissionInput = {
  observer: MissionObserver;
  startUtc: string;
  endUtc: string;
  stepMinutes: number;
};

export type PositionSample = {
  timestamp: string;
  azimuthDeg: number | null;
  elevationDeg: number | null;
};

export type HorizonEvent = { timestamp: string; kind: "rise" | "set" };
export type VisibilityWindow = { startUtc: string; endUtc: string; openStart: boolean; openEnd: boolean };
export type HorizonsProvenance = {
  source: string;
  apiVersion: string;
  ephemeris: string;
  centerFrame: string;
  radiusKm: number;
  timeScale: "UTC";
  queryUrl: string;
  retrievedUtc: string;
};

export type TargetAnalysis =
  | {
      status: "ready";
      samples: PositionSample[];
      events: HorizonEvent[];
      windows: VisibilityWindow[];
      visibleHours: number | null;
      missingSamples: number;
      provenance: HorizonsProvenance;
    }
  | { status: "error"; message: string };

export type MissionAnalysis = {
  input: MissionInput;
  generatedUtc: string;
  sun: TargetAnalysis;
  earth: TargetAnalysis;
  terrainVisibility: "unavailable";
  method: "airless_target_center_tangent_horizon";
};

export type MissionIssue = { field: "observer" | "latitude" | "longitude" | "heightMeters" | "coordinateBasis" | "startUtc" | "endUtc" | "stepMinutes"; message: string };
export type MissionInputResult = { success: true; input: MissionInput } | { success: false; issues: MissionIssue[] };
