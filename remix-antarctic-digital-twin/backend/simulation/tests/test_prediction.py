"""
test_prediction.py — Tests for predictive failure analysis
Antarctic Digital Twin — SIH26060
"""

from django.test import TestCase
from simulation.engine import SimulationEngine
from simulation.prediction import generate_predictions, get_abnormal_factors


class PredictiveEngineTestCase(TestCase):
    def test_predictions_generation(self):
        engine = SimulationEngine(station_id='maitri')
        preds = generate_predictions(engine.state)

        self.assertGreater(len(preds), 0)
        # Predictions sorted by failure probability descending
        for i in range(len(preds) - 1):
            self.assertGreaterEqual(preds[i].failure_probability, preds[i + 1].failure_probability)

    def test_abnormal_factors_detection(self):
        engine = SimulationEngine(station_id='maitri')
        gen = engine.state.equipment[0]

        # Trigger abnormal conditions
        gen.temperature = 98.0  # above max 90°C
        gen.vibration = 36.0    # above max 30
        gen.health = 45.0       # below 60%

        factors = get_abnormal_factors(gen)
        params = [f.parameter for f in factors]

        self.assertIn('Operating Temperature', params)
        self.assertIn('Vibration Level', params)
        self.assertIn('Component Health', params)
