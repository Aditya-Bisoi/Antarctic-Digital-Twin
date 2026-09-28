"""
intervention_generator.py — Dynamic Intervention Candidate Generator
Antarctic Digital Twin — SIH26060

Architecture:
Current Simulation State
        ↓
Identify problems (diagnose_state)
        ↓
Identify available resources (get_available_resources)
        ↓
Identify possible actions & check prerequisites (get_feasible_interventions)
        ↓
Remove impossible/unsafe actions (pruning)
        ↓
Generate individual interventions & compatible combinations (generate_candidate_combinations)
"""

from typing import List, Dict, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from .state import StationState
from .interventions import INTERVENTIONS, get_intervention_by_id


# ============================================================================
# Data Models
# ============================================================================

@dataclass
class IdentifiedProblem:
    """Represents a specific physical or operational vulnerability identified in current telemetry."""
    problem_type: str  # 'GENERATOR_OVERLOAD', 'POWER_DEFICIT', 'BATTERY_DEPLETION', 'EXTREME_THERMAL_LOSS', etc.
    severity: str      # 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'
    details: str
    metric_value: Any
    threshold: Any
    threatened_systems: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'problemType': self.problem_type,
            'problem_type': self.problem_type,
            'severity': self.severity,
            'details': self.details,
            'metricValue': self.metric_value,
            'threshold': self.threshold,
            'threatenedSystems': self.threatened_systems,
            'threatened_systems': self.threatened_systems,
        }


@dataclass
class InterventionModel:
    """Structured representation of an operational intervention with prerequisites, constraints, and physics impacts."""
    id: str
    name: str
    description: str
    category: str  # 'ENERGY', 'HEATING', 'LOGISTICS', 'MAINTENANCE', 'COMMUNICATION'
    icon: str
    prerequisites: List[str]
    constraints: List[str]
    expected_effects: Dict[str, Any]
    resource_cost: Dict[str, Any]
    safety_consequences: List[str]
    compatibility_rules: List[str]
    duration: Optional[int]
    reversible: bool

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'category': self.category,
            'icon': self.icon,
            'prerequisites': self.prerequisites,
            'constraints': self.constraints,
            'expectedEffects': self.expected_effects,
            'expected_effects': self.expected_effects,
            'resourceCost': self.resource_cost,
            'resource_cost': self.resource_cost,
            'safetyConsequences': self.safety_consequences,
            'safety_consequences': self.safety_consequences,
            'compatibilityRules': self.compatibility_rules,
            'compatibility_rules': self.compatibility_rules,
            'duration': self.duration,
            'reversible': self.reversible,
        }


# ============================================================================
# Registered Structured Intervention Definitions
# ============================================================================

STRUCTURED_INTERVENTIONS: Dict[str, InterventionModel] = {
    'start_backup_generator': InterventionModel(
        id='start_backup_generator',
        name='Start Backup Generator',
        description='Commission auxiliary emergency generator to expand available electrical capacity by +200 kW.',
        category='ENERGY',
        icon='Zap',
        prerequisites=[
            'Backup generator physical health > 10%',
            'Backup generator not currently online',
            'Fuel reserves > 500 Liters'
        ],
        constraints=[
            'Requires continuous diesel delivery',
            'Increases station fuel consumption by ~25 L/h'
        ],
        expected_effects={
            'generation_capacity_kw': 200.0,
            'generator_load_percent': -25.0,
            'power_deficit_reduction_kw': 200.0,
        },
        resource_cost={
            'fuel_rate_lph': 25.0,
            'crew_workload': 'moderate',
        },
        safety_consequences=[
            'Mitigates blackout risk; slight increase in continuous generator room acoustic/thermal stress.'
        ],
        compatibility_rules=['reduce_noncritical_loads', 'prioritize_critical', 'preserve_battery', 'reduce_noncritical_heating'],
        duration=None,
        reversible=True,
    ),
    'reduce_noncritical_loads': InterventionModel(
        id='reduce_noncritical_loads',
        name='Reduce Non-Critical Loads',
        description='Shed discretionary electrical loads (science lab circuits, workshops, recreational equipment) for ~30% power savings.',
        category='ENERGY',
        icon='Power',
        prerequisites=[
            'Non-critical circuits currently receiving power',
            'Habitat core life support separated from auxiliary bus'
        ],
        constraints=[
            'Requires temporary suspension of non-essential science data collection'
        ],
        expected_effects={
            'consumption_reduction_percent': 30.0,
            'generator_load_percent': -20.0,
            'battery_discharge_reduction_percent': 35.0,
        },
        resource_cost={
            'experimental_data_loss': 'low',
        },
        safety_consequences=[
            'Zero life safety degradation; improves grid stability margin.'
        ],
        compatibility_rules=['start_backup_generator', 'prioritize_critical', 'preserve_battery', 'reduce_noncritical_heating'],
        duration=None,
        reversible=True,
    ),
    'prioritize_critical': InterventionModel(
        id='prioritize_critical',
        name='Prioritize Critical Systems',
        description='Enforce hard power routing to life-support scrubbers, medical bay, communication array, and core habitat.',
        category='ENERGY',
        icon='Shield',
        prerequisites=[
            'Power distribution microgrid functional'
        ],
        constraints=[
            'Limits auxiliary scientific and peripheral systems power'
        ],
        expected_effects={
            'consumption_reduction_percent': 10.0,
            'life_support_guarantee_percent': 100.0,
            'crew_safety_score_improvement': 25.0,
        },
        resource_cost={
            'secondary_sensor_data_rate': -40.0,
        },
        safety_consequences=[
            'Directly protects expedition crew life safety during emergencies.'
        ],
        compatibility_rules=['start_backup_generator', 'reduce_noncritical_loads', 'preserve_battery', 'emergency_resupply'],
        duration=None,
        reversible=True,
    ),
    'increase_renewables': InterventionModel(
        id='increase_renewables',
        name='Maximize Renewable Energy',
        description='Realign solar PV tracking and adjust wind turbine pitch for peak polar microgrid generation (+40%).',
        category='ENERGY',
        icon='Sun',
        prerequisites=[
            'Wind speed < 100 km/h (below turbine mechanical furling cut-off)',
            'Visibility > 1.0 km',
            'Wind speed >= 10 km/h OR Solar potential >= 5 kW'
        ],
        constraints=[
            'Strictly climate-constrained: Ineffective during total polar night or katabatic hurricane'
        ],
        expected_effects={
            'renewable_generation_boost_percent': 40.0,
            'diesel_displacement_lph': 15.0,
            'fuel_endurance_extension_days': 2.5,
        },
        resource_cost={
            'mechanical_wear_on_turbines': 'moderate',
        },
        safety_consequences=[
            'Must automatically furl if katabatic winds exceed 100 km/h.'
        ],
        compatibility_rules=['reduce_noncritical_loads', 'preserve_battery'],
        duration=None,
        reversible=True,
    ),
    'preserve_battery': InterventionModel(
        id='preserve_battery',
        name='Preserve Battery Power',
        description='Engage battery conservation mode. Throttle discharge rate by 40% to protect black-start emergency reserve.',
        category='ENERGY',
        icon='Battery',
        prerequisites=[
            'Battery bank health > 10%',
            'Battery charge level > 12%'
        ],
        constraints=[
            'Reduces peak supplemental surge capacity'
        ],
        expected_effects={
            'battery_discharge_rate_reduction_percent': 40.0,
            'battery_endurance_extension_hours': 18.0,
        },
        resource_cost={
            'peak_load_shaving_capability': -30.0,
        },
        safety_consequences=[
            'Maintains non-negotiable emergency station survival reserve.'
        ],
        compatibility_rules=['reduce_noncritical_loads', 'start_backup_generator', 'prioritize_critical'],
        duration=None,
        reversible=True,
    ),
    'reduce_noncritical_heating': InterventionModel(
        id='reduce_noncritical_heating',
        name='Reduce Non-Critical Area Heating',
        description='Lower heating setpoint in unstaffed vehicle workshops and cargo storage to save ~20 kW thermal power.',
        category='HEATING',
        icon='ThermometerSnowflake',
        prerequisites=[
            'Heating system not completely failed',
            'Habitat core living zones maintained above safe minimum (>= 12°C)',
            'Non-critical storage zones identified'
        ],
        constraints=[
            'Peripheral storage zones will cool toward +2°C'
        ],
        expected_effects={
            'thermal_power_savings_kw': 20.0,
            'generator_load_percent': -12.0,
        },
        resource_cost={
            'storage_temperature_drop_c': -8.0,
        },
        safety_consequences=[
            'Requires monitoring to prevent fluid freezing in storage bays.'
        ],
        compatibility_rules=['reduce_noncritical_loads', 'start_backup_generator', 'prioritize_critical'],
        duration=None,
        reversible=True,
    ),
    'emergency_resupply': InterventionModel(
        id='emergency_resupply',
        name='Request Emergency Resupply',
        description='Dispatch high-priority polar airlift / ice-breaker resupply request via NCPOR Goa.',
        category='LOGISTICS',
        icon='Ship',
        prerequisites=[
            'Satellite communication array online (quality > 15%)',
            'Katabatic wind speed <= 120 km/h (flight transport envelope)'
        ],
        constraints=[
            'Contingent on maritime ice pack and polar flight weather conditions'
        ],
        expected_effects={
            'resupply_eta_reduction_days': 15.0,
            'fuel_delivery_liters': 35000.0,
        },
        resource_cost={
            'national_polar_program_logistics_cost': 'high',
        },
        safety_consequences=[
            'Flight operations in severe Antarctic weather carry operational transport risk.'
        ],
        compatibility_rules=['start_backup_generator', 'prioritize_critical', 'reduce_noncritical_loads'],
        duration=None,
        reversible=False,
    ),
    'increase_maintenance': InterventionModel(
        id='increase_maintenance',
        name='Increase Maintenance Priority',
        description='Assign expedition engineers to expedited preventive maintenance cycles, slowing mechanical wear by 60%.',
        category='MAINTENANCE',
        icon='Wrench',
        prerequisites=[
            'Expedition crew count >= 5',
            'Spare parts inventory accessible'
        ],
        constraints=[
            'Increases crew physical workload and spare parts consumption'
        ],
        expected_effects={
            'degradation_rate_reduction_percent': 60.0,
            'equipment_failure_probability_reduction': 45.0,
        },
        resource_cost={
            'spare_parts_consumption_rate': +25.0,
            'crew_rest_time_reduction_hours': 2.0,
        },
        safety_consequences=[
            'Substantially lowers cascading mechanical failure probability.'
        ],
        compatibility_rules=['prioritize_critical', 'generator_schedule'],
        duration=None,
        reversible=True,
    ),
    'generator_schedule': InterventionModel(
        id='generator_schedule',
        name='Optimize Generator Schedule',
        description='Dynamically rebalance continuous electrical load between multiple online generators to reduce peak thermal stress.',
        category='ENERGY',
        icon='Clock',
        prerequisites=[
            'At least 2 generator units online and synchronized'
        ],
        constraints=[
            'Requires dual generator operational availability'
        ],
        expected_effects={
            'generator_peak_load_leveling_percent': 18.0,
            'equipment_stress_reduction_percent': 30.0,
        },
        resource_cost={
            'synchronization_overhead': 'low',
        },
        safety_consequences=[
            'Prevents single-point generator thermal overload failures.'
        ],
        compatibility_rules=['increase_maintenance', 'prioritize_critical', 'start_backup_generator'],
        duration=None,
        reversible=True,
    ),
}


# ============================================================================
# Scenario-to-Intervention Priority Mapping
# Maps each scenario ID to its most relevant interventions in priority order.
# Used to boost relevance scores and prioritize candidate packages.
# ============================================================================

SCENARIO_INTERVENTION_PRIORITIES: Dict[str, List[str]] = {
    'extreme_cold': ['reduce_noncritical_heating', 'start_backup_generator', 'prioritize_critical', 'preserve_battery'],
    'antarctic_storm': ['start_backup_generator', 'reduce_noncritical_loads', 'preserve_battery', 'reduce_noncritical_heating'],
    'generator_failure': ['start_backup_generator', 'reduce_noncritical_loads', 'prioritize_critical', 'generator_schedule'],
    'heating_failure': ['prioritize_critical', 'start_backup_generator', 'reduce_noncritical_loads'],
    'fuel_shortage': ['reduce_noncritical_loads', 'reduce_noncritical_heating', 'increase_renewables', 'emergency_resupply'],
    'resupply_delay': ['reduce_noncritical_loads', 'reduce_noncritical_heating', 'emergency_resupply', 'preserve_battery'],
    'comm_failure': ['prioritize_critical', 'preserve_battery', 'increase_maintenance'],
    'equipment_degradation': ['increase_maintenance', 'generator_schedule', 'start_backup_generator'],
    'crew_increase': ['increase_renewables', 'reduce_noncritical_loads', 'start_backup_generator'],
    'multi_equipment_failure': ['start_backup_generator', 'reduce_noncritical_loads', 'prioritize_critical', 'emergency_resupply'],
    'combined_emergency': ['start_backup_generator', 'reduce_noncritical_loads', 'prioritize_critical', 'preserve_battery', 'reduce_noncritical_heating'],
    'full_cascade': ['start_backup_generator', 'reduce_noncritical_loads', 'prioritize_critical', 'preserve_battery', 'reduce_noncritical_heating', 'emergency_resupply'],
}


# ============================================================================
# State Problem Diagnoser
# ============================================================================

class StateProblemIdentifier:
    """Analyzes digital twin telemetry and physical state to diagnose actual vulnerabilities and threats."""

    @staticmethod
    def diagnose(state: StationState, predictions: Optional[List[Any]] = None) -> List[IdentifiedProblem]:
        problems: List[IdentifiedProblem] = []

        # 1. Electrical Deficit / Overload
        if state.energy.power_deficit_kw > 0:
            problems.append(IdentifiedProblem(
                problem_type='POWER_DEFICIT',
                severity='CRITICAL',
                details=f"Station electrical demand exceeds generation by {state.energy.power_deficit_kw:.1f} kW. Unserved deficit threatens critical life-support scrubbers.",
                metric_value=state.energy.power_deficit_kw,
                threshold=0.0,
                threatened_systems=['Microgrid', 'EnvironmentalScrubbers', 'HabitatPower']
            ))

        online_gens = [g for g in state.energy.generators if g.is_online]
        for gen in online_gens:
            if gen.load_percent > 95.0:
                problems.append(IdentifiedProblem(
                    problem_type='GENERATOR_OVERLOAD',
                    severity='CRITICAL' if gen.load_percent > 105.0 else 'HIGH',
                    details=f"Generator '{gen.name}' operating at dangerous {gen.load_percent:.0f}% load capacity (safe target <= 85%). Risk of emergency shutdown.",
                    metric_value=gen.load_percent,
                    threshold=85.0,
                    threatened_systems=[gen.name, 'PrimaryPowerGrid']
                ))
            elif gen.load_percent > 85.0:
                problems.append(IdentifiedProblem(
                    problem_type='GENERATOR_OVERLOAD',
                    severity='MODERATE',
                    details=f"Generator '{gen.name}' operating at elevated {gen.load_percent:.0f}% load. Continuous high load accelerates mechanical degradation.",
                    metric_value=gen.load_percent,
                    threshold=85.0,
                    threatened_systems=[gen.name]
                ))

        # 2. Battery Depletion
        if state.energy.battery_level_percent < 15.0:
            problems.append(IdentifiedProblem(
                problem_type='BATTERY_DEPLETION',
                severity='CRITICAL',
                details=f"Station battery reserve depleted to {state.energy.battery_level_percent:.1f}% (below 15.0% emergency threshold). Station vulnerable to total blackout.",
                metric_value=state.energy.battery_level_percent,
                threshold=15.0,
                threatened_systems=['BatteryBank', 'EmergencyPower']
            ))
        elif state.energy.battery_level_percent < 35.0:
            problems.append(IdentifiedProblem(
                problem_type='BATTERY_DEPLETION',
                severity='HIGH',
                details=f"Station battery reserve low at {state.energy.battery_level_percent:.1f}%. Buffer for generation interruptions is narrow.",
                metric_value=state.energy.battery_level_percent,
                threshold=35.0,
                threatened_systems=['BatteryBank']
            ))

        # 3. Thermal Loss & Freeze Hazards
        if state.infrastructure.indoor_temp_avg < 10.0:
            problems.append(IdentifiedProblem(
                problem_type='EXTREME_THERMAL_LOSS',
                severity='CRITICAL',
                details=f"Average indoor temperature collapsed to {state.infrastructure.indoor_temp_avg:.1f}°C (safe minimum is 10.0°C). Hypothermia and pipe freezing hazard.",
                metric_value=state.infrastructure.indoor_temp_avg,
                threshold=10.0,
                threatened_systems=['HabitatHVAC', 'Plumbing', 'CrewLivingQuarters']
            ))
        elif state.infrastructure.indoor_temp_avg < 16.0:
            problems.append(IdentifiedProblem(
                problem_type='EXTREME_THERMAL_LOSS',
                severity='HIGH',
                details=f"Average indoor temperature is {state.infrastructure.indoor_temp_avg:.1f}°C, below comfort setpoint of 18.0°C.",
                metric_value=state.infrastructure.indoor_temp_avg,
                threshold=16.0,
                threatened_systems=['HabitatHVAC']
            ))

        # Check individual zones
        for zone in state.infrastructure.zones:
            if zone.temperature < 10.0 and zone.category == 'critical':
                problems.append(IdentifiedProblem(
                    problem_type='ZONE_FREEZE_HAZARD',
                    severity='CRITICAL',
                    details=f"Critical zone '{zone.name}' has dropped to {zone.temperature:.1f}°C.",
                    metric_value=zone.temperature,
                    threshold=10.0,
                    threatened_systems=[zone.name]
                ))

        # 4. Logistics & Fuel Depletion
        if state.logistics.fuel_endurance_days < 7.0:
            problems.append(IdentifiedProblem(
                problem_type='FUEL_CRITICAL',
                severity='CRITICAL',
                details=f"Fuel reserves represent only {state.logistics.fuel_endurance_days:.1f} days of endurance at current burn rates.",
                metric_value=state.logistics.fuel_endurance_days,
                threshold=7.0,
                threatened_systems=['FuelTanks', 'Generators']
            ))
        elif state.logistics.fuel_endurance_days < 25.0:
            problems.append(IdentifiedProblem(
                problem_type='FUEL_CRITICAL',
                severity='MODERATE',
                details=f"Fuel endurance is {state.logistics.fuel_endurance_days:.1f} days. Scheduled resupply window requires strict conservation.",
                metric_value=state.logistics.fuel_endurance_days,
                threshold=25.0,
                threatened_systems=['FuelTanks']
            ))

        # Logistics resupply mismatch
        if state.logistics.fuel_endurance_days < state.logistics.next_resupply_days:
            problems.append(IdentifiedProblem(
                problem_type='LOGISTICS_DELAY',
                severity='HIGH',
                details=f"Fuel will deplete in {state.logistics.fuel_endurance_days:.1f} days, but next resupply is {state.logistics.next_resupply_days:.0f} days away (gap of {state.logistics.next_resupply_days - state.logistics.fuel_endurance_days:.1f} days).",
                metric_value=state.logistics.next_resupply_days - state.logistics.fuel_endurance_days,
                threshold=0.0,
                threatened_systems=['StationLogistics', 'LifeSupportAutonomy']
            ))

        # 5. Weather Hazards
        if state.environment.wind_speed > 90.0:
            problems.append(IdentifiedProblem(
                problem_type='WEATHER_HAZARD',
                severity='CRITICAL' if state.environment.wind_speed > 110.0 else 'HIGH',
                details=f"Severe katabatic blizzard winds reaching {state.environment.wind_speed:.0f} km/h (Wind chill: {state.environment.wind_chill:.1f}°C). Structural and outdoor movement prohibited.",
                metric_value=state.environment.wind_speed,
                threshold=90.0,
                threatened_systems=['ExternalStructures', 'RenewableTurbines', 'LogisticsAirlift']
            ))
        elif state.environment.temperature < -35.0:
            problems.append(IdentifiedProblem(
                problem_type='WEATHER_HAZARD',
                severity='MODERATE',
                details=f"Extreme Antarctic cold at {state.environment.temperature:.1f}°C accelerates station building envelope thermal loss.",
                metric_value=state.environment.temperature,
                threshold=-35.0,
                threatened_systems=['BuildingEnvelope']
            ))

        # 6. Communication Degradation
        if state.communication.quality < 25.0 or state.communication.status == 'Offline':
            problems.append(IdentifiedProblem(
                problem_type='COMMUNICATION_DEGRADATION',
                severity='CRITICAL',
                details=f"Station communication array is {state.communication.status} (signal quality {state.communication.quality:.0f}%). Remote telemetry and emergency distress links disrupted.",
                metric_value=state.communication.quality,
                threshold=25.0,
                threatened_systems=['SatelliteArray', 'NCPORGoaUplink']
            ))
        elif state.communication.quality < 50.0:
            problems.append(IdentifiedProblem(
                problem_type='COMMUNICATION_DEGRADATION',
                severity='MODERATE',
                details=f"Communication quality degraded to {state.communication.quality:.0f}%.",
                metric_value=state.communication.quality,
                threshold=50.0,
                threatened_systems=['SatelliteArray']
            ))

        # 7. Equipment Degradation and Failure
        for eq in (state.equipment or []):
            is_critical = getattr(eq, 'criticality', '') == 'CRITICAL' or eq.category in ['generator', 'heating', 'water']
            if not eq.is_online or eq.health <= 0:
                problems.append(IdentifiedProblem(
                    problem_type='EQUIPMENT_FAILURE',
                    severity='CRITICAL' if is_critical else 'HIGH',
                    details=f"Equipment '{eq.name}' is OFFLINE / FAILED (Health: {eq.health:.0f}%).",
                    metric_value=eq.health,
                    threshold=0.0,
                    threatened_systems=[eq.id]
                ))
            elif eq.health < 40.0:
                problems.append(IdentifiedProblem(
                    problem_type='EQUIPMENT_DEGRADATION',
                    severity='HIGH' if is_critical else 'MODERATE',
                    details=f"Equipment '{eq.name}' severely degraded (Health: {eq.health:.0f}%). Impending mechanical failure risk.",
                    metric_value=eq.health,
                    threshold=40.0,
                    threatened_systems=[eq.id]
                ))

        # 8. Machine Learning Predictive Failures
        if predictions:
            for pred in predictions:
                p_dict = pred if isinstance(pred, dict) else (pred.to_dict() if hasattr(pred, 'to_dict') else {})
                prob = p_dict.get('failureProbability24h') or p_dict.get('failure_probability_24h') or p_dict.get('probability') or 0.0
                if prob > 0.50:
                    eq_name = p_dict.get('equipmentName') or p_dict.get('equipment_name') or p_dict.get('equipmentId') or 'Equipment'
                    problems.append(IdentifiedProblem(
                        problem_type='PREDICTED_EQUIPMENT_FAILURE',
                        severity='HIGH' if prob > 0.70 else 'MODERATE',
                        details=f"Predictive ML model forecasts {prob * 100:.0f}% failure probability within 24h for '{eq_name}'.",
                        metric_value=round(prob, 2),
                        threshold=0.50,
                        threatened_systems=[str(p_dict.get('equipmentId') or p_dict.get('equipment_id') or eq_name)]
                    ))

        return problems


# ============================================================================
# Resource Evaluator
# ============================================================================

def get_available_resources(state: StationState) -> Dict[str, Any]:
    """Inspects station inventory and environmental potential to identify actionable resources."""
    backup_gen_ready = not state.energy.backup_generator.is_online and state.energy.backup_generator.health > 10.0
    
    # Renewable potential: solar or wind viable?
    renewable_viable = (
        state.environment.wind_speed < 100.0 and
        state.environment.visibility > 1.0 and
        (state.energy.solar_max_kw >= 5.0 or state.environment.wind_speed >= 10.0)
    )

    noncritical_zones = [z for z in state.infrastructure.zones if z.category == 'non-critical']
    noncritical_heating_sheddable = (
        state.infrastructure.heating_system_status != 'Failed' and
        len(noncritical_zones) > 0 and
        state.infrastructure.indoor_temp_avg >= 10.0
    )

    return {
        'backup_generator_ready': backup_gen_ready,
        'backup_generator_health': state.energy.backup_generator.health,
        'backup_generator_capacity_kw': state.energy.backup_generator.rated_capacity_kw,
        'battery_kwh_available': state.energy.battery_capacity_kwh * (state.energy.battery_level_percent / 100.0),
        'battery_level_percent': state.energy.battery_level_percent,
        'fuel_liters_available': state.logistics.fuel_level_liters,
        'fuel_endurance_days': state.logistics.fuel_endurance_days,
        'renewable_viable': renewable_viable,
        'solar_potential_kw': state.energy.solar_max_kw,
        'wind_speed_kmh': state.environment.wind_speed,
        'noncritical_heating_sheddable': noncritical_heating_sheddable,
        'online_generators_count': len([g for g in state.energy.generators if g.is_online]),
        'crew_available_for_maintenance': state.crew.count >= 5,
        'communication_online': state.communication.status != 'Offline' and state.communication.quality > 15.0,
    }


# ============================================================================
# Intervention Candidate Generator
# ============================================================================

class InterventionCandidateGenerator:
    """
    Generates feasible individual interventions and compatible strategic combinations
    derived specifically from the station's actual simulated state.
    """

    def __init__(self):
        self.problem_diagnoser = StateProblemIdentifier()

    def get_feasible_interventions(
        self,
        state: StationState,
        problems: Optional[List[IdentifiedProblem]] = None,
        active_scenario_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Evaluates physical prerequisites and constraints for every registered intervention.
        Filters out impossible / unsafe actions and returns detailed feasibility reasoning.
        Boosts relevance scores for interventions that are prioritized by the active scenario.
        """
        if problems is None:
            problems = self.problem_diagnoser.diagnose(state)

        problem_types = {p.problem_type for p in problems}
        resources = get_available_resources(state)
        feasible_list: List[Dict[str, Any]] = []

        for i_id, model in STRUCTURED_INTERVENTIONS.items():
            is_active = i_id in state.active_interventions
            is_feasible = True
            reasons_pruned: List[str] = []
            reasons_applicable: List[str] = []

            # Evaluate specific physical prerequisites
            if i_id == 'start_backup_generator':
                if state.energy.backup_generator.is_online:
                    is_feasible = False
                    reasons_pruned.append("Auxiliary backup generator is already active and online.")
                elif state.energy.backup_generator.health <= 10.0:
                    is_feasible = False
                    reasons_pruned.append(f"Backup generator is physically degraded/broken (Health: {state.energy.backup_generator.health:.0f}% <= 10%).")
                elif state.logistics.fuel_level_liters <= 500:
                    is_feasible = False
                    reasons_pruned.append("Insufficient fuel reserves (< 500 L) to run additional auxiliary generator.")
                else:
                    if 'POWER_DEFICIT' in problem_types or 'GENERATOR_OVERLOAD' in problem_types or 'BATTERY_DEPLETION' in problem_types:
                        reasons_applicable.append("Directly counters power deficit and relieves overloaded generators.")
                    else:
                        reasons_applicable.append("Provides standby operational redundancy.")

            elif i_id == 'reduce_noncritical_loads':
                if is_active:
                    is_feasible = False
                    reasons_pruned.append("Non-critical load shedding is already actively engaged.")
                else:
                    if 'POWER_DEFICIT' in problem_types or 'GENERATOR_OVERLOAD' in problem_types or 'BATTERY_DEPLETION' in problem_types:
                        reasons_applicable.append("Instantly sheds ~30% power demand without endangering crew life support.")
                    elif 'FUEL_CRITICAL' in problem_types:
                        reasons_applicable.append("Reduces generator fuel burn rate to extend fuel endurance.")
                    else:
                        reasons_applicable.append("Conserves electrical energy and lowers baseline consumption.")

            elif i_id == 'prioritize_critical':
                if is_active:
                    is_feasible = False
                    reasons_pruned.append("Critical system prioritization is already active.")
                else:
                    reasons_applicable.append("Locks dedicated electrical feed to life support, environmental scrubbers, and medical.")

            elif i_id == 'increase_renewables':
                if is_active:
                    is_feasible = False
                    reasons_pruned.append("Renewable generation is already maximized.")
                elif state.environment.wind_speed > 100.0:
                    is_feasible = False
                    reasons_pruned.append(f"Blizzard winds ({state.environment.wind_speed:.0f} km/h) exceed 100 km/h safe mechanical limit; turbines must remain furled.")
                elif state.energy.solar_max_kw < 5.0 and state.environment.wind_speed < 10.0:
                    is_feasible = False
                    reasons_pruned.append("Total polar night (solar < 5 kW) combined with calm wind (< 10 km/h) yields zero renewable potential.")
                elif state.environment.visibility <= 1.0:
                    is_feasible = False
                    reasons_pruned.append("Severe blizzard whiteout (< 1 km visibility) impairs solar collector alignment.")
                else:
                    reasons_applicable.append("Harnesses polar wind/solar to displace diesel generator fuel burn.")

            elif i_id == 'preserve_battery':
                if is_active:
                    is_feasible = False
                    reasons_pruned.append("Battery preservation mode is already active.")
                elif state.energy.battery_level_percent <= 10.0:
                    is_feasible = False
                    reasons_pruned.append("Battery reserve is already below critical 10% floor; unable to support regular conservation cycling.")
                else:
                    if 'BATTERY_DEPLETION' in problem_types or 'POWER_DEFICIT' in problem_types:
                        reasons_applicable.append("Prevents rapid discharge to avoid premature black-start collapse.")
                    else:
                        reasons_applicable.append("Protects long-term battery bank health.")

            elif i_id == 'reduce_noncritical_heating':
                if is_active:
                    is_feasible = False
                    reasons_pruned.append("Non-critical heating reduction is already active.")
                elif state.infrastructure.heating_system_status == 'Failed':
                    is_feasible = False
                    reasons_pruned.append("Main heating system has suffered total mechanical failure.")
                elif state.infrastructure.indoor_temp_avg < 10.0:
                    is_feasible = False
                    reasons_pruned.append("Average habitat temperature is already below emergency 10°C threshold; further thermal shedding is dangerous.")
                else:
                    reasons_applicable.append("Saves ~20 kW thermal electrical demand by cooling unstaffed workshops and storage.")

            elif i_id == 'emergency_resupply':
                if is_active:
                    is_feasible = False
                    reasons_pruned.append("Emergency resupply petition has already been transmitted to NCPOR Goa.")
                elif state.communication.status == 'Offline' or state.communication.quality < 15.0:
                    is_feasible = False
                    reasons_pruned.append("Station communication blackout prevents transmitting emergency distress message.")
                elif state.environment.wind_speed > 120.0:
                    is_feasible = False
                    reasons_pruned.append(f"Extreme katabatic storm winds ({state.environment.wind_speed:.0f} km/h > 120 km/h) ground polar airlift and naval docking.")
                else:
                    if 'FUEL_CRITICAL' in problem_types or 'LOGISTICS_DELAY' in problem_types:
                        reasons_applicable.append("Bridges the critical fuel/food gap before scheduled vessel arrival.")
                    else:
                        reasons_applicable.append("Dispatches standby polar supply mission.")

            elif i_id == 'increase_maintenance':
                if is_active:
                    is_feasible = False
                    reasons_pruned.append("Expedited maintenance cycles are already active.")
                elif state.crew.count < 5:
                    is_feasible = False
                    reasons_pruned.append(f"Crew size ({state.crew.count}) is insufficient to staff extra maintenance watches safely.")
                else:
                    if 'EQUIPMENT_DEGRADATION' in problem_types or 'PREDICTED_EQUIPMENT_FAILURE' in problem_types:
                        reasons_applicable.append("Slowing degradation by 60% prevents impending mechanical breakdowns.")
                    else:
                        reasons_applicable.append("Maintains high operational readiness across auxiliary systems.")

            elif i_id == 'generator_schedule':
                if is_active:
                    is_feasible = False
                    reasons_pruned.append("Generator schedule optimization is already engaged.")
                elif len(online_gens := [g for g in state.energy.generators if g.is_online]) < 2:
                    is_feasible = False
                    reasons_pruned.append(f"Only {len(online_gens)} generator online; schedule rebalancing requires at least 2 online units.")
                else:
                    reasons_applicable.append("Evens out thermal stress across online generator sets.")

            # Calculate situation relevance score (0 - 100)
            relevance = 50.0
            if is_feasible:
                if 'POWER_DEFICIT' in problem_types and i_id in ['start_backup_generator', 'reduce_noncritical_loads', 'prioritize_critical']:
                    relevance += 40.0
                if 'GENERATOR_OVERLOAD' in problem_types and i_id in ['start_backup_generator', 'reduce_noncritical_loads', 'generator_schedule']:
                    relevance += 35.0
                if 'BATTERY_DEPLETION' in problem_types and i_id in ['preserve_battery', 'reduce_noncritical_loads', 'start_backup_generator']:
                    relevance += 35.0
                if 'FUEL_CRITICAL' in problem_types and i_id in ['reduce_noncritical_loads', 'reduce_noncritical_heating', 'emergency_resupply', 'increase_renewables']:
                    relevance += 35.0
                if 'EXTREME_THERMAL_LOSS' in problem_types and i_id in ['prioritize_critical', 'start_backup_generator']:
                    relevance += 30.0
                if ('EQUIPMENT_DEGRADATION' in problem_types or 'PREDICTED_EQUIPMENT_FAILURE' in problem_types) and i_id in ['increase_maintenance', 'generator_schedule', 'start_backup_generator']:
                    relevance += 35.0

                # Scenario-aware relevance boost
                if active_scenario_ids:
                    for sid in active_scenario_ids:
                        scenario_priorities = SCENARIO_INTERVENTION_PRIORITIES.get(sid, [])
                        if i_id in scenario_priorities:
                            # Boost based on priority position (first = highest boost)
                            position = scenario_priorities.index(i_id)
                            scenario_boost = max(10.0, 30.0 - (position * 5.0))
                            relevance += scenario_boost

            feasible_list.append({
                **model.to_dict(),
                'isFeasible': is_feasible,
                'is_feasible': is_feasible,
                'isActive': is_active,
                'is_active': is_active,
                'reasonsApplicable': reasons_applicable,
                'reasons_applicable': reasons_applicable,
                'reasonsPruned': reasons_pruned,
                'reasons_pruned': reasons_pruned,
                'relevanceScore': min(100.0, relevance),
                'relevance_score': min(100.0, relevance),
            })

        return feasible_list

    def generate_candidate_combinations(
        self,
        state: StationState,
        feasible_interventions: List[Dict[str, Any]],
        problems: List[IdentifiedProblem],
        max_combination_size: int = 3,
        max_candidates: int = 12,
        active_scenario_ids: Optional[List[str]] = None
    ) -> List[List[str]]:
        """
        Dynamically generates strategic, compatible intervention packages
        tailored directly to resolving diagnosed station problems.
        """
        active_ids = set(state.active_interventions)
        feasible_ids = [
            item['id'] for item in feasible_interventions
            if item['is_feasible'] and item['id'] not in active_ids
        ]

        if not feasible_ids:
            return []

        problem_types = {p.problem_type for p in problems}
        combinations: List[List[str]] = []

        # 1. Individual Feasible Actions (Singles)
        for i_id in feasible_ids:
            combinations.append([i_id])

        # 2. Problem-Guided Strategic Pairs
        # Power / Overload pairing
        if 'POWER_DEFICIT' in problem_types or 'GENERATOR_OVERLOAD' in problem_types:
            if 'start_backup_generator' in feasible_ids and 'reduce_noncritical_loads' in feasible_ids:
                combinations.append(['start_backup_generator', 'reduce_noncritical_loads'])
            if 'start_backup_generator' in feasible_ids and 'prioritize_critical' in feasible_ids:
                combinations.append(['start_backup_generator', 'prioritize_critical'])
            if 'reduce_noncritical_loads' in feasible_ids and 'prioritize_critical' in feasible_ids:
                combinations.append(['reduce_noncritical_loads', 'prioritize_critical'])

        # Battery preservation pairing
        if 'BATTERY_DEPLETION' in problem_types or 'POWER_DEFICIT' in problem_types:
            if 'preserve_battery' in feasible_ids and 'reduce_noncritical_loads' in feasible_ids:
                combinations.append(['reduce_noncritical_loads', 'preserve_battery'])
            if 'preserve_battery' in feasible_ids and 'start_backup_generator' in feasible_ids:
                combinations.append(['start_backup_generator', 'preserve_battery'])

        # Fuel shortage / Logistics gap pairing
        if 'FUEL_CRITICAL' in problem_types or 'LOGISTICS_DELAY' in problem_types:
            if 'reduce_noncritical_loads' in feasible_ids and 'reduce_noncritical_heating' in feasible_ids:
                combinations.append(['reduce_noncritical_loads', 'reduce_noncritical_heating'])
            if 'emergency_resupply' in feasible_ids and 'reduce_noncritical_loads' in feasible_ids:
                combinations.append(['emergency_resupply', 'reduce_noncritical_loads'])
            if 'increase_renewables' in feasible_ids and 'reduce_noncritical_loads' in feasible_ids:
                combinations.append(['increase_renewables', 'reduce_noncritical_loads'])

        # Equipment degradation pairing
        if 'EQUIPMENT_DEGRADATION' in problem_types or 'PREDICTED_EQUIPMENT_FAILURE' in problem_types:
            if 'increase_maintenance' in feasible_ids and 'generator_schedule' in feasible_ids:
                combinations.append(['increase_maintenance', 'generator_schedule'])
            if 'increase_maintenance' in feasible_ids and 'start_backup_generator' in feasible_ids:
                combinations.append(['increase_maintenance', 'start_backup_generator'])

        # Thermal loss pairing
        if 'EXTREME_THERMAL_LOSS' in problem_types:
            if 'start_backup_generator' in feasible_ids and 'reduce_noncritical_heating' in feasible_ids:
                combinations.append(['start_backup_generator', 'reduce_noncritical_heating'])

        # 3. Strategic Triples for Severe Combined Crises
        if len(problems) >= 2 or any(p.severity == 'CRITICAL' for p in problems):
            if all(k in feasible_ids for k in ['start_backup_generator', 'reduce_noncritical_loads', 'preserve_battery']):
                combinations.append(['start_backup_generator', 'reduce_noncritical_loads', 'preserve_battery'])
            if all(k in feasible_ids for k in ['start_backup_generator', 'reduce_noncritical_loads', 'reduce_noncritical_heating']):
                combinations.append(['start_backup_generator', 'reduce_noncritical_loads', 'reduce_noncritical_heating'])
            if all(k in feasible_ids for k in ['start_backup_generator', 'prioritize_critical', 'emergency_resupply']):
                combinations.append(['start_backup_generator', 'prioritize_critical', 'emergency_resupply'])
            if all(k in feasible_ids for k in ['reduce_noncritical_loads', 'reduce_noncritical_heating', 'preserve_battery']):
                combinations.append(['reduce_noncritical_loads', 'reduce_noncritical_heating', 'preserve_battery'])

        # 4. Scenario-Recommended Combinations
        if active_scenario_ids:
            for sid in active_scenario_ids:
                scenario_priorities = SCENARIO_INTERVENTION_PRIORITIES.get(sid, [])
                scenario_feasible = [i_id for i_id in scenario_priorities if i_id in feasible_ids]
                if len(scenario_feasible) >= 2:
                    combinations.insert(0, scenario_feasible)  # Insert at front for priority

        # Deduplicate combinations while preserving order
        unique_combinations: List[List[str]] = []
        seen_combos: Set[Tuple[str, ...]] = set()

        for combo in combinations:
            key = tuple(sorted(combo))
            if key not in seen_combos:
                seen_combos.add(key)
                unique_combinations.append(combo)

        return unique_combinations[:max_candidates]
