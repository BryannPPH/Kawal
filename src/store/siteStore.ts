import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { initialTelemetry, siteZones } from '../data/initialSite';
import { calculateSiteRisk } from '../engines/riskEngine';
import { generateInspectionTasks } from '../engines/inspectionEngine';
import { optimizeInterventions } from '../engines/interventionOptimizer';
import { interventionLog, riskLog, telemetryLog } from '../engines/activityLogger';
import type { ActivityLogEntry, InspectionTask, Intervention, RiskScore, SiteZone, TelemetryReading, ZoneId } from '../types/site';

type SiteStore = {
  zones: SiteZone[];
  telemetry: TelemetryReading[];
  risks: RiskScore[];
  interventions: Intervention[];
  inspections: InspectionTask[];
  activity: ActivityLogEntry[];
  selectedZoneId: ZoneId;
  setSelectedZone: (zoneId: ZoneId) => void;
  ingestTelemetry: (reading: TelemetryReading) => void;
  simulateTelemetryBurst: () => void;
  resetSite: () => void;
};

function deriveState(telemetry: TelemetryReading[], zones: SiteZone[]) {
  const risks = calculateSiteRisk(telemetry);
  const interventions = optimizeInterventions(risks, zones);
  const inspections = generateInspectionTasks(risks, zones);

  return { risks, interventions, inspections };
}

const derivedInitialState = deriveState(initialTelemetry, siteZones);

function jitter(value: number, amount: number, min: number, max: number) {
  const next = value + (Math.random() * amount * 2 - amount);
  return Math.round(Math.min(max, Math.max(min, next)) * 10) / 10;
}

export const useSiteStore = create<SiteStore>()(
  persist(
    (set, get) => ({
      zones: siteZones,
      telemetry: initialTelemetry,
      ...derivedInitialState,
      selectedZoneId: 'generator',
      activity: [
        interventionLog(derivedInitialState.interventions[0]),
        riskLog(derivedInitialState.risks[0])
      ],
      setSelectedZone: (zoneId) => set({ selectedZoneId: zoneId }),
      ingestTelemetry: (reading) =>
        set((state) => {
          const telemetry = state.telemetry.map((item) => (item.zoneId === reading.zoneId ? reading : item));
          const derived = deriveState(telemetry, state.zones);
          const risk = derived.risks.find((item) => item.zoneId === reading.zoneId);
          const logs = [telemetryLog(reading), risk ? riskLog(risk) : undefined].filter(Boolean) as ActivityLogEntry[];

          return {
            telemetry,
            ...derived,
            activity: [...logs, ...state.activity].slice(0, 12)
          };
        }),
      simulateTelemetryBurst: () => {
        const state = get();
        const zone = state.telemetry[Math.floor(Math.random() * state.telemetry.length)];

        state.ingestTelemetry({
          ...zone,
          temperature: jitter(zone.temperature, 4.4, 25, 58),
          vibration: jitter(zone.vibration, 1.8, 0.5, 10),
          humidity: jitter(zone.humidity, 7, 30, 92),
          occupancy: Math.round(jitter(zone.occupancy, 14, 0, 98)),
          smokePpm: Math.round(jitter(zone.smokePpm, 3, 0, 18)),
          updatedAt: new Date().toISOString()
        });
      },
      resetSite: () =>
        set({
          zones: siteZones,
          telemetry: initialTelemetry,
          ...derivedInitialState,
          selectedZoneId: 'generator',
          activity: [
            interventionLog(derivedInitialState.interventions[0]),
            riskLog(derivedInitialState.risks[0])
          ]
        })
    }),
    {
      name: 'garuda-site-state',
      partialize: (state) => ({
        telemetry: state.telemetry,
        selectedZoneId: state.selectedZoneId,
        activity: state.activity
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const derived = deriveState(state.telemetry, state.zones);
        state.risks = derived.risks;
        state.interventions = derived.interventions;
        state.inspections = derived.inspections;
      }
    }
  )
);
