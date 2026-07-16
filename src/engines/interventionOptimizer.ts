import type { Intervention, RiskScore, SiteZone } from '../types/site';

const actionByLevel = {
  low: {
    title: 'Continue scheduled monitoring',
    impact: 'Keeps baseline coverage without interrupting operations',
    etaMinutes: 45
  },
  medium: {
    title: 'Dispatch floor supervisor',
    impact: 'Validates sensor readings and removes minor blockers',
    etaMinutes: 18
  },
  high: {
    title: 'Reduce load and isolate equipment',
    impact: 'Cuts escalation probability before shutdown threshold',
    etaMinutes: 10
  },
  critical: {
    title: 'Trigger emergency response protocol',
    impact: 'Prioritizes evacuation and asset shutdown',
    etaMinutes: 4
  }
} as const;

export function optimizeInterventions(risks: RiskScore[], zones: SiteZone[]): Intervention[] {
  const zoneName = new Map(zones.map((zone) => [zone.id, zone.name]));

  return risks.slice(0, 4).map((risk) => {
    const action = actionByLevel[risk.level];

    return {
      id: `${risk.zoneId}-${risk.level}-intervention`,
      zoneId: risk.zoneId,
      title: `${action.title}: ${zoneName.get(risk.zoneId) ?? risk.zoneId}`,
      priority: risk.level,
      impact: action.impact,
      etaMinutes: action.etaMinutes
    };
  });
}
