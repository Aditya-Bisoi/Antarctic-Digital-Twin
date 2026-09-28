"""
test_ai_optimizer_decision.py — Tests for AI Decision Support, Optimizer & ML Predictions
Antarctic Digital Twin — SIH26060
"""

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from stations.models import Station
from simulation.models import SimulationRun, Equipment
from simulation.engine import SimulationEngine
from simulation.optimizer import (
    optimize_decisions,
    optimize_decisions_detailed,
    validate_hard_safety_constraints,
    get_situation_weights,
    DEFAULT_HORIZON,
)
from simulation.ai_decision_support import RuleBasedInsightProvider, generate_decision_support
from simulation.ml.predict import get_equipment_ml_prediction


class DecisionOptimizerTestCase(TestCase):
    def setUp(self):
        self.station = Station.objects.create(
            id='maitri',
            name='Maitri Research Station',
            region='Queen Maud Land',
            status='ACTIVE',
            commissioned_year=1989,
            coordinates={'latitude': -70.767, 'longitude': 11.733}
        )
        self.engine = SimulationEngine(station_id='maitri')

    def test_configurable_horizons(self):
        """Validates that optimizer executes forward simulation across configurable horizons."""
        for horizon in [6, 12, 24, 48, 72, 168]:
            result = optimize_decisions_detailed(self.engine, horizon_hours=horizon)
            self.assertEqual(result['horizon_hours'], horizon)
            self.assertIn('recommended_plan', result)
            self.assertIn('baseline_outcome', result)
            self.assertIn('predicted_outcome', result)

    def test_situation_aware_weights(self):
        """Validates dynamic weight adjustment based on dominant hazard."""
        # Baseline state
        hazard_def, weights_def = get_situation_weights(self.engine.state)
        self.assertEqual(hazard_def, 'default')

        # Blizzard simulation
        self.engine.state.environment.wind_speed = 115.0
        self.engine.state.active_scenarios = ['extreme_storm']
        hazard_storm, weights_storm = get_situation_weights(self.engine.state)
        self.assertEqual(hazard_storm, 'storm')
        self.assertGreaterEqual(weights_storm.get('crew_safety', 0), 0.20)
        self.assertGreaterEqual(weights_storm.get('indoor_heating', 0), 0.15)

        # Fuel shortage simulation
        self.engine.state.environment.wind_speed = 20.0
        self.engine.state.active_scenarios = ['fuel_shortage']
        self.engine.state.logistics.fuel_endurance_days = 8.0
        hazard_fuel, weights_fuel = get_situation_weights(self.engine.state)
        self.assertEqual(hazard_fuel, 'fuel_shortage')
        self.assertGreaterEqual(weights_fuel.get('fuel_endurance', 0), 0.30)

    def test_hard_safety_constraints(self):
        """Validates enforcement of hard safety constraints."""
        # Safe state
        passed, violations = validate_hard_safety_constraints(self.engine.state)
        self.assertTrue(passed)
        self.assertEqual(len(violations), 0)

        # Freezing indoor temperature violation
        forked = self.engine.fork()
        forked.state.infrastructure.indoor_temp_avg = 7.5
        passed_cold, cold_violations = validate_hard_safety_constraints(forked.state)
        self.assertFalse(passed_cold)
        self.assertTrue(any('temperature' in v.lower() for v in cold_violations))

        # Critical power deficit violation
        forked_power = self.engine.fork()
        forked_power.state.energy.power_deficit_kw = 25.0
        passed_power, power_violations = validate_hard_safety_constraints(forked_power.state)
        self.assertFalse(passed_power)
        self.assertTrue(any('deficit' in v.lower() for v in power_violations))

    def test_ai_decision_support_provider(self):
        """Validates rule-based AI provider creates grounded, explainable recommendations."""
        opt_res = optimize_decisions_detailed(self.engine, horizon_hours=24)
        context = {
            'station': {'id': 'maitri', 'name': 'Maitri'},
            'current_state': self.engine.get_state_dict(),
            'hazards': [],
            'failures': [],
            'risk': {'risk_level': 'LOW', 'reasons': []},
            'resilience': {'resilience_score': 85.0, 'factors': []},
            'predictions': [],
            'baseline': opt_res['baseline_outcome'],
            'optimizer': opt_res,
            'candidate_plans': opt_res['alternatives'],
        }

        provider = RuleBasedInsightProvider()
        res = provider.generate_decision_support(context)

        self.assertIn('situation_summary', res)
        self.assertIn('recommended_action', res)
        self.assertIn('why', res)
        self.assertIn('expected_effects', res)
        self.assertIn('tradeoffs', res)
        self.assertIn('urgency', res)
        self.assertIn('confidence', res)
        self.assertIsInstance(res['why'], list)
        self.assertGreater(len(res['why']), 0)

    def test_equipment_ml_prediction(self):
        """Validates ML predictor returns probability, factors, and model version."""
        eq_data = {
            'id': 'gen-1',
            'name': 'Primary Diesel Generator #1',
            'category': 'generator',
            'health': 45.0,
            'temperature': 98.0,  # elevated
            'vibration': 34.0,    # elevated
            'efficiency': 0.81,
            'load_percent': 85.0,
            'operating_hours': 8500.0,
            'maintenance_age_days': 60.0,
        }

        pred = get_equipment_ml_prediction(eq_data)
        self.assertIn('failure_probability', pred)
        self.assertIn('model_version', pred)
        self.assertIn('trend', pred)
        self.assertIn('factors', pred)
        self.assertGreater(pred['failure_probability'], 0.3)
        self.assertGreater(len(pred['factors']), 0)


class DecisionSupportAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.station = Station.objects.create(
            id='maitri',
            name='Maitri Research Station',
            region='Queen Maud Land',
            status='ACTIVE',
            commissioned_year=1989,
            coordinates={'latitude': -70.767, 'longitude': 11.733}
        )
        self.equipment = Equipment.objects.create(
            station=self.station,
            identifier='gen-1',
            name='Main Generator 1',
            equipment_type='generator',
            status='operational',
            health_percentage=85.0,
            temperature=65.0,
            vibration=12.0,
            efficiency=0.92,
            load_percentage=70.0,
            operating_hours=4000.0,
        )
        self.run = SimulationRun.objects.create(
            station=self.station,
            name='Test Decision Run',
            status='running',
        )

    def test_decision_support_endpoint(self):
        """Validates POST /api/simulations/{id}/decision-support/ endpoint contract."""
        url = f'/api/simulations/{self.run.id}/decision-support/'
        res = self.client.post(url, {'horizon_hours': 24}, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()

        # Schema checks
        self.assertIn('situation', data)
        self.assertIn('risk', data)
        self.assertIn('resilience', data)
        self.assertIn('predictions', data)
        self.assertIn('baseline', data)
        self.assertIn('optimizer', data)
        self.assertIn('recommendation', data)
        self.assertIn('explanation', data)
        self.assertIn('traceability', data)
        self.assertIn('timestamp', data)

        # Traceability validation
        trace = data['traceability']
        self.assertEqual(trace['simulation_id'], str(self.run.id))
        self.assertEqual(trace['station_id'], 'maitri')
        self.assertEqual(trace['simulation_horizon'], 24)
        self.assertIn('model_version', trace)

    def test_equipment_prediction_endpoint(self):
        """Validates GET /api/stations/{id}/equipment/{equipment_id}/prediction/ endpoint contract."""
        url = f'/api/stations/maitri/equipment/gen-1/prediction/'
        res = self.client.get(url)

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()

        self.assertEqual(data['equipment_id'], 'gen-1')
        self.assertIn('failure_probability', data)
        self.assertIn('prediction_window_hours', data)
        self.assertIn('trend', data)
        self.assertIn('factors', data)
        self.assertIn('recommended_maintenance', data)
        self.assertIn('model_version', data)
