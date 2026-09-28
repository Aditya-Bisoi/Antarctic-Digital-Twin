"""
engine.py — Core simulation engine
Antarctic Digital Twin — SIH26060

Python port of the frontend's SimulationEngine.ts.
Deterministic: same initial state + scenario + interventions → same output.
"""

import math
import copy
from typing import Optional, List, Callable

from .state import (
    StationState, EnvironmentState, EnergyState, LogisticsState,
    InfrastructureState, CommunicationState, CrewState,
    GeneratorState, EquipmentItem, ZoneTemperature,
    SimulationEventData, CascadeNode, RiskReason, ResilienceFactor,
)
from .physics import (
    clamp, lerp, calculate_wind_chill, calculate_heating_demand,
    calculate_fuel_rate, calculate_fuel_endurance, calculate_effective_output,
    calculate_battery_change, calculate_solar_factor, calculate_wind_generation,
    calculate_equipment_degradation, calculate_indoor_temperature,
    calculate_crew_safety_risk, calculate_communication_quality,
)
from .constants import (
    CREW_POWER_KW_PER_PERSON, CREW_FOOD_KG_PER_PERSON_PER_DAY,
    CREW_WATER_L_PER_PERSON_PER_DAY, MEDICAL_DAILY_RATE_PER_25_CREW,
    SPARE_PARTS_NORMAL_RATE, SPARE_PARTS_MAINTENANCE_RATE,
    EQUIPMENT_HEALTH_FAILED, EQUIPMENT_HEALTH_CRITICAL,
    EQUIPMENT_HEALTH_WARNING, RESILIENCE_WEIGHTS,
    TEMP_EXTREME_COLD, TEMP_SEVERE_COLD, TEMP_INDOOR_HYPOTHERMIA,
    TEMP_INDOOR_WARNING, TEMP_INDOOR_LOW,
    WIND_OUTDOOR_RESTRICTED, WIND_COMM_DEGRADATION,
    BATTERY_CRITICAL, BATTERY_LOW,
    FUEL_CRITICAL_DAYS, FUEL_WARNING_DAYS,
    FOOD_CRITICAL_DAYS, WATER_CRITICAL_DAYS,
    VISIBILITY_WHITEOUT,
)


# ============================================================================
# Baseline Data (matching frontend SimulationEngine.ts)
# ============================================================================

def _maitri_baseline() -> StationState:
    """Create Maitri Station baseline state."""
    state = StationState()
    state.station_id = 'maitri'
    state.station_name = 'Maitri Station'

    state.environment = EnvironmentState(
        temperature=-28, wind_speed=42, wind_direction='ESE (115°)',
        wind_chill=-41, humidity=48, air_pressure=986,
        uv_index=1.2, visibility=35, snow_accumulation=14,
    )

    state.energy = EnergyState(
        generators=[
            GeneratorState(
                id='gen1', name='Generator 1 (Primary)',
                rated_capacity_kw=100, current_output_kw=78, load_percent=78,
                health=95, temperature=82, vibration=22, efficiency=0.92,
                fuel_rate_lph=22, is_online=True, status='Nominal',
            ),
            GeneratorState(
                id='gen2', name='Generator 2 (Secondary)',
                rated_capacity_kw=100, current_output_kw=64, load_percent=64,
                health=92, temperature=78, vibration=18, efficiency=0.90,
                fuel_rate_lph=18, is_online=True, status='Nominal',
            ),
        ],
        backup_generator=GeneratorState(
            id='backup', name='Emergency Backup Generator',
            rated_capacity_kw=80, current_output_kw=0, load_percent=0,
            health=98, temperature=20, vibration=0, efficiency=0.88,
            fuel_rate_lph=0, is_online=False, status='Nominal',
        ),
        total_generation_kw=185, total_consumption_kw=142,
        solar_generation_kw=28, solar_max_kw=45,
        wind_generation_kw=15, heating_demand_kw=55, base_load_kw=87,
        battery_level_percent=94, battery_capacity_kwh=500,
        battery_charge_rate_kw=20, battery_discharge_rate_kw=0,
        is_battery_charging=True, power_deficit_kw=0, power_surplus_kw=43,
    )

    state.logistics = LogisticsState(
        fuel_level_liters=185000, fuel_consumption_lph=40,
        fuel_endurance_days=192.7,
        food_remaining_kg=7750, food_consumption_kg_per_day=25,
        food_endurance_days=310,
        water_storage_liters=48000, water_consumption_lpd=500,
        water_endurance_days=96,
        medical_supply_percent=95, medical_endurance_days=365,
        spare_parts_percent=88, spare_parts_endurance_days=240,
        next_resupply_date='November 2026', next_resupply_days=55,
        resupply_delay_days=0,
    )

    state.infrastructure = InfrastructureState(
        overall_health=97,
        zones=[
            ZoneTemperature('Living Quarters', 'critical', 21.5, 21, 18, True),
            ZoneTemperature('Medical Bay', 'critical', 22.0, 22, 8, True),
            ZoneTemperature('Communication Center', 'critical', 20.5, 20, 6, True),
            ZoneTemperature('Science Laboratory', 'non-critical', 20.0, 20, 10, True),
            ZoneTemperature('Generator Room', 'critical', 18.0, 15, 5, True),
            ZoneTemperature('Storage & Workshop', 'non-critical', 12.0, 10, 8, True),
        ],
        indoor_temp_avg=21.5,
        heating_system_status='Nominal',
        life_support_status='Nominal',
        water_treatment_status='Nominal',
        active_sensors=248, total_sensors=252,
    )

    state.communication = CommunicationState(
        satellite_uplink_mbps=50, max_uplink_mbps=50,
        quality=100, status='Online',
        is_data_syncing=True, pending_data_packets=0, last_sync_hour=0,
    )

    state.crew = CrewState(count=25, base_count=25, safety_risk='LOW',
                           outdoor_ops_allowed=True, shelter_in_place=False)

    state.equipment = [
        EquipmentItem('eq-gen1', 'Primary Diesel Generator', 'generator', 95, 82, 22, 0.92, True, 'Nominal', 0.02, [97, 96, 96, 95, 95]),
        EquipmentItem('eq-gen2', 'Secondary Diesel Generator', 'generator', 92, 78, 18, 0.90, True, 'Nominal', 0.025, [95, 94, 93, 93, 92]),
        EquipmentItem('eq-heating', 'Central Heating System', 'heating', 94, 65, 10, 0.91, True, 'Nominal', 0.015, [96, 95, 95, 94, 94]),
        EquipmentItem('eq-water', 'Water Treatment Plant', 'water', 96, 40, 8, 0.95, True, 'Nominal', 0.01, [97, 97, 96, 96, 96]),
        EquipmentItem('eq-solar', 'Solar Panel Array', 'solar', 90, -15, 0, 0.85, True, 'Nominal', 0.005, [92, 91, 91, 90, 90]),
        EquipmentItem('eq-comms', 'Satellite Communication Array', 'comms', 97, -10, 5, 0.96, True, 'Nominal', 0.008, [98, 98, 97, 97, 97]),
    ]

    return state


def _bharati_baseline() -> StationState:
    """Create Bharati Station baseline state."""
    state = StationState()
    state.station_id = 'bharati'
    state.station_name = 'Bharati Station'

    state.environment = EnvironmentState(
        temperature=-25, wind_speed=36, wind_direction='NE (42°)',
        wind_chill=-36, humidity=52, air_pressure=994,
        uv_index=1.5, visibility=42, snow_accumulation=8,
    )

    state.energy = EnergyState(
        generators=[
            GeneratorState(
                id='gen1', name='Generator 1 (Cogeneration)',
                rated_capacity_kw=130, current_output_kw=95, load_percent=73,
                health=97, temperature=80, vibration=20, efficiency=0.94,
                fuel_rate_lph=25, is_online=True, status='Nominal',
            ),
            GeneratorState(
                id='gen2', name='Generator 2 (Cogeneration)',
                rated_capacity_kw=130, current_output_kw=80, load_percent=61,
                health=95, temperature=76, vibration=17, efficiency=0.93,
                fuel_rate_lph=20, is_online=True, status='Nominal',
            ),
        ],
        backup_generator=GeneratorState(
            id='backup', name='Emergency Backup Generator',
            rated_capacity_kw=100, current_output_kw=0, load_percent=0,
            health=99, temperature=20, vibration=0, efficiency=0.90,
            fuel_rate_lph=0, is_online=False, status='Nominal',
        ),
        total_generation_kw=240, total_consumption_kw=175,
        solar_generation_kw=45, solar_max_kw=65,
        wind_generation_kw=20, heating_demand_kw=65, base_load_kw=110,
        battery_level_percent=98, battery_capacity_kwh=800,
        battery_charge_rate_kw=30, battery_discharge_rate_kw=0,
        is_battery_charging=True, power_deficit_kw=0, power_surplus_kw=65,
    )

    state.logistics = LogisticsState(
        fuel_level_liters=260000, fuel_consumption_lph=45,
        fuel_endurance_days=240.7,
        food_remaining_kg=18800, food_consumption_kg_per_day=47,
        food_endurance_days=400,
        water_storage_liters=75000, water_consumption_lpd=940,
        water_endurance_days=79.8,
        medical_supply_percent=98, medical_endurance_days=400,
        spare_parts_percent=92, spare_parts_endurance_days=320,
        next_resupply_date='December 2026', next_resupply_days=85,
        resupply_delay_days=0,
    )

    state.infrastructure = InfrastructureState(
        overall_health=99,
        zones=[
            ZoneTemperature('Living Quarters (Tier 3)', 'critical', 22.0, 22, 22, True),
            ZoneTemperature('Medical & Telemedicine Suite', 'critical', 22.5, 22, 10, True),
            ZoneTemperature('Communication Hub', 'critical', 21.0, 20, 7, True),
            ZoneTemperature('Oceanography & Science Lab', 'non-critical', 20.5, 20, 12, True),
            ZoneTemperature('CHP Plant Room (Tier 2)', 'critical', 19.0, 16, 6, True),
            ZoneTemperature('Storage & Vehicle Bay', 'non-critical', 10.0, 8, 8, True),
        ],
        indoor_temp_avg=22.0,
        heating_system_status='Nominal',
        life_support_status='Nominal',
        water_treatment_status='Nominal',
        active_sensors=392, total_sensors=394,
    )

    state.communication = CommunicationState(
        satellite_uplink_mbps=120, max_uplink_mbps=120,
        quality=100, status='Online',
        is_data_syncing=True, pending_data_packets=0, last_sync_hour=0,
    )

    state.crew = CrewState(count=47, base_count=47, safety_risk='LOW',
                           outdoor_ops_allowed=True, shelter_in_place=False)

    state.equipment = [
        EquipmentItem('eq-gen1', 'Cogeneration Unit 1', 'generator', 97, 80, 20, 0.94, True, 'Nominal', 0.018, [98, 98, 97, 97, 97]),
        EquipmentItem('eq-gen2', 'Cogeneration Unit 2', 'generator', 95, 76, 17, 0.93, True, 'Nominal', 0.02, [97, 96, 96, 95, 95]),
        EquipmentItem('eq-heating', 'Central Heating System', 'heating', 96, 60, 8, 0.93, True, 'Nominal', 0.012, [97, 97, 96, 96, 96]),
        EquipmentItem('eq-water', 'Greywater Treatment Plant', 'water', 98, 38, 6, 0.96, True, 'Nominal', 0.008, [99, 98, 98, 98, 98]),
        EquipmentItem('eq-solar', 'Solar Array & Wind Turbine', 'solar', 93, -12, 3, 0.88, True, 'Nominal', 0.004, [94, 94, 93, 93, 93]),
        EquipmentItem('eq-comms', 'High-Speed Satellite Terminal', 'comms', 98, -8, 4, 0.97, True, 'Nominal', 0.006, [99, 99, 98, 98, 98]),
    ]

    return state


def initialize_state_from_db(station_id: str) -> Optional[StationState]:
    """
    Construct StationState from Django database models:
    Station, EnergyData, EnvironmentData, InfrastructureData, LogisticsData, and Equipment.
    """
    try:
        from stations.models import Station
        from simulation.models import Equipment

        normalized_id = (station_id or 'maitri').lower().strip()
        station = Station.objects.filter(id=normalized_id).first()
        if not station:
            return None

        # Start with default static template for detailed generator/zone layout
        base = _bharati_baseline() if normalized_id == 'bharati' else _maitri_baseline()
        state = base.deep_copy()
        state.station_id = station.id
        state.station_name = station.name

        # Crew
        state.crew = CrewState(
            count=station.crew_count or base.crew.count,
            base_count=station.crew_count or base.crew.base_count,
            safety_risk='LOW',
            outdoor_ops_allowed=True,
            shelter_in_place=False,
        )

        # Environment
        env = getattr(station, 'environment', None)
        if env:
            state.environment = EnvironmentState(
                temperature=env.temperature,
                wind_speed=env.wind_speed,
                wind_direction=env.wind_direction,
                wind_chill=env.wind_chill,
                humidity=env.humidity_percent,
                air_pressure=env.air_pressure_hpa,
                uv_index=env.uv_index,
                visibility=env.visibility_km,
                snow_accumulation=env.snow_accumulation_cm,
            )

        # Energy
        energy = getattr(station, 'energy', None)
        if energy:
            state.energy.total_generation_kw = energy.power_generation_kw
            state.energy.total_consumption_kw = energy.power_consumption_kw
            state.energy.solar_generation_kw = energy.solar_generation_kw
            state.energy.battery_level_percent = energy.battery_level_percent
            surplus = max(0.0, energy.power_generation_kw - energy.power_consumption_kw)
            deficit = max(0.0, energy.power_consumption_kw - energy.power_generation_kw)
            state.energy.power_surplus_kw = surplus
            state.energy.power_deficit_kw = deficit

        # Infrastructure
        infra = getattr(station, 'infrastructure', None)
        if infra:
            state.infrastructure.overall_health = infra.overall_health_percent
            state.infrastructure.indoor_temp_avg = infra.indoor_temp
            state.infrastructure.heating_system_status = infra.heating_system_status
            state.infrastructure.life_support_status = infra.life_support_status
            state.infrastructure.active_sensors = infra.active_sensors
            state.infrastructure.total_sensors = infra.total_sensors
            state.communication.satellite_uplink_mbps = infra.satellite_uplink_mbps
            state.communication.max_uplink_mbps = infra.satellite_uplink_mbps

        # Logistics
        logistics = getattr(station, 'logistics', None)
        if logistics:
            state.logistics.fuel_level_liters = logistics.fuel_level_liters
            state.logistics.fuel_endurance_days = float(logistics.fuel_reserve_days)
            state.logistics.food_endurance_days = float(logistics.food_ration_days)
            state.logistics.water_storage_liters = logistics.water_storage_liters
            state.logistics.next_resupply_date = logistics.next_resupply_date

        # Equipment from DB
        db_equipment = Equipment.objects.filter(station=station)
        if db_equipment.exists():
            eq_items = []
            for eq in db_equipment:
                eq_items.append(
                    EquipmentItem(
                        id=eq.identifier,
                        name=eq.name,
                        category=eq.equipment_type,
                        health=eq.health_percentage,
                        temperature=eq.temperature,
                        vibration=eq.vibration,
                        efficiency=eq.efficiency,
                        is_online=(eq.status == 'operational' and eq.health_percentage > 0),
                        status='Nominal' if eq.health_percentage >= 70 else ('Warning' if eq.health_percentage >= 30 else 'Critical'),
                        degradation_rate=eq.degradation_rate,
                        health_history=[eq.health_percentage] * 5,
                    )
                )
            state.equipment = eq_items

        return state
    except Exception:
        return None


def get_baseline(station_id: str) -> StationState:
    """Get baseline state for a station, prioritizing database state if available."""
    normalized_id = (station_id or 'maitri').lower().strip()
    db_state = initialize_state_from_db(normalized_id)
    if db_state is not None:
        return db_state
    if normalized_id == 'bharati':
        return _bharati_baseline()
    return _maitri_baseline()



# ============================================================================
# Simulation Engine
# ============================================================================

class SimulationEngine:
    """
    Core physics-based simulation engine.

    Deterministic: given the same initial state, scenario events, and
    interventions applied at the same times, the engine produces
    identical output.
    """

    TICK_INTERVAL_HOURS = 0.1  # Recalculate every 6 sim-minutes

    def __init__(self, station_id: str = 'maitri', initial_state: Optional[StationState] = None):
        if initial_state:
            self.state = initial_state.deep_copy()
        else:
            baseline = get_baseline(station_id)
            self.state = baseline.deep_copy()
            self.state.events = []
            self.state.active_scenarios = []
            self.state.active_interventions = []
            self.state.cascade_chain = []
            self.state.risk_level = 'LOW'
            self.state.risk_reasons = []
            self.state.resilience_score = 100
            self.state.resilience_factors = []
            self.state.overall_status = 'Nominal'

        self.baseline_state = self.state.deep_copy()
        self.history: List[dict] = []  # List of {'hour': float, 'state': dict}
        self._is_running = False
        self._speed = 1.0

        self._recalculate_derived()
        self.history.append({
            'hour': 0,
            'state': self.state.to_dict(),
        })

    # ---- Public API ----

    def get_state(self) -> StationState:
        return self.state

    def get_state_dict(self) -> dict:
        return self.state.to_dict()

    def get_history(self) -> List[dict]:
        return self.history

    def get_baseline(self) -> StationState:
        return self.baseline_state

    def is_running(self) -> bool:
        return self._is_running

    def play(self):
        self._is_running = True

    def pause(self):
        self._is_running = False

    def set_speed(self, multiplier: float):
        self._speed = clamp(multiplier, 0.25, 100)

    def reset(self):
        self.state = self.baseline_state.deep_copy()
        self.state.simulation_hour = 0
        self.state.events = []
        self.state.active_scenarios = []
        self.state.active_interventions = []
        self.state.cascade_chain = []
        self.history = [{'hour': 0, 'state': self.state.to_dict()}]
        self._is_running = False
        self._recalculate_derived()

    def advance_by_hours(self, hours: float):
        """Advance simulation by the given number of hours."""
        steps = math.ceil(hours / self.TICK_INTERVAL_HOURS)
        for _ in range(steps):
            self._tick_internal(self.TICK_INTERVAL_HOURS)

    def recalculate_physics(self, immediate: bool = True):
        """Recalculate physical subsystems without advancing time."""
        if immediate and self.state.infrastructure.heating_system_status != 'Failed':
            base_temp = self.baseline_state.environment.temperature
            temp_delta = max(0.0, base_temp - self.state.environment.temperature)
            base_heating = self.baseline_state.energy.heating_demand_kw
            heating_mult = 1.0 + 0.03 * temp_delta
            wind_penalty = max(0.0, (self.state.environment.wind_speed - 50.0) * 0.15)
            target_heating = base_heating * heating_mult + wind_penalty
            heating_eq = next((e for e in self.state.equipment if e.category == 'heating'), None)
            if heating_eq:
                target_heating *= clamp(heating_eq.efficiency, 0.3, 1.0)
            if 'reduce_noncritical_heating' in self.state.active_interventions:
                savings = sum(z.heating_kw * 0.6 for z in self.state.infrastructure.zones if z.category == 'non-critical')
                target_heating -= savings
            self.state.energy.heating_demand_kw = clamp(target_heating, 0.0, 300.0)
        else:
            self._tick_heating(0.0)

        self._tick_energy(0.0)
        self._tick_fuel(0.0)
        self._tick_logistics(0.0)
        self._tick_indoor_temp(0.0)
        self._recalculate_derived()

    def modify_state(self, modifier: Callable[[StationState], None], immediate_physics: bool = True):
        """Apply external modifications (scenarios, interventions)."""
        modifier(self.state)
        if immediate_physics:
            self.recalculate_physics(immediate=True)
        else:
            self._recalculate_derived()

    def add_event(self, event_type: str, category: str, title: str, description: str):
        """Add an event to the timeline."""
        self.state.events.append(SimulationEventData(
            hour=self.state.simulation_hour,
            type=event_type,
            category=category,
            title=title,
            description=description,
        ))

    def create_snapshot(self) -> dict:
        """Create a snapshot for comparison."""
        return {
            'hour': self.state.simulation_hour,
            'state': self.state.to_dict(),
        }

    def fork(self) -> 'SimulationEngine':
        """Fork the engine for parallel simulation."""
        forked = SimulationEngine.__new__(SimulationEngine)
        forked.state = self.state.deep_copy()
        forked.baseline_state = self.baseline_state.deep_copy()
        forked.history = copy.deepcopy(self.history)
        forked._is_running = False
        forked._speed = self._speed
        return forked

    # ---- Internal Tick ----

    def _tick_internal(self, dt: float):
        """Execute one simulation step."""
        s = self.state
        s.simulation_hour += dt

        # 1. Environment
        self._tick_environment(dt)
        # 2. Heating demand
        self._tick_heating(dt)
        # 3. Equipment degradation
        self._tick_equipment(dt)
        # 4. Energy balance
        self._tick_energy(dt)
        # 5. Fuel consumption
        self._tick_fuel(dt)
        # 6. Logistics
        self._tick_logistics(dt)
        # 7. Communication
        self._tick_communication(dt)
        # 8. Crew
        self._tick_crew(dt)
        # 9. Indoor temperatures
        self._tick_indoor_temp(dt)
        # 10. Recalculate derived
        self._recalculate_derived()
        # 11. Check alert thresholds
        self._check_alert_thresholds()
        # 12. Record history snapshot every hour
        last_hour = self.history[-1]['hour'] if self.history else -1
        if math.floor(s.simulation_hour) > math.floor(last_hour):
            self.history.append({
                'hour': math.floor(s.simulation_hour),
                'state': s.to_dict(),
            })

    def _tick_environment(self, dt: float):
        env = self.state.environment
        base_env = self.baseline_state.environment

        # Natural diurnal cycle (sinusoidal, not random)
        hour_angle = (self.state.simulation_hour * math.pi) / 12
        diurnal_shift = math.sin(hour_angle) * 1.5

        # Only apply diurnal if no weather scenario is active
        weather_scenarios = {'storm', 'cold', 'weather', 'antarctic_storm', 'extreme_cold'}
        if not any(s_id in weather_scenarios or 'storm' in s_id or 'cold' in s_id
                   for s_id in self.state.active_scenarios):
            env.temperature = lerp(env.temperature, base_env.temperature + diurnal_shift, 0.02 * dt)

        env.wind_chill = calculate_wind_chill(env.temperature, env.wind_speed)
        env.air_pressure = clamp(env.air_pressure, 920, 1050)
        env.visibility = clamp(env.visibility, 0.1, 50)
        env.snow_accumulation = clamp(env.snow_accumulation, 0, 200)

    def _tick_heating(self, dt: float):
        s = self.state
        infra = s.infrastructure

        if infra.heating_system_status == 'Failed':
            s.energy.heating_demand_kw = 0
            return

        base_heating = self.baseline_state.energy.heating_demand_kw
        base_temp = self.baseline_state.environment.temperature

        heating_equip = next((e for e in s.equipment if e.category == 'heating'), None)
        efficiency = heating_equip.efficiency if heating_equip else 1.0

        target_heating = calculate_heating_demand(
            base_heating, base_temp, s.environment.temperature,
            s.environment.wind_speed, efficiency,
        )

        # Non-critical heating reduction intervention
        if 'reduce_noncritical_heating' in s.active_interventions:
            savings = sum(
                z.heating_kw * 0.6
                for z in infra.zones if z.category == 'non-critical'
            )
            target_heating -= savings

        s.energy.heating_demand_kw = clamp(
            lerp(s.energy.heating_demand_kw, target_heating, 0.1),
            0, 300,
        )

    def _tick_equipment(self, dt: float):
        s = self.state
        maintenance = 'increase_maintenance' in s.active_interventions

        for eq in s.equipment:
            if not eq.is_online:
                continue

            gen_load = 0.0
            is_gen = eq.category == 'generator'
            if is_gen:
                gen_id = eq.id.replace('eq-', '')
                gen = next(
                    (g for g in s.energy.generators if g.id == gen_id and g.is_online),
                    None,
                )
                if gen:
                    gen_load = gen.load_percent
                    # Sync equipment health to generator
                    gen.health = eq.health
                    gen.temperature = eq.temperature
                    gen.vibration = eq.vibration
                    gen.efficiency = eq.efficiency

            degradation = calculate_equipment_degradation(
                eq.degradation_rate, dt,
                s.environment.temperature, s.environment.wind_speed,
                gen_load, is_gen, maintenance,
            )

            eq.health = clamp(eq.health - degradation, 0, 100)
            eq.efficiency = clamp(math.pow(eq.health / 100, 0.5), 0.3, 1)

            # Temperature and vibration increase as health drops
            if eq.category in ('generator', 'heating'):
                health_loss = 100 - eq.health
                eq.temperature += health_loss * 0.05 * dt
                eq.vibration = clamp(eq.vibration + health_loss * 0.03 * dt, 0, 100)

            # Health history (one entry per hour)
            if (not eq.health_history or
                    math.floor(s.simulation_hour) > len(eq.health_history)):
                eq.health_history.append(round(eq.health))
                if len(eq.health_history) > 100:
                    eq.health_history.pop(0)

            # Update status
            if eq.health <= EQUIPMENT_HEALTH_FAILED:
                eq.status = 'Failed'
                eq.is_online = False
            elif eq.health < EQUIPMENT_HEALTH_CRITICAL:
                eq.status = 'Critical'
            elif eq.health < EQUIPMENT_HEALTH_WARNING:
                eq.status = 'Warning'
            else:
                eq.status = 'Nominal'

    def _tick_energy(self, dt: float):
        s = self.state
        energy = s.energy

        # Total consumption
        crew_power = s.crew.count * CREW_POWER_KW_PER_PERSON
        total_consumption = energy.base_load_kw + energy.heating_demand_kw + crew_power

        if 'reduce_noncritical_loads' in s.active_interventions:
            total_consumption *= 0.7
        if 'prioritize_critical' in s.active_interventions:
            total_consumption *= 0.9

        energy.total_consumption_kw = clamp(total_consumption, 20, 1000)

        # Generation from online generators
        all_gens = energy.generators + [energy.backup_generator]
        online_gens = [g for g in all_gens if g.is_online]

        total_generation = 0.0
        if online_gens:
            total_capacity = sum(g.rated_capacity_kw * g.efficiency for g in online_gens)
            for gen in online_gens:
                share = (gen.rated_capacity_kw * gen.efficiency) / max(total_capacity, 1)
                gen.current_output_kw = clamp(
                    energy.total_consumption_kw * share, 0, gen.rated_capacity_kw
                )
                gen.load_percent = (gen.current_output_kw / gen.rated_capacity_kw) * 100
                total_generation += gen.current_output_kw
                gen.fuel_rate_lph = calculate_fuel_rate(
                    gen.current_output_kw, gen.rated_capacity_kw
                )

        # Solar
        energy.solar_generation_kw = energy.solar_max_kw * calculate_solar_factor(
            s.environment.visibility, s.environment.snow_accumulation,
            'increase_renewables' in s.active_interventions,
        )

        # Wind
        energy.wind_generation_kw = calculate_wind_generation(s.environment.wind_speed)

        total_generation += energy.solar_generation_kw + energy.wind_generation_kw
        energy.total_generation_kw = total_generation

        # Power balance
        power_balance = total_generation - energy.total_consumption_kw
        energy.power_surplus_kw = max(0, power_balance)
        energy.power_deficit_kw = max(0, -power_balance)

        # Battery
        preserve = 'preserve_battery' in s.active_interventions
        new_pct, charge, discharge, charging = calculate_battery_change(
            power_balance, energy.battery_capacity_kwh,
            energy.battery_level_percent, dt, preserve,
        )
        energy.battery_level_percent = new_pct
        energy.battery_charge_rate_kw = charge
        energy.battery_discharge_rate_kw = discharge
        energy.is_battery_charging = charging

        # Update offline generators
        for gen in all_gens:
            if not gen.is_online:
                gen.current_output_kw = 0
                gen.load_percent = 0
                gen.fuel_rate_lph = 0
                gen.status = 'Failed' if gen.failed_at_hour is not None else 'Nominal'
            else:
                if gen.load_percent > 90:
                    gen.status = 'Critical'
                elif gen.load_percent > 75:
                    gen.status = 'Warning'
                else:
                    gen.status = 'Nominal'
                gen.hours_running += dt

    def _tick_fuel(self, dt: float):
        s = self.state
        energy = s.energy
        logistics = s.logistics

        all_gens = energy.generators + [energy.backup_generator]
        total_fuel_lph = sum(g.fuel_rate_lph for g in all_gens if g.is_online)

        logistics.fuel_consumption_lph = total_fuel_lph
        logistics.fuel_level_liters = clamp(
            logistics.fuel_level_liters - total_fuel_lph * dt, 0, 500000
        )
        logistics.fuel_endurance_days = calculate_fuel_endurance(
            logistics.fuel_level_liters, total_fuel_lph
        )

    def _tick_logistics(self, dt: float):
        s = self.state
        log = s.logistics
        crew = s.crew

        # Food
        log.food_consumption_kg_per_day = crew.count * CREW_FOOD_KG_PER_PERSON_PER_DAY
        log.food_remaining_kg = clamp(
            log.food_remaining_kg - (log.food_consumption_kg_per_day / 24) * dt,
            0, 100000,
        )
        log.food_endurance_days = (
            log.food_remaining_kg / log.food_consumption_kg_per_day
            if log.food_consumption_kg_per_day > 0 else 9999
        )

        # Water
        log.water_consumption_lpd = crew.count * CREW_WATER_L_PER_PERSON_PER_DAY
        log.water_storage_liters = clamp(
            log.water_storage_liters - (log.water_consumption_lpd / 24) * dt,
            0, 200000,
        )
        log.water_endurance_days = (
            log.water_storage_liters / log.water_consumption_lpd
            if log.water_consumption_lpd > 0 else 9999
        )

        # Medical
        medical_rate = MEDICAL_DAILY_RATE_PER_25_CREW * (crew.count / 25)
        log.medical_supply_percent = clamp(
            log.medical_supply_percent - (medical_rate / 24) * dt, 0, 100
        )
        log.medical_endurance_days = (
            log.medical_supply_percent / medical_rate if medical_rate > 0 else 9999
        )

        # Spare parts
        spare_rate = (SPARE_PARTS_MAINTENANCE_RATE
                      if 'increase_maintenance' in s.active_interventions
                      else SPARE_PARTS_NORMAL_RATE)
        log.spare_parts_percent = clamp(
            log.spare_parts_percent - (spare_rate / 24) * dt, 0, 100
        )
        log.spare_parts_endurance_days = (
            log.spare_parts_percent / spare_rate if spare_rate > 0 else 9999
        )

        # Resupply
        log.next_resupply_days = max(
            0,
            self.baseline_state.logistics.next_resupply_days
            - (s.simulation_hour / 24)
            + log.resupply_delay_days,
        )
        if 'emergency_resupply' in s.active_interventions:
            log.next_resupply_days = max(0, log.next_resupply_days - 15)

    def _tick_communication(self, dt: float):
        s = self.state
        comm = s.communication

        comm_equip = next((e for e in s.equipment if e.category == 'comms'), None)
        comm_health = comm_equip.health if comm_equip else 100

        quality, status = calculate_communication_quality(
            comm.quality, s.environment.wind_speed, comm_health
        )
        comm.quality = quality
        comm.status = status
        comm.satellite_uplink_mbps = (quality / 100) * comm.max_uplink_mbps

        if status == 'Offline':
            comm.is_data_syncing = False
            comm.pending_data_packets += dt * 10
        elif status == 'Degraded':
            comm.is_data_syncing = True
            comm.pending_data_packets = max(0, comm.pending_data_packets - dt * 3)
        else:
            comm.is_data_syncing = True
            comm.pending_data_packets = max(0, comm.pending_data_packets - dt * 20)
            if comm.pending_data_packets <= 0:
                comm.last_sync_hour = s.simulation_hour

    def _tick_crew(self, dt: float):
        s = self.state
        crew = s.crew
        env = s.environment

        crew.outdoor_ops_allowed = (
            env.wind_speed < WIND_OUTDOOR_RESTRICTED
            and env.temperature > TEMP_EXTREME_COLD
            and env.visibility > VISIBILITY_WHITEOUT
        )
        crew.shelter_in_place = (
            env.wind_speed > 100 or env.temperature < -55
        )
        crew.safety_risk = calculate_crew_safety_risk(
            s.infrastructure.indoor_temp_avg,
            s.energy.battery_level_percent,
            s.energy.power_deficit_kw,
            s.logistics.fuel_endurance_days,
            env.wind_speed,
        )

    def _tick_indoor_temp(self, dt: float):
        s = self.state
        infra = s.infrastructure
        env = s.environment

        for zone in infra.zones:
            zone.temperature = calculate_indoor_temperature(
                zone.temperature, zone.target_temperature,
                env.temperature,
                zone.is_heating_active,
                infra.heating_system_status == 'Failed',
                s.energy.power_deficit_kw, s.energy.total_consumption_kw,
                dt,
            )

        # Average indoor temp (critical zones only)
        critical_zones = [z for z in infra.zones if z.category == 'critical']
        if critical_zones:
            infra.indoor_temp_avg = sum(z.temperature for z in critical_zones) / len(critical_zones)

        # Heating system status from equipment
        heating_equip = next((e for e in s.equipment if e.category == 'heating'), None)
        if heating_equip:
            if not heating_equip.is_online or heating_equip.health <= 0:
                infra.heating_system_status = 'Failed'
            elif heating_equip.health < EQUIPMENT_HEALTH_CRITICAL:
                infra.heating_system_status = 'Critical'
            elif heating_equip.health < EQUIPMENT_HEALTH_WARNING:
                infra.heating_system_status = 'Warning'
            else:
                infra.heating_system_status = 'Nominal'

        # Overall infrastructure health
        online_equip = [e for e in s.equipment if e.is_online]
        if online_equip:
            infra.overall_health = round(
                sum(e.health for e in online_equip) / len(online_equip)
            )
        else:
            infra.overall_health = 0

        # Life support status
        if infra.indoor_temp_avg < TEMP_INDOOR_HYPOTHERMIA or s.energy.power_deficit_kw > 100:
            infra.life_support_status = 'Critical'
        elif infra.indoor_temp_avg < TEMP_INDOOR_LOW or s.energy.power_deficit_kw > 30:
            infra.life_support_status = 'Warning'
        else:
            infra.life_support_status = 'Nominal'

    # ---- Derived Calculations ----

    def _recalculate_derived(self):
        self._calculate_risk()
        self._calculate_resilience()
        self._update_cascade_chain()
        self._update_overall_status()

    def _calculate_risk(self):
        s = self.state
        reasons: List[RiskReason] = []

        # Environment
        if s.environment.temperature < TEMP_EXTREME_COLD:
            reasons.append(RiskReason(
                'Extreme temperature', 'critical',
                f'Ambient temperature at {s.environment.temperature:.1f}°C — life-threatening conditions',
            ))
        elif s.environment.temperature < TEMP_SEVERE_COLD:
            reasons.append(RiskReason(
                'Severe cold', 'warning',
                f'Temperature at {s.environment.temperature:.1f}°C — increased heating and equipment stress',
            ))

        if s.environment.wind_speed > 120:
            reasons.append(RiskReason(
                'Hurricane-force winds', 'critical',
                f'Wind speed {s.environment.wind_speed:.0f} km/h — structural risk, all outdoor ops suspended',
            ))
        elif s.environment.wind_speed > WIND_OUTDOOR_RESTRICTED:
            reasons.append(RiskReason(
                'Severe wind advisory', 'warning',
                f'Wind speed {s.environment.wind_speed:.0f} km/h — outdoor operations restricted',
            ))

        if s.environment.visibility < VISIBILITY_WHITEOUT:
            reasons.append(RiskReason(
                'Near-zero visibility', 'critical',
                f'Visibility {s.environment.visibility:.1f} km — whiteout conditions',
            ))

        # Energy
        if s.energy.power_deficit_kw > 50:
            reasons.append(RiskReason(
                'Severe power shortage', 'critical',
                f'Power deficit of {s.energy.power_deficit_kw:.0f} kW — critical systems at risk',
            ))
        elif s.energy.power_deficit_kw > 0:
            reasons.append(RiskReason(
                'Power shortage detected', 'warning',
                f'Power deficit of {s.energy.power_deficit_kw:.0f} kW — battery compensating',
            ))

        if s.energy.battery_level_percent < BATTERY_CRITICAL:
            reasons.append(RiskReason(
                'Battery critically low', 'critical',
                f'Battery reserve at {s.energy.battery_level_percent:.1f}% — imminent power loss',
            ))
        elif s.energy.battery_level_percent < BATTERY_LOW:
            reasons.append(RiskReason(
                'Battery reserve low', 'warning',
                f'Battery at {s.energy.battery_level_percent:.1f}% and {"charging" if s.energy.is_battery_charging else "discharging"}',
            ))

        # Generators
        failed_gens = [g for g in s.energy.generators if not g.is_online or g.failed_at_hour is not None]
        for g in failed_gens:
            detail = (f'Failed at simulation hour {g.failed_at_hour:.1f}'
                      if g.failed_at_hour is not None else 'Offline')
            reasons.append(RiskReason(
                f'{g.name} unavailable',
                'critical' if len(failed_gens) > 1 else 'warning',
                detail,
            ))

        # Fuel
        if s.logistics.fuel_endurance_days < FUEL_CRITICAL_DAYS:
            reasons.append(RiskReason(
                'Critical fuel shortage', 'critical',
                f'Only {s.logistics.fuel_endurance_days:.1f} days of fuel remaining',
            ))
        elif s.logistics.fuel_endurance_days < s.logistics.next_resupply_days:
            shortfall = s.logistics.next_resupply_days - s.logistics.fuel_endurance_days
            reasons.append(RiskReason(
                'Fuel shortage before resupply', 'warning',
                f'Fuel lasts {s.logistics.fuel_endurance_days:.1f} days but resupply in {s.logistics.next_resupply_days:.0f} days — shortage predicted {shortfall:.1f} days before resupply',
            ))

        # Indoor temperature
        if s.infrastructure.indoor_temp_avg < TEMP_INDOOR_HYPOTHERMIA:
            reasons.append(RiskReason(
                'Indoor temperature dangerously low', 'critical',
                f'Average indoor temperature {s.infrastructure.indoor_temp_avg:.1f}°C — hypothermia risk',
            ))
        elif s.infrastructure.indoor_temp_avg < TEMP_INDOOR_WARNING:
            reasons.append(RiskReason(
                'Indoor temperature dropping', 'warning',
                f'Average indoor temperature {s.infrastructure.indoor_temp_avg:.1f}°C — heating system under stress',
            ))

        # Communication
        if s.communication.status == 'Offline':
            reasons.append(RiskReason(
                'Communication offline', 'critical',
                'Satellite communication completely unavailable',
            ))
        elif s.communication.status == 'Degraded':
            reasons.append(RiskReason(
                'Communication degraded', 'warning',
                f'Satellite uplink at {s.communication.quality:.0f}% quality',
            ))

        # Food/water
        if s.logistics.food_endurance_days < FOOD_CRITICAL_DAYS:
            reasons.append(RiskReason(
                'Food supply critical', 'critical',
                f'Food reserves for only {s.logistics.food_endurance_days:.0f} days',
            ))
        if s.logistics.water_endurance_days < WATER_CRITICAL_DAYS:
            reasons.append(RiskReason(
                'Water supply critical', 'critical',
                f'Water reserves for only {s.logistics.water_endurance_days:.0f} days',
            ))

        # Equipment
        for eq in s.equipment:
            if eq.health < EQUIPMENT_HEALTH_CRITICAL and eq.is_online:
                reasons.append(RiskReason(
                    f'{eq.name} degraded', 'warning',
                    f'Health at {eq.health:.0f}% — failure risk increasing',
                ))

        # Determine overall risk level
        critical_count = sum(1 for r in reasons if r.severity == 'critical')
        warning_count = sum(1 for r in reasons if r.severity == 'warning')

        if critical_count >= 3:
            risk_level = 'CRITICAL'
        elif critical_count >= 1:
            risk_level = 'HIGH'
        elif warning_count >= 1:
            risk_level = 'MODERATE'
        else:
            risk_level = 'LOW'

        s.risk_level = risk_level
        s.risk_reasons = reasons

    def _calculate_resilience(self):
        s = self.state
        factors: List[ResilienceFactor] = []

        # Energy availability (15%)
        gen_online = sum(1 for g in s.energy.generators if g.is_online)
        gen_total = max(len(s.energy.generators), 1)
        energy_score = clamp(
            (100 if s.energy.power_surplus_kw > 0 else max(0, 100 - s.energy.power_deficit_kw * 2))
            * (gen_online / gen_total),
            0, 100,
        )
        factors.append(ResilienceFactor('Energy Availability', energy_score, RESILIENCE_WEIGHTS['energy_availability']))

        # Fuel endurance (15%)
        fuel_score = clamp(min(100, s.logistics.fuel_endurance_days * 1.0), 0, 100)
        factors.append(ResilienceFactor('Fuel Endurance', fuel_score, RESILIENCE_WEIGHTS['fuel_endurance']))

        # Equipment health (15%)
        equip_list = s.equipment or []
        avg_health = sum(e.health for e in equip_list) / max(len(equip_list), 1)
        factors.append(ResilienceFactor('Equipment Health', avg_health, RESILIENCE_WEIGHTS['equipment_health']))

        # Environmental (10%)
        env_score = clamp(
            100 - max(0, (-s.environment.temperature - 30) * 2)
            - max(0, (s.environment.wind_speed - 50) * 0.5),
            0, 100,
        )
        factors.append(ResilienceFactor('Environmental Conditions', env_score, RESILIENCE_WEIGHTS['environmental_conditions']))

        # Logistics (15%)
        log_score = clamp(min(
            s.logistics.food_endurance_days * 0.5,
            s.logistics.water_endurance_days * 1.0,
            s.logistics.medical_supply_percent,
            100,
        ), 0, 100)
        factors.append(ResilienceFactor('Logistics Status', log_score, RESILIENCE_WEIGHTS['logistics_status']))

        # Communication (10%)
        comm_score = s.communication.quality
        factors.append(ResilienceFactor('Communication', comm_score, RESILIENCE_WEIGHTS['communication']))

        # Crew safety (10%)
        crew_map = {'LOW': 100, 'MODERATE': 65, 'HIGH': 30, 'CRITICAL': 5}
        crew_score = crew_map.get(s.crew.safety_risk, 50)
        factors.append(ResilienceFactor('Crew Safety', crew_score, RESILIENCE_WEIGHTS['crew_safety']))

        # System integrity (10%)
        failure_count = (
            sum(1 for e in s.equipment if not e.is_online or e.health <= 0)
            + (1 if s.infrastructure.heating_system_status == 'Failed' else 0)
            + (1 if s.communication.status == 'Offline' else 0)
        )
        failure_score = clamp(100 - failure_count * 25, 0, 100)
        factors.append(ResilienceFactor('System Integrity', failure_score, RESILIENCE_WEIGHTS['system_integrity']))

        s.resilience_factors = factors
        s.resilience_score = round(sum(f.score * f.weight for f in factors))

    def _update_cascade_chain(self):
        s = self.state
        base = self.baseline_state

        chain = [
            CascadeNode(
                'env', 'Environment',
                f'{s.environment.temperature:.1f}°C / {s.environment.wind_speed:.0f} km/h',
                s.environment.temperature < -35 or s.environment.wind_speed > 60,
                'critical' if s.environment.temperature < -45 else 'warning' if s.environment.temperature < -35 else 'normal',
                ['heating'],
            ),
            CascadeNode(
                'heating', 'Heating Demand',
                f'{s.energy.heating_demand_kw:.0f} kW',
                s.energy.heating_demand_kw > base.energy.heating_demand_kw * 1.2,
                'critical' if s.energy.heating_demand_kw > base.energy.heating_demand_kw * 1.8 else 'warning' if s.energy.heating_demand_kw > base.energy.heating_demand_kw * 1.3 else 'normal',
                ['power'],
            ),
            CascadeNode(
                'power', 'Power Consumption',
                f'{s.energy.total_consumption_kw:.0f} kW',
                s.energy.total_consumption_kw > base.energy.total_consumption_kw * 1.15,
                'critical' if s.energy.power_deficit_kw > 0 else 'warning' if s.energy.total_consumption_kw > base.energy.total_consumption_kw * 1.3 else 'normal',
                ['genload'],
            ),
            CascadeNode(
                'genload', 'Generator Load',
                ' / '.join(f'{g.load_percent:.0f}%' for g in s.energy.generators if g.is_online) or 'N/A',
                any(g.is_online and g.load_percent > 75 for g in s.energy.generators),
                'critical' if any(g.is_online and g.load_percent > 90 for g in s.energy.generators) else 'warning' if any(g.is_online and g.load_percent > 75 for g in s.energy.generators) else 'normal',
                ['fuel'],
            ),
            CascadeNode(
                'fuel', 'Fuel Consumption',
                f'{s.logistics.fuel_consumption_lph:.1f} L/hr',
                s.logistics.fuel_consumption_lph > base.logistics.fuel_consumption_lph * 1.2,
                'critical' if s.logistics.fuel_endurance_days < 14 else 'warning' if s.logistics.fuel_consumption_lph > base.logistics.fuel_consumption_lph * 1.5 else 'normal',
                ['endurance'],
            ),
            CascadeNode(
                'endurance', 'Fuel Endurance',
                f'{s.logistics.fuel_endurance_days:.1f} days',
                s.logistics.fuel_endurance_days < base.logistics.fuel_endurance_days * 0.7,
                'critical' if s.logistics.fuel_endurance_days < 14 else 'warning' if s.logistics.fuel_endurance_days < 60 else 'normal',
                ['risk'],
            ),
            CascadeNode(
                'risk', 'Station Risk',
                s.risk_level,
                s.risk_level != 'LOW',
                'critical' if s.risk_level == 'CRITICAL' else 'warning' if s.risk_level in ('HIGH', 'MODERATE') else 'normal',
                [],
            ),
        ]
        s.cascade_chain = chain

    def _update_overall_status(self):
        s = self.state
        if s.risk_level == 'CRITICAL':
            s.overall_status = 'Critical'
        elif s.risk_level in ('HIGH', 'MODERATE'):
            s.overall_status = 'Warning'
        else:
            s.overall_status = 'Nominal'

    def _check_alert_thresholds(self):
        s = self.state
        hour = s.simulation_hour

        # Only check once per simulated hour
        if hour - math.floor(hour) > self.TICK_INTERVAL_HOURS * 1.5:
            return

        # Power shortage
        if s.energy.power_deficit_kw > 0:
            if not any(e.title == 'Power Shortage Detected' and hour - e.hour < 1
                       for e in s.events):
                battery_hours = (
                    (s.energy.battery_capacity_kwh * s.energy.battery_level_percent / 100)
                    / max(s.energy.battery_discharge_rate_kw, 1)
                    if s.energy.battery_level_percent > 0 else 0
                )
                self.add_event(
                    'critical', 'Energy', 'Power Shortage Detected',
                    f'Generation ({s.energy.total_generation_kw:.0f} kW) below demand ({s.energy.total_consumption_kw:.0f} kW). Battery reserves can sustain operations for approximately {battery_hours:.1f} hours.',
                )

        # Fuel shortage before resupply
        if (s.logistics.fuel_endurance_days < s.logistics.next_resupply_days and
                not any(e.title == 'Fuel Shortage Predicted' and hour - e.hour < 6
                        for e in s.events)):
            shortfall = s.logistics.next_resupply_days - s.logistics.fuel_endurance_days
            self.add_event(
                'critical', 'Logistics', 'Fuel Shortage Predicted',
                f'Fuel will be depleted {shortfall:.1f} days before next resupply. Current fuel endurance: {s.logistics.fuel_endurance_days:.1f} days.',
            )

        # Indoor temperature
        if (s.infrastructure.indoor_temp_avg < TEMP_INDOOR_LOW and
                not any(e.title == 'Indoor Temperature Dropping' and hour - e.hour < 2
                        for e in s.events)):
            heating_note = ('Heating system is offline.'
                            if s.infrastructure.heating_system_status == 'Failed'
                            else 'Heating system under strain.')
            self.add_event(
                'warning', 'Infrastructure', 'Indoor Temperature Dropping',
                f'Average indoor temperature has fallen to {s.infrastructure.indoor_temp_avg:.1f}°C. {heating_note}',
            )
