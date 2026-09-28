// ============================================================================
// InterventionEngine.ts — Interventions + Decision Optimizer
// Antarctic Digital Twin — SIH26060
// ============================================================================

import { SimulationEngine, StationState, RiskLevel } from './SimulationEngine';

export interface Intervention {
  id: string;
  name: string;
  description: string;
  category: 'energy' | 'heating' | 'logistics' | 'maintenance' | 'crew';
  icon: string;
  isAvailable: (state: StationState) => boolean;
  apply: (engine: SimulationEngine) => void;
  revert: (engine: SimulationEngine) => void;
}

export interface InterventionPlan {
  id: string;
  name: string;
  interventions: string[];
  scores: PlanScores;
  reasoning: string[];
  rank: number;
}

export interface PlanScores {
  fuelEndurance: number;
  powerStability: number;
  batteryReserve: number;
  resourceEndurance: number;
  operationalRisk: number; // lower is better
  equipmentStress: number; // lower is better
  crewSafety: number;
  overallScore: number;
}

export const INTERVENTIONS: Intervention[] = [
  {
    id: 'start_backup_generator',
    name: 'Start Backup Generator',
    description: 'Activate the emergency backup generator to provide additional power generation capacity.',
    category: 'energy',
    icon: 'Zap',
    isAvailable: (s) => !s.energy.backupGenerator.isOnline && s.energy.backupGenerator.health > 10,
    apply: (engine) => {
      engine.modifyState((s) => {
        s.energy.backupGenerator.isOnline = true;
        s.energy.backupGenerator.status = 'Nominal';
        s.activeInterventions.push('start_backup_generator');
      });
      engine.addEvent({ type: 'intervention', category: 'Energy', title: 'Backup Generator Activated', description: `Emergency backup generator online. Additional ${engine.getState().energy.backupGenerator.ratedCapacityKw} kW capacity available.` });
    },
    revert: (engine) => {
      engine.modifyState((s) => {
        s.energy.backupGenerator.isOnline = false;
        s.energy.backupGenerator.currentOutputKw = 0;
        s.energy.backupGenerator.loadPercent = 0;
        s.energy.backupGenerator.status = 'Nominal';
        s.activeInterventions = s.activeInterventions.filter(i => i !== 'start_backup_generator');
      });
    },
  },
  {
    id: 'reduce_noncritical_loads',
    name: 'Reduce Non-Critical Loads',
    description: 'Shed non-essential electrical loads (recreational, optional lab equipment, non-essential lighting) to reduce total power consumption by ~30%.',
    category: 'energy',
    icon: 'Power',
    isAvailable: () => true,
    apply: (engine) => {
      engine.modifyState((s) => { s.activeInterventions.push('reduce_noncritical_loads'); });
      engine.addEvent({ type: 'intervention', category: 'Energy', title: 'Non-Critical Load Shedding', description: 'Non-essential electrical loads disconnected. Recreational systems, optional lab equipment, and non-essential lighting powered down. ~30% consumption reduction.' });
    },
    revert: (engine) => {
      engine.modifyState((s) => { s.activeInterventions = s.activeInterventions.filter(i => i !== 'reduce_noncritical_loads'); });
    },
  },
  {
    id: 'prioritize_critical',
    name: 'Prioritize Critical Systems',
    description: 'Redistribute power to heating, medical, communication, and safety systems. Reduce optional laboratory and science loads.',
    category: 'energy',
    icon: 'Shield',
    isAvailable: () => true,
    apply: (engine) => {
      engine.modifyState((s) => { s.activeInterventions.push('prioritize_critical'); });
      engine.addEvent({ type: 'intervention', category: 'Energy', title: 'Critical System Prioritization', description: 'Power redistributed to critical systems: Heating, Medical, Communication, Safety. Non-essential science loads deferred. ~10% consumption reduction.' });
    },
    revert: (engine) => {
      engine.modifyState((s) => { s.activeInterventions = s.activeInterventions.filter(i => i !== 'prioritize_critical'); });
    },
  },
  {
    id: 'increase_renewables',
    name: 'Maximize Renewable Energy',
    description: 'Optimize solar panel tracking and wind turbine configuration to increase renewable energy contribution by ~40%.',
    category: 'energy',
    icon: 'Sun',
    isAvailable: (s) => s.environment.windSpeed < 100 && s.environment.visibility > 1,
    apply: (engine) => {
      engine.modifyState((s) => { s.activeInterventions.push('increase_renewables'); });
      engine.addEvent({ type: 'intervention', category: 'Energy', title: 'Renewable Energy Maximized', description: 'Solar panel tracking optimized. Wind turbine configuration adjusted. Renewable contribution increased ~40%.' });
    },
    revert: (engine) => {
      engine.modifyState((s) => { s.activeInterventions = s.activeInterventions.filter(i => i !== 'increase_renewables'); });
    },
  },
  {
    id: 'preserve_battery',
    name: 'Preserve Battery Power',
    description: 'Switch battery to trickle-charge/conservation mode. Reduces discharge rate by 40% to extend backup duration.',
    category: 'energy',
    icon: 'Battery',
    isAvailable: () => true,
    apply: (engine) => {
      engine.modifyState((s) => { s.activeInterventions.push('preserve_battery'); });
      engine.addEvent({ type: 'intervention', category: 'Energy', title: 'Battery Preservation Mode', description: 'Battery switched to conservation mode. Discharge rate reduced by 40%. Extended backup duration at the cost of reduced supplemental power.' });
    },
    revert: (engine) => {
      engine.modifyState((s) => { s.activeInterventions = s.activeInterventions.filter(i => i !== 'preserve_battery'); });
    },
  },
  {
    id: 'reduce_noncritical_heating',
    name: 'Reduce Non-Critical Area Heating',
    description: 'Lower heating in storage, workshops, and non-essential areas to save ~20kW. Those zones will cool toward ambient.',
    category: 'heating',
    icon: 'ThermometerSnowflake',
    isAvailable: (s) => s.infrastructure.heatingSystemStatus !== 'Failed',
    apply: (engine) => {
      engine.modifyState((s) => {
        s.activeInterventions.push('reduce_noncritical_heating');
        for (const zone of s.infrastructure.zones) {
          if (zone.category === 'non-critical') {
            zone.targetTemperature = Math.max(2, zone.targetTemperature - 8);
          }
        }
      });
      engine.addEvent({ type: 'intervention', category: 'Heating', title: 'Non-Critical Heating Reduced', description: 'Heating reduced in storage, workshops, and non-essential areas. Saving ~20kW. Critical zones (living quarters, medical, comms) maintained at full heating.' });
    },
    revert: (engine) => {
      engine.modifyState((s) => {
        s.activeInterventions = s.activeInterventions.filter(i => i !== 'reduce_noncritical_heating');
        const baseline = engine.getBaseline();
        for (const zone of s.infrastructure.zones) {
          if (zone.category === 'non-critical') {
            const baseZone = baseline.infrastructure.zones.find(z => z.name === zone.name);
            if (baseZone) zone.targetTemperature = baseZone.targetTemperature;
          }
        }
      });
    },
  },
  {
    id: 'emergency_resupply',
    name: 'Request Emergency Resupply',
    description: 'Dispatch request for emergency polar supply vessel or air-drop. Reduces effective resupply wait by ~15 days.',
    category: 'logistics',
    icon: 'Ship',
    isAvailable: (s) => s.communication.status !== 'Offline',
    apply: (engine) => {
      engine.modifyState((s) => { s.activeInterventions.push('emergency_resupply'); });
      engine.addEvent({ type: 'intervention', category: 'Logistics', title: 'Emergency Resupply Requested', description: 'Emergency resupply dispatched via NCPOR Goa. Estimated arrival reduced by ~15 days. Priority: fuel, food, critical spare parts.' });
    },
    revert: (engine) => {
      engine.modifyState((s) => { s.activeInterventions = s.activeInterventions.filter(i => i !== 'emergency_resupply'); });
    },
  },
  {
    id: 'increase_maintenance',
    name: 'Increase Maintenance Priority',
    description: 'Assign additional crew to equipment maintenance. Slows degradation by 60% but increases spare parts consumption.',
    category: 'maintenance',
    icon: 'Wrench',
    isAvailable: () => true,
    apply: (engine) => {
      engine.modifyState((s) => { s.activeInterventions.push('increase_maintenance'); });
      engine.addEvent({ type: 'intervention', category: 'Maintenance', title: 'Maintenance Priority Increased', description: 'Additional maintenance crew assigned. Equipment degradation rate reduced by 60%. Spare parts consumption increased.' });
    },
    revert: (engine) => {
      engine.modifyState((s) => { s.activeInterventions = s.activeInterventions.filter(i => i !== 'increase_maintenance'); });
    },
  },
  {
    id: 'generator_schedule',
    name: 'Optimize Generator Schedule',
    description: 'Redistribute load between generators to reduce peak stress. Lower individual generator loads improve longevity.',
    category: 'energy',
    icon: 'Clock',
    isAvailable: (s) => s.energy.generators.filter(g => g.isOnline).length >= 2,
    apply: (engine) => {
      engine.modifyState((s) => { s.activeInterventions.push('generator_schedule'); });
      engine.addEvent({ type: 'intervention', category: 'Energy', title: 'Generator Schedule Optimized', description: 'Load distribution optimized across online generators. Peak loads reduced. Generator longevity improved.' });
    },
    revert: (engine) => {
      engine.modifyState((s) => { s.activeInterventions = s.activeInterventions.filter(i => i !== 'generator_schedule'); });
    },
  },
];

// ============================================================================
// Scenario-to-Intervention Priority Map
// Maps each scenario ID to its most relevant interventions in priority order,
// with scenario-specific reasoning for the AI to present.
// ============================================================================

export interface ScenarioInterventionPriority {
  interventionIds: string[];
  reasoningTheme: string;
  scenarioReasoning: Record<string, string>;
}

export const SCENARIO_INTERVENTION_MAP: Record<string, ScenarioInterventionPriority> = {
  extreme_cold: {
    interventionIds: ['reduce_noncritical_heating', 'start_backup_generator', 'prioritize_critical', 'preserve_battery'],
    reasoningTheme: 'Extreme cold demands maximum thermal management and sustained power for heating systems.',
    scenarioReasoning: {
      reduce_noncritical_heating: 'Extreme cold scenario: Concentrate all heating capacity on crew-occupied zones to prevent hypothermia.',
      start_backup_generator: 'Extreme cold scenario: Additional generation capacity needed to meet surging heating power demand.',
      prioritize_critical: 'Extreme cold scenario: Life-support and heating systems must receive uninterrupted power priority.',
      preserve_battery: 'Extreme cold scenario: Battery conservation extends emergency backup during prolonged cold exposure.',
    },
  },
  antarctic_storm: {
    interventionIds: ['start_backup_generator', 'reduce_noncritical_loads', 'preserve_battery', 'reduce_noncritical_heating'],
    reasoningTheme: 'Katabatic blizzard requires maximum reserve preservation to ride out the storm safely.',
    scenarioReasoning: {
      start_backup_generator: 'Storm scenario: Backup generation provides critical redundancy against storm-induced equipment failures.',
      reduce_noncritical_loads: 'Storm scenario: Load shedding extends fuel and battery endurance through the storm duration.',
      preserve_battery: 'Storm scenario: Battery conservation ensures emergency reserves survive the full storm event.',
      reduce_noncritical_heating: 'Storm scenario: Redirecting heating to critical zones only saves ~20kW during peak storm demand.',
    },
  },
  generator_failure: {
    interventionIds: ['start_backup_generator', 'reduce_noncritical_loads', 'prioritize_critical', 'generator_schedule'],
    reasoningTheme: 'Generator failure requires immediate backup activation and load reduction to prevent blackout.',
    scenarioReasoning: {
      start_backup_generator: 'Generator failure: Backup generator is the primary countermeasure to restore lost generation capacity.',
      reduce_noncritical_loads: 'Generator failure: Shedding non-essential loads reduces demand on remaining generators by ~30%.',
      prioritize_critical: 'Generator failure: Critical system prioritization ensures life-support remains powered during deficit.',
      generator_schedule: 'Generator failure: Rebalancing load across remaining generators prevents cascading overload failures.',
    },
  },
  heating_failure: {
    interventionIds: ['prioritize_critical', 'start_backup_generator', 'reduce_noncritical_loads'],
    reasoningTheme: 'Heating failure demands maximizing power for emergency heating alternatives and crew safety.',
    scenarioReasoning: {
      prioritize_critical: 'Heating failure: Locks power routing to crew living quarters and emergency heating systems.',
      start_backup_generator: 'Heating failure: Additional generation capacity supports emergency space heaters and thermal backup.',
      reduce_noncritical_loads: 'Heating failure: Load shedding frees electrical capacity for portable heating equipment.',
    },
  },
  fuel_shortage: {
    interventionIds: ['reduce_noncritical_loads', 'reduce_noncritical_heating', 'increase_renewables', 'emergency_resupply'],
    reasoningTheme: 'Fuel shortage requires aggressive consumption reduction and renewable displacement of diesel.',
    scenarioReasoning: {
      reduce_noncritical_loads: 'Fuel shortage: Reducing electrical demand directly lowers generator fuel consumption rate.',
      reduce_noncritical_heating: 'Fuel shortage: Cutting non-critical heating saves ~20kW, reducing fuel burn by ~5 L/h.',
      increase_renewables: 'Fuel shortage: Maximizing wind/solar displaces diesel consumption and extends fuel reserves.',
      emergency_resupply: 'Fuel shortage: Emergency resupply dispatches fuel delivery to bridge the depletion gap.',
    },
  },
  resupply_delay: {
    interventionIds: ['reduce_noncritical_loads', 'reduce_noncritical_heating', 'emergency_resupply', 'preserve_battery'],
    reasoningTheme: 'Resupply delay requires extending all resource endurance timelines to cover the gap.',
    scenarioReasoning: {
      reduce_noncritical_loads: 'Resupply delay: Conservation mode extends fuel and resource endurance across the delay period.',
      reduce_noncritical_heating: 'Resupply delay: Thermal load reduction conserves fuel reserves through the extended wait.',
      emergency_resupply: 'Resupply delay: Dispatching emergency resupply via airlift shortens the critical gap.',
      preserve_battery: 'Resupply delay: Battery conservation ensures emergency reserves last through the delay.',
    },
  },
  comm_failure: {
    interventionIds: ['prioritize_critical', 'preserve_battery', 'increase_maintenance'],
    reasoningTheme: 'Communication failure demands autonomous operations readiness and system reliability.',
    scenarioReasoning: {
      prioritize_critical: 'Comms failure: Critical system prioritization maintains autonomous station operations without remote support.',
      preserve_battery: 'Comms failure: Battery preservation ensures emergency reserves during isolated autonomous operations.',
      increase_maintenance: 'Comms failure: Enhanced maintenance prevents equipment failures when remote support is unavailable.',
    },
  },
  equipment_degradation: {
    interventionIds: ['increase_maintenance', 'generator_schedule', 'start_backup_generator'],
    reasoningTheme: 'Accelerated degradation requires proactive maintenance and operational redundancy.',
    scenarioReasoning: {
      increase_maintenance: 'Equipment degradation: Expedited maintenance slows degradation rate by 60%, preventing cascading failures.',
      generator_schedule: 'Equipment degradation: Load rebalancing reduces peak stress and extends equipment service life.',
      start_backup_generator: 'Equipment degradation: Backup generator provides redundancy if primary equipment fails.',
    },
  },
  crew_increase: {
    interventionIds: ['increase_renewables', 'reduce_noncritical_loads', 'start_backup_generator'],
    reasoningTheme: 'Increased crew demands higher power and resource capacity to maintain safety margins.',
    scenarioReasoning: {
      increase_renewables: 'Crew increase: Maximizing renewables offsets the higher electrical demand from additional personnel.',
      reduce_noncritical_loads: 'Crew increase: Shedding optional loads frees capacity for increased life-support demand.',
      start_backup_generator: 'Crew increase: Additional generation capacity meets the higher baseline power consumption.',
    },
  },
  multi_equipment_failure: {
    interventionIds: ['start_backup_generator', 'reduce_noncritical_loads', 'prioritize_critical', 'emergency_resupply'],
    reasoningTheme: 'Multiple equipment failures demand emergency response with maximum redundancy and conservation.',
    scenarioReasoning: {
      start_backup_generator: 'Multiple failures: Backup generation is critical to compensate for lost primary equipment.',
      reduce_noncritical_loads: 'Multiple failures: Load shedding prevents cascading overload on surviving systems.',
      prioritize_critical: 'Multiple failures: Ensures life-support systems remain powered despite reduced capacity.',
      emergency_resupply: 'Multiple failures: Emergency resupply provides critical spare parts and fuel for recovery.',
    },
  },
  combined_emergency: {
    interventionIds: ['start_backup_generator', 'reduce_noncritical_loads', 'prioritize_critical', 'preserve_battery', 'reduce_noncritical_heating'],
    reasoningTheme: 'Combined storm and generator failure requires full-spectrum crisis response.',
    scenarioReasoning: {
      start_backup_generator: 'Combined emergency: Backup generator compensates for failed primary generation during storm.',
      reduce_noncritical_loads: 'Combined emergency: Maximum load reduction to prevent total grid collapse.',
      prioritize_critical: 'Combined emergency: All available power must flow to crew survival systems.',
      preserve_battery: 'Combined emergency: Battery reserves are the last line of defense against total blackout.',
      reduce_noncritical_heating: 'Combined emergency: Concentrate heating on crew quarters only during the crisis.',
    },
  },
  full_cascade: {
    interventionIds: ['start_backup_generator', 'reduce_noncritical_loads', 'prioritize_critical', 'preserve_battery', 'reduce_noncritical_heating', 'emergency_resupply'],
    reasoningTheme: 'Full cascade failure is the ultimate stress test — deploy every available countermeasure.',
    scenarioReasoning: {
      start_backup_generator: 'Cascade failure: Immediately activate backup power to prevent total station blackout.',
      reduce_noncritical_loads: 'Cascade failure: Aggressive load shedding is essential for station survival.',
      prioritize_critical: 'Cascade failure: Life-support priority routing is non-negotiable during cascading failure.',
      preserve_battery: 'Cascade failure: Every kilowatt-hour of battery must be conserved for survival.',
      reduce_noncritical_heating: 'Cascade failure: Sacrifice non-critical zones to maintain habitable temperatures in crew areas.',
      emergency_resupply: 'Cascade failure: Emergency resupply is critical — station cannot self-recover from cascade.',
    },
  },
};

// ---- Decision Optimizer ----

function evaluatePlan(
  engine: SimulationEngine,
  interventionIds: string[],
  scenarioBoost?: { boostIds: string[]; boostAmount: number }
): PlanScores {
  // Fork engine, apply interventions, simulate 24 hours, measure results
  const forked = engine.fork();

  for (const id of interventionIds) {
    const intervention = INTERVENTIONS.find(i => i.id === id);
    if (intervention && intervention.isAvailable(forked.getState())) {
      intervention.apply(forked);
    }
  }

  // Simulate 24 hours forward
  forked.advanceByHours(24);
  const futureState = forked.getState();

  const fuelEndurance = Math.min(100, futureState.logistics.fuelEnduranceDays * 0.8);
  const powerStability = futureState.energy.powerDeficitKw <= 0 ? 100 : Math.max(0, 100 - futureState.energy.powerDeficitKw * 2);
  const batteryReserve = futureState.energy.batteryLevelPercent;
  const resourceEndurance = Math.min(
    futureState.logistics.foodEnduranceDays * 0.5,
    futureState.logistics.waterEnduranceDays * 1.0,
    100
  );
  const riskMap: Record<RiskLevel, number> = { LOW: 10, MODERATE: 35, HIGH: 65, CRITICAL: 95 };
  const operationalRisk = riskMap[futureState.riskLevel];
  const avgEquipHealth = futureState.equipment.reduce((s, e) => s + e.health, 0) / Math.max(futureState.equipment.length, 1);
  const equipmentStress = 100 - avgEquipHealth;
  const crewSafetyMap: Record<RiskLevel, number> = { LOW: 95, MODERATE: 70, HIGH: 35, CRITICAL: 5 };
  const crewSafety = crewSafetyMap[futureState.crew.safetyRisk];

  let overallScore = (
    fuelEndurance * 0.2 +
    powerStability * 0.2 +
    batteryReserve * 0.1 +
    resourceEndurance * 0.1 +
    (100 - operationalRisk) * 0.15 +
    (100 - equipmentStress) * 0.1 +
    crewSafety * 0.15
  );

  // Apply scenario boost: if this plan includes scenario-relevant interventions, boost score
  if (scenarioBoost) {
    const matchCount = interventionIds.filter(id => scenarioBoost.boostIds.includes(id)).length;
    const boostRatio = matchCount / Math.max(scenarioBoost.boostIds.length, 1);
    overallScore = Math.min(100, overallScore + scenarioBoost.boostAmount * boostRatio);
  }

  return {
    fuelEndurance: Math.round(fuelEndurance * 10) / 10,
    powerStability: Math.round(powerStability * 10) / 10,
    batteryReserve: Math.round(batteryReserve * 10) / 10,
    resourceEndurance: Math.round(resourceEndurance * 10) / 10,
    operationalRisk: Math.round(operationalRisk * 10) / 10,
    equipmentStress: Math.round(equipmentStress * 10) / 10,
    crewSafety: Math.round(crewSafety * 10) / 10,
    overallScore: Math.round(overallScore * 10) / 10,
  };
}

function generateReasoning(
  plan: InterventionPlan,
  state: StationState,
  activeScenarioIds?: string[]
): string[] {
  const reasons: string[] = [];

  // Prepend scenario-specific reasoning if a scenario is active
  if (activeScenarioIds && activeScenarioIds.length > 0) {
    for (const scenarioId of activeScenarioIds) {
      const scenarioMap = SCENARIO_INTERVENTION_MAP[scenarioId];
      if (scenarioMap) {
        for (const intId of plan.interventions) {
          const scenarioReason = scenarioMap.scenarioReasoning[intId];
          if (scenarioReason) {
            reasons.push(scenarioReason);
          }
        }
      }
    }
  }

  // Fallback to generic reasoning for interventions not covered by scenario context
  const coveredByScenario = new Set(reasons.map(r => r));
  if (!plan.interventions.some(id => reasons.some(r => r.includes('Backup generator') || r.includes('backup')))) {
    if (plan.interventions.includes('start_backup_generator') && coveredByScenario.size === 0) {
      reasons.push('Backup generator adds critical generation capacity, directly addressing power shortage.');
    }
  }
  if (plan.interventions.includes('reduce_noncritical_loads') && !reasons.some(r => r.toLowerCase().includes('load'))) {
    reasons.push('Load shedding reduces total demand by ~30%, significantly extending fuel and battery reserves.');
  }
  if (plan.interventions.includes('prioritize_critical') && !reasons.some(r => r.toLowerCase().includes('critical system') || r.toLowerCase().includes('life-support'))) {
    reasons.push('Critical system prioritization ensures crew safety systems remain powered during shortage.');
  }
  if (plan.interventions.includes('preserve_battery') && !reasons.some(r => r.toLowerCase().includes('battery'))) {
    reasons.push('Battery conservation extends emergency backup duration by ~40%.');
  }
  if (plan.interventions.includes('reduce_noncritical_heating') && !reasons.some(r => r.toLowerCase().includes('heating'))) {
    reasons.push('Reducing heating in non-critical areas saves ~20kW, reducing generator and fuel strain.');
  }
  if (plan.interventions.includes('emergency_resupply') && !reasons.some(r => r.toLowerCase().includes('resupply'))) {
    reasons.push('Emergency resupply shortens the gap between fuel depletion and arrival of supplies.');
  }
  if (plan.interventions.includes('increase_maintenance') && !reasons.some(r => r.toLowerCase().includes('maintenance'))) {
    reasons.push('Enhanced maintenance slows equipment degradation, reducing cascading failure risk.');
  }
  if (plan.interventions.includes('increase_renewables') && !reasons.some(r => r.toLowerCase().includes('renewable'))) {
    reasons.push('Maximizing renewables reduces dependence on fuel-burning generators.');
  }

  if (plan.scores.overallScore > 70) {
    reasons.push(`Overall effectiveness score of ${plan.scores.overallScore}/100 indicates strong mitigation of current risks.`);
  } else if (plan.scores.overallScore > 50) {
    reasons.push(`Moderate effectiveness (${plan.scores.overallScore}/100). Some risks remain but situation is stabilized.`);
  } else {
    reasons.push(`Limited effectiveness (${plan.scores.overallScore}/100). Additional measures or manual intervention may be required.`);
  }

  return reasons;
}

export function optimizeDecisions(engine: SimulationEngine, activeScenarioIds?: string[]): InterventionPlan[] {
  const state = engine.getState();
  const available = INTERVENTIONS.filter(i => i.isAvailable(state) && !state.activeInterventions.includes(i.id));

  if (available.length === 0) return [];

  // Determine scenario boost
  let scenarioBoost: { boostIds: string[]; boostAmount: number } | undefined;
  if (activeScenarioIds && activeScenarioIds.length > 0) {
    const allBoostIds: string[] = [];
    for (const sid of activeScenarioIds) {
      const mapping = SCENARIO_INTERVENTION_MAP[sid];
      if (mapping) {
        allBoostIds.push(...mapping.interventionIds);
      }
    }
    if (allBoostIds.length > 0) {
      scenarioBoost = { boostIds: [...new Set(allBoostIds)], boostAmount: 15 };
    }
  }

  // Generate candidate plans (combinations of 1-4 interventions)
  const plans: InterventionPlan[] = [];
  const planCombinations: string[][] = [];

  // Individual interventions
  for (const i of available) {
    planCombinations.push([i.id]);
  }

  // Pairs (top strategic combinations)
  const strategicPairs = [
    ['start_backup_generator', 'reduce_noncritical_loads'],
    ['start_backup_generator', 'prioritize_critical'],
    ['reduce_noncritical_loads', 'reduce_noncritical_heating'],
    ['reduce_noncritical_loads', 'preserve_battery'],
    ['prioritize_critical', 'preserve_battery'],
    ['start_backup_generator', 'reduce_noncritical_heating'],
    ['emergency_resupply', 'reduce_noncritical_loads'],
    ['increase_maintenance', 'prioritize_critical'],
  ];

  for (const pair of strategicPairs) {
    if (pair.every(id => available.some(a => a.id === id))) {
      planCombinations.push(pair);
    }
  }

  // Key triple combinations
  const strategicTriples = [
    ['start_backup_generator', 'reduce_noncritical_loads', 'reduce_noncritical_heating'],
    ['start_backup_generator', 'reduce_noncritical_loads', 'preserve_battery'],
    ['start_backup_generator', 'prioritize_critical', 'emergency_resupply'],
    ['reduce_noncritical_loads', 'reduce_noncritical_heating', 'preserve_battery'],
  ];

  for (const triple of strategicTriples) {
    if (triple.every(id => available.some(a => a.id === id))) {
      planCombinations.push(triple);
    }
  }

  // Scenario-recommended combination: add the scenario's full recommended set as a candidate
  if (activeScenarioIds && activeScenarioIds.length > 0) {
    for (const sid of activeScenarioIds) {
      const mapping = SCENARIO_INTERVENTION_MAP[sid];
      if (mapping) {
        const scenarioCombo = mapping.interventionIds.filter(id => available.some(a => a.id === id));
        if (scenarioCombo.length >= 2) {
          planCombinations.push(scenarioCombo);
        }
      }
    }
  }

  // Full emergency plan
  const fullPlan = available.map(i => i.id).slice(0, 5);
  if (fullPlan.length >= 3) {
    planCombinations.push(fullPlan);
  }

  // Deduplicate combinations
  const seenCombos = new Set<string>();

  // Evaluate each combination
  for (let i = 0; i < planCombinations.length; i++) {
    const combo = planCombinations[i];
    const comboKey = [...combo].sort().join('|');
    if (seenCombos.has(comboKey)) continue;
    seenCombos.add(comboKey);

    const scores = evaluatePlan(engine, combo, scenarioBoost);
    const interventionNames = combo.map(id => INTERVENTIONS.find(int => int.id === id)?.name || id);

    // Check if this is a scenario-recommended combo
    const isScenarioRecommended = activeScenarioIds?.some(sid => {
      const mapping = SCENARIO_INTERVENTION_MAP[sid];
      if (!mapping) return false;
      return combo.every(id => mapping.interventionIds.includes(id)) && combo.length >= 2;
    });

    const plan: InterventionPlan = {
      id: `plan-${i}`,
      name: isScenarioRecommended
        ? `AI Scenario Response (${combo.length} actions)`
        : combo.length === 1
          ? interventionNames[0]
          : combo.length <= 3
            ? interventionNames.join(' + ')
            : `Comprehensive Response (${combo.length} actions)`,
      interventions: combo,
      scores,
      reasoning: [],
      rank: 0,
    };

    plan.reasoning = generateReasoning(plan, state, activeScenarioIds);
    plans.push(plan);
  }

  // Sort by overall score descending
  plans.sort((a, b) => b.scores.overallScore - a.scores.overallScore);

  // Assign ranks
  plans.forEach((p, idx) => { p.rank = idx + 1; });

  return plans.slice(0, 8); // Return top 8 plans
}

/**
 * Scenario-aware optimizer: computes ranked plans with scenario context,
 * and returns the top plan for auto-application.
 */
export function optimizeForScenario(
  engine: SimulationEngine,
  activeScenarioIds: string[]
): { plans: InterventionPlan[]; autoApplyPlan: InterventionPlan | null; scenarioTheme: string } {
  const plans = optimizeDecisions(engine, activeScenarioIds);

  // Determine the scenario reasoning theme
  let scenarioTheme = '';
  for (const sid of activeScenarioIds) {
    const mapping = SCENARIO_INTERVENTION_MAP[sid];
    if (mapping) {
      scenarioTheme = mapping.reasoningTheme;
      break; // Use the first active non-normal scenario's theme
    }
  }

  // The top-ranked plan is the one the AI recommends for auto-application
  const autoApplyPlan = plans.length > 0 ? plans[0] : null;

  return { plans, autoApplyPlan, scenarioTheme };
}

export function getInterventionById(id: string): Intervention | undefined {
  return INTERVENTIONS.find(i => i.id === id);
}
