"""
test_dynamic_intervention_optimizer.py — Comprehensive Test Suite for Dynamic Intervention Optimization
Antarctic Digital Twin — SIH26060

Tests:
1. Physical problem diagnosis from digital twin telemetry
2. Feasibility validation and prerequisite-based pruning
3. Dynamic problem-targeted combination generation
4. Forward simulation of candidates vs no-intervention baseline
5. State-dependent sensitivity (different recommendations for same scenario with different station states)
6. Hard safety constraints enforcement
7. ML predictive failure integration into candidate selection
8. REST API endpoints for candidate interventions and decision support
"""

import copy
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from stations.models import Station
from simulation.models import SimulationRun, Scenario
from simulation.engine import SimulationEngine
from simulation.state import StationState
from simulation.intervention_generator import (
    InterventionCandidateGenerator,
    StateProblemIdentifier,
    get_available_resources,
    STRUCTURED_INTERVENTIONS,
    IdentifiedProblem,
)
from simulation.optimizer import (
    optimize_decisions,
    optimize_decisions_detailed,
    evaluate_plan,
    validate_hard_safety_constraints,
)


class DynamicInterventionOptimizationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.station = Station.objects.create(
            id='maitri',
            name='Maitri Station',
            region='Schirmacher Oasis, East Antarctica',
            coordinates='70°45\'57"S 11°44\'09"E',
            status='Online',
            commissioned_year=1989,
            elevation='117 m',
            description='Indian Antarctic Research Station',
            image='/images/maitri.jpg',
        )
        self.scenario = Scenario.objects.create(
            scenario_id='storm',
            name='Antarctic Storm',
            description='Severe katabatic storm with generator stress.',
            severity='critical',
            category='meteorological',
        )
        self.sim_run = SimulationRun.objects.create(
            station=self.station,
            scenario=self.scenario,
            name='Test Dynamic Optimization Run',
            status='active',
        )

    def test_problem_diagnosis_from_telemetry(self):
        """Verify that StateProblemIdentifier diagnoses actual physical threats from state."""
        engine = SimulationEngine(station_id='maitri')
        state = engine.state

        # Induce specific physical threats
        state.energy.power_deficit_kw = 25.0
        state.energy.battery_level_percent = 22.0
        state.energy.generators[0].load_percent = 98.0
        state.infrastructure.indoor_temp_avg = 14.2
        state.logistics.fuel_endurance_days = 5.0
        state.logistics.next_resupply_days = 20.0
        state.environment.wind_speed = 95.0

        diagnoser = StateProblemIdentifier()
        problems = diagnoser.diagnose(state)

        problem_types = [p.problem_type for p in problems]
        self.assertIn('POWER_DEFICIT', problem_types)
        self.assertIn('BATTERY_DEPLETION', problem_types)
        self.assertIn('GENERATOR_OVERLOAD', problem_types)
        self.assertIn('EXTREME_THERMAL_LOSS', problem_types)
        self.assertIn('FUEL_CRITICAL', problem_types)
        self.assertIn('LOGISTICS_DELAY', problem_types)
        self.assertIn('WEATHER_HAZARD', problem_types)

        # Check detail strings contain physical metrics
        p_def = next(p for p in problems if p.problem_type == 'POWER_DEFICIT')
        self.assertEqual(p_def.severity, 'CRITICAL')
        self.assertIn('25.0 kW', p_def.details)

    def test_dynamic_pruning_backup_generator_broken(self):
        """Verify that start_backup_generator is pruned if backup generator is broken or degraded."""
        engine = SimulationEngine(station_id='maitri')
        state = engine.state
        state.energy.backup_generator.health = 0.0  # Damaged

        generator = InterventionCandidateGenerator()
        feasible = generator.get_feasible_interventions(state)

        backup_item = next(item for item in feasible if item['id'] == 'start_backup_generator')
        self.assertFalse(backup_item['is_feasible'])
        self.assertTrue(any('degraded/broken' in r for r in backup_item['reasons_pruned']))

        # Ensure combinations do not include start_backup_generator
        combos = generator.generate_candidate_combinations(state, feasible, [])
        for combo in combos:
            self.assertNotIn('start_backup_generator', combo)

    def test_dynamic_pruning_renewables_in_blizzard(self):
        """Verify that increase_renewables is pruned when wind exceeds safe cut-off (100 km/h)."""
        engine = SimulationEngine(station_id='maitri')
        state = engine.state
        state.environment.wind_speed = 115.0  # Severe storm

        generator = InterventionCandidateGenerator()
        feasible = generator.get_feasible_interventions(state)

        ren_item = next(item for item in feasible if item['id'] == 'increase_renewables')
        self.assertFalse(ren_item['is_feasible'])
        self.assertTrue(any('100 km/h' in r for r in ren_item['reasons_pruned']))

    def test_dynamic_pruning_resupply_in_extreme_weather(self):
        """Verify emergency_resupply is pruned if storm winds exceed 120 km/h or comms offline."""
        engine = SimulationEngine(station_id='maitri')
        state = engine.state
        state.environment.wind_speed = 125.0

        generator = InterventionCandidateGenerator()
        feasible = generator.get_feasible_interventions(state)

        resupply_item = next(item for item in feasible if item['id'] == 'emergency_resupply')
        self.assertFalse(resupply_item['is_feasible'])
        self.assertTrue(any('120 km/h' in r for r in resupply_item['reasons_pruned']))

    def test_forward_simulation_does_not_mutate_original_state(self):
        """Verify that candidate evaluation uses isolated forks and does not mutate engine state."""
        engine = SimulationEngine(station_id='maitri')
        initial_hour = engine.state.simulation_hour
        initial_battery = engine.state.energy.battery_level_percent

        scores, future_state, constraints = evaluate_plan(
            engine=engine,
            intervention_ids=['reduce_noncritical_loads', 'preserve_battery'],
            horizon_hours=24
        )

        # Original engine state must remain untouched
        self.assertEqual(engine.state.simulation_hour, initial_hour)
        self.assertEqual(engine.state.energy.battery_level_percent, initial_battery)
        self.assertNotIn('reduce_noncritical_loads', engine.state.active_interventions)
        # Future state must reflect 24h forward simulation
        self.assertAlmostEqual(future_state.simulation_hour, initial_hour + 24, places=1)

    def test_state_dependent_sensitivity_healthy_vs_broken_backup(self):
        """
        Verify that the SAME scenario produces DIFFERENT recommendations
        depending on whether the backup generator is healthy vs broken.
        """
        # Case 1: Storm with healthy backup generator
        engine1 = SimulationEngine(station_id='maitri')
        engine1.state.active_scenarios = ['storm']
        engine1.state.environment.wind_speed = 95.0
        engine1.state.energy.power_deficit_kw = 30.0
        engine1.state.energy.backup_generator.health = 95.0
        engine1.state.energy.backup_generator.is_online = False

        plans1 = optimize_decisions(engine1, horizon_hours=24)
        self.assertTrue(len(plans1) > 0)
        rec1_interventions = plans1[0].interventions
        self.assertIn('start_backup_generator', rec1_interventions)

        # Case 2: Same storm with BROKEN backup generator
        engine2 = SimulationEngine(station_id='maitri')
        engine2.state.active_scenarios = ['storm']
        engine2.state.environment.wind_speed = 95.0
        engine2.state.energy.power_deficit_kw = 30.0
        engine2.state.energy.backup_generator.health = 0.0  # Damaged!
        engine2.state.energy.backup_generator.is_online = False

        plans2 = optimize_decisions(engine2, horizon_hours=24)
        self.assertTrue(len(plans2) > 0)
        rec2_interventions = plans2[0].interventions
        # Cannot recommend start_backup_generator because it is broken!
        self.assertNotIn('start_backup_generator', rec2_interventions)
        # Must recommend demand-side mitigations instead
        self.assertTrue(
            'reduce_noncritical_loads' in rec2_interventions or
            'prioritize_critical' in rec2_interventions or
            'preserve_battery' in rec2_interventions
        )

    def test_state_dependent_sensitivity_battery_abundant_vs_depleted(self):
        """
        Verify that 80% battery vs 15% battery produces different priority recommendations.
        """
        # Case 1: Generator deficit with 80% battery
        engine1 = SimulationEngine(station_id='maitri')
        engine1.state.energy.generators[0].is_online = False
        engine1.state.energy.battery_level_percent = 80.0
        plans1 = optimize_decisions(engine1, horizon_hours=24)

        # Case 2: Same deficit with 15% battery (critically depleted)
        engine2 = SimulationEngine(station_id='maitri')
        engine2.state.energy.generators[0].is_online = False
        engine2.state.energy.battery_level_percent = 15.0
        plans2 = optimize_decisions(engine2, horizon_hours=24)

        # In Case 2, diagnosed problems include BATTERY_DEPLETION (CRITICAL)
        cand_gen = InterventionCandidateGenerator()
        problems1 = cand_gen.problem_diagnoser.diagnose(engine1.state)
        problems2 = cand_gen.problem_diagnoser.diagnose(engine2.state)
        self.assertNotIn('BATTERY_DEPLETION', [p.problem_type for p in problems1])
        self.assertIn('BATTERY_DEPLETION', [p.problem_type for p in problems2])

        # At 15% battery, candidate generator synthesizes battery preservation plans
        plan2_names = [p.name for p in plans2]
        self.assertTrue(any('Preserve Battery Power' in name for name in plan2_names))

    def test_hard_safety_constraints_enforcement(self):
        """Verify that plans violating hard safety constraints are marked unsafe and penalized."""
        state = StationState(station_id='maitri')
        state.infrastructure.indoor_temp_avg = 8.5  # Below 10.0°C!
        state.energy.battery_level_percent = 12.0  # Below 15.0%!

        passed, violations = validate_hard_safety_constraints(state)
        self.assertFalse(passed)
        self.assertEqual(len(violations), 2)

    def test_ml_prediction_influences_optimizer(self):
        """Verify that ML predictive failure warnings are diagnosed and incorporated into optimization."""
        engine = SimulationEngine(station_id='maitri')
        # Simulate ML prediction that Main Generator 1 has 85% probability of failure within 24h
        predictions = [{
            'equipmentId': 'gen-1',
            'equipmentName': 'Main Generator 1',
            'failureProbability24h': 0.85,
            'severity': 'critical',
            'rulHours': 12.5,
        }]

        opt_detail = optimize_decisions_detailed(engine, horizon_hours=24, predictions=predictions)
        diagnosed = opt_detail.get('diagnosed_problems', [])
        pred_problems = [p for p in diagnosed if p.get('problem_type') == 'PREDICTED_EQUIPMENT_FAILURE']
        self.assertEqual(len(pred_problems), 1)
        self.assertIn('85%', pred_problems[0]['details'])

    def test_candidate_interventions_api_endpoint(self):
        """Verify GET /api/simulations/{id}/candidate-interventions/ returns structured dynamic candidate data."""
        url = f'/api/simulations/{self.sim_run.id}/candidate-interventions/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertEqual(data['simulationId'], str(self.sim_run.id))
        self.assertIn('diagnosedProblems', data)
        self.assertIn('availableResources', data)
        self.assertIn('feasibleInterventions', data)
        self.assertIn('candidatePackages', data)

        # Check each feasible intervention has structured metadata
        for item in data['feasibleInterventions']:
            self.assertIn('id', item)
            self.assertIn('name', item)
            self.assertIn('isFeasible', item)
            self.assertIn('prerequisites', item)
            self.assertIn('expectedEffects', item)

    def test_decision_support_api_endpoint_dynamic_integration(self):
        """Verify POST /api/simulations/{id}/decision-support/ returns complete grounded decision support."""
        url = f'/api/simulations/{self.sim_run.id}/decision-support/'
        response = self.client.post(url, {'horizon_hours': 24}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertIn('situation', data)
        self.assertIn('optimizer', data)
        self.assertIn('baseline', data)
        self.assertIn('diagnosedProblems', data)
        self.assertIn('feasibleInterventions', data)
        self.assertIn('constraintsChecked', data)
        self.assertIn('traceability', data)

        # Verify recommended plan and alternatives have non-zero multi-objective scores
        rec_plan = data['optimizer']['recommended_plan']
        self.assertIsNotNone(rec_plan)
        self.assertIn('scores', rec_plan)
        self.assertGreater(rec_plan['scores']['overallScore'], 0)
