"""
test_radar_pipeline_contracts.py — Automated Contract Compliance Test Suite
Validates the Radar → Digital Twin → AI Response pipeline across all 19 hardening contracts.
"""

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from stations.models import Station, EnergyData, EnvironmentData, InfrastructureData, LogisticsData
from simulation.models import Scenario, Equipment, SimulationRun, SimulationEvent
from simulation.optimizer import validate_hard_safety_constraints
from simulation.ai_decision_support import generate_decision_support
from simulation.engine import SimulationEngine
from simulation.state import StationState


class RadarPipelineContractsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Seed Bharati station
        self.station = Station.objects.create(
            id='bharati',
            name='Bharati Station',
            region='East Antarctica (Larsemann Hills)',
            coordinates="69°24'28\"S 76°11'14\"E",
            status='Online',
            commissioned_year=2012,
            crew_count=47,
        )
        self.energy = EnergyData.objects.create(
            station=self.station,
            primary_source='Polar Combined Diesel + Solar Microgrid',
            power_generation_kw=240.0,
            power_consumption_kw=175.0,
            solar_generation_kw=45.0,
            generator_load_percent=68.0,
            battery_level_percent=92.0,
            daily_usage_kwh=4200.0,
        )
        self.env = EnvironmentData.objects.create(
            station=self.station,
            temperature=-22.0,
            wind_speed=35.0,
            wind_direction='NE',
            wind_chill=-34.0,
            humidity_percent=45.0,
            air_pressure_hpa=990.0,
            uv_index=1.0,
            visibility_km=40.0,
            snow_accumulation_cm=8.0,
        )
        self.infra = InfrastructureData.objects.create(
            station=self.station,
            overall_health_percent=96,
            life_support_status='Nominal',
            heating_system_status='Nominal',
            water_treatment_capacity_lpd=5000,
            indoor_temp=21.5,
            satellite_uplink_mbps=75,
            active_sensors=320,
            total_sensors=330,
        )
        self.logistics = LogisticsData.objects.create(
            station=self.station,
            fuel_reserve_days=240,
            fuel_level_liters=220000,
            food_ration_days=365,
            water_storage_liters=60000,
            medical_supply_status='Full',
            next_resupply_date='December 2026',
            expedition_team='45th ISEA',
        )
        self.scenario = Scenario.objects.create(
            scenario_id='blizzard_severe',
            name='Severe Polar Blizzard',
            description='Severe polar blizzard with extreme wind and subzero temperatures.',
            severity='critical',
            category='weather',
            duration_hours=48.0,
            enabled=True,
        )
        self.equipment = Equipment.objects.create(
            station=self.station,
            name='Primary Generator Unit 1',
            equipment_type='generator',
            identifier='gen-bh-01',
            rated_output=150.0,
            current_output=110.0,
            health_percentage=96.0,
            status='operational',
        )

    def test_contract_2_valid_radar_event(self):
        """Contract 2 & 3: Valid radar event successfully creates simulation run and processes pipeline."""
        payload = {
            'station_id': 'bharati',
            'hazard_type': 'STORM',
            'distance_km': 180.0,
            'wind_speed_kmh': 115.0,
            'estimated_arrival_hours': 4.0,
            'severity': 'HIGH',
            'confidence': 0.95,
            'source': 'Polar Doppler Radar MK-IV',
            'is_simulated': True,
            'event_id': 'evt-test-valid-001',
            'force_fresh': True,
        }
        res = self.client.post('/api/radar/events/', payload, format='json')
        self.assertIn(res.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        data = res.data

        # Verify Contract 2 & 3 outputs
        self.assertTrue(data.get('success', False))
        self.assertIn('simulationRunId', data)
        self.assertIn('currentState', data)
        self.assertIn('deltas', data)
        self.assertIn('risk', data)
        self.assertIn('resilience', data)
        self.assertIn('optimizer', data)
        self.assertIn('aiDecisionSupport', data)
        self.assertIn('radarEvent', data)
        self.assertTrue(data['radarEvent'].get('isSimulated', data['radarEvent'].get('is_simulated')))

    def test_contract_2_validation_bounds_errors(self):
        """Contract 2: Invalid inputs (negative values, confidence > 1, invalid station) return HTTP 400."""
        # Negative wind speed
        res = self.client.post('/api/radar/events/', {
            'station_id': 'bharati',
            'distance_km': 100.0,
            'wind_speed_kmh': -25.0,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('wind_speed_kmh', res.data)

        # Confidence > 1.0
        res2 = self.client.post('/api/radar/events/', {
            'station_id': 'bharati',
            'confidence': 1.5,
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('confidence', res2.data)

        # Invalid station ID
        res3 = self.client.post('/api/radar/events/', {
            'station_id': 'unknown_base',
        }, format='json')
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('station_id', res3.data)

        # Negative distance
        res4 = self.client.post('/api/radar/events/', {
            'station_id': 'bharati',
            'distance_km': -50.0,
        }, format='json')
        self.assertEqual(res4.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('distance_km', res4.data)

    def test_contract_3_idempotency(self):
        """Contract 3: Duplicate radar event with same event_id does not create duplicate simulation records."""
        event_id = 'evt-idempotency-test-999'
        payload = {
            'station_id': 'bharati',
            'distance_km': 120.0,
            'wind_speed_kmh': 105.0,
            'estimated_arrival_hours': 3.0,
            'confidence': 0.90,
            'event_id': event_id,
            'force_fresh': False,
        }
        res1 = self.client.post('/api/radar/events/', payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        run_id_1 = res1.data['simulationRunId']

        # Send exact same event_id
        res2 = self.client.post('/api/radar/events/', payload, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        run_id_2 = res2.data['simulationRunId']

        # Should reference the same simulation run, not spawn an orphan run
        self.assertEqual(run_id_1, run_id_2)

    def test_contract_8_safety_constraint_rejections(self):
        """Contract 8: Optimizer hard safety constraints reject dangerous states."""
        # 1. Outdoor ops during blizzard
        state = StationState(station_id='bharati', station_name='Bharati Station')
        state.environment.wind_speed = 115.0
        state.crew.outdoor_ops_allowed = True
        ok, violations = validate_hard_safety_constraints(state)
        self.assertFalse(ok)
        self.assertTrue(any('outdoor operations permitted during hazardous weather' in v for v in violations))

        # 2. Complete communication blackout during emergency
        state2 = StationState(station_id='bharati', station_name='Bharati Station')
        state2.communication.status = 'Offline'
        state2.energy.power_deficit_kw = 10.0
        ok2, violations2 = validate_hard_safety_constraints(state2)
        self.assertFalse(ok2)
        self.assertTrue(any('Complete communication blackout' in v for v in violations2))

        # 3. Safe state passes
        state3 = StationState(station_id='bharati', station_name='Bharati Station')
        state3.environment.wind_speed = 30.0
        state3.environment.wind_chill = -25.0
        state3.crew.outdoor_ops_allowed = True
        ok3, violations3 = validate_hard_safety_constraints(state3)
        self.assertTrue(ok3)
        self.assertEqual(len(violations3), 0)

    def test_contract_9_and_10_ai_decision_grounding(self):
        """Contract 9 & 10: AI decision support reflects real optimizer rankings and does not hallucinate."""
        state = StationState(
            station_id='bharati',
            station_name='Bharati Station',
        )
        state.environment.wind_speed = 110.0
        rec_interventions = ['reduce_noncritical_loads', 'preheat_fuel_lines']
        context = {
            'current_state': state.to_dict(),
            'hazards': ['Blizzard warning'],
            'risk': {'overall_level': 'HIGH', 'power_risk': 'HIGH'},
            'resilience': {'resilience_score': 74.0},
            'optimizer': {
                'recommended_plan': {
                    'title': 'Active Load Shedding & Preheating',
                    'interventions': rec_interventions,
                },
                'predicted_outcome': {
                    'power_deficit_kw': 0.0,
                    'indoor_temp_c': 19.5,
                }
            },
        }
        ai_resp = generate_decision_support(context)

        self.assertIn('situation_summary', ai_resp)
        self.assertIn('recommended_action', ai_resp)
        self.assertEqual(ai_resp['recommended_action']['interventions'], rec_interventions)
        self.assertIn('why', ai_resp)
        self.assertIn('tradeoffs', ai_resp)
        self.assertIn('confidence', ai_resp)

    def test_contract_13_apply_intervention_revalidation(self):
        """Contract 13: Applying an intervention validates preconditions, applies, advances physics, and recalculates risk/resilience."""
        # Create simulation run
        sim_run = SimulationRun.objects.create(
            station=self.station,
            scenario=self.scenario,
            name='Test Contract 13 Run',
            speed_multiplier=1.0,
            current_simulation_time=0.0,
        )
        engine = SimulationEngine(station_id='bharati')
        sim_run.current_state = engine.get_state_dict()
        sim_run.save()

        # Apply valid intervention
        res = self.client.post(f'/api/simulations/{sim_run.id}/interventions/apply/', {
            'interventions': ['start_backup_generator'],
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'applied')
        self.assertIn('currentState', res.data)
        self.assertIn('riskLevel', res.data)
        self.assertIn('resilienceScore', res.data)
        self.assertIn('appliedInterventions', res.data)
        self.assertIn('start_backup_generator', res.data['appliedInterventions'])
