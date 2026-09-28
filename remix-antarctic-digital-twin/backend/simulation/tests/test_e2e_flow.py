"""
test_e2e_flow.py — Comprehensive End-to-End Simulation Lifecycle Tests
Antarctic Digital Twin — SIH26060

Validates the full integrated lifecycle:
Create Run -> Hazard / Incident Injection -> Physics Advance -> Cascade / Risk ->
Optimizer Decision Support -> Apply Intervention -> Incident Resolution ->
Branching Comparison -> Post-Run Report -> Station History -> What-If Physics API
"""

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from stations.models import (
    Station, EnergyData, EnvironmentData, InfrastructureData,
    LogisticsData, Alert, EnergyHistory, EnvironmentHistory
)
from simulation.models import (
    Scenario, Equipment, SimulationRun, SimulationSnapshot,
    SimulationEvent, Incident, InterventionDefinition, AppliedIntervention
)


class EndToEndSimulationLifecycleTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Station
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
            primary_source='Polar Diesel & Microgrid',
            power_generation_kw=185.0,
            power_consumption_kw=142.0,
            solar_generation_kw=28.0,
            generator_load_percent=68.0,
            battery_level_percent=94.0,
            daily_usage_kwh=3408.0,
        )
        self.env = EnvironmentData.objects.create(
            station=self.station,
            temperature=-28.0,
            wind_speed=42.0,
            wind_direction='ESE (115°)',
            wind_chill=-41.0,
            humidity_percent=48.0,
            air_pressure_hpa=986.0,
            uv_index=1.2,
            visibility_km=35.0,
            snow_accumulation_cm=14.0,
        )
        self.infra = InfrastructureData.objects.create(
            station=self.station,
            overall_health_percent=97,
            life_support_status='Nominal',
            heating_system_status='Nominal',
            water_treatment_capacity_lpd=4200,
            indoor_temp=21.5,
            satellite_uplink_mbps=50,
            active_sensors=248,
            total_sensors=252,
        )
        self.logistics = LogisticsData.objects.create(
            station=self.station,
            fuel_reserve_days=240,
            fuel_level_liters=185000,
            food_ration_days=310,
            water_storage_liters=48000,
            medical_supply_status='Full',
            next_resupply_date='November 2026',
        )

        # Equipment
        self.eq_gen = Equipment.objects.create(
            station=self.station,
            identifier='gen1',
            name='Primary Diesel Generator',
            equipment_type='generator',
            rated_output=100.0,
            current_output=78.0,
            health_percentage=95.0,
            efficiency=0.92,
            temperature=82.0,
            vibration=22.0,
            status='operational',
            degradation_rate=0.02,
        )

        # Scenario
        self.scenario = Scenario.objects.create(
            scenario_id='blizzard_severe',
            name='Severe Katabatic Blizzard',
            description='130 km/h blizzard testing structural and microgrid endurance.',
            severity='critical',
            category='environmental',
            duration_hours=24,
            events_data=[
                {
                    'at_hour': 0.0,
                    'event_type': 'environment',
                    'action': 'set_weather',
                    'parameters': {'wind_speed': 130.0, 'temperature': -42.0},
                    'description': 'Blizzard onset.',
                }
            ],
            enabled=True,
        )

    def test_complete_simulation_lifecycle(self):
        # 1. Create Simulation Run
        create_res = self.client.post('/api/simulations/', {
            'station': 'maitri',
            'scenario': 'blizzard_severe',
            'name': 'E2E Blizzard Test Run',
            'speedMultiplier': 1.0,
        }, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        run_id = create_res.data['id']
        self.assertIn('activeScenarios', create_res.data)

        # 2. Advance Simulation by 2 hours
        adv_res = self.client.post(f'/api/simulations/{run_id}/advance/', {
            'hours': 2.0,
        }, format='json')
        self.assertEqual(adv_res.status_code, status.HTTP_200_OK)
        self.assertEqual(adv_res.data['simulationHour'], 2.0)
        self.assertIn('riskLevel', adv_res.data)
        self.assertIn('resilienceScore', adv_res.data)

        # 3. Inject In-Flight Incident (Generator Trip)
        inc_res = self.client.post(f'/api/simulations/{run_id}/incidents/', {
            'incidentType': 'generator_trip',
            'description': 'Unexpected mechanical trip on primary unit.',
            'severity': 'critical',
            'parameters': {'generator_id': 'gen1'},
        }, format='json')
        self.assertEqual(inc_res.status_code, status.HTTP_201_CREATED)
        incident_id = inc_res.data['id']
        self.assertIn('engineStatus', inc_res.data)
        self.assertEqual(inc_res.data['engineStatus']['status'], 'injected')

        # 4. Advance 1 hour under the incident
        adv_res2 = self.client.post(f'/api/simulations/{run_id}/advance/', {
            'hours': 1.0,
        }, format='json')
        self.assertEqual(adv_res2.status_code, status.HTTP_200_OK)
        self.assertEqual(adv_res2.data['simulationHour'], 3.0)

        # 5. Risk and Resilience APIs
        risk_res = self.client.get(f'/api/simulations/{run_id}/risk/')
        self.assertEqual(risk_res.status_code, status.HTTP_200_OK)
        self.assertIn('riskLevel', risk_res.data)
        self.assertIn('reasons', risk_res.data)

        resil_res = self.client.get(f'/api/simulations/{run_id}/resilience/')
        self.assertEqual(resil_res.status_code, status.HTTP_200_OK)
        self.assertIn('resilienceScore', resil_res.data)

        # 6. Multi-Objective Decision Optimizer
        opt_res = self.client.post(f'/api/simulations/{run_id}/optimize/')
        self.assertEqual(opt_res.status_code, status.HTTP_200_OK)
        self.assertIn('recommendedPlan', opt_res.data)
        self.assertIn('tradeoffs', opt_res.data)
        self.assertIn('baselineOutcomeWithoutIntervention', opt_res.data)
        self.assertIn('alternatives', opt_res.data)

        # 7. Apply Recommended Intervention
        rec_plan = opt_res.data['recommendedPlan']
        if rec_plan and rec_plan.get('interventions'):
            target_inv = rec_plan['interventions'][0]
            apply_res = self.client.post(f'/api/simulations/{run_id}/interventions/apply/', {
                'interventionId': target_inv,
            }, format='json')
            self.assertEqual(apply_res.status_code, status.HTTP_200_OK)
            self.assertEqual(apply_res.data['status'], 'applied')

        # 8. Resolve the In-Flight Incident
        resolve_res = self.client.post(f'/api/simulations/{run_id}/incidents/{incident_id}/resolve/')
        self.assertEqual(resolve_res.status_code, status.HTTP_200_OK)
        self.assertEqual(resolve_res.data['status'], 'resolved')

        # 9. Compare Projections (with from_hour snapshot branching)
        comp_res = self.client.post(f'/api/simulations/{run_id}/compare/', {
            'interventions': ['start_backup_generator', 'reduce_noncritical_loads'],
            'from_hour': 2.0,
        }, format='json')
        self.assertEqual(comp_res.status_code, status.HTTP_200_OK)
        self.assertIn('withoutInterventions', comp_res.data)
        self.assertIn('withInterventions', comp_res.data)

        # 10. Generate Final Post-Run Report
        report_res = self.client.get(f'/api/simulations/{run_id}/report/')
        self.assertEqual(report_res.status_code, status.HTTP_200_OK)
        self.assertIn('majorImpacts', report_res.data)
        self.assertIn('timeline', report_res.data)

        # 11. Station Unified History API
        hist_res = self.client.get('/api/stations/maitri/history/')
        self.assertEqual(hist_res.status_code, status.HTTP_200_OK)
        self.assertIn('stationId', hist_res.data)
        self.assertIn('recentEnergyHistory', hist_res.data)
        self.assertIn('recentAlerts', hist_res.data)

        # 12. Dynamic Physics-Based What-If Simulation API
        whatif_res = self.client.post('/api/stations/maitri/simulate/', {
            'scenario': 'Generator Failure',
        }, format='json')
        self.assertEqual(whatif_res.status_code, status.HTTP_200_OK)
        self.assertEqual(whatif_res.data['stationId'], 'maitri')
        self.assertIn('batteryImpact', whatif_res.data['result'])
        self.assertIn('backupDuration', whatif_res.data['result'])
        self.assertIn('projectedBatteryIn24h', whatif_res.data['result'])
