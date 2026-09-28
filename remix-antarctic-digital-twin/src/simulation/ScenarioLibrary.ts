// ============================================================================
// ScenarioLibrary.ts — 13 predefined scenario definitions
// Antarctic Digital Twin — SIH26060
// ============================================================================

import { SimulationEngine, StationState, calcWindChill } from './SimulationEngine';

export interface ScenarioEvent {
  atHour: number;
  action: string;
  apply: (engine: SimulationEngine) => void;
  description: string;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  icon: string;
  events: ScenarioEvent[];
  customControls?: ScenarioControl[];
  initialDistanceKm?: number;
  stormMotionSpeedKmh?: number;
  stormBearingDeg?: number;
  stormBearingLabel?: string;
}

export interface ScenarioControl {
  id: string;
  label: string;
  type: 'slider' | 'select' | 'number';
  min?: number;
  max?: number;
  step?: number;
  defaultValue: number | string;
  options?: { label: string; value: string | number }[];
}

// Helper to apply gradual environmental change over ticks
function applyGradualChange(
  engine: SimulationEngine,
  targetTemp: number,
  targetWind: number,
  targetVisibility: number,
  targetPressure: number,
  description: string
) {
  engine.modifyState((s: StationState) => {
    // Apply gradual changes - the engine's lerp will smooth these
    const lerpRate = 0.15;
    s.environment.temperature += (targetTemp - s.environment.temperature) * lerpRate;
    s.environment.windSpeed += (targetWind - s.environment.windSpeed) * lerpRate;
    s.environment.visibility += (targetVisibility - s.environment.visibility) * lerpRate;
    s.environment.airPressure += (targetPressure - s.environment.airPressure) * lerpRate;
    if (targetWind > 80) {
      s.environment.snowAccumulation += 2;
    }
  });
  engine.addEvent({
    type: 'warning',
    category: 'Environment',
    title: 'Environmental Change',
    description,
  });
}

export const SCENARIO_LIBRARY: ScenarioDefinition[] = [
  // 1. Normal Operations
  {
    id: 'normal',
    name: 'Normal Operations',
    description: 'Station operating under standard Antarctic conditions. All systems nominal. Baseline telemetry with natural diurnal cycling.',
    severity: 'low',
    category: 'Baseline',
    icon: 'CheckCircle',
    events: [
      {
        atHour: 0,
        action: 'reset_to_normal',
        description: 'All systems reset to nominal baseline',
        apply: (engine) => {
          engine.reset();
          engine.addEvent({ type: 'info', category: 'System', title: 'Normal Operations', description: 'Station reset to nominal baseline conditions. All systems operating normally.' });
        },
      },
    ],
  },

  // 2. Extreme Cold
  {
    id: 'extreme_cold',
    name: 'Extreme Cold',
    description: 'Temperature drops to -52°C. Heating demand surges, power consumption increases, equipment stress rises. Tests thermal resilience.',
    severity: 'high',
    category: 'Environment',
    icon: 'Thermometer',
    customControls: [
      {
        id: 'target_temp',
        label: 'Target Polar Temperature (°C)',
        type: 'slider',
        min: -65,
        max: -35,
        step: 1,
        defaultValue: -52,
      },
    ],
    events: [
      {
        atHour: 0, action: 'cold_onset',
        description: 'Polar freeze wave strikes station immediately',
        apply: (engine) => {
          engine.modifyState((s) => {
            s.environment.temperature = -45;
            s.environment.windChill = calcWindChill(-45, s.environment.windSpeed);
          });
          engine.addEvent({ type: 'warning', category: 'Environment', title: 'Extreme Cold Wave', description: 'Rapid temperature decline to -45°C detected. Heating systems engaging full load.' });
        },
      },
      {
        atHour: 1, action: 'cold_phase1',
        description: 'Temperature reaches -38°C',
        apply: (engine) => applyGradualChange(engine, -38, 45, 30, 980, 'Temperature dropping to -38°C. Heating demand increasing.'),
      },
      {
        atHour: 3, action: 'cold_phase2',
        description: 'Temperature reaches -45°C',
        apply: (engine) => applyGradualChange(engine, -45, 48, 25, 975, 'Temperature at -45°C. Significant heating load increase. Equipment stress elevated.'),
      },
      {
        atHour: 6, action: 'cold_peak',
        description: 'Temperature reaches -52°C — extreme cold peak',
        apply: (engine) => {
          applyGradualChange(engine, -52, 50, 20, 970, 'Extreme cold peak: -52°C. Maximum heating demand. All outdoor operations suspended.');
          engine.addEvent({ type: 'critical', category: 'Environment', title: 'Extreme Cold Peak', description: 'Temperature has reached -52°C. Heating system at maximum capacity. Indoor temperature monitoring critical.' });
        },
      },
      {
        atHour: 18, action: 'cold_recovery',
        description: 'Temperature begins recovering',
        apply: (engine) => applyGradualChange(engine, -40, 42, 30, 980, 'Temperature recovering. Cold event subsiding.'),
      },
    ],
  },

  // 3. Antarctic Storm
  {
    id: 'antarctic_storm',
    name: 'Extreme Antarctic Storm',
    description: 'Full katabatic blizzard: temperature drops to -48°C, winds reach 145 km/h, visibility drops to 0.5 km. Complete cascade: heating → power → fuel → risk.',
    severity: 'critical',
    category: 'Environment',
    icon: 'CloudLightning',
    initialDistanceKm: 180,
    stormMotionSpeedKmh: 60,
    stormBearingDeg: 135,
    stormBearingLabel: '135° SE',
    customControls: [
      {
        id: 'wind_speed',
        label: 'Blizzard Winds (km/h)',
        type: 'slider',
        min: 75,
        max: 180,
        step: 5,
        defaultValue: 140,
      },
      {
        id: 'storm_temp',
        label: 'Blizzard Ambient Temp (°C)',
        type: 'slider',
        min: -55,
        max: -30,
        step: 1,
        defaultValue: -45,
      },
    ],
    events: [
      {
        atHour: 0, action: 'storm_warning',
        description: 'Severe katabatic blizzard strikes station immediately',
        apply: (engine) => {
          engine.modifyState((s) => {
            s.environment.airPressure = 955;
            s.environment.windSpeed = 105;
            s.environment.temperature = -40;
            s.environment.windChill = calcWindChill(-40, 105);
            s.environment.visibility = 4;
            s.crew.outdoorOpsAllowed = false;
            s.crew.shelterInPlace = true;
          });
          engine.addEvent({ type: 'warning', category: 'Environment', title: 'Katabatic Storm Arrival', description: 'Blizzard winds hit 105 km/h. Outdoor ops halted. High thermal extraction active.' });
        },
      },
      {
        atHour: 2, action: 'storm_onset',
        description: 'Storm arrives — winds accelerating, temperature dropping',
        apply: (engine) => {
          applyGradualChange(engine, -35, 75, 15, 965, 'Storm front arriving. Winds accelerating to 75 km/h. Temperature dropping.');
          engine.addEvent({ type: 'warning', category: 'Environment', title: 'Storm Front Arrival', description: 'Katabatic storm front has reached the station. Wind speeds 75 km/h and increasing. Outdoor operations restricted.' });
        },
      },
      {
        atHour: 4, action: 'storm_intensify',
        description: 'Storm intensifying — winds 110 km/h',
        apply: (engine) => {
          applyGradualChange(engine, -42, 110, 5, 955, 'Storm intensifying. Winds at 110 km/h. Visibility severely reduced.');
          engine.modifyState((s) => { s.crew.shelterInPlace = true; s.crew.outdoorOpsAllowed = false; });
          engine.addEvent({ type: 'critical', category: 'Environment', title: 'Storm Intensifying', description: 'Wind speeds exceed 110 km/h. Shelter-in-place activated. Wind turbines locked. Communication quality declining.' });
        },
      },
      {
        atHour: 6, action: 'storm_peak',
        description: 'Storm peak — 145 km/h winds, -48°C, 0.5 km visibility',
        apply: (engine) => {
          applyGradualChange(engine, -48, 145, 0.5, 942, 'STORM PEAK: 145 km/h winds, -48°C, near-zero visibility. Maximum stress on all systems.');
          engine.addEvent({ type: 'critical', category: 'Environment', title: 'Storm at Maximum Intensity', description: 'Katabatic blizzard at peak intensity. Wind gusts to 145 km/h. Temperature -48°C. Visibility 0.5 km. All systems under maximum environmental stress.' });
        },
      },
      {
        atHour: 12, action: 'storm_weakening',
        description: 'Storm beginning to weaken',
        apply: (engine) => {
          applyGradualChange(engine, -40, 85, 8, 960, 'Storm weakening. Winds decreasing to 85 km/h. Visibility improving.');
          engine.addEvent({ type: 'info', category: 'Environment', title: 'Storm Weakening', description: 'Storm intensity decreasing. Wind speeds dropping below 90 km/h. Conditions remain hazardous.' });
        },
      },
      {
        atHour: 20, action: 'storm_passing',
        description: 'Storm passing — conditions normalizing',
        apply: (engine) => {
          applyGradualChange(engine, -32, 50, 25, 978, 'Storm passing. Conditions gradually normalizing. Outdoor operations may resume cautiously.');
          engine.modifyState((s) => { s.crew.shelterInPlace = false; });
          engine.addEvent({ type: 'info', category: 'Environment', title: 'Storm Passing', description: 'Katabatic blizzard has largely passed. Wind speeds below 50 km/h. Begin damage assessment and system checks.' });
        },
      },
    ],
  },

  // 4. Generator Failure
  {
    id: 'generator_failure',
    name: 'Generator Failure',
    description: 'Primary or secondary generator fails. Remaining generators take increased load. Power reserve decreases. Fuel consumption pattern changes.',
    severity: 'high',
    category: 'Energy',
    icon: 'ZapOff',
    customControls: [
      {
        id: 'which_generator',
        label: 'Generator to Fail',
        type: 'select',
        defaultValue: 'gen1',
        options: [
          { label: 'Generator 1 (Primary)', value: 'gen1' },
          { label: 'Generator 2 (Secondary)', value: 'gen2' },
        ],
      },
    ],
    events: [
      {
        atHour: 0, action: 'gen_fail',
        description: 'Designated generator fails — automatic load transfer',
        apply: (engine) => {
          engine.modifyState((s) => {
            const targetGen = s.energy.generators.find(g => g.id === 'gen1') || s.energy.generators[0];
            if (targetGen) {
              targetGen.isOnline = false;
              targetGen.failedAtHour = s.simulationHour;
              targetGen.currentOutputKw = 0;
              targetGen.loadPercent = 0;
              targetGen.fuelRateLph = 0;
              targetGen.status = 'Failed';
              const eq = s.equipment.find(e => e.id === `eq-${targetGen.id}`);
              if (eq) {
                eq.isOnline = false;
                eq.status = 'Failed';
                eq.health = 0;
              }
            }
          });
          engine.addEvent({ type: 'critical', category: 'Energy', title: 'Generator Anomaly & Trip', description: 'Generator suffered sudden mechanical failure and tripped offline. Remaining unit absorbing surge load.' });
        },
      },
      {
        atHour: 2, action: 'gen_fail_confirm',
        description: 'Generator failure confirmed — thermal stress elevated',
        apply: (engine) => {
          engine.addEvent({ type: 'critical', category: 'Energy', title: 'Generator Offline Confirmed', description: 'Online generators operating under sustained elevated load.' });
        },
      },
    ],
  },

  // 5. Heating System Failure
  {
    id: 'heating_failure',
    name: 'Heating System Failure',
    description: 'Central heating system fails. Indoor temperature begins declining. Critical zones prioritized. Crew safety risk increases.',
    severity: 'critical',
    category: 'Infrastructure',
    icon: 'Flame',
    events: [
      {
        atHour: 0, action: 'heating_fail',
        description: 'Central heating system suffers failure',
        apply: (engine) => {
          engine.modifyState((s) => {
            s.infrastructure.heatingSystemStatus = 'Failed';
            const heatingEq = s.equipment.find(e => e.category === 'heating');
            if (heatingEq) { heatingEq.health = 0; heatingEq.isOnline = false; heatingEq.status = 'Failed'; }
            for (const zone of s.infrastructure.zones) {
              if (zone.category !== 'critical') {
                zone.isHeatingActive = false;
              }
            }
          });
          engine.addEvent({ type: 'critical', category: 'Infrastructure', title: 'Central Heating Trip', description: 'Central heating circulation pump tripped. Non-critical zones losing thermal support.' });
        },
      },
      {
        atHour: 3, action: 'heating_fail',
        description: 'Heating system fails completely',
        apply: (engine) => {
          engine.modifyState((s) => {
            s.infrastructure.heatingSystemStatus = 'Failed';
            const heatingEq = s.equipment.find(e => e.category === 'heating');
            if (heatingEq) { heatingEq.health = 0; heatingEq.isOnline = false; heatingEq.status = 'Failed'; }
            for (const zone of s.infrastructure.zones) {
              zone.isHeatingActive = false;
            }
          });
          engine.addEvent({ type: 'critical', category: 'Infrastructure', title: 'Heating System Failed', description: 'Central heating system has completely failed. Indoor temperatures declining toward ambient.' });
        },
      },
    ],
  },

  // 6. Fuel Shortage
  {
    id: 'fuel_shortage',
    name: 'Fuel Shortage',
    description: 'Fuel reserves are critically low. Adjust fuel level, consumption rate, and weather to calculate depletion timeline vs. resupply.',
    severity: 'high',
    category: 'Logistics',
    icon: 'Fuel',
    customControls: [
      { id: 'fuel_level', label: 'Fuel Level (liters)', type: 'slider', min: 5000, max: 200000, step: 1000, defaultValue: 25000 },
      { id: 'consumption_multiplier', label: 'Consumption Multiplier', type: 'slider', min: 0.5, max: 3, step: 0.1, defaultValue: 1.5 },
    ],
    events: [
      {
        atHour: 0, action: 'fuel_shortage',
        description: 'Fuel reserves critically low',
        apply: (engine) => {
          engine.modifyState((s) => {
            s.logistics.fuelLevelLiters = 25000;
          });
          engine.addEvent({ type: 'critical', category: 'Logistics', title: 'Critical Fuel Shortage', description: 'Fuel reserves have been set to critical level. Monitor fuel endurance vs. resupply timeline carefully.' });
        },
      },
    ],
  },

  // 7. Resupply Delay
  {
    id: 'resupply_delay',
    name: 'Resupply Delayed',
    description: 'Next resupply mission delayed. Recalculates all resource endurance timelines. Identifies which resource becomes critical first.',
    severity: 'medium',
    category: 'Logistics',
    icon: 'Ship',
    customControls: [
      {
        id: 'delay_days',
        label: 'Delay Duration (days)',
        type: 'select',
        defaultValue: 14,
        options: [
          { label: '7 days', value: 7 },
          { label: '14 days', value: 14 },
          { label: '21 days', value: 21 },
          { label: '30 days', value: 30 },
          { label: '45 days', value: 45 },
        ],
      },
    ],
    events: [
      {
        atHour: 0, action: 'resupply_delay',
        description: 'Resupply mission delayed',
        apply: (engine) => {
          engine.modifyState((s) => {
            s.logistics.resupplyDelayDays = 14; // Default, can be overridden
          });
          engine.addEvent({ type: 'warning', category: 'Logistics', title: 'Resupply Mission Delayed', description: 'Next resupply mission has been delayed by 14 days due to sea ice conditions. All resource endurance timelines recalculated.' });
        },
      },
    ],
  },

  // 8. Communication Failure
  {
    id: 'comm_failure',
    name: 'Satellite Communication Failure',
    description: 'Satellite uplink fails. Data sync stops. Local monitoring continues. Tests station autonomy and data buffering.',
    severity: 'high',
    category: 'Communication',
    icon: 'WifiOff',
    events: [
      {
        atHour: 0, action: 'comm_degrade',
        description: 'Communication quality degrading',
        apply: (engine) => {
          engine.modifyState((s) => { s.communication.quality = 40; s.communication.status = 'Degraded'; });
          engine.addEvent({ type: 'warning', category: 'Communication', title: 'Communication Degrading', description: 'Satellite uplink quality declining. Data synchronization slowing. Local monitoring unaffected.' });
        },
      },
      {
        atHour: 2, action: 'comm_fail',
        description: 'Communication goes offline',
        apply: (engine) => {
          engine.modifyState((s) => {
            s.communication.quality = 0;
            s.communication.status = 'Offline';
            s.communication.isDataSyncing = false;
            s.communication.satelliteUplinkMbps = 0;
            const commEq = s.equipment.find(e => e.category === 'comms');
            if (commEq) { commEq.health = 15; commEq.isOnline = false; commEq.status = 'Failed'; }
          });
          engine.addEvent({ type: 'critical', category: 'Communication', title: 'Communication Offline', description: 'Satellite communication completely unavailable. Data packets being buffered locally. Station continues autonomous operation. Critical alerts stored for later sync.' });
        },
      },
      {
        atHour: 12, action: 'comm_restore',
        description: 'Communication restored — data sync begins',
        apply: (engine) => {
          engine.modifyState((s) => {
            const commEq = s.equipment.find(e => e.category === 'comms');
            if (commEq) { commEq.health = 70; commEq.isOnline = true; commEq.status = 'Warning'; }
            s.communication.quality = 60;
            s.communication.status = 'Degraded';
            s.communication.isDataSyncing = true;
          });
          engine.addEvent({ type: 'info', category: 'Communication', title: 'Communication Partially Restored', description: 'Satellite uplink restored at reduced capacity. Buffered data packets syncing — critical information prioritized.' });
        },
      },
    ],
  },

  // 9. Equipment Degradation
  {
    id: 'equipment_degradation',
    name: 'Equipment Degradation',
    description: 'Gradual equipment degradation with predictive warnings. Generator health declines, efficiency drops, failure probability increases.',
    severity: 'medium',
    category: 'Equipment',
    icon: 'Wrench',
    events: [
      {
        atHour: 0, action: 'degradation_accelerate',
        description: 'Equipment degradation rate increases',
        apply: (engine) => {
          engine.modifyState((s) => {
            for (const eq of s.equipment) {
              eq.degradationRate *= 8; // 8x accelerated degradation for demo
            }
          });
          engine.addEvent({ type: 'info', category: 'Equipment', title: 'Equipment Degradation Simulation', description: 'Equipment degradation rate accelerated for simulation. Monitor health trends and predictive failure warnings.' });
        },
      },
    ],
  },

  // 10. Crew Increase
  {
    id: 'crew_increase',
    name: 'Crew Increase',
    description: 'Additional expedition members arrive. Increases food, water, power consumption. Shows impact on resource endurance.',
    severity: 'low',
    category: 'Crew',
    icon: 'Users',
    customControls: [
      {
        id: 'additional_crew',
        label: 'Additional Crew Members',
        type: 'select',
        defaultValue: 10,
        options: [
          { label: '+5 members', value: 5 },
          { label: '+10 members', value: 10 },
          { label: '+15 members', value: 15 },
          { label: '+20 members', value: 20 },
          { label: '+30 members', value: 30 },
        ],
      },
    ],
    events: [
      {
        atHour: 0, action: 'crew_arrives',
        description: 'Additional crew members arrive',
        apply: (engine) => {
          engine.modifyState((s) => {
            s.crew.count = s.crew.baseCount + 10; // Default +10
          });
          engine.addEvent({ type: 'info', category: 'Crew', title: 'Crew Size Increased', description: 'Additional expedition members have arrived. Resource consumption rates increased. Food, water, and power endurance recalculated.' });
        },
      },
    ],
  },

  // 11. Multiple Equipment Failure
  {
    id: 'multi_equipment_failure',
    name: 'Multiple Equipment Failure',
    description: 'Generator 2 and water treatment system fail simultaneously. Tests system redundancy and critical prioritization.',
    severity: 'high',
    category: 'Equipment',
    icon: 'AlertOctagon',
    events: [
      {
        atHour: 0, action: 'multi_fail_warning',
        description: 'Multiple equipment anomalies detected',
        apply: (engine) => {
          engine.addEvent({ type: 'warning', category: 'Equipment', title: 'Multiple Anomalies Detected', description: 'Abnormal readings from Generator 2 and water treatment plant. Potential cascading failure risk.' });
        },
      },
      {
        atHour: 2, action: 'gen2_fail',
        description: 'Generator 2 fails',
        apply: (engine) => {
          engine.modifyState((s) => {
            const gen2 = s.energy.generators.find(g => g.id === 'gen2');
            if (gen2) { gen2.isOnline = false; gen2.failedAtHour = s.simulationHour; gen2.status = 'Failed'; }
            const eq = s.equipment.find(e => e.id === 'eq-gen2');
            if (eq) { eq.isOnline = false; eq.status = 'Failed'; eq.health = 0; }
          });
          engine.addEvent({ type: 'critical', category: 'Energy', title: 'Generator 2 Failed', description: 'Secondary generator has failed. Generator 1 absorbing full load.' });
        },
      },
      {
        atHour: 4, action: 'water_fail',
        description: 'Water treatment system fails',
        apply: (engine) => {
          engine.modifyState((s) => {
            const waterEq = s.equipment.find(e => e.category === 'water');
            if (waterEq) { waterEq.isOnline = false; waterEq.status = 'Failed'; waterEq.health = 0; }
            s.infrastructure.waterTreatmentStatus = 'Failed';
          });
          engine.addEvent({ type: 'critical', category: 'Infrastructure', title: 'Water Treatment Failed', description: 'Water treatment plant offline. Relying on stored water reserves. Conservation measures required.' });
        },
      },
    ],
  },

  // 12. Combined Emergency
  {
    id: 'combined_emergency',
    name: 'Combined Emergency',
    description: 'Storm + Generator failure. Tests response to concurrent crises with cascading effects across all systems.',
    severity: 'critical',
    category: 'Combined',
    icon: 'ShieldAlert',
    events: [
      {
        atHour: 0, action: 'storm_begins',
        description: 'Storm warning issued',
        apply: (engine) => {
          engine.addEvent({ type: 'warning', category: 'Environment', title: 'Combined Emergency — Storm Warning', description: 'Severe storm approaching while systems are under stress.' });
        },
      },
      {
        atHour: 3, action: 'storm_arrives',
        description: 'Storm hits with force',
        apply: (engine) => applyGradualChange(engine, -42, 110, 3, 950, 'Storm arrives with 110 km/h winds and -42°C. All outdoor operations suspended.'),
      },
      {
        atHour: 6, action: 'gen1_fails_in_storm',
        description: 'Generator 1 fails under storm stress',
        apply: (engine) => {
          engine.modifyState((s) => {
            const gen1 = s.energy.generators.find(g => g.id === 'gen1');
            if (gen1) { gen1.isOnline = false; gen1.failedAtHour = s.simulationHour; gen1.status = 'Failed'; }
            const eq = s.equipment.find(e => e.id === 'eq-gen1');
            if (eq) { eq.isOnline = false; eq.status = 'Failed'; eq.health = 0; }
          });
          engine.addEvent({ type: 'critical', category: 'Energy', title: 'Generator 1 Failed During Storm', description: 'Primary generator has failed under storm-induced stress. Single generator remaining. Power shortage imminent if demand continues rising.' });
        },
      },
      {
        atHour: 10, action: 'storm_peak',
        description: 'Storm at peak combined with single generator',
        apply: (engine) => {
          applyGradualChange(engine, -48, 135, 0.8, 940, 'Storm at peak intensity. Single generator under extreme load. Critical situation.');
          engine.addEvent({ type: 'critical', category: 'System', title: 'Critical Combined Emergency', description: 'Storm at peak intensity with only one generator operational. Battery reserves depleting. Fuel consumption elevated. Immediate intervention required.' });
        },
      },
      {
        atHour: 18, action: 'storm_weakens',
        description: 'Storm begins weakening',
        apply: (engine) => applyGradualChange(engine, -35, 65, 15, 968, 'Storm weakening. Single generator still operational.'),
      },
    ],
  },

  // 13. Full Cascade Failure
  {
    id: 'full_cascade',
    name: 'Full Cascade Failure',
    description: 'The ultimate stress test: Storm → Gen failure → Heating failure → Resupply delay → Comm degradation. Complete cascade through all systems.',
    severity: 'critical',
    category: 'Combined',
    icon: 'Zap',
    events: [
      {
        atHour: 0, action: 'cascade_start',
        description: 'Cascade scenario initiated — storm approaching',
        apply: (engine) => {
          engine.addEvent({ type: 'warning', category: 'System', title: 'Full Cascade Scenario', description: 'Extreme multi-failure cascade simulation initiated. Severe storm approaching.' });
        },
      },
      {
        atHour: 2, action: 'cascade_storm',
        description: 'Severe storm arrives',
        apply: (engine) => applyGradualChange(engine, -45, 130, 2, 945, 'Severe katabatic blizzard. Temperature plummeting. Winds 130 km/h.'),
      },
      {
        atHour: 5, action: 'cascade_gen_fail',
        description: 'Generator 1 fails under storm stress',
        apply: (engine) => {
          engine.modifyState((s) => {
            const gen1 = s.energy.generators[0];
            if (gen1) { gen1.isOnline = false; gen1.failedAtHour = s.simulationHour; gen1.status = 'Failed'; }
            const eq = s.equipment.find(e => e.id === 'eq-gen1');
            if (eq) { eq.isOnline = false; eq.health = 0; eq.status = 'Failed'; }
          });
          engine.addEvent({ type: 'critical', category: 'Energy', title: 'CASCADE: Generator 1 Failed', description: 'Storm-induced generator failure. Remaining generator absorbing full load under extreme conditions.' });
        },
      },
      {
        atHour: 9, action: 'cascade_heating_fail',
        description: 'Heating system fails from overload',
        apply: (engine) => {
          engine.modifyState((s) => {
            s.infrastructure.heatingSystemStatus = 'Failed';
            const heatingEq = s.equipment.find(e => e.category === 'heating');
            if (heatingEq) { heatingEq.health = 0; heatingEq.isOnline = false; heatingEq.status = 'Failed'; }
            for (const zone of s.infrastructure.zones) { zone.isHeatingActive = false; }
          });
          engine.addEvent({ type: 'critical', category: 'Infrastructure', title: 'CASCADE: Heating System Failed', description: 'Heating system overloaded and failed. Indoor temperatures declining rapidly. Crew safety at immediate risk.' });
        },
      },
      {
        atHour: 12, action: 'cascade_resupply_delay',
        description: 'Resupply delayed due to storm',
        apply: (engine) => {
          engine.modifyState((s) => { s.logistics.resupplyDelayDays = 21; });
          engine.addEvent({ type: 'critical', category: 'Logistics', title: 'CASCADE: Resupply Delayed 21 Days', description: 'Storm has made resupply impossible. Vessel delayed by 21 days. All resource endurance timelines critical.' });
        },
      },
      {
        atHour: 14, action: 'cascade_comm_degrade',
        description: 'Communication degraded from storm',
        apply: (engine) => {
          engine.modifyState((s) => {
            s.communication.quality = 25;
            s.communication.status = 'Degraded';
          });
          engine.addEvent({ type: 'critical', category: 'Communication', title: 'CASCADE: Communication Severely Degraded', description: 'Satellite communication at 25% quality. Data sync impaired. Station operating with minimal external contact.' });
        },
      },
      {
        atHour: 18, action: 'cascade_fuel_critical',
        description: 'Fuel shortage becomes critical',
        apply: (engine) => {
          engine.modifyState((s) => { s.logistics.fuelLevelLiters = Math.min(s.logistics.fuelLevelLiters, 30000); });
          engine.addEvent({ type: 'critical', category: 'Logistics', title: 'CASCADE: Fuel Critical', description: 'Elevated consumption during storm has depleted fuel reserves to critical levels. Immediate conservation measures required.' });
        },
      },
    ],
  },
];

// ---- Scenario Application Helper ----

export function applyCustomScenarioParams(
  engine: SimulationEngine,
  scenarioId: string,
  params?: Record<string, number | string>
): void {
  if (!params) return;

  if (scenarioId === 'generator_failure') {
    const genId = (params.which_generator as string) || 'gen1';
    engine.modifyState((s) => {
      for (const g of s.energy.generators) {
        g.isOnline = true;
        g.status = 'Nominal';
        g.failedAtHour = null;
        const eq = s.equipment.find(e => e.id === `eq-${g.id}`);
        if (eq) { eq.isOnline = true; eq.status = 'Nominal'; eq.health = 95; }
      }
      const targetGen = s.energy.generators.find(g => g.id === genId) || s.energy.generators[0];
      if (targetGen) {
        targetGen.isOnline = false;
        targetGen.failedAtHour = s.simulationHour;
        targetGen.currentOutputKw = 0;
        targetGen.loadPercent = 0;
        targetGen.fuelRateLph = 0;
        targetGen.status = 'Failed';
        const eq = s.equipment.find(e => e.id === `eq-${targetGen.id}`);
        if (eq) { eq.isOnline = false; eq.status = 'Failed'; eq.health = 0; }
      }
    });
  } else if (scenarioId === 'fuel_shortage') {
    const fuelLevel = Number(params.fuel_level) || 25000;
    const mult = Number(params.consumption_multiplier) || 1.0;
    engine.modifyState((s) => {
      s.logistics.fuelLevelLiters = fuelLevel;
      if (mult !== 1.0) {
        for (const gen of s.energy.generators) {
          if (gen.isOnline) gen.fuelRateLph *= mult;
        }
      }
    });
  } else if (scenarioId === 'extreme_cold') {
    const targetTemp = Number(params.target_temp) || -52;
    engine.modifyState((s) => {
      s.environment.temperature = targetTemp;
      s.environment.windChill = calcWindChill(targetTemp, s.environment.windSpeed);
    });
  } else if (scenarioId === 'antarctic_storm') {
    const targetWind = Number(params.wind_speed) || 140;
    const targetTemp = Number(params.storm_temp) || -45;
    engine.modifyState((s) => {
      s.environment.windSpeed = targetWind;
      s.environment.temperature = targetTemp;
      s.environment.airPressure = 945;
      s.environment.visibility = targetWind > 120 ? 0.5 : 2.0;
      s.crew.shelterInPlace = targetWind > 100;
      s.crew.outdoorOpsAllowed = false;
    });
  } else if (scenarioId === 'resupply_delay') {
    const days = Number(params.delay_days) || 14;
    engine.modifyState((s) => {
      s.logistics.resupplyDelayDays = days;
    });
  } else if (scenarioId === 'crew_increase') {
    const additional = Number(params.additional_crew) || 10;
    engine.modifyState((s) => {
      s.crew.count = s.crew.baseCount + additional;
    });
  }
}

export function applyScenarioEvents(
  engine: SimulationEngine,
  scenario: ScenarioDefinition,
  currentHour: number,
  params?: Record<string, number | string>
): void {
  if (params && Object.keys(params).length > 0) {
    applyCustomScenarioParams(engine, scenario.id, params);
  }

  for (const event of scenario.events) {
    if (Math.abs(currentHour - event.atHour) < 0.15) {
      event.apply(engine);
    }
  }
}

export function getScenarioById(id: string): ScenarioDefinition | undefined {
  return SCENARIO_LIBRARY.find(s => s.id === id);
}
