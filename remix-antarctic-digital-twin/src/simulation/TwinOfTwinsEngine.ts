// ============================================================================
// TwinOfTwinsEngine.ts — Twin-of-Twins Resilience Testing
// Antarctic Digital Twin — SIH26060
//
// Runs the SAME failure scenario across independent Maitri and Bharati
// simulation instances to compare resilience, surface the weaker station's
// critical weaknesses, and prioritize backup/spares accordingly.
// ============================================================================

import { SimulationEngine } from './SimulationEngine';
import { ScenarioDefinition, applyScenarioEvents, getScenarioById } from './ScenarioLibrary';
import { generatePredictions } from './PredictiveEngine';
import { assessCapabilities, CapabilityAssessment } from './CapabilityIntelligence';

export interface TwinStationResult {
  stationId: 'maitri' | 'bharati';
  stationName: string;
  baselineResilienceScore: number;
  finalResilienceScore: number;
  resilienceDelta: number;
  finalRiskLevel: string;
  capabilities: CapabilityAssessment[];
  weakestCapability: CapabilityAssessment | null;
  criticalEventCount: number;
}

export interface TwinComparisonResult {
  scenarioId: string;
  scenarioName: string;
  scenarioDescription: string;
  horizonHours: number;
  maitri: TwinStationResult;
  bharati: TwinStationResult;
  moreResilientStationId: 'maitri' | 'bharati' | 'tie';
  resilienceGapPoints: number;
  backupPriorityNote: string;
}

const STEP_HOURS = 0.1; // matches the engine's own physics tick interval

function runStationScenario(
  stationId: 'maitri' | 'bharati',
  scenario: ScenarioDefinition,
  horizonHours: number,
  params?: Record<string, number | string>
): TwinStationResult {
  const engine = new SimulationEngine(stationId);
  const baselineResilienceScore = Math.round(engine.getState().resilienceScore);

  let hour = 0;
  while (hour < horizonHours) {
    applyScenarioEvents(engine, scenario, hour, params);
    engine.advanceByHours(STEP_HOURS);
    hour += STEP_HOURS;
  }

  const finalState = engine.getState();
  const predictions = generatePredictions(finalState);
  const capabilities = assessCapabilities(finalState, predictions);
  const weakestCapability = capabilities.length > 0 ? capabilities[0] : null;
  const criticalEventCount = finalState.events.filter((e) => e.type === 'critical').length;

  return {
    stationId,
    stationName: finalState.stationName,
    baselineResilienceScore,
    finalResilienceScore: Math.round(finalState.resilienceScore),
    resilienceDelta: Math.round(finalState.resilienceScore - baselineResilienceScore),
    finalRiskLevel: finalState.riskLevel,
    capabilities,
    weakestCapability,
    criticalEventCount,
  };
}

export function runTwinOfTwinsTest(
  scenarioId: string,
  horizonHours: number = 48,
  params?: Record<string, number | string>
): TwinComparisonResult | null {
  const scenario = getScenarioById(scenarioId);
  if (!scenario) return null;

  const maitri = runStationScenario('maitri', scenario, horizonHours, params);
  const bharati = runStationScenario('bharati', scenario, horizonHours, params);

  const gap = maitri.finalResilienceScore - bharati.finalResilienceScore;
  let moreResilientStationId: 'maitri' | 'bharati' | 'tie' = 'tie';
  if (Math.abs(gap) >= 2) moreResilientStationId = gap > 0 ? 'maitri' : 'bharati';

  const weaker = gap >= 0 ? bharati : maitri;
  const backupPriorityNote = weaker.weakestCapability
    ? `${weaker.stationName} shows the greater exposure under this scenario — prioritize backup capacity and spares for its ${weaker.weakestCapability.name.toLowerCase()} function.`
    : 'Both stations held up comparably well under this scenario.';

  return {
    scenarioId,
    scenarioName: scenario.name,
    scenarioDescription: scenario.description,
    horizonHours,
    maitri,
    bharati,
    moreResilientStationId,
    resilienceGapPoints: Math.abs(gap),
    backupPriorityNote,
  };
}
