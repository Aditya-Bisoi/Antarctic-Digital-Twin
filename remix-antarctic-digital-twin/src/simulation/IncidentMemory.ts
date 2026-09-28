// ============================================================================
// IncidentMemory.ts — Predictive Incident Memory
// Antarctic Digital Twin — SIH26060
//
// Combines real sensor events (the live station's simulation event log) with
// simulated-failure signatures (patterns drawn from the scenario library) to
// recognize recurring failure patterns and surface proven responses before
// the situation escalates — rather than reacting only once a threshold trips.
// ============================================================================

import { StationState } from './SimulationEngine';
import { FailurePrediction } from './PredictiveEngine';

export type IncidentConfidence = 'possible' | 'likely' | 'strong';

export interface IncidentMatch {
  id: string;
  pattern: string;
  description: string;
  confidence: IncidentConfidence;
  provenResponse: string[];
  historicalNote: string;
  recentOccurrences: number;
}

interface IncidentSignature {
  id: string;
  pattern: string;
  description: string;
  keywords: string[]; // used to correlate against the live event log
  matches: (state: StationState, predictions: FailurePrediction[]) => boolean;
  provenResponse: string[];
  historicalNote: string;
}

const SIGNATURE_LIBRARY: IncidentSignature[] = [
  {
    id: 'generator_thermal_creep',
    pattern: 'Generator temperature and vibration rising together',
    description: 'A generator shows simultaneous temperature climb and vibration increase — a combination that typically precedes bearing or cooling-system failure.',
    keywords: ['generator', 'temperature', 'vibration'],
    matches: (_state, predictions) =>
      predictions.some(
        (p) =>
          p.equipmentName.toLowerCase().includes('generator') &&
          p.abnormalFactors.some((f) => f.parameter === 'Operating Temperature') &&
          p.abnormalFactors.some((f) => f.parameter === 'Vibration Level')
      ),
    provenResponse: [
      'Shift non-critical load onto the battery buffer to ease generator load',
      'Pre-stage the emergency backup generator for standby activation',
      'Schedule a coolant and bearing inspection within 4 hours',
    ],
    historicalNote: 'This combined thermal-plus-vibration signature has preceded generator trip events in prior simulated runs; early load-shedding avoided a full failure in most cases.',
  },
  {
    id: 'battery_power_squeeze',
    pattern: 'Power deficit with falling battery reserve',
    description: 'Generation is not covering demand and battery state of charge is trending down, risking a hard power interruption.',
    keywords: ['power', 'deficit', 'battery'],
    matches: (state) => state.energy.powerDeficitKw > 0 && state.energy.batteryLevelPercent < 40,
    provenResponse: [
      'Activate the emergency backup generator',
      'Shed non-critical loads (science lab, non-essential comms)',
      'Notify crew of a possible short power interruption window',
    ],
    historicalNote: 'Matches the pattern behind past blizzard-driven power squeezes; a combined generator-plus-load-shed response restored margin within a few simulated hours.',
  },
  {
    id: 'habitat_cold_creep',
    pattern: 'Indoor temperature drifting below the comfort band',
    description: 'Critical-zone temperatures are trending toward the hypothermia-risk threshold, usually tied to a heating or power shortfall.',
    keywords: ['temperature', 'heating', 'habitat', 'indoor'],
    matches: (state) => state.infrastructure.indoorTempAvg < 17,
    provenResponse: [
      'Prioritize heating power to the Medical Bay and Living Quarters',
      'Issue a crew shelter-in-place advisory if the trend continues',
      'Cross-check generator output for a concurrent power shortfall',
    ],
    historicalNote: 'Recurs whenever a power shortfall coincides with an extreme-cold event; treating the power cause resolves the temperature symptom faster than a heater-only fix.',
  },
  {
    id: 'comms_blackout_storm',
    pattern: 'Comms degrading during high wind and low visibility',
    description: 'Satellite uplink quality is dropping while wind speed climbs — a signature typically seen during storm passages.',
    keywords: ['comms', 'satellite', 'wind', 'storm', 'uplink'],
    matches: (state) => state.communication.status !== 'Online' && state.environment.windSpeed > 70,
    provenResponse: [
      'Switch to the low-bandwidth emergency comms channel',
      'Queue non-urgent data sync for the post-storm window',
      'Confirm backup satellite terminal power status',
    ],
    historicalNote: 'Storm-correlated comms degradation reliably recovers once wind drops below roughly 60 km/h; premature realignment attempts have wasted power in past runs.',
  },
  {
    id: 'fuel_endurance_squeeze',
    pattern: 'Fuel endurance falling under a resupply delay',
    description: 'Remaining fuel autonomy is shrinking faster than the resupply schedule can cover.',
    keywords: ['fuel', 'resupply', 'endurance'],
    matches: (state) => state.logistics.fuelEnduranceDays < 21,
    provenResponse: [
      'Reduce generator load percent wherever it is safe to do so',
      'Increase solar/wind contribution during favorable weather windows',
      'Flag the resupply schedule for priority review',
    ],
    historicalNote: 'This is the earliest reliable signal of a fuel-critical trajectory; stations that acted at this stage avoided a full fuel-critical escalation in most simulated runs.',
  },
];

export function matchIncidentMemory(
  state: StationState,
  predictions: FailurePrediction[]
): IncidentMatch[] {
  const matches: IncidentMatch[] = [];

  for (const sig of SIGNATURE_LIBRARY) {
    if (!sig.matches(state, predictions)) continue;

    // Correlate against the live event log ("real sensor events") to gauge
    // how often this pattern has actually recurred in this station's history.
    const recentOccurrences = state.events.filter((e) => {
      if (e.type !== 'warning' && e.type !== 'critical') return false;
      const text = `${e.title} ${e.description} ${e.category}`.toLowerCase();
      return sig.keywords.some((kw) => text.includes(kw));
    }).length;

    const confidence: IncidentConfidence =
      recentOccurrences > 3 ? 'strong' : recentOccurrences > 0 ? 'likely' : 'possible';

    matches.push({
      id: sig.id,
      pattern: sig.pattern,
      description: sig.description,
      confidence,
      provenResponse: sig.provenResponse,
      historicalNote: sig.historicalNote,
      recentOccurrences,
    });
  }

  const confidenceRank: Record<IncidentConfidence, number> = { strong: 0, likely: 1, possible: 2 };
  return matches.sort((a, b) => confidenceRank[a.confidence] - confidenceRank[b.confidence]);
}
