// ============================================================================
// CapabilityIntelligence.ts — Sensor-to-Capability Intelligence
// Antarctic Digital Twin — SIH26060
//
// Converts live sensor / equipment telemetry into mission impact: instead of
// only reporting "what is failing" at the component level, this module maps
// equipment health and failure trends onto the critical station FUNCTIONS
// (power, heating/life-support, water, comms, science, mobility) those
// components support, and estimates which function is at risk and how soon.
// ============================================================================

import { StationState, EquipmentItem } from './SimulationEngine';
import { FailurePrediction } from './PredictiveEngine';

export type CapabilityStatus = 'secure' | 'at_risk' | 'critical';

export interface CapabilitySensorLink {
  equipmentId: string;
  equipmentName: string;
  currentHealth: number;
  failureProbability: number;
  estimatedFailureWindow: string;
}

export interface CapabilityAssessment {
  id: string;
  name: string;
  description: string;
  status: CapabilityStatus;
  capabilityScore: number; // 0-100, mission-impact-weighted (not raw equipment health)
  contributingSensors: CapabilitySensorLink[];
  timeToImpactHours: number | null;
  timeToImpactLabel: string;
  missionImpact: string;
}

interface CapabilityDefinition {
  id: string;
  name: string;
  description: string;
  equipmentCategories: EquipmentItem['category'][];
  missionImpact: string;
  extraRisk?: (state: StationState) => { score: number; note: string } | null;
}

const CAPABILITIES: CapabilityDefinition[] = [
  {
    id: 'power_supply',
    name: 'Primary Power Supply',
    description: 'Generator fleet and battery buffer supplying station-wide electrical load.',
    equipmentCategories: ['generator'],
    missionImpact: 'A loss here cascades into heating, water treatment, comms and science operations station-wide.',
    extraRisk: (state) => {
      if (state.energy.powerDeficitKw > 0) {
        return { score: 25, note: `active power deficit of ${state.energy.powerDeficitKw.toFixed(1)} kW` };
      }
      if (state.energy.batteryLevelPercent < 25) {
        return { score: 15, note: `battery buffer down to ${state.energy.batteryLevelPercent.toFixed(0)}%` };
      }
      return null;
    },
  },
  {
    id: 'life_support',
    name: 'Life Support & Habitat Heating',
    description: 'Indoor climate control and critical-zone heating that keeps crew quarters and the medical bay habitable.',
    equipmentCategories: ['heating'],
    missionImpact: 'A loss here creates hypothermia risk in critical zones and may force crew to shelter-in-place.',
    extraRisk: (state) => {
      if (state.infrastructure.indoorTempAvg < 15) {
        return { score: 30, note: `average habitat temperature already down to ${state.infrastructure.indoorTempAvg.toFixed(1)}°C` };
      }
      return null;
    },
  },
  {
    id: 'water_treatment',
    name: 'Water Treatment & Supply',
    description: 'Potable water treatment and storage capacity for crew consumption and hygiene.',
    equipmentCategories: ['water'],
    missionImpact: 'A loss here forces rationing and raises health risk within days if not restored.',
    extraRisk: (state) => {
      if (state.logistics.waterEnduranceDays < 10) {
        return { score: 15, note: `stored water endurance down to ${state.logistics.waterEnduranceDays.toFixed(1)} days` };
      }
      return null;
    },
  },
  {
    id: 'communications',
    name: 'Satellite Communications',
    description: 'Satellite uplink connecting the station to mission control and emergency response.',
    equipmentCategories: ['comms'],
    missionImpact: 'A loss here isolates the station from mission control and delays emergency coordination and resupply requests.',
    extraRisk: (state) => {
      if (state.communication.status !== 'Online') {
        return { score: 20, note: `uplink currently ${state.communication.status}` };
      }
      return null;
    },
  },
  {
    id: 'science_ops',
    name: 'Science Operations',
    description: 'Laboratory and field science instrumentation supporting the active research programme.',
    equipmentCategories: ['science'],
    missionImpact: 'A loss here halts data collection; lower crew-safety urgency than life-support systems, but a mission-schedule risk.',
  },
  {
    id: 'mobility_logistics',
    name: 'Mobility & Field Logistics',
    description: 'Vehicles and field-support equipment used for resupply staging, field science and emergency response.',
    equipmentCategories: ['vehicle'],
    missionImpact: 'A loss here restricts field operations and shrinks the emergency-response radius around the station.',
  },
];

export function assessCapabilities(
  state: StationState,
  predictions: FailurePrediction[]
): CapabilityAssessment[] {
  const predictionMap = new Map(predictions.map((p) => [p.equipmentId, p]));

  const assessments = CAPABILITIES.map((cap) => {
    const eqList = state.equipment.filter((e) => cap.equipmentCategories.includes(e.category));

    const contributingSensors: CapabilitySensorLink[] = eqList.map((eq) => {
      const pred = predictionMap.get(eq.id);
      return {
        equipmentId: eq.id,
        equipmentName: eq.name,
        currentHealth: Math.round(eq.health),
        failureProbability: pred?.failureProbability ?? 0,
        estimatedFailureWindow: pred?.estimatedFailureWindow ?? 'No failure expected',
      };
    });

    // Worst-case-dominant score: the most compromised sensor drives the
    // capability's mission-readiness, not an averaged blend.
    let worstScore = 100;
    let timeToImpactHours: number | null = null;
    for (const eq of eqList) {
      const pred = predictionMap.get(eq.id);
      const failureProbability = pred?.failureProbability ?? 0;
      const impactScore = Math.max(0, 100 - failureProbability * 0.9 - Math.max(0, 60 - eq.health) * 0.3);
      if (impactScore < worstScore) worstScore = impactScore;

      if (pred?.estimatedFailureHours != null) {
        if (timeToImpactHours === null || pred.estimatedFailureHours < timeToImpactHours) {
          timeToImpactHours = pred.estimatedFailureHours;
        }
      }
    }

    let capabilityScore = eqList.length > 0 ? worstScore : 100;
    let extraNote: string | null = null;
    if (cap.extraRisk) {
      const extra = cap.extraRisk(state);
      if (extra) {
        capabilityScore = Math.max(0, capabilityScore - extra.score);
        extraNote = extra.note;
      }
    }
    capabilityScore = Math.round(Math.max(0, Math.min(100, capabilityScore)));

    let status: CapabilityStatus = 'secure';
    if (capabilityScore < 40) status = 'critical';
    else if (capabilityScore < 70) status = 'at_risk';

    let timeToImpactLabel = 'No imminent impact';
    if (timeToImpactHours !== null) {
      if (timeToImpactHours < 6) timeToImpactLabel = 'Within 6 hours';
      else if (timeToImpactHours < 24) timeToImpactLabel = 'Within 24 hours';
      else if (timeToImpactHours < 168) timeToImpactLabel = `Within ${Math.round(timeToImpactHours / 24)} days`;
      else timeToImpactLabel = 'Beyond 7 days';
    } else if (extraNote) {
      timeToImpactLabel = 'Already degraded';
    }

    return {
      id: cap.id,
      name: cap.name,
      description: cap.description,
      status,
      capabilityScore,
      contributingSensors,
      timeToImpactHours,
      timeToImpactLabel,
      missionImpact: extraNote ? `${cap.missionImpact} Currently: ${extraNote}.` : cap.missionImpact,
    } as CapabilityAssessment;
  });

  // Most at-risk capability first — leads with which mission function needs attention.
  return assessments.sort((a, b) => a.capabilityScore - b.capabilityScore);
}
