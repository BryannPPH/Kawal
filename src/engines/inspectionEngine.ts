import type { InspectionTask, RiskScore, SiteZone } from '../types/site';

export function generateInspectionTasks(risks: RiskScore[], zones: SiteZone[]): InspectionTask[] {
  const zonesById = new Map(zones.map((zone) => [zone.id, zone]));

  return risks
    .filter((risk) => risk.level !== 'low')
    .slice(0, 5)
    .map((risk) => {
      const zone = zonesById.get(risk.zoneId);
      const driver = risk.drivers[0] ?? 'Risk trend needs validation';

      return {
        id: `${risk.zoneId}-${risk.score}-inspection`,
        zoneId: risk.zoneId,
        checklist: `${zone?.asset ?? 'Asset'} inspection: ${driver}`,
        dueInMinutes: risk.level === 'critical' ? 5 : risk.level === 'high' ? 12 : 25,
        severity: risk.level
      };
    });
}
