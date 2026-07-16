export type ZoneId = 'north-gate' | 'assembly' | 'storage' | 'generator' | 'dock';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type TelemetryReading = {
  zoneId: ZoneId;
  temperature: number;
  vibration: number;
  humidity: number;
  occupancy: number;
  smokePpm: number;
  updatedAt: string;
};

export type SiteZone = {
  id: ZoneId;
  name: string;
  asset: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RiskScore = {
  zoneId: ZoneId;
  score: number;
  level: RiskLevel;
  drivers: string[];
};

export type Intervention = {
  id: string;
  zoneId: ZoneId;
  title: string;
  priority: RiskLevel;
  impact: string;
  etaMinutes: number;
};

export type InspectionTask = {
  id: string;
  zoneId: ZoneId;
  checklist: string;
  dueInMinutes: number;
  severity: RiskLevel;
};

export type ActivityLogEntry = {
  id: string;
  at: string;
  message: string;
  kind: 'telemetry' | 'risk' | 'intervention' | 'inspection';
};
