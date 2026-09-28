from django.core.management.base import BaseCommand
from stations.models import (
    Station,
    EnergyData,
    EnvironmentData,
    InfrastructureData,
    InfrastructureItem,
    LogisticsData,
    LogisticsItem,
    Alert,
    DigitalTwinModule,
    EnergyHistory,
    EnvironmentHistory,
)

class Command(BaseCommand):
    help = 'Seeds database with realistic telemetry data for Maitri and Bharati stations'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Seeding Antarctic Digital Twin database...'))

        # Clear existing data
        Station.objects.all().delete()
        Alert.objects.all().delete()

        # ----------------------------------------------------
        # 1. MAITRI STATION SEEDING
        # ----------------------------------------------------
        maitri = Station.objects.create(
            id='maitri',
            name='Maitri Station',
            region='East Antarctica',
            coordinates="70°45'57\"S 11°44'09\"E (Schirmacher Oasis)",
            status='Online',
            last_ping='Just now (Telemetry synced)',
            image='/images/maitri-station.png',
            description='India’s second permanent research station in Antarctica, operating year-round in the rocky ice-free Schirmacher Oasis region. Supports geomagnetic, meteorological, and glaciological science.',
            commissioned_year=1989,
            elevation='117 m above sea level',
            crew_count=25,
        )

        EnergyData.objects.create(
            station=maitri,
            primary_source='High-Efficiency Polar Diesel & Microgrid',
            power_generation_kw=185.0,
            power_consumption_kw=142.0,
            solar_generation_kw=28.0,
            generator_load_percent=68.0,
            battery_level_percent=94.0,
            daily_usage_kwh=3408.0,
        )

        EnvironmentData.objects.create(
            station=maitri,
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

        InfrastructureData.objects.create(
            station=maitri,
            overall_health_percent=97,
            life_support_status='Nominal',
            heating_system_status='Nominal',
            water_treatment_capacity_lpd=4200,
            indoor_temp=21.5,
            satellite_uplink_mbps=50,
            active_sensors=248,
            total_sensors=252,
        )

        LogisticsData.objects.create(
            station=maitri,
            fuel_reserve_days=240,
            fuel_level_liters=185000,
            food_ration_days=310,
            water_storage_liters=48000,
            medical_supply_status='Full',
            next_resupply_date='November 2026',
            expedition_team='45th Indian Scientific Expedition to Antarctica (ISEA)',
        )

        # Maitri Subsystem Infrastructure Items
        infra_items_maitri = [
            ("Main Living Habitat", "Buildings", "Nominal", 98),
            ("Primary Microgrid Diesel Gen #1", "Generator", "Nominal", 96),
            ("Auxiliary Diesel Gen #2", "Generator", "Standby", 95),
            ("Bifacial Solar Photovoltaic Bank", "Solar Panels", "Nominal", 92),
            ("Lake Priyadarshini Heated Water Intake", "Water System", "Nominal", 99),
            ("NRSC Satellite High-Gain Dish", "Communication System", "Nominal", 97),
        ]
        for name, category, status_str, health in infra_items_maitri:
            InfrastructureItem.objects.create(
                station=maitri, name=name, category=category, status=status_str, health_percent=health
            )

        # Maitri Logistics Items
        logistics_items_maitri = [
            ("Polar Aviation Turbine Fuel (ATF)", 185000, "liters", 240),
            ("Freeze-Dried & Cold Food Rations", 310, "days", 310),
            ("Potable Freshwater Storage", 48000, "liters", 120),
            ("Trauma & Telemedicine Medical Kit", 100, "percent", 365),
            ("Generator Turbines & Spare Filters", 45, "units", 150),
        ]
        for name, qty, unit, reserve in logistics_items_maitri:
            LogisticsItem.objects.create(
                station=maitri, item_name=name, quantity=qty, unit=unit, reserve_days=reserve
            )

        # Maitri Digital Twin Modules
        DigitalTwinModule.objects.create(
            station=maitri,
            module_id='main-habitat',
            name='Main Habitat & Living Quarters',
            type='living',
            status='Optimal',
            temp='+21.5°C',
            power='45 kW',
            description='Accommodates 25 expedition members, dining hall, medical infirmary, and communication center.',
            x=15, y=20, width=38, height=28,
        )
        DigitalTwinModule.objects.create(
            station=maitri,
            module_id='generator-hub',
            name='Thermal & Power Generation Plant',
            type='energy',
            status='Optimal',
            temp='+18.0°C',
            power='185 kW gen',
            description='Multi-redundant generators with heat recovery system that heats station water pipes.',
            x=58, y=20, width=28, height=28,
        )
        DigitalTwinModule.objects.create(
            station=maitri,
            module_id='science-lab',
            name='Atmospheric & Geomagnetic Laboratory',
            type='science',
            status='Active',
            temp='+20.0°C',
            power='32 kW',
            description='Continuous monitoring of Southern Aurora, ozone depletion, seismology, and meteorological probes.',
            x=15, y=54, width=32, height=30,
        )
        DigitalTwinModule.objects.create(
            station=maitri,
            module_id='fuel-lake-comms',
            name='Lake Priyadarshini Water Intake & Uplink',
            type='logistics',
            status='Optimal',
            temp='+4.0°C',
            power='18 kW',
            description='Heated freshwater pipeline from Lake Priyadarshini and high-frequency radome dome.',
            x=52, y=54, width=34, height=30,
        )

        # Maitri History Data
        time_stamps = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "Current"]
        m_gens = [180, 182, 185, 190, 188, 185, 185]
        m_cons = [135, 138, 145, 150, 146, 140, 142]
        m_bats = [95, 94, 93, 92, 94, 95, 94]
        m_temps = [-30, -31, -29, -26, -27, -28, -28]
        m_winds = [38, 45, 48, 40, 42, 44, 42]

        for i in range(len(time_stamps)):
            EnergyHistory.objects.create(
                station=maitri,
                time_label=time_stamps[i],
                power_generation_kw=m_gens[i],
                power_consumption_kw=m_cons[i],
                battery_level_percent=m_bats[i],
            )
            EnvironmentHistory.objects.create(
                station=maitri,
                time_label=time_stamps[i],
                temperature=m_temps[i],
                wind_speed=m_winds[i],
                air_pressure_hpa=986.0 + i % 3,
            )

        # ----------------------------------------------------
        # 2. BHARATI STATION SEEDING
        # ----------------------------------------------------
        bharati = Station.objects.create(
            id='bharati',
            name='Bharati Station',
            region='East Antarctica',
            coordinates="69°24'28\"S 76°11'14\"E (Larsemann Hills)",
            status='Online',
            last_ping='Just now (High-speed telemetry)',
            image='/images/bharati-station.png',
            description='India’s state-of-the-art third Antarctic research facility, constructed on elevated stilts using 134 prefabricated shipping containers. Features an advanced aerodynamic envelope to prevent snowdrifts.',
            commissioned_year=2012,
            elevation='35 m above sea level (near coast)',
            crew_count=47,
        )

        EnergyData.objects.create(
            station=bharati,
            primary_source='Automated Cogeneration Plant & Wind Assist',
            power_generation_kw=240.0,
            power_consumption_kw=175.0,
            solar_generation_kw=45.0,
            generator_load_percent=62.0,
            battery_level_percent=98.0,
            daily_usage_kwh=4200.0,
        )

        EnvironmentData.objects.create(
            station=bharati,
            temperature=-25.0,
            wind_speed=36.0,
            wind_direction='NE (42°)',
            wind_chill=-36.0,
            humidity_percent=52.0,
            air_pressure_hpa=994.0,
            uv_index=1.5,
            visibility_km=42.0,
            snow_accumulation_cm=8.0,
        )

        InfrastructureData.objects.create(
            station=bharati,
            overall_health_percent=99,
            life_support_status='Nominal',
            heating_system_status='Nominal',
            water_treatment_capacity_lpd=6500,
            indoor_temp=22.0,
            satellite_uplink_mbps=120,
            active_sensors=392,
            total_sensors=394,
        )

        LogisticsData.objects.create(
            station=bharati,
            fuel_reserve_days=320,
            fuel_level_liters=260000,
            food_ration_days=400,
            water_storage_liters=75000,
            medical_supply_status='Full',
            next_resupply_date='December 2026',
            expedition_team='45th Indian Scientific Expedition to Antarctica (ISEA)',
        )

        # Bharati Subsystem Infrastructure Items
        infra_items_bharati = [
            ("Containerized Habitat Block", "Buildings", "Nominal", 99),
            ("Automated Cogeneration Plant", "Generator", "Nominal", 98),
            ("Bifacial High-Altitude Solar Array", "Solar Panels", "Nominal", 96),
            ("Reverse Osmosis & Seawater Desalination", "Water System", "Nominal", 97),
            ("C-Band High-Speed Satellite Terminal", "Communication System", "Nominal", 100),
        ]
        for name, category, status_str, health in infra_items_bharati:
            InfrastructureItem.objects.create(
                station=bharati, name=name, category=category, status=status_str, health_percent=health
            )

        # Bharati Logistics Items
        logistics_items_bharati = [
            ("Aviation Turbine Fuel (ATF Reserves)", 260000, "liters", 320),
            ("Extended Expedition Rations", 400, "days", 400),
            ("Desalinated Freshwater Reserves", 75000, "liters", 200),
            ("Advanced Surgical & Pharmacy Supplies", 100, "percent", 365),
            ("Microgrid Inverters & Control Electronics", 60, "units", 240),
        ]
        for name, qty, unit, reserve in logistics_items_bharati:
            LogisticsItem.objects.create(
                station=bharati, item_name=name, quantity=qty, unit=unit, reserve_days=reserve
            )

        # Bharati Digital Twin Modules
        DigitalTwinModule.objects.create(
            station=bharati,
            module_id='tier1-stilts',
            name='Ground Level & Aerodynamic Stilts',
            type='logistics',
            status='Optimal',
            temp='-22.0°C',
            power='12 kW',
            description='Elevated pile foundations that allow polar blizzards and drift snow to blow harmlessly underneath.',
            x=10, y=60, width=80, height=18,
        )
        DigitalTwinModule.objects.create(
            station=bharati,
            module_id='tier2-tech',
            name='Second Tier: Combined Heat & Power Plant',
            type='energy',
            status='Optimal',
            temp='+20.5°C',
            power='240 kW gen',
            description='Thermal recovery units, greywater treatment, workshop, vehicle maintenance and stores.',
            x=14, y=36, width=72, height=22,
        )
        DigitalTwinModule.objects.create(
            station=bharati,
            module_id='tier3-living',
            name='Third Tier: Living Quarters & Science Labs',
            type='living',
            status='Optimal',
            temp='+22.0°C',
            power='65 kW',
            description='24 residential cabins with panoramic glazing, dining lounge, telemedicine suite, and oceanography lab.',
            x=18, y=12, width=64, height=22,
        )

        # Bharati History Data
        b_gens = [230, 235, 240, 245, 242, 238, 240]
        b_cons = [168, 170, 178, 182, 179, 174, 175]
        b_bats = [98, 97, 98, 99, 98, 98, 98]
        b_temps = [-27, -26, -25, -23, -24, -25, -25]
        b_winds = [32, 35, 40, 38, 34, 36, 36]

        for i in range(len(time_stamps)):
            EnergyHistory.objects.create(
                station=bharati,
                time_label=time_stamps[i],
                power_generation_kw=b_gens[i],
                power_consumption_kw=b_cons[i],
                battery_level_percent=b_bats[i],
            )
            EnvironmentHistory.objects.create(
                station=bharati,
                time_label=time_stamps[i],
                temperature=b_temps[i],
                wind_speed=b_winds[i],
                air_pressure_hpa=994.0 + i % 2,
            )

        # ----------------------------------------------------
        # 3. ALERTS SEEDING
        # ----------------------------------------------------
        Alert.objects.create(
            station=maitri,
            alert_id='alt-1',
            severity='medium',
            title='High Katabatic Wind Advisory',
            message='Gusts up to 68 km/h recorded on outer ridge; secondary wind turbine safely locked.',
            timestamp='28m ago',
            category='Weather',
        )
        Alert.objects.create(
            station=bharati,
            alert_id='alt-2',
            severity='low',
            title='Satellite Uplink Frequency Sync',
            message='Scheduled ground station tracking calibration completed with NRSC Hyderabad.',
            timestamp='1h 14m ago',
            category='Communications',
        )
        Alert.objects.create(
            station=maitri,
            alert_id='alt-3',
            severity='low',
            title='Water Intake Heating Cycle Active',
            message='Lake Priyadarshini thermal trace line pulse nominal; water flow optimal at 3.2 bar.',
            timestamp='3h ago',
            category='Infrastructure',
        )

        self.stdout.write(self.style.SUCCESS('Successfully seeded Maitri & Bharati station data!'))
