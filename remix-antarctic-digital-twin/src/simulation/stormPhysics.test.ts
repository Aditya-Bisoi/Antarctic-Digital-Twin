/**
 * stormPhysics.test.ts — Automated Unit Tests for Storm Kinematics
 * Validates all 7 test cases directly in TypeScript.
 */

import {
  calculateStormKinematics,
  calculateStormKinematicsVariableSpeed,
  calculateSimElapsedHours,
  mapDistanceToRadarRadiusRatio,
} from './stormPhysics';


export function runStormPhysicsTests() {
  const results: { test: string; passed: boolean; details: any }[] = [];

  // TEST 1: Initial distance = 180 km, Speed = 60 km/h, Elapsed = 0 h -> distance = 180 km, ETA = 3 h
  const t1 = calculateStormKinematics({
    initialDistanceKm: 180,
    stormMotionSpeedKmh: 60,
    elapsedSimulationHours: 0,
    windSpeedKmh: 115,
  });
  const pass1 = t1.remainingDistanceKm === 180 && t1.etaHours === 3 && t1.status === 'APPROACHING';
  results.push({ test: 'TEST 1: T+0h initial distance 180km, ETA 3h', passed: pass1, details: t1 });

  // TEST 2: Initial distance = 180 km, Speed = 60 km/h, Elapsed = 1 h -> distance = 120 km, ETA = 2 h
  const t2 = calculateStormKinematics({
    initialDistanceKm: 180,
    stormMotionSpeedKmh: 60,
    elapsedSimulationHours: 1,
    windSpeedKmh: 115,
  });
  const pass2 = t2.remainingDistanceKm === 120 && t2.etaHours === 2 && t2.status === 'APPROACHING';
  results.push({ test: 'TEST 2: T+1h distance 120km, ETA 2h', passed: pass2, details: t2 });

  // TEST 3: Elapsed = 2 h -> distance = 60 km, ETA = 1 h
  const t3 = calculateStormKinematics({
    initialDistanceKm: 180,
    stormMotionSpeedKmh: 60,
    elapsedSimulationHours: 2,
    windSpeedKmh: 115,
  });
  const pass3 = t3.remainingDistanceKm === 60 && t3.etaHours === 1 && t3.status === 'APPROACHING';
  results.push({ test: 'TEST 3: T+2h distance 60km, ETA 1h', passed: pass3, details: t3 });

  // TEST 4: Elapsed = 3 h -> distance = 0 km, ETA = 0, status = ARRIVED
  const t4 = calculateStormKinematics({
    initialDistanceKm: 180,
    stormMotionSpeedKmh: 60,
    elapsedSimulationHours: 3,
    windSpeedKmh: 115,
  });
  const pass4 = t4.remainingDistanceKm === 0 && t4.etaHours === 0 && t4.status === 'ARRIVED';
  results.push({ test: 'TEST 4: T+3h distance 0km, ETA 0h, ARRIVED', passed: pass4, details: t4 });

  // TEST 5: Elapsed = 4 h -> distance = 0 km, NOT -60 km
  const t5 = calculateStormKinematics({
    initialDistanceKm: 180,
    stormMotionSpeedKmh: 60,
    elapsedSimulationHours: 4,
    windSpeedKmh: 115,
  });
  const pass5 = t5.remainingDistanceKm === 0 && t5.remainingDistanceKm !== -60 && t5.etaHours === 0;
  results.push({ test: 'TEST 5: T+4h clamped to 0km (never negative)', passed: pass5, details: t5 });

  // TEST 6: Wind speed = 115 km/h, Storm movement speed = 60 km/h -> wind_speed != storm_movement_speed
  const t6 = calculateStormKinematics({
    initialDistanceKm: 180,
    stormMotionSpeedKmh: 60,
    elapsedSimulationHours: 1,
    windSpeedKmh: 115,
  });
  const pass6 = t6.windSpeedKmh !== t6.stormMotionSpeedKmh && t6.windSpeedKmh === 115 && t6.stormMotionSpeedKmh === 60;
  results.push({ test: 'TEST 6: wind speed (115) != storm speed (60)', passed: pass6, details: t6 });

  // TEST 7: Change simulation time scale -> physical trajectory remains correct
  const simHoursScale360 = calculateSimElapsedHours(10, 360);   // 1.0 h
  const simHoursScale1080 = calculateSimElapsedHours(10 / 3, 1080); // 1.0 h
  const t7a = calculateStormKinematics({ initialDistanceKm: 180, stormMotionSpeedKmh: 60, elapsedSimulationHours: simHoursScale360 });
  const t7b = calculateStormKinematics({ initialDistanceKm: 180, stormMotionSpeedKmh: 60, elapsedSimulationHours: simHoursScale1080 });
  const pass7 = t7a.remainingDistanceKm === 120 && t7b.remainingDistanceKm === 120 && t7a.etaHours === 2;
  results.push({ test: 'TEST 7: Time scale conversion invariance', passed: pass7, details: { t7a, t7b } });

  // TEST 8: Variable storm speed over discrete simulation steps
  const t8 = calculateStormKinematicsVariableSpeed({
    initialDistanceKm: 180,
    speedSteps: [
      { speedKmh: 60, durationHours: 1 },
      { speedKmh: 70, durationHours: 1 },
    ],
    currentSpeedKmh: 70,
    windSpeedKmh: 115,
  });
  const pass8 = t8.distanceTravelledKm === 130 && t8.remainingDistanceKm === 50 && t8.etaHours === 0.71;
  results.push({ test: 'TEST 8: Variable speed cumulative integration (130km travelled, 50km remaining)', passed: pass8, details: t8 });

  return results;
}

const tests = runStormPhysicsTests();
let allPass = true;
for (const t of tests) {
  if (!t.passed) {
    console.error(`FAIL: ${t.test}`, t.details);
    allPass = false;
  } else {
    console.log(`PASS: ${t.test}`);
  }
}
if (!allPass) process.exit(1);
console.log(`All ${tests.length} tests passed successfully!`);


