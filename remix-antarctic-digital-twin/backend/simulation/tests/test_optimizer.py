"""
test_optimizer.py — Tests for multi-objective decision optimizer
Antarctic Digital Twin — SIH26060
"""

from django.test import TestCase
from simulation.engine import SimulationEngine
from simulation.optimizer import optimize_decisions, evaluate_plan


class DecisionOptimizerTestCase(TestCase):
    def test_optimizer_execution(self):
        engine = SimulationEngine(station_id='maitri')
        # Induce a hazard that makes interventions impactful
        engine.state.energy.power_deficit_kw = 45.0

        plans = optimize_decisions(engine)
        self.assertGreater(len(plans), 0)

        # Ranked descending
        for idx in range(len(plans) - 1):
            self.assertGreaterEqual(
                plans[idx].scores.overall_score,
                plans[idx + 1].scores.overall_score
            )
            self.assertEqual(plans[idx].rank, idx + 1)
            self.assertGreater(len(plans[idx].reasoning), 0)
