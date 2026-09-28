"""
test_interventions.py — Tests for operational interventions
Antarctic Digital Twin — SIH26060
"""

from django.test import TestCase
from simulation.engine import SimulationEngine
from simulation.interventions import (
    INTERVENTIONS,
    get_intervention_by_id,
    get_available_interventions,
)


class InterventionsTestCase(TestCase):
    def test_interventions_catalog(self):
        self.assertEqual(len(INTERVENTIONS), 9)

    def test_start_backup_generator(self):
        engine = SimulationEngine(station_id='maitri')
        intervention = get_intervention_by_id('start_backup_generator')
        self.assertIsNotNone(intervention)

        self.assertTrue(intervention.is_available(engine.state))
        intervention.apply(engine)

        self.assertTrue(engine.state.energy.backup_generator.is_online)
        self.assertIn('start_backup_generator', engine.state.active_interventions)

        # Revert
        intervention.revert(engine)
        self.assertFalse(engine.state.energy.backup_generator.is_online)
        self.assertNotIn('start_backup_generator', engine.state.active_interventions)

    def test_load_shedding(self):
        engine = SimulationEngine(station_id='maitri')
        intervention = get_intervention_by_id('reduce_noncritical_loads')
        self.assertIsNotNone(intervention)

        intervention.apply(engine)
        self.assertIn('reduce_noncritical_loads', engine.state.active_interventions)

        # Advance engine and verify load reduction
        engine.advance_by_hours(1.0)
        consumption_reduced = engine.state.energy.total_consumption_kw

        # Clean baseline engine comparison
        base_engine = SimulationEngine(station_id='maitri')
        base_engine.advance_by_hours(1.0)
        self.assertLess(consumption_reduced, base_engine.state.energy.total_consumption_kw)
