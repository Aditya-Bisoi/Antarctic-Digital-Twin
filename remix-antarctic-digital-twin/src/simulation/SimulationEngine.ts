// ============================================================================
// SimulationEngine.ts — Core physics-based simulation engine
// Antarctic Digital Twin — SIH26060
// ============================================================================

// ---- Type Definitions ----

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type SystemStatus = 'Nominal' | 'Warning' | 'Critical' | 'Failed';
export type CommStatus = 'Online' | 'Degraded' | 'Offline';

export interface GeneratorState {
  id: string;
  name: string;
  ratedCapacityKw: number;
  currentOutputKw: number;
  loadPercent: number;
  health: number;          // 0-100
  temperature: number;     // operating temp °C
  vibration: number;       // 0-100 normalized
  efficiency: number;      // 0-1
  fuelRateLph: number;     // liters per hour
  isOnline: boolean;
  failedAtHour: number | null;
  hoursRunning: number;
  status: SystemStatus;
}

export interface EquipmentItem {
  id: string;
  name: string;
  category: 'generator' | 'heating' | 'water' | 'solar' | 'comms' | 'science' | 'vehicle';
  health: number;
  temperature: number;
  vibration: number;
  efficiency: number;
  isOnline: boolean;
  status: SystemStatus;
  degradationRate: number; // health % lost per hour under normal conditions
  healthHistory: number[]; // last N readings for trend analysis
}

export interface ZoneTemperature {
  name: string;
  category: 'critical' | 'non-critical';
  temperature: number;
  targetTemperature: number;
  heatingKw: number;
  isHeatingActive: boolean;
}

export interface EnvironmentState {
  temperature: number;
  windSpeed: number;
  windDirection: string;
  windChill: number;
  humidity: number;
  airPressure: number;
  uvIndex: number;
  visibility: number;
  snowAccumulation: number;
}

export interface EnergyState {
  generators: GeneratorState[];
  backupGenerator: GeneratorState;
  totalGenerationKw: number;
  totalConsumptionKw: number;
  solarGenerationKw: number;
  solarMaxKw: number;
  windGenerationKw: number;
  heatingDemandKw: number;
  baseLoadKw: number;
  batteryLevelPercent: number;
  batteryCapacityKwh: number;
  batteryChargeRateKw: number;
  batteryDischargeRateKw: number;
  isBatteryCharging: boolean;
  powerDeficitKw: number;
  powerSurplusKw: number;
}

export interface LogisticsState {
  fuelLevelLiters: number;
  fuelConsumptionLph: number;
  fuelEnduranceDays: number;
  foodRemainingKg: number;
  foodConsumptionKgPerDay: number;
  foodEnduranceDays: number;
  waterStorageLiters: number;
  waterConsumptionLpd: number;
  waterEnduranceDays: number;
  medicalSupplyPercent: number;
  medicalEnduranceDays: number;
  sparePartsPercent: number;
  sparePartsEnduranceDays: number;
  nextResupplyDate: string;
  nextResupplyDays: number;
  resupplyDelayDays: number;
}

export interface InfrastructureState {
  overallHealth: number;
  zones: ZoneTemperature[];
  indoorTempAvg: number;
  heatingSystemStatus: SystemStatus;
  lifeSupportStatus: SystemStatus;
  waterTreatmentStatus: SystemStatus;
  activeSensors: number;
  totalSensors: number;
}

export interface CommunicationState {
  satelliteUplinkMbps: number;
  maxUplinkMbps: number;
  quality: number; // 0-100
  status: CommStatus;
  isDataSyncing: boolean;
  pendingDataPackets: number;
  lastSyncHour: number;
}

export interface CrewState {
  count: number;
  baseCount: number;
  safetyRisk: RiskLevel;
  outdoorOpsAllowed: boolean;
  shelterInPlace: boolean;
}

export interface RiskReason {
  factor: string;
  severity: 'info' | 'warning' | 'critical';
  detail: string;
}

export interface SimulationEvent {
  hour: number;
  type: 'info' | 'warning' | 'critical' | 'intervention' | 'prediction';
  category: string;
  title: string;
  description: string;
}

export interface StationState {
  stationId: 'maitri' | 'bharati';
  stationName: string;
  environment: EnvironmentState;
  energy: EnergyState;
  logistics: LogisticsState;
  infrastructure: InfrastructureState;
  communication: CommunicationState;
  crew: CrewState;
  equipment: EquipmentItem[];
  riskLevel: RiskLevel;
  riskReasons: RiskReason[];
  resilienceScore: number;
  resilienceFactors: { name: string; score: number; weight: number }[];
  overallStatus: SystemStatus;
  simulationHour: number;
  events: SimulationEvent[];
  activeScenarios: string[];
  activeInterventions: string[];
  cascadeChain: CascadeNode[];
}

export interface CascadeNode {
  id: string;
  label: string;
  detail: string;
  isActive: boolean;
  severity: 'normal' | 'warning' | 'critical';
  children: string[]; // ids of downstream nodes
}

export interface StateSnapshot {
  hour: number;
  state: StationState;
}

// ---- Baseline Data ----

const MAITRI_BASELINE: Omit<StationState, 'events' | 'activeScenarios' | 'activeInterventions' | 'cascadeChain' | 'riskLevel' | 'riskReasons' | 'resilienceScore' | 'resilienceFactors' | 'overallStatus'> = {
  stationId: 'maitri',
  stationName: 'Maitri Station',
  environment: {
    temperature: -28,
    windSpeed: 42,
    windDirection: 'ESE (115°)',
    windChill: -41,
    humidity: 48,
    airPressure: 986,
    uvIndex: 1.2,
    visibility: 35,
    snowAccumulation: 14,
  },
  energy: {
    generators: [
      {
        id: 'gen1', name: 'Generator 1 (Primary)',
        ratedCapacityKw: 100, currentOutputKw: 78, loadPercent: 78,
        health: 95, temperature: 82, vibration: 22, efficiency: 0.92,
        fuelRateLph: 22, isOnline: true, failedAtHour: null, hoursRunning: 0,
        status: 'Nominal',
      },
      {
        id: 'gen2', name: 'Generator 2 (Secondary)',
        ratedCapacityKw: 100, currentOutputKw: 64, loadPercent: 64,
        health: 92, temperature: 78, vibration: 18, efficiency: 0.90,
        fuelRateLph: 18, isOnline: true, failedAtHour: null, hoursRunning: 0,
        status: 'Nominal',
      },
    ],
    backupGenerator: {
      id: 'backup', name: 'Emergency Backup Generator',
      ratedCapacityKw: 80, currentOutputKw: 0, loadPercent: 0,
      health: 98, temperature: 20, vibration: 0, efficiency: 0.88,
      fuelRateLph: 0, isOnline: false, failedAtHour: null, hoursRunning: 0,
      status: 'Nominal',
    },
    totalGenerationKw: 185,
    totalConsumptionKw: 142,
    solarGenerationKw: 28,
    solarMaxKw: 45,
    windGenerationKw: 15,
    heatingDemandKw: 55,
    baseLoadKw: 87,
    batteryLevelPercent: 94,
    batteryCapacityKwh: 500,
    batteryChargeRateKw: 20,
    batteryDischargeRateKw: 0,
    isBatteryCharging: true,
    powerDeficitKw: 0,
    powerSurplusKw: 43,
  },
  logistics: {
    fuelLevelLiters: 185000,
    fuelConsumptionLph: 40,
    fuelEnduranceDays: 192.7,
    foodRemainingKg: 7750,
    foodConsumptionKgPerDay: 25,
    foodEnduranceDays: 310,
    waterStorageLiters: 48000,
    waterConsumptionLpd: 500,
    waterEnduranceDays: 96,
    medicalSupplyPercent: 95,
    medicalEnduranceDays: 365,
    sparePartsPercent: 88,
    sparePartsEnduranceDays: 240,
    nextResupplyDate: 'November 2026',
    nextResupplyDays: 55,
    resupplyDelayDays: 0,
  },
  infrastructure: {
    overallHealth: 97,
    zones: [
      { name: 'Living Quarters', category: 'critical', temperature: 21.5, targetTemperature: 21, heatingKw: 18, isHeatingActive: true },
      { name: 'Medical Bay', category: 'critical', temperature: 22.0, targetTemperature: 22, heatingKw: 8, isHeatingActive: true },
      { name: 'Communication Center', category: 'critical', temperature: 20.5, targetTemperature: 20, heatingKw: 6, isHeatingActive: true },
      { name: 'Science Laboratory', category: 'non-critical', temperature: 20.0, targetTemperature: 20, heatingKw: 10, isHeatingActive: true },
      { name: 'Generator Room', category: 'critical', temperature: 18.0, targetTemperature: 15, heatingKw: 5, isHeatingActive: true },
      { name: 'Storage & Workshop', category: 'non-critical', temperature: 12.0, targetTemperature: 10, heatingKw: 8, isHeatingActive: true },
    ],
    indoorTempAvg: 21.5,
    heatingSystemStatus: 'Nominal',
    lifeSupportStatus: 'Nominal',
    waterTreatmentStatus: 'Nominal',
    activeSensors: 248,
    totalSensors: 252,
  },
  communication: {
    satelliteUplinkMbps: 50,
    maxUplinkMbps: 50,
    quality: 100,
    status: 'Online',
    isDataSyncing: true,
    pendingDataPackets: 0,
    lastSyncHour: 0,
  },
  crew: {
    count: 25,
    baseCount: 25,
    safetyRisk: 'LOW',
    outdoorOpsAllowed: true,
    shelterInPlace: false,
  },
  equipment: [
    { id: 'eq-gen1', name: 'Primary Diesel Generator', category: 'generator', health: 95, temperature: 82, vibration: 22, efficiency: 0.92, isOnline: true, status: 'Nominal', degradationRate: 0.02, healthHistory: [97, 96, 96, 95, 95] },
    { id: 'eq-gen2', name: 'Secondary Diesel Generator', category: 'generator', health: 92, temperature: 78, vibration: 18, efficiency: 0.90, isOnline: true, status: 'Nominal', degradationRate: 0.025, healthHistory: [95, 94, 93, 93, 92] },
    { id: 'eq-heating', name: 'Central Heating System', category: 'heating', health: 94, temperature: 65, vibration: 10, efficiency: 0.91, isOnline: true, status: 'Nominal', degradationRate: 0.015, healthHistory: [96, 95, 95, 94, 94] },
    { id: 'eq-water', name: 'Water Treatment Plant', category: 'water', health: 96, temperature: 40, vibration: 8, efficiency: 0.95, isOnline: true, status: 'Nominal', degradationRate: 0.01, healthHistory: [97, 97, 96, 96, 96] },
    { id: 'eq-solar', name: 'Solar Panel Array', category: 'solar', health: 90, temperature: -15, vibration: 0, efficiency: 0.85, isOnline: true, status: 'Nominal', degradationRate: 0.005, healthHistory: [92, 91, 91, 90, 90] },
    { id: 'eq-comms', name: 'Satellite Communication Array', category: 'comms', health: 97, temperature: -10, vibration: 5, efficiency: 0.96, isOnline: true, status: 'Nominal', degradationRate: 0.008, healthHistory: [98, 98, 97, 97, 97] },
  ],
  simulationHour: 0,
};

const BHARATI_BASELINE: Omit<StationState, 'events' | 'activeScenarios' | 'activeInterventions' | 'cascadeChain' | 'riskLevel' | 'riskReasons' | 'resilienceScore' | 'resilienceFactors' | 'overallStatus'> = {
  stationId: 'bharati',
  stationName: 'Bharati Station',
  environment: {
    temperature: -25,
    windSpeed: 36,
    windDirection: 'NE (42°)',
    windChill: -36,
    humidity: 52,
    airPressure: 994,
    uvIndex: 1.5,
    visibility: 42,
    snowAccumulation: 8,
  },
  energy: {
    generators: [
      {
        id: 'gen1', name: 'Generator 1 (Cogeneration)',
        ratedCapacityKw: 130, currentOutputKw: 95, loadPercent: 73,
        health: 97, temperature: 80, vibration: 20, efficiency: 0.94,
        fuelRateLph: 25, isOnline: true, failedAtHour: null, hoursRunning: 0,
        status: 'Nominal',
      },
      {
        id: 'gen2', name: 'Generator 2 (Cogeneration)',
        ratedCapacityKw: 130, currentOutputKw: 80, loadPercent: 61,
        health: 95, temperature: 76, vibration: 17, efficiency: 0.93,
        fuelRateLph: 20, isOnline: true, failedAtHour: null, hoursRunning: 0,
        status: 'Nominal',
      },
    ],
    backupGenerator: {
      id: 'backup', name: 'Emergency Backup Generator',
      ratedCapacityKw: 100, currentOutputKw: 0, loadPercent: 0,
      health: 99, temperature: 20, vibration: 0, efficiency: 0.90,
      fuelRateLph: 0, isOnline: false, failedAtHour: null, hoursRunning: 0,
      status: 'Nominal',
    },
    totalGenerationKw: 240,
    totalConsumptionKw: 175,
    solarGenerationKw: 45,
    solarMaxKw: 65,
    windGenerationKw: 20,
    heatingDemandKw: 65,
    baseLoadKw: 110,
    batteryLevelPercent: 98,
    batteryCapacityKwh: 800,
    batteryChargeRateKw: 30,
    batteryDischargeRateKw: 0,
    isBatteryCharging: true,
    powerDeficitKw: 0,
    powerSurplusKw: 65,
  },
  logistics: {
    fuelLevelLiters: 260000,
    fuelConsumptionLph: 45,
    fuelEnduranceDays: 240.7,
    foodRemainingKg: 18800,
    foodConsumptionKgPerDay: 47,
    foodEnduranceDays: 400,
    waterStorageLiters: 75000,
    waterConsumptionLpd: 940,
    waterEnduranceDays: 79.8,
    medicalSupplyPercent: 98,
    medicalEnduranceDays: 400,
    sparePartsPercent: 92,
    sparePartsEnduranceDays: 320,
    nextResupplyDate: 'December 2026',
    nextResupplyDays: 85,
    resupplyDelayDays: 0,
  },
  infrastructure: {
    overallHealth: 99,
    zones: [
      { name: 'Living Quarters (Tier 3)', category: 'critical', temperature: 22.0, targetTemperature: 22, heatingKw: 22, isHeatingActive: true },
      { name: 'Medical & Telemedicine Suite', category: 'critical', temperature: 22.5, targetTemperature: 22, heatingKw: 10, isHeatingActive: true },
      { name: 'Communication Hub', category: 'critical', temperature: 21.0, targetTemperature: 20, heatingKw: 7, isHeatingActive: true },
      { name: 'Oceanography & Science Lab', category: 'non-critical', temperature: 20.5, targetTemperature: 20, heatingKw: 12, isHeatingActive: true },
      { name: 'CHP Plant Room (Tier 2)', category: 'critical', temperature: 19.0, targetTemperature: 16, heatingKw: 6, isHeatingActive: true },
      { name: 'Storage & Vehicle Bay', category: 'non-critical', temperature: 10.0, targetTemperature: 8, heatingKw: 8, isHeatingActive: true },
    ],
    indoorTempAvg: 22.0,
    heatingSystemStatus: 'Nominal',
    lifeSupportStatus: 'Nominal',
    waterTreatmentStatus: 'Nominal',
    activeSensors: 392,
    totalSensors: 394,
  },
  communication: {
    satelliteUplinkMbps: 120,
    maxUplinkMbps: 120,
    quality: 100,
    status: 'Online',
    isDataSyncing: true,
    pendingDataPackets: 0,
    lastSyncHour: 0,
  },
  crew: {
    count: 47,
    baseCount: 47,
    safetyRisk: 'LOW',
    outdoorOpsAllowed: true,
    shelterInPlace: false,
  },
  equipment: [
    { id: 'eq-gen1', name: 'Cogeneration Unit 1', category: 'generator', health: 97, temperature: 80, vibration: 20, efficiency: 0.94, isOnline: true, status: 'Nominal', degradationRate: 0.018, healthHistory: [98, 98, 97, 97, 97] },
    { id: 'eq-gen2', name: 'Cogeneration Unit 2', category: 'generator', health: 95, temperature: 76, vibration: 17, efficiency: 0.93, isOnline: true, status: 'Nominal', degradationRate: 0.02, healthHistory: [97, 96, 96, 95, 95] },
    { id: 'eq-heating', name: 'Central Heating System', category: 'heating', health: 96, temperature: 60, vibration: 8, efficiency: 0.93, isOnline: true, status: 'Nominal', degradationRate: 0.012, healthHistory: [97, 97, 96, 96, 96] },
    { id: 'eq-water', name: 'Greywater Treatment Plant', category: 'water', health: 98, temperature: 38, vibration: 6, efficiency: 0.96, isOnline: true, status: 'Nominal', degradationRate: 0.008, healthHistory: [99, 98, 98, 98, 98] },
    { id: 'eq-solar', name: 'Solar Array & Wind Turbine', category: 'solar', health: 93, temperature: -12, vibration: 3, efficiency: 0.88, isOnline: true, status: 'Nominal', degradationRate: 0.004, healthHistory: [94, 94, 93, 93, 93] },
    { id: 'eq-comms', name: 'High-Speed Satellite Terminal', category: 'comms', health: 98, temperature: -8, vibration: 4, efficiency: 0.97, isOnline: true, status: 'Nominal', degradationRate: 0.006, healthHistory: [99, 99, 98, 98, 98] },
  ],
  simulationHour: 0,
};

// ---- Helper Functions ----

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(current: number, target: number, rate: number): number {
  return current + (target - current) * rate;
}

export function calcWindChill(temp: number, windSpeed: number): number {
  // Standard wind chill formula (Environment Canada / NWS)
  if (temp > 10 || windSpeed < 4.8) return temp;
  return 13.12 + 0.6215 * temp - 11.37 * Math.pow(windSpeed, 0.16) + 0.3965 * temp * Math.pow(windSpeed, 0.16);
}

// ---- Deep Clone Utility ----
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ---- Simulation Engine Class ----

export class SimulationEngine {
  private state: StationState;
  private baselineState: StationState;
  private history: StateSnapshot[] = [];
  private _isRunning: boolean = false;
  private _speed: number = 1; // 1 = 1 sim-hour per real-second
  private _accumulatedDt: number = 0;
  private readonly TICK_INTERVAL_HOURS = 0.1; // recalculate every 6 sim-minutes

  constructor(stationId: 'maitri' | 'bharati') {
    const baseline = stationId === 'bharati' ? deepClone(BHARATI_BASELINE) : deepClone(MAITRI_BASELINE);
    this.state = {
      ...baseline,
      events: [],
      activeScenarios: [],
      activeInterventions: [],
      cascadeChain: [],
      riskLevel: 'LOW',
      riskReasons: [],
      resilienceScore: 100,
      resilienceFactors: [],
      overallStatus: 'Nominal',
    };
    this.baselineState = deepClone(this.state);
    this.recalculateDerived();
    this.history.push({ hour: 0, state: deepClone(this.state) });
  }

  // ---- Public API ----

  getState(): StationState {
    return this.state;
  }

  getHistory(): StateSnapshot[] {
    return this.history;
  }

  getBaseline(): StationState {
    return this.baselineState;
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  getSpeed(): number {
    return this._speed;
  }

  play(): void {
    this._isRunning = true;
  }

  pause(): void {
    this._isRunning = false;
  }

  setSpeed(multiplier: number): void {
    this._speed = clamp(multiplier, 0.25, 100);
  }

  reset(): void {
    this.state = deepClone(this.baselineState);
    this.state.simulationHour = 0;
    this.state.events = [];
    this.state.activeScenarios = [];
    this.state.activeInterventions = [];
    this.state.cascadeChain = [];
    this.history = [{ hour: 0, state: deepClone(this.state) }];
    this._isRunning = false;
    this._accumulatedDt = 0;
    this.recalculateDerived();
  }

  advanceByHours(hours: number): void {
    const steps = Math.ceil(hours / this.TICK_INTERVAL_HOURS);
    for (let i = 0; i < steps; i++) {
      this.tickInternal(this.TICK_INTERVAL_HOURS);
    }
  }

  // Called by requestAnimationFrame loop — realDeltaSeconds is wall-clock time since last frame
  tick(realDeltaSeconds: number): void {
    if (!this._isRunning) return;
    const simHours = (realDeltaSeconds * this._speed) / 3600;
    this._accumulatedDt += simHours;

    while (this._accumulatedDt >= this.TICK_INTERVAL_HOURS) {
      this.tickInternal(this.TICK_INTERVAL_HOURS);
      this._accumulatedDt -= this.TICK_INTERVAL_HOURS;
    }
  }

  // Recalculate all physical subsystems without advancing time
  recalculatePhysics(immediate: boolean = true): void {
    const s = this.state;
    const env = s.environment;
    const infra = s.infrastructure;

    // 1. Immediate heating demand computation
    if (infra.heatingSystemStatus !== 'Failed') {
      const baseTemp = this.baselineState.environment.temperature;
      const tempDelta = Math.max(0, baseTemp - env.temperature);
      const baseHeating = this.baselineState.energy.heatingDemandKw;
      const heatingMultiplier = 1 + 0.03 * tempDelta;
      const windHeatingPenalty = Math.max(0, (env.windSpeed - 50) * 0.15);
      let targetHeating = baseHeating * heatingMultiplier + windHeatingPenalty;
      const heatingEquip = s.equipment.find(e => e.category === 'heating');
      if (heatingEquip) {
        targetHeating *= clamp(heatingEquip.efficiency, 0.3, 1);
      }
      if (s.activeInterventions.includes('reduce_noncritical_heating')) {
        const nonCriticalSavings = infra.zones
          .filter(z => z.category === 'non-critical')
          .reduce((sum, z) => sum + z.heatingKw * 0.6, 0);
        targetHeating -= nonCriticalSavings;
      }
      s.energy.heatingDemandKw = clamp(immediate ? targetHeating : lerp(s.energy.heatingDemandKw, targetHeating, 0.2), 0, 300);
    } else {
      s.energy.heatingDemandKw = 0;
    }

    // 2. Energy balance & generator load distribution
    this.tickEnergy(0);

    // 3. Fuel rate & endurance recomputation
    this.tickFuel(0);

    // 4. Logistics endurance
    this.tickLogistics(0);

    // 5. Indoor temperature evaluation
    this.tickIndoorTemp(0);

    // 6. Derived indicators (risk, resilience, cascade chain)
    this.recalculateDerived();
  }

  // Apply external modifications (scenarios, interventions)
  modifyState(modifier: (state: StationState) => void, immediatePhysics: boolean = true): void {
    modifier(this.state);
    if (immediatePhysics) {
      this.recalculatePhysics(true);
    } else {
      this.recalculateDerived();
    }
  }

  addEvent(event: Omit<SimulationEvent, 'hour'>): void {
    this.state.events.push({ ...event, hour: this.state.simulationHour });
  }

  // Create a snapshot for comparison (e.g. "without intervention" branch)
  createSnapshot(): StateSnapshot {
    return { hour: this.state.simulationHour, state: deepClone(this.state) };
  }

  // Fork the engine for parallel simulation (e.g. "what if we intervened earlier?")
  fork(): SimulationEngine {
    const forked = new SimulationEngine(this.state.stationId);
    forked.state = deepClone(this.state);
    forked.baselineState = deepClone(this.baselineState);
    forked.history = deepClone(this.history);
    return forked;
  }

  // ---- Internal Tick (all physics happen here) ----

  private tickInternal(dt: number): void {
    const s = this.state;
    s.simulationHour += dt;

    // 1. Environment natural drift (very small, keeps things alive)
    this.tickEnvironment(dt);

    // 2. Heating demand from environment
    this.tickHeating(dt);

    // 3. Equipment degradation
    this.tickEquipment(dt);

    // 4. Energy balance
    this.tickEnergy(dt);

    // 5. Fuel consumption
    this.tickFuel(dt);

    // 6. Logistics consumption (food, water, medical)
    this.tickLogistics(dt);

    // 7. Communication effects
    this.tickCommunication(dt);

    // 8. Crew effects
    this.tickCrew(dt);

    // 9. Infrastructure indoor temperatures
    this.tickIndoorTemp(dt);

    // 10. Recalculate derived values (risk, resilience, etc.)
    this.recalculateDerived();

    // 11. Generate auto-alerts based on thresholds
    this.checkAlertThresholds();

    // 12. Record history snapshot every simulated hour
    const lastSnapshotHour = this.history.length > 0 ? this.history[this.history.length - 1].hour : -1;
    if (Math.floor(s.simulationHour) > Math.floor(lastSnapshotHour)) {
      this.history.push({ hour: Math.floor(s.simulationHour), state: deepClone(s) });
    }
  }

  // ---- Physics Subsystems ----

  private tickEnvironment(dt: number): void {
    const env = this.state.environment;
    // Natural micro-variation (not random — sinusoidal based on hour)
    const hourAngle = (this.state.simulationHour * Math.PI) / 12;
    const diurnalShift = Math.sin(hourAngle) * 1.5; // ±1.5°C diurnal cycle
    const baseTemp = this.baselineState.environment.temperature;

    // Only apply diurnal if no scenario has overridden temperature
    if (!this.state.activeScenarios.some(s => s.includes('storm') || s.includes('cold') || s.includes('weather'))) {
      env.temperature = lerp(env.temperature, baseTemp + diurnalShift, 0.02 * dt);
    }

    env.windChill = calcWindChill(env.temperature, env.windSpeed);
    env.airPressure = clamp(env.airPressure, 920, 1050);
    env.visibility = clamp(env.visibility, 0.1, 50);
    env.snowAccumulation = clamp(env.snowAccumulation, 0, 200);
  }

  private tickHeating(dt: number): void {
    const s = this.state;
    const env = s.environment;
    const infra = s.infrastructure;

    if (infra.heatingSystemStatus === 'Failed') {
      // Heating offline — demand stays but isn't met
      s.energy.heatingDemandKw = 0;
      return;
    }

    // Physics: heating demand = base × (1 + 0.03 × (baseTemp - currentTemp)) where base is around -25
    const baseTemp = this.baselineState.environment.temperature;
    const tempDelta = Math.max(0, baseTemp - env.temperature); // how much colder than baseline
    const baseHeating = this.baselineState.energy.heatingDemandKw;
    const heatingMultiplier = 1 + 0.03 * tempDelta;
    const windHeatingPenalty = Math.max(0, (env.windSpeed - 50) * 0.15); // extra kW above 50 km/h wind

    let targetHeating = baseHeating * heatingMultiplier + windHeatingPenalty;

    // If heating system is degraded, it can't meet full demand
    const heatingEquip = s.equipment.find(e => e.category === 'heating');
    if (heatingEquip) {
      targetHeating *= clamp(heatingEquip.efficiency, 0.3, 1);
    }

    // Non-critical zones may have heating reduced (intervention)
    if (s.activeInterventions.includes('reduce_noncritical_heating')) {
      const nonCriticalSavings = infra.zones
        .filter(z => z.category === 'non-critical')
        .reduce((sum, z) => sum + z.heatingKw * 0.6, 0);
      targetHeating -= nonCriticalSavings;
    }

    s.energy.heatingDemandKw = clamp(lerp(s.energy.heatingDemandKw, targetHeating, 0.1), 0, 300);
  }

  private tickEquipment(dt: number): void {
    const s = this.state;

    for (const eq of s.equipment) {
      if (!eq.isOnline) continue;

      // Base degradation
      let degradation = eq.degradationRate * dt;

      // Stress multipliers
      if (s.environment.temperature < -40) degradation *= 1.5;
      if (s.environment.windSpeed > 80) degradation *= 1.3;

      // Generators under high load degrade faster
      if (eq.category === 'generator') {
        const gen = s.energy.generators.find(g => g.id === eq.id.replace('eq-', ''));
        if (gen && gen.isOnline) {
          if (gen.loadPercent > 85) degradation *= 2.0;
          else if (gen.loadPercent > 70) degradation *= 1.3;

          // Sync equipment health to generator
          gen.health = eq.health;
          gen.temperature = eq.temperature;
          gen.vibration = eq.vibration;
          gen.efficiency = eq.efficiency;
        }
      }

      // Maintenance intervention slows degradation
      if (s.activeInterventions.includes('increase_maintenance')) {
        degradation *= 0.4;
      }

      eq.health = clamp(eq.health - degradation, 0, 100);
      eq.efficiency = clamp(Math.pow(eq.health / 100, 0.5), 0.3, 1);

      // Temperature and vibration increase as health drops
      if (eq.category === 'generator' || eq.category === 'heating') {
        const healthLoss = 100 - eq.health;
        eq.temperature = eq.temperature + healthLoss * 0.05 * dt;
        eq.vibration = clamp(eq.vibration + healthLoss * 0.03 * dt, 0, 100);
      }

      // Record health history (one entry per hour)
      if (eq.healthHistory.length === 0 ||
          Math.floor(s.simulationHour) > eq.healthHistory.length) {
        eq.healthHistory.push(Math.round(eq.health));
        if (eq.healthHistory.length > 100) eq.healthHistory.shift();
      }

      // Update status
      if (eq.health <= 0) {
        eq.status = 'Failed';
        eq.isOnline = false;
      } else if (eq.health < 40) {
        eq.status = 'Critical';
      } else if (eq.health < 70) {
        eq.status = 'Warning';
      } else {
        eq.status = 'Nominal';
      }
    }
  }

  private tickEnergy(dt: number): void {
    const s = this.state;
    const energy = s.energy;

    // Calculate total consumption
    const crewPowerPerPerson = 0.8; // kW per person
    const crewPower = s.crew.count * crewPowerPerPerson;

    let totalConsumption = energy.baseLoadKw + energy.heatingDemandKw + crewPower;

    // Non-critical load shedding intervention
    if (s.activeInterventions.includes('reduce_noncritical_loads')) {
      totalConsumption *= 0.7; // 30% reduction
    }

    // Critical systems prioritization shifts consumption pattern but doesn't reduce much
    if (s.activeInterventions.includes('prioritize_critical')) {
      totalConsumption *= 0.9; // 10% reduction by cutting optional loads
    }

    energy.totalConsumptionKw = clamp(totalConsumption, 20, 1000);

    // Calculate generation from online generators
    let totalGeneration = 0;
    const onlineGens = [...energy.generators, energy.backupGenerator].filter(g => g.isOnline);

    if (onlineGens.length === 0) {
      totalGeneration = 0;
    } else {
      // Distribute load across online generators proportionally
      const totalCapacity = onlineGens.reduce((sum, g) => sum + g.ratedCapacityKw * g.efficiency, 0);
      for (const gen of onlineGens) {
        const share = (gen.ratedCapacityKw * gen.efficiency) / Math.max(totalCapacity, 1);
        gen.currentOutputKw = clamp(energy.totalConsumptionKw * share, 0, gen.ratedCapacityKw);
        gen.loadPercent = (gen.currentOutputKw / gen.ratedCapacityKw) * 100;
        totalGeneration += gen.currentOutputKw;

        // Fuel rate scales non-linearly with load (efficiency curve)
        gen.fuelRateLph = (gen.currentOutputKw / gen.ratedCapacityKw) * 30 * Math.pow(gen.loadPercent / 100, 1.15);
      }
    }

    // Solar contribution (reduced in bad weather / polar night)
    let solarFactor = 1.0;
    if (s.environment.visibility < 10) solarFactor *= 0.3;
    if (s.environment.snowAccumulation > 30) solarFactor *= 0.5;
    // Polar seasonal factor (simplistic: reduced in winter)
    solarFactor *= 0.4; // Antarctic winter baseline

    if (s.activeInterventions.includes('increase_renewables')) {
      solarFactor *= 1.4;
    }

    energy.solarGenerationKw = energy.solarMaxKw * solarFactor;

    // Wind generation affected by extreme wind
    if (s.environment.windSpeed > 100) {
      energy.windGenerationKw = 0; // Turbines locked in extreme wind
    } else if (s.environment.windSpeed > 60) {
      energy.windGenerationKw = 15; // Feathered
    } else {
      energy.windGenerationKw = clamp(s.environment.windSpeed * 0.5, 0, 25);
    }

    totalGeneration += energy.solarGenerationKw + energy.windGenerationKw;
    energy.totalGenerationKw = totalGeneration;

    // Power balance
    const powerBalance = totalGeneration - energy.totalConsumptionKw;
    energy.powerSurplusKw = Math.max(0, powerBalance);
    energy.powerDeficitKw = Math.max(0, -powerBalance);

    // Battery dynamics
    if (powerBalance > 0) {
      // Surplus charges battery
      energy.isBatteryCharging = true;
      energy.batteryChargeRateKw = Math.min(powerBalance, 30);
      energy.batteryDischargeRateKw = 0;
      const chargeKwh = energy.batteryChargeRateKw * dt;
      energy.batteryLevelPercent = clamp(
        energy.batteryLevelPercent + (chargeKwh / energy.batteryCapacityKwh) * 100,
        0, 100
      );
    } else if (powerBalance < 0) {
      // Deficit drains battery
      energy.isBatteryCharging = false;
      energy.batteryChargeRateKw = 0;
      energy.batteryDischargeRateKw = Math.abs(powerBalance);

      // Battery preservation mode
      if (s.activeInterventions.includes('preserve_battery')) {
        energy.batteryDischargeRateKw *= 0.6;
      }

      const dischargeKwh = energy.batteryDischargeRateKw * dt;
      energy.batteryLevelPercent = clamp(
        energy.batteryLevelPercent - (dischargeKwh / energy.batteryCapacityKwh) * 100,
        0, 100
      );
    } else {
      energy.isBatteryCharging = false;
      energy.batteryChargeRateKw = 0;
      energy.batteryDischargeRateKw = 0;
    }

    // Update offline generators
    for (const gen of [...energy.generators, energy.backupGenerator]) {
      if (!gen.isOnline) {
        gen.currentOutputKw = 0;
        gen.loadPercent = 0;
        gen.fuelRateLph = 0;
      }
      // Status based on load
      if (!gen.isOnline) gen.status = gen.failedAtHour !== null ? 'Failed' : 'Nominal';
      else if (gen.loadPercent > 90) gen.status = 'Critical';
      else if (gen.loadPercent > 75) gen.status = 'Warning';
      else gen.status = 'Nominal';

      if (gen.isOnline) gen.hoursRunning += dt;
    }
  }

  private tickFuel(dt: number): void {
    const s = this.state;
    const logistics = s.logistics;
    const energy = s.energy;

    // Total fuel consumption from all online generators
    const totalFuelLph = [...energy.generators, energy.backupGenerator]
      .filter(g => g.isOnline)
      .reduce((sum, g) => sum + g.fuelRateLph, 0);

    logistics.fuelConsumptionLph = totalFuelLph;
    logistics.fuelLevelLiters = clamp(logistics.fuelLevelLiters - totalFuelLph * dt, 0, 500000);
    logistics.fuelEnduranceDays = totalFuelLph > 0
      ? logistics.fuelLevelLiters / (totalFuelLph * 24)
      : 9999;
  }

  private tickLogistics(dt: number): void {
    const s = this.state;
    const log = s.logistics;
    const crew = s.crew;

    // Food consumption scales with crew
    const foodPerPersonPerDay = 1.0; // kg
    log.foodConsumptionKgPerDay = crew.count * foodPerPersonPerDay;
    log.foodRemainingKg = clamp(log.foodRemainingKg - (log.foodConsumptionKgPerDay / 24) * dt, 0, 100000);
    log.foodEnduranceDays = log.foodConsumptionKgPerDay > 0
      ? log.foodRemainingKg / log.foodConsumptionKgPerDay
      : 9999;

    // Water consumption scales with crew
    const waterPerPersonPerDay = 20; // liters
    log.waterConsumptionLpd = crew.count * waterPerPersonPerDay;
    log.waterStorageLiters = clamp(log.waterStorageLiters - (log.waterConsumptionLpd / 24) * dt, 0, 200000);
    log.waterEnduranceDays = log.waterConsumptionLpd > 0
      ? log.waterStorageLiters / log.waterConsumptionLpd
      : 9999;

    // Medical supplies (slow consumption)
    const medicalDailyRate = 0.025; // % per day per 25 crew
    const medicalRate = medicalDailyRate * (crew.count / 25);
    log.medicalSupplyPercent = clamp(log.medicalSupplyPercent - (medicalRate / 24) * dt, 0, 100);
    log.medicalEnduranceDays = medicalRate > 0 ? log.medicalSupplyPercent / medicalRate : 9999;

    // Spare parts (consumed during maintenance)
    const spareRate = s.activeInterventions.includes('increase_maintenance') ? 0.04 : 0.015;
    log.sparePartsPercent = clamp(log.sparePartsPercent - (spareRate / 24) * dt, 0, 100);
    log.sparePartsEnduranceDays = spareRate > 0 ? log.sparePartsPercent / spareRate : 9999;

    // Resupply calculations
    log.nextResupplyDays = Math.max(0,
      this.baselineState.logistics.nextResupplyDays
      - (this.state.simulationHour / 24)
      + log.resupplyDelayDays
    );

    // Emergency resupply intervention
    if (s.activeInterventions.includes('emergency_resupply')) {
      log.nextResupplyDays = Math.max(0, log.nextResupplyDays - 15);
    }
  }

  private tickCommunication(dt: number): void {
    const s = this.state;
    const comm = s.communication;

    // Wind affects comm quality
    if (s.environment.windSpeed > 100) {
      comm.quality = clamp(lerp(comm.quality, Math.max(20, 100 - (s.environment.windSpeed - 100) * 1.5), 0.05), 0, 100);
    } else if (s.environment.windSpeed > 60) {
      comm.quality = clamp(lerp(comm.quality, 80, 0.03), 0, 100);
    } else {
      comm.quality = clamp(lerp(comm.quality, 100, 0.02), 0, 100);
    }

    // Comm equipment health affects quality
    const commEquip = s.equipment.find(e => e.category === 'comms');
    if (commEquip) {
      comm.quality *= clamp(commEquip.health / 100, 0.2, 1);
    }

    // Update status
    if (comm.quality <= 0) {
      comm.status = 'Offline';
    } else if (comm.quality < 50) {
      comm.status = 'Degraded';
    } else {
      comm.status = 'Online';
    }

    comm.satelliteUplinkMbps = (comm.quality / 100) * comm.maxUplinkMbps;

    // Data sync
    if (comm.status === 'Offline') {
      comm.isDataSyncing = false;
      comm.pendingDataPackets += dt * 10; // 10 packets per hour
    } else if (comm.status === 'Degraded') {
      comm.isDataSyncing = true;
      comm.pendingDataPackets = Math.max(0, comm.pendingDataPackets - dt * 3);
    } else {
      comm.isDataSyncing = true;
      comm.pendingDataPackets = Math.max(0, comm.pendingDataPackets - dt * 20);
      if (comm.pendingDataPackets <= 0) comm.lastSyncHour = s.simulationHour;
    }
  }

  private tickCrew(dt: number): void {
    const s = this.state;
    const crew = s.crew;

    // Outdoor operations
    crew.outdoorOpsAllowed = s.environment.windSpeed < 80 && s.environment.temperature > -50 && s.environment.visibility > 2;

    // Shelter in place
    crew.shelterInPlace = s.environment.windSpeed > 100 || s.environment.temperature < -55;

    // Safety risk
    const indoorAvg = s.infrastructure.indoorTempAvg;
    if (indoorAvg < 5 || s.energy.batteryLevelPercent < 5) {
      crew.safetyRisk = 'CRITICAL';
    } else if (indoorAvg < 10 || s.energy.powerDeficitKw > 50 || s.logistics.fuelEnduranceDays < 3) {
      crew.safetyRisk = 'HIGH';
    } else if (indoorAvg < 15 || s.logistics.fuelEnduranceDays < 14 || s.environment.windSpeed > 80) {
      crew.safetyRisk = 'MODERATE';
    } else {
      crew.safetyRisk = 'LOW';
    }
  }

  private tickIndoorTemp(dt: number): void {
    const s = this.state;
    const infra = s.infrastructure;
    const env = s.environment;

    for (const zone of infra.zones) {
      if (infra.heatingSystemStatus === 'Failed' || !zone.isHeatingActive) {
        // No heating — temperature decays toward outdoor
        const decayRate = 0.5; // °C per hour toward outdoor temp
        zone.temperature = lerp(zone.temperature, env.temperature, decayRate * dt * 0.02);
      } else if (s.energy.powerDeficitKw > 0) {
        // Partial power — heating at reduced capacity
        const deficitFactor = 1 - clamp(s.energy.powerDeficitKw / s.energy.totalConsumptionKw, 0, 0.8);
        const effectiveTarget = zone.targetTemperature * deficitFactor + env.temperature * (1 - deficitFactor);
        zone.temperature = lerp(zone.temperature, effectiveTarget, 0.05 * dt);
      } else {
        // Normal — temperature moves toward target
        zone.temperature = lerp(zone.temperature, zone.targetTemperature, 0.08 * dt);
      }

      zone.temperature = clamp(zone.temperature, env.temperature, 35);
    }

    // Average indoor temp
    const criticalZones = infra.zones.filter(z => z.category === 'critical');
    infra.indoorTempAvg = criticalZones.reduce((sum, z) => sum + z.temperature, 0) / Math.max(criticalZones.length, 1);

    // Heating system status from equipment
    const heatingEquip = s.equipment.find(e => e.category === 'heating');
    if (heatingEquip) {
      if (!heatingEquip.isOnline || heatingEquip.health <= 0) {
        infra.heatingSystemStatus = 'Failed';
      } else if (heatingEquip.health < 40) {
        infra.heatingSystemStatus = 'Critical';
      } else if (heatingEquip.health < 70) {
        infra.heatingSystemStatus = 'Warning';
      } else {
        infra.heatingSystemStatus = 'Nominal';
      }
    }

    // Overall infrastructure health
    const allHealth = s.equipment.filter(e => e.isOnline).map(e => e.health);
    infra.overallHealth = allHealth.length > 0
      ? Math.round(allHealth.reduce((a, b) => a + b, 0) / allHealth.length)
      : 0;

    // Life support status
    if (infra.indoorTempAvg < 5 || s.energy.powerDeficitKw > 100) {
      infra.lifeSupportStatus = 'Critical';
    } else if (infra.indoorTempAvg < 15 || s.energy.powerDeficitKw > 30) {
      infra.lifeSupportStatus = 'Warning';
    } else {
      infra.lifeSupportStatus = 'Nominal';
    }
  }

  // ---- Derived Calculations (Risk, Resilience, Cascade) ----

  private recalculateDerived(): void {
    this.calculateRisk();
    this.calculateResilience();
    this.updateCascadeChain();
    this.updateOverallStatus();
  }

  private calculateRisk(): void {
    const s = this.state;
    const reasons: RiskReason[] = [];

    // Environment
    if (s.environment.temperature < -50) {
      reasons.push({ factor: 'Extreme temperature', severity: 'critical', detail: `Ambient temperature at ${s.environment.temperature.toFixed(1)}°C — life-threatening conditions` });
    } else if (s.environment.temperature < -40) {
      reasons.push({ factor: 'Severe cold', severity: 'warning', detail: `Temperature at ${s.environment.temperature.toFixed(1)}°C — increased heating and equipment stress` });
    }

    if (s.environment.windSpeed > 120) {
      reasons.push({ factor: 'Hurricane-force winds', severity: 'critical', detail: `Wind speed ${s.environment.windSpeed.toFixed(0)} km/h — structural risk, all outdoor ops suspended` });
    } else if (s.environment.windSpeed > 80) {
      reasons.push({ factor: 'Severe wind advisory', severity: 'warning', detail: `Wind speed ${s.environment.windSpeed.toFixed(0)} km/h — outdoor operations restricted` });
    }

    if (s.environment.visibility < 2) {
      reasons.push({ factor: 'Near-zero visibility', severity: 'critical', detail: `Visibility ${s.environment.visibility.toFixed(1)} km — whiteout conditions` });
    }

    // Energy
    if (s.energy.powerDeficitKw > 50) {
      reasons.push({ factor: 'Severe power shortage', severity: 'critical', detail: `Power deficit of ${s.energy.powerDeficitKw.toFixed(0)} kW — critical systems at risk` });
    } else if (s.energy.powerDeficitKw > 0) {
      reasons.push({ factor: 'Power shortage detected', severity: 'warning', detail: `Power deficit of ${s.energy.powerDeficitKw.toFixed(0)} kW — battery compensating` });
    }

    if (s.energy.batteryLevelPercent < 10) {
      reasons.push({ factor: 'Battery critically low', severity: 'critical', detail: `Battery reserve at ${s.energy.batteryLevelPercent.toFixed(1)}% — imminent power loss` });
    } else if (s.energy.batteryLevelPercent < 30) {
      reasons.push({ factor: 'Battery reserve low', severity: 'warning', detail: `Battery at ${s.energy.batteryLevelPercent.toFixed(1)}% and ${s.energy.isBatteryCharging ? 'charging' : 'discharging'}` });
    }

    // Generators
    const failedGens = s.energy.generators.filter(g => !g.isOnline || g.failedAtHour !== null);
    if (failedGens.length > 0) {
      for (const g of failedGens) {
        reasons.push({ factor: `${g.name} unavailable`, severity: failedGens.length > 1 ? 'critical' : 'warning',
          detail: g.failedAtHour !== null ? `Failed at simulation hour ${g.failedAtHour.toFixed(1)}` : 'Offline' });
      }
    }

    // Fuel
    if (s.logistics.fuelEnduranceDays < 7) {
      reasons.push({ factor: 'Critical fuel shortage', severity: 'critical', detail: `Only ${s.logistics.fuelEnduranceDays.toFixed(1)} days of fuel remaining` });
    } else if (s.logistics.fuelEnduranceDays < s.logistics.nextResupplyDays) {
      reasons.push({ factor: 'Fuel shortage before resupply', severity: 'warning',
        detail: `Fuel lasts ${s.logistics.fuelEnduranceDays.toFixed(1)} days but resupply in ${s.logistics.nextResupplyDays.toFixed(0)} days — shortage predicted ${(s.logistics.nextResupplyDays - s.logistics.fuelEnduranceDays).toFixed(1)} days before resupply` });
    }

    // Indoor temperature
    if (s.infrastructure.indoorTempAvg < 5) {
      reasons.push({ factor: 'Indoor temperature dangerously low', severity: 'critical', detail: `Average indoor temperature ${s.infrastructure.indoorTempAvg.toFixed(1)}°C — hypothermia risk` });
    } else if (s.infrastructure.indoorTempAvg < 12) {
      reasons.push({ factor: 'Indoor temperature dropping', severity: 'warning', detail: `Average indoor temperature ${s.infrastructure.indoorTempAvg.toFixed(1)}°C — heating system under stress` });
    }

    // Communication
    if (s.communication.status === 'Offline') {
      reasons.push({ factor: 'Communication offline', severity: 'critical', detail: 'Satellite communication completely unavailable — local monitoring continues' });
    } else if (s.communication.status === 'Degraded') {
      reasons.push({ factor: 'Communication degraded', severity: 'warning', detail: `Satellite uplink at ${s.communication.quality.toFixed(0)}% quality` });
    }

    // Food/water
    if (s.logistics.foodEnduranceDays < 14) {
      reasons.push({ factor: 'Food supply critical', severity: 'critical', detail: `Food reserves for only ${s.logistics.foodEnduranceDays.toFixed(0)} days` });
    }
    if (s.logistics.waterEnduranceDays < 7) {
      reasons.push({ factor: 'Water supply critical', severity: 'critical', detail: `Water reserves for only ${s.logistics.waterEnduranceDays.toFixed(0)} days` });
    }

    // Equipment
    const criticalEquip = s.equipment.filter(e => e.health < 40 && e.isOnline);
    for (const eq of criticalEquip) {
      reasons.push({ factor: `${eq.name} degraded`, severity: 'warning', detail: `Health at ${eq.health.toFixed(0)}% — failure risk increasing` });
    }

    // Determine overall risk level
    const criticalCount = reasons.filter(r => r.severity === 'critical').length;
    const warningCount = reasons.filter(r => r.severity === 'warning').length;

    let riskLevel: RiskLevel;
    if (criticalCount >= 3) riskLevel = 'CRITICAL';
    else if (criticalCount >= 1) riskLevel = 'HIGH';
    else if (warningCount >= 2) riskLevel = 'MODERATE';
    else if (warningCount >= 1) riskLevel = 'MODERATE';
    else riskLevel = 'LOW';

    s.riskLevel = riskLevel;
    s.riskReasons = reasons;
  }

  private calculateResilience(): void {
    const s = this.state;

    const factors: { name: string; score: number; weight: number }[] = [];

    // Energy availability (15%)
    const genOnline = s.energy.generators.filter(g => g.isOnline).length;
    const energyScore = clamp(
      (s.energy.powerSurplusKw > 0 ? 100 : Math.max(0, 100 - s.energy.powerDeficitKw * 2)) *
      (genOnline / Math.max(s.energy.generators.length, 1)),
      0, 100
    );
    factors.push({ name: 'Energy Availability', score: energyScore, weight: 0.15 });

    // Fuel endurance (15%)
    const fuelScore = clamp(Math.min(100, s.logistics.fuelEnduranceDays * 1.0), 0, 100);
    factors.push({ name: 'Fuel Endurance', score: fuelScore, weight: 0.15 });

    // Equipment health (15%)
    const avgHealth = s.equipment.reduce((sum, e) => sum + e.health, 0) / Math.max(s.equipment.length, 1);
    factors.push({ name: 'Equipment Health', score: avgHealth, weight: 0.15 });

    // Environmental severity (10%)
    const envScore = clamp(100 - Math.max(0, (-s.environment.temperature - 30) * 2) - Math.max(0, (s.environment.windSpeed - 50) * 0.5), 0, 100);
    factors.push({ name: 'Environmental Conditions', score: envScore, weight: 0.10 });

    // Logistics status (15%)
    const logScore = clamp(Math.min(
      s.logistics.foodEnduranceDays * 0.5,
      s.logistics.waterEnduranceDays * 1.0,
      s.logistics.medicalSupplyPercent,
      100
    ), 0, 100);
    factors.push({ name: 'Logistics Status', score: logScore, weight: 0.15 });

    // Communication status (10%)
    const commScore = s.communication.quality;
    factors.push({ name: 'Communication', score: commScore, weight: 0.10 });

    // Crew safety (10%)
    const crewScore = s.crew.safetyRisk === 'LOW' ? 100 : s.crew.safetyRisk === 'MODERATE' ? 65 : s.crew.safetyRisk === 'HIGH' ? 30 : 5;
    factors.push({ name: 'Crew Safety', score: crewScore, weight: 0.10 });

    // Active failures (10%)
    const failureCount = s.equipment.filter(e => !e.isOnline || e.health <= 0).length +
      (s.infrastructure.heatingSystemStatus === 'Failed' ? 1 : 0) +
      (s.communication.status === 'Offline' ? 1 : 0);
    const failureScore = clamp(100 - failureCount * 25, 0, 100);
    factors.push({ name: 'System Integrity', score: failureScore, weight: 0.10 });

    s.resilienceFactors = factors;
    s.resilienceScore = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));
  }

  private updateCascadeChain(): void {
    const s = this.state;
    const chain: CascadeNode[] = [
      { id: 'env', label: 'Environment', detail: `${s.environment.temperature.toFixed(1)}°C / ${s.environment.windSpeed.toFixed(0)} km/h`, isActive: s.environment.temperature < -35 || s.environment.windSpeed > 60, severity: s.environment.temperature < -45 ? 'critical' : s.environment.temperature < -35 ? 'warning' : 'normal', children: ['heating'] },
      { id: 'heating', label: 'Heating Demand', detail: `${s.energy.heatingDemandKw.toFixed(0)} kW`, isActive: s.energy.heatingDemandKw > this.baselineState.energy.heatingDemandKw * 1.2, severity: s.energy.heatingDemandKw > this.baselineState.energy.heatingDemandKw * 1.8 ? 'critical' : s.energy.heatingDemandKw > this.baselineState.energy.heatingDemandKw * 1.3 ? 'warning' : 'normal', children: ['power'] },
      { id: 'power', label: 'Power Consumption', detail: `${s.energy.totalConsumptionKw.toFixed(0)} kW`, isActive: s.energy.totalConsumptionKw > this.baselineState.energy.totalConsumptionKw * 1.15, severity: s.energy.powerDeficitKw > 0 ? 'critical' : s.energy.totalConsumptionKw > this.baselineState.energy.totalConsumptionKw * 1.3 ? 'warning' : 'normal', children: ['genload'] },
      { id: 'genload', label: 'Generator Load', detail: `${s.energy.generators.filter(g => g.isOnline).map(g => `${g.loadPercent.toFixed(0)}%`).join(' / ') || 'N/A'}`, isActive: s.energy.generators.some(g => g.isOnline && g.loadPercent > 75), severity: s.energy.generators.some(g => g.isOnline && g.loadPercent > 90) ? 'critical' : s.energy.generators.some(g => g.isOnline && g.loadPercent > 75) ? 'warning' : 'normal', children: ['fuel'] },
      { id: 'fuel', label: 'Fuel Consumption', detail: `${s.logistics.fuelConsumptionLph.toFixed(1)} L/hr`, isActive: s.logistics.fuelConsumptionLph > this.baselineState.logistics.fuelConsumptionLph * 1.2, severity: s.logistics.fuelEnduranceDays < 14 ? 'critical' : s.logistics.fuelConsumptionLph > this.baselineState.logistics.fuelConsumptionLph * 1.5 ? 'warning' : 'normal', children: ['endurance'] },
      { id: 'endurance', label: 'Fuel Endurance', detail: `${s.logistics.fuelEnduranceDays.toFixed(1)} days`, isActive: s.logistics.fuelEnduranceDays < this.baselineState.logistics.fuelEnduranceDays * 0.7, severity: s.logistics.fuelEnduranceDays < 14 ? 'critical' : s.logistics.fuelEnduranceDays < 60 ? 'warning' : 'normal', children: ['risk'] },
      { id: 'risk', label: 'Station Risk', detail: s.riskLevel, isActive: s.riskLevel !== 'LOW', severity: s.riskLevel === 'CRITICAL' ? 'critical' : s.riskLevel === 'HIGH' || s.riskLevel === 'MODERATE' ? 'warning' : 'normal', children: [] },
    ];

    s.cascadeChain = chain;
  }

  private updateOverallStatus(): void {
    const s = this.state;
    if (s.riskLevel === 'CRITICAL') s.overallStatus = 'Critical';
    else if (s.riskLevel === 'HIGH') s.overallStatus = 'Warning';
    else if (s.riskLevel === 'MODERATE') s.overallStatus = 'Warning';
    else s.overallStatus = 'Nominal';
  }

  private checkAlertThresholds(): void {
    const s = this.state;
    const hour = s.simulationHour;

    // Only check once per simulated hour
    if (hour - Math.floor(hour) > this.TICK_INTERVAL_HOURS * 1.5) return;

    // Power shortage
    if (s.energy.powerDeficitKw > 0 && !s.events.some(e => e.title === 'Power Shortage Detected' && hour - e.hour < 1)) {
      const batteryHoursLeft = s.energy.batteryLevelPercent > 0
        ? (s.energy.batteryCapacityKwh * s.energy.batteryLevelPercent / 100) / Math.max(s.energy.batteryDischargeRateKw, 1)
        : 0;
      this.addEvent({
        type: 'critical', category: 'Energy',
        title: 'Power Shortage Detected',
        description: `Generation (${s.energy.totalGenerationKw.toFixed(0)} kW) below demand (${s.energy.totalConsumptionKw.toFixed(0)} kW). Battery reserves can sustain operations for approximately ${batteryHoursLeft.toFixed(1)} hours at current discharge rate.`,
      });
    }

    // Fuel shortage before resupply
    if (s.logistics.fuelEnduranceDays < s.logistics.nextResupplyDays &&
        !s.events.some(e => e.title === 'Fuel Shortage Predicted' && hour - e.hour < 6)) {
      const shortfallDays = s.logistics.nextResupplyDays - s.logistics.fuelEnduranceDays;
      this.addEvent({
        type: 'critical', category: 'Logistics',
        title: 'Fuel Shortage Predicted',
        description: `Fuel will be depleted ${shortfallDays.toFixed(1)} days before next resupply. Current fuel endurance: ${s.logistics.fuelEnduranceDays.toFixed(1)} days. Next resupply: ${s.logistics.nextResupplyDays.toFixed(0)} days.`,
      });
    }

    // Indoor temperature warning
    if (s.infrastructure.indoorTempAvg < 15 &&
        !s.events.some(e => e.title === 'Indoor Temperature Dropping' && hour - e.hour < 2)) {
      this.addEvent({
        type: 'warning', category: 'Infrastructure',
        title: 'Indoor Temperature Dropping',
        description: `Average indoor temperature has fallen to ${s.infrastructure.indoorTempAvg.toFixed(1)}°C. ${s.infrastructure.heatingSystemStatus === 'Failed' ? 'Heating system is offline.' : 'Heating system under strain.'}`,
      });
    }
  }
}

export default SimulationEngine;
