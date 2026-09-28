"""
state.py — StationState data structures
Antarctic Digital Twin — SIH26060

Python equivalent of the frontend's StationState TypeScript interface.
Fully serializable to/from JSON for database persistence.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Optional
import copy
import json


@dataclass
class GeneratorState:
    id: str = ''
    name: str = ''
    rated_capacity_kw: float = 0
    current_output_kw: float = 0
    load_percent: float = 0
    health: float = 100
    temperature: float = 20
    vibration: float = 0
    efficiency: float = 0.95
    fuel_rate_lph: float = 0
    is_online: bool = False
    failed_at_hour: Optional[float] = None
    hours_running: float = 0
    status: str = 'Nominal'


@dataclass
class EquipmentItem:
    id: str = ''
    name: str = ''
    category: str = ''  # generator, heating, water, solar, comms, science, vehicle
    health: float = 100
    temperature: float = 20
    vibration: float = 0
    efficiency: float = 0.95
    is_online: bool = True
    status: str = 'Nominal'
    degradation_rate: float = 0.02
    health_history: List[float] = field(default_factory=list)


@dataclass
class ZoneTemperature:
    name: str = ''
    category: str = 'critical'  # 'critical' or 'non-critical'
    temperature: float = 21.0
    target_temperature: float = 21.0
    heating_kw: float = 10.0
    is_heating_active: bool = True


@dataclass
class EnvironmentState:
    temperature: float = -28.0
    wind_speed: float = 42.0
    wind_direction: str = 'ESE (115°)'
    wind_chill: float = -41.0
    humidity: float = 48.0
    air_pressure: float = 986.0
    uv_index: float = 1.2
    visibility: float = 35.0
    snow_accumulation: float = 14.0


@dataclass
class EnergyState:
    generators: List[GeneratorState] = field(default_factory=list)
    backup_generator: GeneratorState = field(default_factory=GeneratorState)
    total_generation_kw: float = 0
    total_consumption_kw: float = 0
    solar_generation_kw: float = 0
    solar_max_kw: float = 0
    wind_generation_kw: float = 0
    heating_demand_kw: float = 0
    base_load_kw: float = 0
    battery_level_percent: float = 94.0
    battery_capacity_kwh: float = 500.0
    battery_charge_rate_kw: float = 0
    battery_discharge_rate_kw: float = 0
    is_battery_charging: bool = True
    power_deficit_kw: float = 0
    power_surplus_kw: float = 0


@dataclass
class LogisticsState:
    fuel_level_liters: float = 185000
    fuel_consumption_lph: float = 40
    fuel_endurance_days: float = 192.7
    food_remaining_kg: float = 7750
    food_consumption_kg_per_day: float = 25
    food_endurance_days: float = 310
    water_storage_liters: float = 48000
    water_consumption_lpd: float = 500
    water_endurance_days: float = 96
    medical_supply_percent: float = 95
    medical_endurance_days: float = 365
    spare_parts_percent: float = 88
    spare_parts_endurance_days: float = 240
    next_resupply_date: str = 'November 2026'
    next_resupply_days: float = 55
    resupply_delay_days: float = 0


@dataclass
class InfrastructureState:
    overall_health: float = 97
    zones: List[ZoneTemperature] = field(default_factory=list)
    indoor_temp_avg: float = 21.5
    heating_system_status: str = 'Nominal'
    life_support_status: str = 'Nominal'
    water_treatment_status: str = 'Nominal'
    active_sensors: int = 248
    total_sensors: int = 252


@dataclass
class CommunicationState:
    satellite_uplink_mbps: float = 50
    max_uplink_mbps: float = 50
    quality: float = 100
    status: str = 'Online'  # Online, Degraded, Offline
    is_data_syncing: bool = True
    pending_data_packets: float = 0
    last_sync_hour: float = 0


@dataclass
class CrewState:
    count: int = 25
    base_count: int = 25
    safety_risk: str = 'LOW'
    outdoor_ops_allowed: bool = True
    shelter_in_place: bool = False


@dataclass
class RiskReason:
    factor: str = ''
    severity: str = 'info'  # info, warning, critical
    detail: str = ''

    def to_dict(self) -> dict:
        return {'factor': self.factor, 'severity': self.severity, 'detail': self.detail}


@dataclass
class SimulationEventData:
    hour: float = 0
    type: str = 'info'
    category: str = ''
    title: str = ''
    description: str = ''


@dataclass
class CascadeNode:
    id: str = ''
    label: str = ''
    detail: str = ''
    is_active: bool = False
    severity: str = 'normal'
    children: List[str] = field(default_factory=list)


@dataclass
class ResilienceFactor:
    name: str = ''
    score: float = 100
    weight: float = 0.1

    def to_dict(self) -> dict:
        return {'name': self.name, 'score': self.score, 'weight': self.weight}


@dataclass
class StationState:
    station_id: str = 'maitri'
    station_name: str = 'Maitri Station'
    environment: EnvironmentState = field(default_factory=EnvironmentState)
    energy: EnergyState = field(default_factory=EnergyState)
    logistics: LogisticsState = field(default_factory=LogisticsState)
    infrastructure: InfrastructureState = field(default_factory=InfrastructureState)
    communication: CommunicationState = field(default_factory=CommunicationState)
    crew: CrewState = field(default_factory=CrewState)
    equipment: List[EquipmentItem] = field(default_factory=list)
    risk_level: str = 'LOW'
    risk_reasons: List[RiskReason] = field(default_factory=list)
    resilience_score: float = 100
    resilience_factors: List[ResilienceFactor] = field(default_factory=list)
    overall_status: str = 'Nominal'
    simulation_hour: float = 0
    events: List[SimulationEventData] = field(default_factory=list)
    active_scenarios: List[str] = field(default_factory=list)
    active_interventions: List[str] = field(default_factory=list)
    cascade_chain: List[CascadeNode] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Serialize to a plain dict (JSON-compatible)."""
        return asdict(self)

    def to_json(self) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict())

    @classmethod
    def from_dict(cls, data: dict) -> 'StationState':
        """Deserialize from a plain dict."""
        if not data:
            return cls()

        state = cls()
        state.station_id = data.get('station_id', 'maitri')
        state.station_name = data.get('station_name', 'Maitri Station')
        state.risk_level = data.get('risk_level', 'LOW')
        state.resilience_score = data.get('resilience_score', 100)
        state.overall_status = data.get('overall_status', 'Nominal')
        state.simulation_hour = data.get('simulation_hour', 0)
        state.active_scenarios = data.get('active_scenarios', [])
        state.active_interventions = data.get('active_interventions', [])

        # Environment
        env_data = data.get('environment', {})
        if env_data:
            state.environment = EnvironmentState(**{
                k: env_data[k] for k in EnvironmentState.__dataclass_fields__
                if k in env_data
            })

        # Energy
        en_data = data.get('energy', {})
        if en_data:
            gens = [GeneratorState(**g) for g in en_data.get('generators', [])]
            backup_data = en_data.get('backup_generator', {})
            backup = GeneratorState(**backup_data) if backup_data else GeneratorState()
            state.energy = EnergyState(
                generators=gens,
                backup_generator=backup,
                **{k: en_data[k] for k in EnergyState.__dataclass_fields__
                   if k in en_data and k not in ('generators', 'backup_generator')}
            )

        # Logistics
        log_data = data.get('logistics', {})
        if log_data:
            state.logistics = LogisticsState(**{
                k: log_data[k] for k in LogisticsState.__dataclass_fields__
                if k in log_data
            })

        # Infrastructure
        infra_data = data.get('infrastructure', {})
        if infra_data:
            zones = [ZoneTemperature(**z) for z in infra_data.get('zones', [])]
            state.infrastructure = InfrastructureState(
                zones=zones,
                **{k: infra_data[k] for k in InfrastructureState.__dataclass_fields__
                   if k in infra_data and k != 'zones'}
            )

        # Communication
        comm_data = data.get('communication', {})
        if comm_data:
            state.communication = CommunicationState(**{
                k: comm_data[k] for k in CommunicationState.__dataclass_fields__
                if k in comm_data
            })

        # Crew
        crew_data = data.get('crew', {})
        if crew_data:
            state.crew = CrewState(**{
                k: crew_data[k] for k in CrewState.__dataclass_fields__
                if k in crew_data
            })

        # Equipment
        eq_list = data.get('equipment', [])
        state.equipment = [EquipmentItem(**e) for e in eq_list]

        # Risk reasons
        state.risk_reasons = [
            RiskReason(**r) for r in data.get('risk_reasons', [])
        ]

        # Resilience factors
        state.resilience_factors = [
            ResilienceFactor(**f) for f in data.get('resilience_factors', [])
        ]

        # Events
        state.events = [
            SimulationEventData(**e) for e in data.get('events', [])
        ]

        # Cascade chain
        state.cascade_chain = [
            CascadeNode(**c) for c in data.get('cascade_chain', [])
        ]

        return state

    @classmethod
    def from_json(cls, json_str: str) -> 'StationState':
        """Deserialize from JSON string."""
        return cls.from_dict(json.loads(json_str))

    def deep_copy(self) -> 'StationState':
        """Create a deep copy of this state."""
        return copy.deepcopy(self)
