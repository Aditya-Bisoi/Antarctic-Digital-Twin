"""
test_physically_consistent_storm.py — Comprehensive Physical Consistency Test Suite
Antarctic Digital Twin — SIH26060

Validates all 7 required test cases from Section 18:
  TEST 1: Initial distance = 180 km, Speed = 60 km/h, Elapsed = 0 h -> distance = 180 km, ETA = 3 h
  TEST 2: Initial distance = 180 km, Speed = 60 km/h, Elapsed = 1 h -> distance = 120 km, ETA = 2 h
  TEST 3: Elapsed = 2 h -> distance = 60 km, ETA = 1 h
  TEST 4: Elapsed = 3 h -> distance = 0 km, ETA = 0, status = ARRIVED
  TEST 5: Elapsed = 4 h -> distance = 0 km, NOT -60 km
  TEST 6: Wind speed = 115 km/h, Storm movement speed = 60 km/h -> wind_speed != storm_movement_speed
  TEST 7: Simulation time scale change -> physical trajectory remains correct in simulation time
"""

from django.test import TestCase
from simulation.storm_physics import calculate_storm_kinematics, calculate_sim_elapsed_hours


class PhysicallyConsistentStormTestCase(TestCase):
    def setUp(self):
        self.initial_dist = 180.0
        self.storm_speed = 60.0
        self.wind_speed = 115.0

    def test_case_1_t0_initial_conditions(self):
        """TEST 1: T+0h -> remaining distance = 180 km, ETA = 3 h"""
        res = calculate_storm_kinematics(
            initial_distance_km=self.initial_dist,
            storm_motion_speed_kmh=self.storm_speed,
            elapsed_simulation_hours=0.0,
            wind_speed_kmh=self.wind_speed
        )
        self.assertEqual(res['remaining_distance_km'], 180.0)
        self.assertEqual(res['eta_hours'], 3.0)
        self.assertEqual(res['distance_travelled_km'], 0.0)
        self.assertEqual(res['status'], 'APPROACHING')
        self.assertFalse(res['has_arrived'])

    def test_case_2_t1_one_hour_elapsed(self):
        """TEST 2: T+1h -> remaining distance = 120 km, ETA = 2 h"""
        res = calculate_storm_kinematics(
            initial_distance_km=self.initial_dist,
            storm_motion_speed_kmh=self.storm_speed,
            elapsed_simulation_hours=1.0,
            wind_speed_kmh=self.wind_speed
        )
        self.assertEqual(res['remaining_distance_km'], 120.0)
        self.assertEqual(res['eta_hours'], 2.0)
        self.assertEqual(res['distance_travelled_km'], 60.0)
        self.assertEqual(res['status'], 'APPROACHING')

    def test_case_3_t2_two_hours_elapsed(self):
        """TEST 3: T+2h -> remaining distance = 60 km, ETA = 1 h"""
        res = calculate_storm_kinematics(
            initial_distance_km=self.initial_dist,
            storm_motion_speed_kmh=self.storm_speed,
            elapsed_simulation_hours=2.0,
            wind_speed_kmh=self.wind_speed
        )
        self.assertEqual(res['remaining_distance_km'], 60.0)
        self.assertEqual(res['eta_hours'], 1.0)
        self.assertEqual(res['distance_travelled_km'], 120.0)
        self.assertEqual(res['status'], 'APPROACHING')

    def test_case_4_t3_three_hours_arrival(self):
        """TEST 4: T+3h -> remaining distance = 0 km, ETA = 0, status = ARRIVED"""
        res = calculate_storm_kinematics(
            initial_distance_km=self.initial_dist,
            storm_motion_speed_kmh=self.storm_speed,
            elapsed_simulation_hours=3.0,
            wind_speed_kmh=self.wind_speed
        )
        self.assertEqual(res['remaining_distance_km'], 0.0)
        self.assertEqual(res['eta_hours'], 0.0)
        self.assertEqual(res['distance_travelled_km'], 180.0)
        self.assertEqual(res['status'], 'ARRIVED')
        self.assertTrue(res['has_arrived'])

    def test_case_5_t4_overrun_clamped_to_zero(self):
        """TEST 5: T+4h -> remaining distance = 0 km, NOT -60 km"""
        res = calculate_storm_kinematics(
            initial_distance_km=self.initial_dist,
            storm_motion_speed_kmh=self.storm_speed,
            elapsed_simulation_hours=4.0,
            wind_speed_kmh=self.wind_speed
        )
        self.assertEqual(res['remaining_distance_km'], 0.0)
        self.assertNotEqual(res['remaining_distance_km'], -60.0)
        self.assertEqual(res['eta_hours'], 0.0)
        self.assertEqual(res['status'], 'ARRIVED')

    def test_case_6_wind_vs_storm_speed_distinction(self):
        """TEST 6: Verify wind_speed (115 km/h) != storm_movement_speed (60 km/h)"""
        res = calculate_storm_kinematics(
            initial_distance_km=self.initial_dist,
            storm_motion_speed_kmh=self.storm_speed,
            elapsed_simulation_hours=1.0,
            wind_speed_kmh=self.wind_speed
        )
        self.assertNotEqual(res['wind_speed_kmh'], res['storm_motion_speed_kmh'])
        self.assertEqual(res['wind_speed_kmh'], 115.0)
        self.assertEqual(res['storm_motion_speed_kmh'], 60.0)
        # Verify ETA is computed strictly from storm_motion_speed, NOT wind_speed
        expected_eta_from_motion = res['remaining_distance_km'] / res['storm_motion_speed_kmh']
        self.assertEqual(res['eta_hours'], round(expected_eta_from_motion, 2))
        wrong_eta_from_wind = res['remaining_distance_km'] / res['wind_speed_kmh']
        self.assertNotEqual(res['eta_hours'], round(wrong_eta_from_wind, 2))

    def test_case_7_simulation_time_scale_invariance(self):
        """TEST 7: Physical trajectory is identical in simulation time regardless of real-time scale."""
        # Scale A: 30 real seconds represents 3 simulation hours (scale = 360)
        scale_a = 360.0
        # Scale B: 10 real seconds represents 3 simulation hours (scale = 1080)
        scale_b = 1080.0

        # At T = 1.0 simulation hour:
        # Under Scale A: 10 real seconds elapse
        sim_hours_a = calculate_sim_elapsed_hours(10.0, scale_a)
        # Under Scale B: 3.333 real seconds elapse
        sim_hours_b = calculate_sim_elapsed_hours(10.0 / 3.0, scale_b)

        self.assertAlmostEqual(sim_hours_a, 1.0, places=2)
        self.assertAlmostEqual(sim_hours_b, 1.0, places=2)

        res_a = calculate_storm_kinematics(180.0, 60.0, sim_hours_a)
        res_b = calculate_storm_kinematics(180.0, 60.0, sim_hours_b)

        # Both produce identical physical remaining distance (120 km) and ETA (2.0h)
        self.assertEqual(res_a['remaining_distance_km'], 120.0)
        self.assertEqual(res_b['remaining_distance_km'], 120.0)
        self.assertEqual(res_a['eta_hours'], 2.0)
        self.assertEqual(res_b['eta_hours'], 2.0)

    def test_case_8_variable_storm_speed_history(self):
        """TEST 8 (Section 8): Variable speed uses cumulative integration, NOT current_speed * total_time."""
        from simulation.storm_physics import calculate_storm_kinematics_variable_speed
        # Initial distance: 180 km
        # Hour 0->1: 60 km/h (60 km)
        # Hour 1->2: 70 km/h (70 km)
        speed_steps = [
            (60.0, 1.0),
            (70.0, 1.0),
        ]
        res = calculate_storm_kinematics_variable_speed(
            initial_distance_km=180.0,
            speed_steps=speed_steps,
            current_speed_kmh=70.0,
            wind_speed_kmh=115.0
        )
        # Cumulative travelled = 60 + 70 = 130 km
        # Remaining = 180 - 130 = 50 km
        # If naive (current_speed * total_time = 70 * 2 = 140km -> remaining 40km), that would fail
        self.assertEqual(res['distance_travelled_km'], 130.0)
        self.assertEqual(res['remaining_distance_km'], 50.0)
        self.assertEqual(res['eta_hours'], round(50.0 / 70.0, 2))
        self.assertEqual(res['status'], 'APPROACHING')

