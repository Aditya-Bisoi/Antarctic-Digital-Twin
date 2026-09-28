"""
test_api.py — Integration tests for simulation and telemetry REST APIs
Antarctic Digital Twin — SIH26060
"""

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from stations.models import Station, EnergyData, EnvironmentData, InfrastructureData, LogisticsData
from simulation.models import Scenario, Equipment, SimulationRun


class SimulationAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.station = Station.objects.create(
            id='maitri',
            name='Maitri Station',
            region='East Antarctica',
            coordinates="70°45'57\"S 11°44'09\"E",
            status='Online',
            commissioned_year=1989,
            crew_count=25,
        )
        self.energy = EnergyData.objects.create(
            station=self.station,
            primary_source='Polar Diesel',
            power_generation_kw=180.0,
            power_consumption_kw=140.0,
            solar_generation_kw=25.0,
            generator_load_percent=65.0,
            battery_level_percent=95.0,
            daily_usage_kwh=3360.0,
        )
        self.env = EnvironmentData.objects.create(
            station=self.station,
            temperature=-25.0,
            wind_speed=40.0,
            wind_direction='ESE',
            wind_chill=-38.0,
            humidity_percent=50.0,
            air_pressure_hpa=985.0,
            uv_index=1.0,
            visibility_km=30.0,
            snow_accumulation_cm=10.0,
        )
        self.infra = InfrastructureData.objects.create(
            station=self.station,
            overall_health_percent=95,
            life_support_status='Nominal',
            heating_system_status='Nominal',
            water_treatment_capacity_lpd=4000,
            indoor_temp=21.0,
            satellite_uplink_mbps=50,
            active_sensors=240,
            total_sensors=250,
        )
        self.logistics = LogisticsData.objects.create(
            station=self.station,
            fuel_reserve_days=200,
            fuel_level_liters=180000,
            food_ration_days=300,
            water_storage_liters=45000,
            medical_supply_status='Full',
            next_resupply_date='November 2026',
            expedition_team='45th ISEA',
        )
        self.scenario = Scenario.objects.create(
            scenario_id='generator_failure',
            name='Generator Failure',
            description='Test generator failure scenario',
            severity='high',
            category='power',
            duration_hours=24.0,
            enabled=True,
        )
        self.equipment = Equipment.objects.create(
            station=self.station,
            name='Diesel Generator 1',
            equipment_type='generator',
            identifier='gen1',
            rated_output=100.0,
            current_output=70.0,
            health_percentage=95.0,
            status='operational',
        )

    def test_scenarios_list(self):
        res = self.client.get('/api/scenarios/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res.data), 1)

    def test_interventions_list(self):
        res = self.client.get('/api/interventions/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 9)

    def test_station_overview(self):
        res = self.client.get(f'/api/stations/{self.station.id}/overview/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['name'], 'Maitri Station')
        self.assertIn('energy', res.data)
        self.assertIn('environment', res.data)

    def test_station_telemetry(self):
        res = self.client.get(f'/api/stations/{self.station.id}/telemetry/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['stationName'], 'Maitri Station')

    def test_simulation_run_lifecycle(self):
        # 1. Create
        create_res = self.client.post('/api/simulations/', {
            'station': self.station.id,
            'scenario': self.scenario.id,
            'name': 'Test Integration Run',
            'speedMultiplier': 1.0,
        }, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        run_id = create_res.data['id']

        # 2. Advance by 2 hours
        advance_res = self.client.post(f'/api/simulations/{run_id}/advance/', {
            'hours': 2.0,
        }, format='json')
        self.assertEqual(advance_res.status_code, status.HTTP_200_OK)
        self.assertEqual(advance_res.data['simulationHour'], 2.0)

        # 3. State
        state_res = self.client.get(f'/api/simulations/{run_id}/state/')
        self.assertEqual(state_res.status_code, status.HTTP_200_OK)
        hour = state_res.data.get('simulation_hour', state_res.data.get('simulationHour'))
        self.assertAlmostEqual(hour, 2.0, places=2)

        # 4. Risk & Resilience
        risk_res = self.client.get(f'/api/simulations/{run_id}/risk/')
        self.assertEqual(risk_res.status_code, status.HTTP_200_OK)
        self.assertIn('riskLevel', risk_res.data)

        resilience_res = self.client.get(f'/api/simulations/{run_id}/resilience/')
        self.assertEqual(resilience_res.status_code, status.HTTP_200_OK)
        self.assertIn('resilienceScore', resilience_res.data)

        # 5. Apply intervention
        apply_res = self.client.post(f'/api/simulations/{run_id}/interventions/apply/', {
            'interventionId': 'start_backup_generator',
        }, format='json')
        self.assertEqual(apply_res.status_code, status.HTTP_200_OK)
        self.assertEqual(apply_res.data['status'], 'applied')

        # 6. Optimize decisions
        opt_res = self.client.post(f'/api/simulations/{run_id}/optimize/')
        self.assertEqual(opt_res.status_code, status.HTTP_200_OK)
        self.assertTrue(isinstance(opt_res.data, (list, dict)))

        # 7. AI Insights
        insights_res = self.client.get(f'/api/simulations/{run_id}/insights/')
        self.assertEqual(insights_res.status_code, status.HTTP_200_OK)
        self.assertIn('situationSummary', insights_res.data)

        # 8. Report
        report_res = self.client.get(f'/api/simulations/{run_id}/report/')
        self.assertEqual(report_res.status_code, status.HTTP_200_OK)
        self.assertIn('executiveSummary', report_res.data)

        # 9. Compare
        comp_res = self.client.post(f'/api/simulations/{run_id}/compare/', {
            'interventions': ['reduce_noncritical_loads'],
        }, format='json')
        self.assertEqual(comp_res.status_code, status.HTTP_200_OK)
        self.assertIn('withoutInterventions', comp_res.data)
        self.assertIn('withInterventions', comp_res.data)
