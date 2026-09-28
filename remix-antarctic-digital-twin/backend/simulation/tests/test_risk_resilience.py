"""
test_risk_resilience.py — Tests for risk and resilience calculation engines
Antarctic Digital Twin — SIH26060
"""

from django.test import TestCase
from simulation.engine import SimulationEngine
from simulation.risk import evaluate_risk
from simulation.resilience import evaluate_resilience


class RiskResilienceTestCase(TestCase):
    def test_nominal_risk_and_resilience(self):
        engine = SimulationEngine(station_id='maitri')
        risk_level, reasons = evaluate_risk(engine.state)
        self.assertEqual(risk_level, 'LOW')

        score, factors = evaluate_resilience(engine.state)
        self.assertGreaterEqual(score, 70)
        self.assertEqual(len(factors), 8)

    def test_critical_risk_trigger(self):
        engine = SimulationEngine(station_id='maitri')
        # Simulate severe multi-hazard
        engine.state.environment.temperature = -60.0
        engine.state.energy.power_deficit_kw = 80.0
        engine.state.logistics.fuel_endurance_days = 3.0
        engine.state.crew.safety_risk = 'CRITICAL'
        engine.state.communication.status = 'Offline'
        engine.state.infrastructure.heating_system_status = 'Failed'
        for eq in engine.state.equipment:
            eq.is_online = False
            eq.health = 0.0

        risk_level, reasons = evaluate_risk(engine.state)
        self.assertEqual(risk_level, 'CRITICAL')
        self.assertTrue(any(r.severity == 'critical' for r in reasons))

        score, factors = evaluate_resilience(engine.state)
        self.assertLess(score, 50)
