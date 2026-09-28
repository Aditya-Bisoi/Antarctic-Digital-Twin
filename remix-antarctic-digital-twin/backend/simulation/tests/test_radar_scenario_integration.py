"""
test_radar_scenario_integration.py — Integration tests between Scenario Library and Live Radar.
Validates authoritative single source of truth, time synchronization, and radar event contracts.
"""

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from stations.models import Station, EnergyData, EnvironmentData, InfrastructureData, LogisticsData
from simulation.models import Scenario, SimulationRun


class RadarScenarioIntegrationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Seed test station
        self.station = Station.objects.create(
            id='maitri',
            name='Maitri Station',
            region='East Antarctica (Schirmacher Oasis)',
            coordinates="70°45'57\"S 11°44'09\"E",
            status='Online',
            commissioned_year=1989,
            crew_count=25,
        )
        self.energy = EnergyData.objects.create(
            station=self.station,
            primary_source='Polar Diesel',
            power_generation_kw=185.0,
            power_consumption_kw=142.0,
            generator_load_percent=68.0,
            battery_level_percent=94.0,
            daily_usage_kwh=3408.0,
        )
        self.env = EnvironmentData.objects.create(
            station=self.station,
            temperature=-28.0,
            wind_speed=42.0,
            air_pressure_hpa=986.0,
            visibility_km=35.0,
        )
        self.infra = InfrastructureData.objects.create(
            station=self.station,
            overall_health_percent=97,
            indoor_temp=21.5,
        )
        self.logistics = LogisticsData.objects.create(
            station=self.station,
            fuel_reserve_days=240,
            fuel_level_liters=185000,
        )

        # Predefined Scenarios
        self.storm_scenario = Scenario.objects.create(
            scenario_id='antarctic_storm',
            name='Extreme Antarctic Storm',
            description='Full katabatic blizzard.',
            severity='critical',
            category='environment',
            duration_hours=24.0,
            enabled=True,
            events_data=[
                {'at_hour': 0, 'action': 'storm_warning', 'description': 'Storm warning issued'},
                {'at_hour': 2, 'action': 'storm_onset', 'description': 'Storm front arrives'},
            ]
        )

        self.gen_scenario = Scenario.objects.create(
            scenario_id='generator_failure',
            name='Generator Failure',
            description='Generator fails under load.',
            severity='high',
            category='energy',
            duration_hours=24.0,
            enabled=True,
        )

    def test_radar_endpoint_storm_scenario(self):
        """Selecting Extreme Antarctic Storm exposes live storm radar parameters."""
        create_res = self.client.post('/api/simulations/', {
            'station': 'maitri',
            'scenario': 'extreme_antarctic_storm',  # Test canonical alias resolution
            'name': 'Test Storm Run',
        }, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        run_id = create_res.data['id']

        # Query GET /api/simulations/{id}/radar/
        radar_res = self.client.get(f'/api/simulations/{run_id}/radar/')
        self.assertEqual(radar_res.status_code, status.HTTP_200_OK)
        r_data = radar_res.data

        self.assertTrue(r_data['has_storm'])
        self.assertEqual(r_data['scenario_id'], 'antarctic_storm')
        self.assertEqual(r_data['scenario_name'], 'Extreme Antarctic Storm')
        self.assertEqual(r_data['status'], 'APPROACHING')
        self.assertEqual(r_data['distance_km'], 180.0)
        self.assertEqual(r_data['estimated_arrival_hours'], 4.0)
        self.assertGreater(r_data['wind_speed_kmh'], 0)
        self.assertEqual(r_data['direction'], '135° SE')
        self.assertEqual(r_data['simulation_time'], 0.0)

    def test_radar_endpoint_time_progression(self):
        """Sim clock T+2 brings storm closer on the radar."""
        create_res = self.client.post('/api/simulations/', {
            'station': 'maitri',
            'scenario': 'antarctic_storm',
        }, format='json')
        run_id = create_res.data['id']

        # Advance by 2 hours
        adv_res = self.client.post(f'/api/simulations/{run_id}/advance/', {'hours': 2.0}, format='json')
        self.assertEqual(adv_res.status_code, status.HTTP_200_OK)

        # Query radar state after T+2
        radar_res = self.client.get(f'/api/simulations/{run_id}/radar/')
        self.assertEqual(radar_res.status_code, status.HTTP_200_OK)
        r_data = radar_res.data

        # Distance should decrease by 45 km/h * 2h = 90km -> 90km remaining
        self.assertEqual(r_data['distance_km'], 90.0)
        self.assertEqual(r_data['estimated_arrival_hours'], 2.0)
        self.assertEqual(r_data['status'], 'APPROACHING')
        self.assertEqual(r_data['simulation_time'], 2.0)

    def test_radar_endpoint_non_storm_scenario(self):
        """Generator failure scenario causes radar to remain IDLE with no storm detected."""
        create_res = self.client.post('/api/simulations/', {
            'station': 'maitri',
            'scenario': 'generator_failure',
        }, format='json')
        run_id = create_res.data['id']

        radar_res = self.client.get(f'/api/simulations/{run_id}/radar/')
        self.assertEqual(radar_res.status_code, status.HTTP_200_OK)
        r_data = radar_res.data

        self.assertFalse(r_data['has_storm'])
        self.assertEqual(r_data['status'], 'IDLE')
        self.assertEqual(r_data['distance_km'], 0.0)
        self.assertEqual(r_data['estimated_arrival_hours'], 0.0)
        self.assertEqual(r_data['scenario_id'], 'generator_failure')

    def test_radar_event_traceability_contract(self):
        """Radar detection event references simulation_id, scenario_id, and type."""
        create_res = self.client.post('/api/simulations/', {
            'station': 'maitri',
            'scenario': 'antarctic_storm',
        }, format='json')
        run_id = create_res.data['id']

        event_payload = {
            'type': 'RADAR_STORM_DETECTED',
            'station_id': 'maitri',
            'simulation_id': str(run_id),
            'scenario_id': 'antarctic_storm',
            'severity': 'CRITICAL',
            'distance_km': 180.0,
            'wind_speed_kmh': 140.0,
            'estimated_arrival_hours': 4.0,
            'source': 'Polar Doppler Radar MK-IV',
            'is_simulated': True,
            'force_fresh': True,
        }

        res = self.client.post('/api/radar/events/', event_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        self.assertEqual(data.get('type'), 'RADAR_STORM_DETECTED')
        self.assertEqual(str(data.get('simulation_id')), str(run_id))
        self.assertEqual(data.get('scenario_id'), 'antarctic_storm')
        self.assertEqual(data.get('radarEvent', {}).get('scenario_id'), 'antarctic_storm')

    def test_radar_endpoint_bharati_station(self):
        """Bharati station storm approach calculates 200km range, 50 km/h speed, and 065° NE bearing."""
        bharati = Station.objects.create(
            id='bharati',
            name='Bharati Station',
            region='East Antarctica (Larsemann Hills)',
            coordinates="69°24'28\"S 76°11'14\"E",
            status='Online',
            commissioned_year=2012,
            crew_count=47,
        )
        EnergyData.objects.create(
            station=bharati,
            primary_source='Combined Heat & Power',
            power_generation_kw=260.0,
            power_consumption_kw=195.0,
        )
        EnvironmentData.objects.create(
            station=bharati,
            temperature=-25.0,
            wind_speed=36.0,
        )
        InfrastructureData.objects.create(
            station=bharati,
            overall_health_percent=98,
        )
        LogisticsData.objects.create(
            station=bharati,
            fuel_reserve_days=310,
        )

        create_res = self.client.post('/api/simulations/', {
            'station': 'bharati',
            'scenario': 'antarctic_storm',
            'name': 'Bharati Storm Run',
        }, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        run_id = create_res.data['id']

        radar_res = self.client.get(f'/api/simulations/{run_id}/radar/')
        self.assertEqual(radar_res.status_code, status.HTTP_200_OK)
        r_data = radar_res.data

        self.assertTrue(r_data['has_storm'])
        self.assertEqual(r_data['distance_km'], 200.0)
        self.assertEqual(r_data['estimated_arrival_hours'], 4.0)
        self.assertEqual(r_data['direction'], '065° NE')

        # Advance by 2 hours (50 km/h * 2h = 100km distance reduction -> 100km remaining)
        adv_res = self.client.post(f'/api/simulations/{run_id}/advance/', {'hours': 2.0}, format='json')
        self.assertEqual(adv_res.status_code, status.HTTP_200_OK)

        radar_res2 = self.client.get(f'/api/simulations/{run_id}/radar/')
        r_data2 = radar_res2.data
        self.assertEqual(r_data2['distance_km'], 100.0)
        self.assertEqual(r_data2['estimated_arrival_hours'], 2.0)
        self.assertEqual(r_data2['status'], 'APPROACHING')

