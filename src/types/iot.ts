export type IoTDevice = {
  id: string;
  mqttClientId: string;
  name: string;
  deviceType: string;
  status: string;
  firmwareVersion: string | null;
  assignedWorkerId: string | null;
  assignedSiteId: string | null;
  assignedZoneId: string | null;
  assignedTaskId: string | null;
  lastSeenAt: string | null;
  batteryPct: number | null;
  signalStrength: number | null;
};

export type IoTIncident = {
  id: string;
  worker_id: string;
  task_id: string | null;
  zone_id: string | null;
  state: string;
  trigger_source: string;
  device_id: string;
  opened_at: string;
  escalation_level: number;
};

export type RestRequest = {
  id: string;
  worker_id: string;
  device_id: string;
  task_id: string | null;
  zone_id: string | null;
  source: string;
  status: string;
  requested_at: string;
  risk_score_at_request: number;
  decision: string | null;
  decision_reason: string | null;
  break_session_id: string | null;
};

export type DeviceCommand = {
  id: string;
  command_id: string;
  device_id: string;
  command_type: string;
  priority: string;
  status: string;
  issued_at: string;
  expires_at: string;
  acknowledged_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
};

export type RiskEvaluation = {
  id: string;
  worker_id: string;
  device_id: string | null;
  task_id: string | null;
  zone_id: string | null;
  risk_score: number;
  risk_level: string;
  intervention: string;
  break_minutes: number;
  reasons: string;
  evaluated_at: string;
};

export type IoTOverview = {
  devices: IoTDevice[];
  activeIncidents: IoTIncident[];
  restRequests: RestRequest[];
  commands: DeviceCommand[];
  latestRisk: RiskEvaluation[];
};

export type NearMissReport = {
  id: string;
  device_id: string;
  worker_id: string | null;
  task_id: string | null;
  zone_id: string | null;
  window_end: string;
  maximum_acceleration_g: number;
  movement_state: string;
  inactive_seconds: number;
  impact_detected: number;
  fall_candidate: number;
};

export type IncidentCenterData = {
  activeIncidents: IoTIncident[];
  incidentHistory: IoTIncident[];
  nearMissReports: NearMissReport[];
};

export type EnvironmentReading = {
  id: string;
  device_id: string;
  site_id: string | null;
  zone_id: string | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  weather: string | null;
  surface_condition: string | null;
  crane_active: number;
  restricted_zone_detected: number;
  recorded_at: string;
  received_at: string;
  data_source: string;
};
