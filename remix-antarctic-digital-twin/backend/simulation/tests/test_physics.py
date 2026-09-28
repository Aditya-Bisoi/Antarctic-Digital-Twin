"""
test_physics.py — Tests for physics formulas
Antarctic Digital Twin — SIH26060
"""

from django.test import TestCase
from simulation.physics import (
    clamp,
    calculate_wind_chill,
    calculate_heating_demand,
    calculate_generator_load,
    calculate_fuel_rate,
    calculate_fuel_endurance,
    calculate_effective_output,
    calculate_battery_change,
    calculate_solar_factor,
    calculate_wind_generation,
    calculate_indoor_temperature,
    calculate_crew_safety_risk,
    calculate_communication_quality,
)


class PhysicsFormulasTestCase(TestCase):
    def test_clamp(self):
        self.assertEqual(clamp(5, 0, 10), 5)
        self.assertEqual(clamp(-5, 0, 10), 0)
        self.assertEqual(clamp(15, 0, 10), 10)

    def test_wind_chill(self):
        # Temperature -20°C, wind 40 km/h should be significantly colder than -20°C
        wc = calculate_wind_chill(-20.0, 40.0)
        self.assertLess(wc, -20.0)
        self.assertGreater(wc, -70.0)

    def test_heating_demand(self):
        # Colder ambient and higher wind must increase heating demand
        base_demand = calculate_heating_demand(50.0, -10.0, -10.0, 10.0, 0.9)
        colder_demand = calculate_heating_demand(50.0, -10.0, -30.0, 10.0, 0.9)
        windy_demand = calculate_heating_demand(50.0, -10.0, -10.0, 70.0, 0.9)

        self.assertGreater(colder_demand, base_demand)
        self.assertGreater(windy_demand, base_demand)

    def test_generator_load_and_fuel_rate(self):
        load = calculate_generator_load(80.0, 100.0)
        self.assertAlmostEqual(load, 80.0, places=1)

        fuel_rate = calculate_fuel_rate(80.0, 100.0)
        self.assertGreater(fuel_rate, 0.0)
        self.assertLess(fuel_rate, 50.0)

        endurance = calculate_fuel_endurance(2400.0, 10.0)
        self.assertAlmostEqual(endurance, 10.0, places=1)  # 2400 / (10 * 24) = 10 days

    def test_battery_change(self):
        # Deficit of 20 kW should discharge battery
        new_soc, charge_rate, discharge_rate, is_charging = calculate_battery_change(-20.0, 100.0, 50.0, 1.0)
        self.assertLess(new_soc, 50.0)
        self.assertGreater(discharge_rate, 0.0)
        self.assertFalse(is_charging)

        # Surplus of 20 kW should charge battery
        new_soc_chg, charge_rate_chg, discharge_rate_chg, is_charging_chg = calculate_battery_change(20.0, 100.0, 50.0, 1.0)
        self.assertGreater(new_soc_chg, 50.0)
        self.assertGreater(charge_rate_chg, 0.0)
        self.assertTrue(is_charging_chg)

    def test_renewable_generation(self):
        solar_factor = calculate_solar_factor(12.0, 30.0)
        self.assertGreater(solar_factor, 0.0)
        self.assertLessEqual(solar_factor, 1.0)

        wind_gen = calculate_wind_generation(45.0)
        self.assertGreater(wind_gen, 0.0)
        self.assertLessEqual(wind_gen, 30.0)

        # In extreme hurricane winds > 100 km/h, turbine locks to 0
        wind_locked = calculate_wind_generation(105.0)
        self.assertEqual(wind_locked, 0.0)
