"""
test_engine.py — Tests for SimulationEngine determinism and physics integration
Antarctic Digital Twin — SIH26060
"""

from django.test import TestCase
from simulation.engine import SimulationEngine


class SimulationEngineTestCase(TestCase):
    def test_engine_initialization(self):
        engine_maitri = SimulationEngine(station_id='maitri')
        self.assertEqual(engine_maitri.state.station_name, 'Maitri Station')
        self.assertEqual(engine_maitri.state.simulation_hour, 0.0)
        self.assertGreater(len(engine_maitri.state.equipment), 0)

        engine_bharati = SimulationEngine(station_id='bharati')
        self.assertEqual(engine_bharati.state.station_name, 'Bharati Station')

    def test_engine_determinism(self):
        # Two engines with same initial state must produce exact same state after N hours
        engine1 = SimulationEngine(station_id='maitri')
        engine2 = SimulationEngine(station_id='maitri')

        engine1.advance_by_hours(12.0)
        engine2.advance_by_hours(12.0)

        s1 = engine1.get_state_dict()
        s2 = engine2.get_state_dict()

        self.assertAlmostEqual(s1['simulation_hour'], s2['simulation_hour'], places=4)
        self.assertEqual(s1['risk_level'], s2['risk_level'])
        self.assertEqual(s1['resilience_score'], s2['resilience_score'])
        self.assertAlmostEqual(s1['energy']['total_consumption_kw'], s2['energy']['total_consumption_kw'], places=2)
        self.assertAlmostEqual(s1['logistics']['fuel_endurance_days'], s2['logistics']['fuel_endurance_days'], places=2)

    def test_engine_fork(self):
        engine = SimulationEngine(station_id='maitri')
        engine.advance_by_hours(6.0)

        forked = engine.fork()
        self.assertAlmostEqual(forked.state.simulation_hour, 6.0, places=2)

        # Modifying forked does not affect original
        forked.advance_by_hours(6.0)
        self.assertAlmostEqual(engine.state.simulation_hour, 6.0, places=2)
        self.assertAlmostEqual(forked.state.simulation_hour, 12.0, places=2)

    def test_snapshot_creation(self):
        engine = SimulationEngine(station_id='maitri')
        engine.advance_by_hours(3.0)
        snapshot = engine.create_snapshot()

        self.assertIn('hour', snapshot)
        self.assertIn('state', snapshot)
        self.assertAlmostEqual(snapshot['hour'], 3.0, places=2)
