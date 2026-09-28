// ============================================================================
// PredictiveEngine.ts — Equipment degradation + predictive failure analysis
// Antarctic Digital Twin — SIH26060
// ============================================================================

import { EquipmentItem, StationState } from './SimulationEngine';

export interface FailurePrediction {
  equipmentId: string;
  equipmentName: string;
  currentHealth: number;
  trend: 'stable' | 'declining' | 'rapidly_declining';
  trendRate: number; // health % lost per hour
  abnormalFactors: AbnormalFactor[];
  failureProbability: number; // 0-100
  estimatedFailureHours: number | null;
  estimatedFailureWindow: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendedMaintenance: string[];
}

export interface AbnormalFactor {
  parameter: string;
  currentValue: number;
  normalRange: string;
  deviationPercent: number;
  contribution: number; // 0-1 how much this contributes to failure probability
}

// Normal operating ranges per equipment category
const NORMAL_RANGES: Record<string, { tempMax: number; vibMax: number; effMin: number }> = {
  generator: { tempMax: 90, vibMax: 30, effMin: 0.85 },
  heating: { tempMax: 75, vibMax: 15, effMin: 0.85 },
  water: { tempMax: 50, vibMax: 12, effMin: 0.90 },
  solar: { tempMax: 40, vibMax: 5, effMin: 0.75 },
  comms: { tempMax: 35, vibMax: 8, effMin: 0.90 },
  science: { tempMax: 45, vibMax: 10, effMin: 0.85 },
  vehicle: { tempMax: 95, vibMax: 40, effMin: 0.80 },
};

function analyzeTrend(healthHistory: number[]): { trend: 'stable' | 'declining' | 'rapidly_declining'; rate: number } {
  if (healthHistory.length < 3) {
    return { trend: 'stable', rate: 0 };
  }

  // Calculate rate of change over last readings
  const recent = healthHistory.slice(-5);
  const oldest = recent[0];
  const newest = recent[recent.length - 1];
  const rate = (oldest - newest) / Math.max(recent.length - 1, 1); // health % lost per reading period

  if (rate > 1.5) return { trend: 'rapidly_declining', rate };
  if (rate > 0.3) return { trend: 'declining', rate };
  return { trend: 'stable', rate };
}

function getAbnormalFactors(eq: EquipmentItem): AbnormalFactor[] {
  const normals = NORMAL_RANGES[eq.category] || NORMAL_RANGES.generator;
  const factors: AbnormalFactor[] = [];

  // Temperature analysis
  if (eq.temperature > normals.tempMax) {
    const deviation = ((eq.temperature - normals.tempMax) / normals.tempMax) * 100;
    factors.push({
      parameter: 'Operating Temperature',
      currentValue: eq.temperature,
      normalRange: `≤ ${normals.tempMax}°C`,
      deviationPercent: Math.round(deviation),
      contribution: Math.min(deviation / 100, 0.4),
    });
  }

  // Vibration analysis
  if (eq.vibration > normals.vibMax) {
    const deviation = ((eq.vibration - normals.vibMax) / normals.vibMax) * 100;
    factors.push({
      parameter: 'Vibration Level',
      currentValue: eq.vibration,
      normalRange: `≤ ${normals.vibMax}`,
      deviationPercent: Math.round(deviation),
      contribution: Math.min(deviation / 100, 0.35),
    });
  }

  // Efficiency analysis
  if (eq.efficiency < normals.effMin) {
    const deviation = ((normals.effMin - eq.efficiency) / normals.effMin) * 100;
    factors.push({
      parameter: 'Operating Efficiency',
      currentValue: Math.round(eq.efficiency * 100),
      normalRange: `≥ ${Math.round(normals.effMin * 100)}%`,
      deviationPercent: Math.round(deviation),
      contribution: Math.min(deviation / 100, 0.3),
    });
  }

  // Health below threshold
  if (eq.health < 60) {
    factors.push({
      parameter: 'Component Health',
      currentValue: eq.health,
      normalRange: '≥ 60%',
      deviationPercent: Math.round(((60 - eq.health) / 60) * 100),
      contribution: Math.min((60 - eq.health) / 100, 0.5),
    });
  }

  return factors;
}

function calculateFailureProbability(eq: EquipmentItem, trendRate: number): number {
  const factors = getAbnormalFactors(eq);

  // Base probability from health
  let probability = 0;
  if (eq.health < 20) probability = 85;
  else if (eq.health < 40) probability = 55;
  else if (eq.health < 60) probability = 30;
  else if (eq.health < 80) probability = 10;
  else probability = 2;

  // Add contributions from abnormal factors
  const factorContribution = factors.reduce((sum, f) => sum + f.contribution, 0);
  probability += factorContribution * 40;

  // Trend acceleration
  if (trendRate > 1.5) probability += 15;
  else if (trendRate > 0.5) probability += 8;

  return Math.min(Math.round(probability), 99);
}

function estimateFailureHours(eq: EquipmentItem, trendRate: number): number | null {
  if (trendRate <= 0.01) return null; // Not declining
  const hoursToZero = eq.health / Math.max(trendRate, 0.01);
  return Math.round(hoursToZero);
}

function getRecommendedMaintenance(eq: EquipmentItem, factors: AbnormalFactor[]): string[] {
  const recommendations: string[] = [];

  if (factors.some(f => f.parameter === 'Operating Temperature')) {
    if (eq.category === 'generator') {
      recommendations.push('Inspect coolant system and radiator for blockages');
      recommendations.push('Check lubrication oil level and viscosity');
    } else {
      recommendations.push('Inspect thermal management system');
    }
  }

  if (factors.some(f => f.parameter === 'Vibration Level')) {
    recommendations.push('Inspect mounting bolts and vibration dampeners');
    if (eq.category === 'generator') {
      recommendations.push('Check crankshaft alignment and bearing wear');
      recommendations.push('Inspect fuel injectors for uneven combustion');
    }
  }

  if (factors.some(f => f.parameter === 'Operating Efficiency')) {
    recommendations.push('Perform full diagnostic and calibration check');
    if (eq.category === 'generator') {
      recommendations.push('Replace air and fuel filters');
      recommendations.push('Check exhaust system for backpressure');
    }
  }

  if (eq.health < 50) {
    recommendations.push('Schedule preventive component replacement');
    recommendations.push('Prepare backup unit for standby activation');
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue routine monitoring per maintenance schedule');
  }

  return recommendations;
}

export function generatePredictions(state: StationState): FailurePrediction[] {
  const predictions: FailurePrediction[] = [];

  for (const eq of state.equipment) {
    if (!eq.isOnline && eq.health <= 0) continue; // Already failed

    const { trend, rate } = analyzeTrend(eq.healthHistory);
    const abnormalFactors = getAbnormalFactors(eq);
    const failureProbability = calculateFailureProbability(eq, rate);
    const failureHours = estimateFailureHours(eq, rate);

    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (failureProbability > 75) severity = 'critical';
    else if (failureProbability > 50) severity = 'high';
    else if (failureProbability > 25) severity = 'medium';
    else severity = 'low';

    let failureWindow = 'No failure expected';
    if (failureHours !== null) {
      if (failureHours < 6) failureWindow = 'Within 6 hours';
      else if (failureHours < 24) failureWindow = 'Within 24 hours';
      else if (failureHours < 72) failureWindow = `Within ${Math.round(failureHours / 24)} days`;
      else if (failureHours < 168) failureWindow = `Within ${Math.round(failureHours / 24)} days`;
      else failureWindow = 'Beyond 7 days';
    }

    predictions.push({
      equipmentId: eq.id,
      equipmentName: eq.name,
      currentHealth: Math.round(eq.health),
      trend,
      trendRate: Math.round(rate * 100) / 100,
      abnormalFactors,
      failureProbability,
      estimatedFailureHours: failureHours,
      estimatedFailureWindow: failureWindow,
      severity,
      recommendedMaintenance: getRecommendedMaintenance(eq, abnormalFactors),
    });
  }

  // Sort by failure probability descending
  predictions.sort((a, b) => b.failureProbability - a.failureProbability);

  return predictions;
}
