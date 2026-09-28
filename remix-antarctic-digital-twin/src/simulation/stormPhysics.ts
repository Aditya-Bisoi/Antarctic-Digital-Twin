/**
 * stormPhysics.ts — Authoritative Storm Kinematics Engine
 *
 * Implements mathematically and physically consistent storm motion:
 *   distance_travelled_km = storm_motion_speed_kmh * elapsed_simulation_hours
 *   remaining_distance_km = Math.max(0, initial_distance_km - distance_travelled_km)
 *   eta_hours = remaining_distance_km > 0 ? remaining_distance_km / storm_motion_speed_kmh : 0.0
 *
 * Distinguishes storm propagation speed (e.g. 60 km/h translation toward station)
 * from atmospheric blizzard wind speed (e.g. 115 km/h cyclonic gusts).
 */

export interface StormKinematicsInput {
  initialDistanceKm: number;       // e.g. 180 km
  stormMotionSpeedKmh: number;     // e.g. 60 km/h (translation speed toward station)
  elapsedSimulationHours: number;  // e.g. 1.0 h (from simulation clock)
  windSpeedKmh?: number;           // e.g. 115 km/h (atmospheric cyclonic wind speed)
}

export interface StormKinematicsResult {
  initialDistanceKm: number;
  stormMotionSpeedKmh: number;
  elapsedSimulationHours: number;
  distanceTravelledKm: number;
  remainingDistanceKm: number;
  etaHours: number;
  status: 'APPROACHING' | 'ARRIVED';
  hasArrived: boolean;
  windSpeedKmh: number;
}

export const DEFAULT_STORM_INITIAL_DISTANCE_KM = 180.0;
export const DEFAULT_STORM_MOTION_SPEED_KMH = 60.0;
export const DEFAULT_BLIZZARD_WIND_KMH = 115.0;
export const DEFAULT_RADAR_MAX_RANGE_KM = 200.0;

/**
 * Calculates storm kinematic distance, travel, ETA, and arrival status.
 * Clamps distance to 0 when arrived (never returns negative distance).
 */
export function calculateStormKinematics(input: StormKinematicsInput): StormKinematicsResult {
  const initialDist = Math.max(0, Number(input.initialDistanceKm) || DEFAULT_STORM_INITIAL_DISTANCE_KM);
  const stormSpeed = Math.max(0.1, Number(input.stormMotionSpeedKmh) || DEFAULT_STORM_MOTION_SPEED_KMH);
  const elapsedHours = Math.max(0, Number(input.elapsedSimulationHours) || 0.0);
  const windSpeed = Number(input.windSpeedKmh) || DEFAULT_BLIZZARD_WIND_KMH;

  // distance_travelled = storm_speed * elapsed_time
  const distanceTravelled = stormSpeed * elapsedHours;

  // remaining_distance = max(0, initial_distance - distance_travelled)
  const remainingDistance = Math.max(0, initialDist - distanceTravelled);

  // ETA_hours = remaining_distance / storm_speed
  const etaHours = remainingDistance > 0 ? Number((remainingDistance / stormSpeed).toFixed(2)) : 0.0;

  const hasArrived = remainingDistance <= 0.001;
  const status: 'APPROACHING' | 'ARRIVED' = hasArrived ? 'ARRIVED' : 'APPROACHING';

  return {
    initialDistanceKm: initialDist,
    stormMotionSpeedKmh: stormSpeed,
    elapsedSimulationHours: Number(elapsedHours.toFixed(3)),
    distanceTravelledKm: Number(distanceTravelled.toFixed(2)),
    remainingDistanceKm: Number(remainingDistance.toFixed(2)),
    etaHours,
    status,
    hasArrived,
    windSpeedKmh: windSpeed,
  };
}

/**
 * Converts real demo seconds to simulation elapsed hours using an explicit time scale.
 * Example: 30 real seconds represents 3 simulation hours:
 *   timeScale = (3 hours * 3600) / 30 = 360.
 *   10 real seconds * 360 / 3600 = 1.0 simulated hour.
 */
export function calculateSimElapsedHours(realElapsedSeconds: number, simulationTimeScale: number): number {
  const realSec = Math.max(0, Number(realElapsedSeconds) || 0);
  const scale = Math.max(1, Number(simulationTimeScale) || 360);
  const simElapsedSeconds = realSec * scale;
  return simElapsedSeconds / 3600.0;
}

export interface SpeedStep {
  speedKmh: number;
  durationHours: number;
}

export interface VariableSpeedKinematicsInput {
  initialDistanceKm: number;
  speedSteps: SpeedStep[];
  currentSpeedKmh: number;
  windSpeedKmh?: number;
}

/**
 * Computes storm kinematics when speed varies across discrete simulation time steps.
 * distance_travelled = sum(step.speedKmh * step.durationHours)
 * remaining_distance = max(0, initial_distance - distance_travelled)
 * eta_hours = remaining_distance / currentSpeedKmh
 */
export function calculateStormKinematicsVariableSpeed(
  input: VariableSpeedKinematicsInput
): StormKinematicsResult {
  const initialDist = Math.max(0, Number(input.initialDistanceKm) || DEFAULT_STORM_INITIAL_DISTANCE_KM);
  const currentSpeed = Math.max(0.1, Number(input.currentSpeedKmh) || DEFAULT_STORM_MOTION_SPEED_KMH);
  const windSpeed = Number(input.windSpeedKmh) || DEFAULT_BLIZZARD_WIND_KMH;

  let cumulativeTravelled = 0;
  let totalElapsedHours = 0;

  for (const step of input.speedSteps || []) {
    const s = Math.max(0, Number(step.speedKmh) || 0);
    const d = Math.max(0, Number(step.durationHours) || 0);
    cumulativeTravelled += s * d;
    totalElapsedHours += d;
  }

  const remainingDistance = Math.max(0, initialDist - cumulativeTravelled);
  const etaHours = remainingDistance > 0 ? Number((remainingDistance / currentSpeed).toFixed(2)) : 0.0;
  const hasArrived = remainingDistance <= 0.001;
  const status: 'APPROACHING' | 'ARRIVED' = hasArrived ? 'ARRIVED' : 'APPROACHING';

  return {
    initialDistanceKm: initialDist,
    stormMotionSpeedKmh: currentSpeed,
    elapsedSimulationHours: Number(totalElapsedHours.toFixed(3)),
    distanceTravelledKm: Number(cumulativeTravelled.toFixed(2)),
    remainingDistanceKm: Number(remainingDistance.toFixed(2)),
    etaHours,
    status,
    hasArrived,
    windSpeedKmh: windSpeed,
  };
}

/**
 * Maps physical distance in km to normalized radar radius ratio [0.0, 1.0].
 * 0.0 represents the central station (0 km).
 * 1.0 represents the maximum outer perimeter (e.g. 200 km).
 */
export function mapDistanceToRadarRadiusRatio(
  remainingDistanceKm: number,
  maxRadarRangeKm: number = DEFAULT_RADAR_MAX_RANGE_KM
): number {
  const dist = Math.max(0, remainingDistanceKm);
  const maxRange = Math.max(1, maxRadarRangeKm);
  return Math.min(1.0, dist / maxRange);
}

