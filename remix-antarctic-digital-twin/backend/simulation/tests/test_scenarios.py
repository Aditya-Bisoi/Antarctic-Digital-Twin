"""
test_scenarios.py — Tests for scenario triggers and hazard events
Antarctic Digital Twin — SIH26060
"""

from django.test import TestCase
from simulation.engine import SimulationEngine
from simulation.scenarios import SCENARIO_DEFINITIONS, apply_scenario_event


class ScenariosTestCase(TestCase):
    def test_scenarios_catalog_count(self):
        self.assertEqual(len(SCENARIO_DEFINITIONS), 13)

    def test_generator_failure_scenario(self):
        engine = SimulationEngine(station_id='maitri')
        self.assertTrue(engine.state.energy.generators[0].is_online)

        # Apply generator failure event
        apply_scenario_event(engine, 'generator_failure', 'gen_fail', {'which_generator': 'gen1'})

        # Generator 1 should now be offline
        gen1 = next(g for g in engine.state.energy.generators if g.id == 'gen1')
        self.assertFalse(gen1.is_online)
        self.assertEqual(gen1.status, 'Failed')

    def test_extreme_cold_scenario(self):
        engine = SimulationEngine(station_id='maitri')
        apply_scenario_event(engine, 'extreme_cold', 'cold_peak', {})

        # Ambient temperature should drop towards -52°C
        self.assertLess(engine.state.environment.temperature, -28.0)
