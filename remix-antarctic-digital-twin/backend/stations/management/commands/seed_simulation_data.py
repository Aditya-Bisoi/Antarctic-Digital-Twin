"""
seed_simulation_data.py — Seeds comprehensive station and simulation data
Antarctic Digital Twin — SIH26060

Populates:
1. Maitri & Bharati station baseline data (energy, environment, infrastructure, logistics, alerts)
2. Granular Equipment records for both stations with physics baselines
3. Predefined 13 Scenario records from SCENARIOS_CATALOG
4. Predefined 9 InterventionDefinition records from INTERVENTIONS
"""

from django.core.management.base import BaseCommand
from django.core.management import call_command
from stations.models import Station
from simulation.models import (
    Equipment,
    Scenario,
    InterventionDefinition,
)
from simulation.scenarios import SCENARIOS_CATALOG
from simulation.interventions import INTERVENTIONS


class Command(BaseCommand):
    help = 'Seeds complete station telemetry, simulation equipment, 13 scenarios, and 9 interventions'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('--- Step 1: Seeding base station telemetry ---'))
        call_command('seed_data')

        self.stdout.write(self.style.SUCCESS('--- Step 2: Seeding granular equipment inventory ---'))
        maitri = Station.objects.get(id='maitri')
        bharati = Station.objects.get(id='bharati')

        # Clean existing equipment
        Equipment.objects.all().delete()

        # Equipment inventory for Maitri
        maitri_equipment = [
            {
                'station': maitri,
                'name': 'Primary Polar Diesel Generator #1',
                'equipment_type': 'generator',
                'identifier': 'gen1',
                'rated_output': 100.0,
                'current_output': 65.0,
                'health_percentage': 96.0,
                'efficiency': 0.94,
                'temperature': 78.0,
                'vibration': 14.0,
                'load_percentage': 65.0,
                'operating_hours': 4210.0,
                'status': 'operational',
                'failure_probability': 4.0,
                'degradation_rate': 0.02,
            },
            {
                'station': maitri,
                'name': 'Auxiliary Diesel Generator #2',
                'equipment_type': 'generator',
                'identifier': 'gen2',
                'rated_output': 100.0,
                'current_output': 50.0,
                'health_percentage': 94.0,
                'efficiency': 0.92,
                'temperature': 74.0,
                'vibration': 16.0,
                'load_percentage': 50.0,
                'operating_hours': 3890.0,
                'status': 'operational',
                'failure_probability': 6.0,
                'degradation_rate': 0.02,
            },
            {
                'station': maitri,
                'name': 'Emergency Backup Generator',
                'equipment_type': 'generator',
                'identifier': 'backup_gen',
                'rated_output': 75.0,
                'current_output': 0.0,
                'health_percentage': 98.0,
                'efficiency': 0.95,
                'temperature': 20.0,
                'vibration': 0.0,
                'load_percentage': 0.0,
                'operating_hours': 450.0,
                'status': 'standby',
                'failure_probability': 2.0,
                'degradation_rate': 0.01,
            },
            {
                'station': maitri,
                'name': 'Habitat Central Heating Loop (HVAC-1)',
                'equipment_type': 'heating',
                'identifier': 'hvac1',
                'rated_output': 80.0,
                'current_output': 58.0,
                'health_percentage': 97.0,
                'efficiency': 0.91,
                'temperature': 62.0,
                'vibration': 8.0,
                'load_percentage': 72.5,
                'operating_hours': 8200.0,
                'status': 'operational',
                'failure_probability': 3.0,
                'degradation_rate': 0.015,
            },
            {
                'station': maitri,
                'name': 'Auxiliary Heating Trace & Thermal Loop (HVAC-2)',
                'equipment_type': 'heating',
                'identifier': 'hvac2',
                'rated_output': 50.0,
                'current_output': 22.0,
                'health_percentage': 95.0,
                'efficiency': 0.89,
                'temperature': 58.0,
                'vibration': 9.0,
                'load_percentage': 44.0,
                'operating_hours': 5100.0,
                'status': 'operational',
                'failure_probability': 5.0,
                'degradation_rate': 0.015,
            },
            {
                'station': maitri,
                'name': 'Bifacial Solar Photovoltaic Field',
                'equipment_type': 'solar',
                'identifier': 'solar_field',
                'rated_output': 40.0,
                'current_output': 28.0,
                'health_percentage': 92.0,
                'efficiency': 0.88,
                'temperature': -12.0,
                'vibration': 0.0,
                'load_percentage': 70.0,
                'operating_hours': 6400.0,
                'status': 'operational',
                'failure_probability': 4.0,
                'degradation_rate': 0.01,
            },
            {
                'station': maitri,
                'name': 'Priyadarshini Heated Water Intake Pipeline',
                'equipment_type': 'water',
                'identifier': 'water_intake',
                'rated_output': 15.0,
                'current_output': 10.0,
                'health_percentage': 99.0,
                'efficiency': 0.96,
                'temperature': 4.0,
                'vibration': 4.0,
                'load_percentage': 66.0,
                'operating_hours': 9200.0,
                'status': 'operational',
                'failure_probability': 1.0,
                'degradation_rate': 0.008,
            },
            {
                'station': maitri,
                'name': 'NRSC Polar Satellite Tracking Dish (3.8m)',
                'equipment_type': 'comms',
                'identifier': 'sat_comm',
                'rated_output': 8.0,
                'current_output': 6.5,
                'health_percentage': 97.0,
                'efficiency': 0.95,
                'temperature': 24.0,
                'vibration': 3.0,
                'load_percentage': 81.0,
                'operating_hours': 11400.0,
                'status': 'operational',
                'failure_probability': 3.0,
                'degradation_rate': 0.01,
            },
            {
                'station': maitri,
                'name': 'PistenBully 300 Polar Transport Vehicle',
                'equipment_type': 'vehicle',
                'identifier': 'vehicle1',
                'rated_output': 240.0,
                'current_output': 0.0,
                'health_percentage': 91.0,
                'efficiency': 0.86,
                'temperature': -5.0,
                'vibration': 0.0,
                'load_percentage': 0.0,
                'operating_hours': 1850.0,
                'status': 'operational',
                'failure_probability': 9.0,
                'degradation_rate': 0.03,
            }
        ]

        # Equipment inventory for Bharati
        bharati_equipment = [
            {
                'station': bharati,
                'name': 'Primary Combined Heat & Power Gen #1',
                'equipment_type': 'generator',
                'identifier': 'gen1',
                'rated_output': 120.0,
                'current_output': 70.0,
                'health_percentage': 98.0,
                'efficiency': 0.96,
                'temperature': 76.0,
                'vibration': 11.0,
                'load_percentage': 58.3,
                'operating_hours': 3100.0,
                'status': 'operational',
                'failure_probability': 2.0,
                'degradation_rate': 0.018,
            },
            {
                'station': bharati,
                'name': 'Secondary Combined Heat & Power Gen #2',
                'equipment_type': 'generator',
                'identifier': 'gen2',
                'rated_output': 120.0,
                'current_output': 62.0,
                'health_percentage': 97.0,
                'efficiency': 0.95,
                'temperature': 75.0,
                'vibration': 12.0,
                'load_percentage': 51.7,
                'operating_hours': 2950.0,
                'status': 'operational',
                'failure_probability': 3.0,
                'degradation_rate': 0.018,
            },
            {
                'station': bharati,
                'name': 'Emergency Backup Generator',
                'equipment_type': 'generator',
                'identifier': 'backup_gen',
                'rated_output': 100.0,
                'current_output': 0.0,
                'health_percentage': 99.0,
                'efficiency': 0.97,
                'temperature': 20.0,
                'vibration': 0.0,
                'load_percentage': 0.0,
                'operating_hours': 320.0,
                'status': 'standby',
                'failure_probability': 1.0,
                'degradation_rate': 0.01,
            },
            {
                'station': bharati,
                'name': 'Modern Aerodynamic HVAC Loop (Main Hab)',
                'equipment_type': 'heating',
                'identifier': 'hvac1',
                'rated_output': 100.0,
                'current_output': 64.0,
                'health_percentage': 99.0,
                'efficiency': 0.95,
                'temperature': 59.0,
                'vibration': 6.0,
                'load_percentage': 64.0,
                'operating_hours': 6800.0,
                'status': 'operational',
                'failure_probability': 2.0,
                'degradation_rate': 0.012,
            },
            {
                'station': bharati,
                'name': 'Bifacial Solar Photovoltaic Array ( Bharati Hill)',
                'equipment_type': 'solar',
                'identifier': 'solar_field',
                'rated_output': 50.0,
                'current_output': 35.0,
                'health_percentage': 96.0,
                'efficiency': 0.92,
                'temperature': -8.0,
                'vibration': 0.0,
                'load_percentage': 70.0,
                'operating_hours': 5400.0,
                'status': 'operational',
                'failure_probability': 3.0,
                'degradation_rate': 0.01,
            },
            {
                'station': bharati,
                'name': 'Seawater Reverse Osmosis Desalination Plant',
                'equipment_type': 'water',
                'identifier': 'water_ro',
                'rated_output': 25.0,
                'current_output': 18.0,
                'health_percentage': 97.0,
                'efficiency': 0.93,
                'temperature': 12.0,
                'vibration': 7.0,
                'load_percentage': 72.0,
                'operating_hours': 7100.0,
                'status': 'operational',
                'failure_probability': 3.0,
                'degradation_rate': 0.012,
            },
            {
                'station': bharati,
                'name': 'Dual-Axis High-Bandwidth Satellite Radome',
                'equipment_type': 'comms',
                'identifier': 'sat_radome',
                'rated_output': 12.0,
                'current_output': 9.2,
                'health_percentage': 98.0,
                'efficiency': 0.97,
                'temperature': 21.0,
                'vibration': 2.0,
                'load_percentage': 76.7,
                'operating_hours': 9800.0,
                'status': 'operational',
                'failure_probability': 2.0,
                'degradation_rate': 0.009,
            }
        ]

        for eq in maitri_equipment + bharati_equipment:
            Equipment.objects.create(**eq)

        self.stdout.write(self.style.SUCCESS(f'Created {len(maitri_equipment) + len(bharati_equipment)} equipment items.'))

        self.stdout.write(self.style.SUCCESS('--- Step 3: Seeding 13 predefined Scenarios ---'))
        for s_def in SCENARIOS_CATALOG:
            Scenario.objects.update_or_create(
                scenario_id=s_def['scenario_id'],
                defaults={
                    'name': s_def['name'],
                    'description': s_def['description'],
                    'severity': s_def['severity'],
                    'category': s_def['category'],
                    'duration_hours': s_def.get('duration_hours', 24.0),
                    'configurable_parameters': s_def.get('configurable_parameters', {}),
                    'events_data': s_def.get('events_data', []),
                    'icon': s_def.get('icon', 'AlertTriangle'),
                    'enabled': True,
                }
            )
        self.stdout.write(self.style.SUCCESS(f'Seeded {len(SCENARIOS_CATALOG)} scenarios successfully.'))

        self.stdout.write(self.style.SUCCESS('--- Step 4: Seeding 9 operational Interventions ---'))
        for i_def in INTERVENTIONS:
            InterventionDefinition.objects.update_or_create(
                intervention_id=i_def.id,
                defaults={
                    'name': i_def.name,
                    'description': i_def.description,
                    'category': i_def.category,
                    'icon': i_def.icon,
                    'applicable_conditions': {},
                    'effects': {},
                    'resource_cost': {},
                    'side_effects': [],
                    'priority': 5,
                    'reversible': True,
                    'enabled': True,
                }
            )
        self.stdout.write(self.style.SUCCESS(f'Seeded {len(INTERVENTIONS)} intervention definitions successfully.'))

        self.stdout.write(self.style.SUCCESS('All simulation and digital twin data seeded successfully!'))
