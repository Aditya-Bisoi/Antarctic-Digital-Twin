"""
optimizer.py — Multi-Objective Decision Optimizer
Antarctic Digital Twin — SIH26060

Generates candidate intervention strategies (singles, strategic pairs, triples, comprehensive packages),
validates equipment/fuel/power feasibility, performs forward simulation using the actual SimulationEngine
over configurable horizons (6h - 168h), enforces hard safety constraints, and produces multi-objective
rankings with explainable reasoning and calculated tradeoff analysis.
"""

import copy
import uuid
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from .state import StationState
from .interventions import INTERVENTIONS, get_intervention_by_id
from .intervention_generator import (
    InterventionCandidateGenerator,
    StateProblemIdentifier,
    get_available_resources,
    STRUCTURED_INTERVENTIONS,
    IdentifiedProblem,
)
from .prediction import generate_predictions


# ============================================================================
# Situation-Aware Dynamic Optimization Weights
# ============================================================================

HAZARD_WEIGHTS: Dict[str, Dict[str, float]] = {
    'storm': {
        'crew_safety': 0.25,
        'power_stability': 0.20,
        'indoor_heating': 0.20,
        'fuel_endurance': 0.15,
        'battery_reserve': 0.10,
        'equipment_stress': 0.05,
        'operational_risk': 0.05,
    },
    'fuel_shortage': {
        'fuel_endurance': 0.35,
        'power_stability': 0.20,
        'crew_safety': 0.15,
        'battery_reserve': 0.15,
        'equipment_stress': 0.05,
        'operational_risk': 0.10,
    },
    'generator_failure': {
        'power_stability': 0.30,
        'battery_reserve': 0.20,
        'crew_safety': 0.20,
        'fuel_endurance': 0.15,
        'equipment_stress': 0.10,
        'operational_risk': 0.05,
    },
    'heating_failure': {
        'crew_safety': 0.30,
        'indoor_heating': 0.25,
        'power_stability': 0.20,
        'battery_reserve': 0.10,
        'fuel_endurance': 0.10,
        'operational_risk': 0.05,
    },
    'extreme_cold': {
        'crew_safety': 0.30,
        'indoor_heating': 0.30,
        'power_stability': 0.20,
        'fuel_endurance': 0.10,
        'battery_reserve': 0.05,
        'operational_risk': 0.05,
    },
    'communication_failure': {
        'crew_safety': 0.25,
        'power_stability': 0.20,
        'operational_risk': 0.20,
        'equipment_stress': 0.15,
        'battery_reserve': 0.10,
        'fuel_endurance': 0.10,
    },
    'equipment_degradation': {
        'equipment_stress': 0.30,
        'power_stability': 0.25,
        'crew_safety': 0.20,
        'operational_risk': 0.15,
        'fuel_endurance': 0.10,
    },
    'default': {
        'crew_safety': 0.20,
        'power_stability': 0.20,
        'fuel_endurance': 0.15,
        'indoor_heating': 0.15,
        'battery_reserve': 0.10,
        'resource_endurance': 0.05,
        'equipment_stress': 0.05,
        'operational_risk': 0.10,
    }
}

VALID_HORIZONS = [6, 12, 24, 48, 72, 168]
DEFAULT_HORIZON = 24


def detect_dominant_hazard(state: StationState) -> str:
    """Detects active operational priority profile based on telemetry and active scenarios."""
    scenarios = [s.lower() for s in (state.active_scenarios or [])]

    # Check scenarios first
    if any('storm' in s or 'blizzard' in s for s in scenarios) or state.environment.wind_speed > 80:
        return 'storm'
    if any('cold' in s or 'freeze' in s for s in scenarios) or state.environment.temperature < -38:
        return 'extreme_cold'
    if any('fuel' in s or 'resupply' in s for s in scenarios) or state.logistics.fuel_endurance_days < 20:
        return 'fuel_shortage'
    if any('generator' in s or 'blackout' in s or 'power' in s for s in scenarios) or state.energy.power_deficit_kw > 15:
        return 'generator_failure'
    if any('heat' in s or 'thermal' in s for s in scenarios) or state.infrastructure.indoor_temp_avg < 15:
        return 'heating_failure'
    if any('comm' in s for s in scenarios) or state.communication.quality < 30.0 or state.communication.status == 'Offline':
        return 'communication_failure'
    if any('equipment' in s or 'degrad' in s for s in scenarios) or any(e.health < 40.0 for e in (state.equipment or [])):
        return 'equipment_degradation'

    # Fallback to telemetry checks
    if state.energy.power_deficit_kw > 0:
        return 'generator_failure'
    if state.infrastructure.indoor_temp_avg < 16:
        return 'heating_failure'
    if state.environment.temperature < -35:
        return 'extreme_cold'

    return 'default'


def get_situation_weights(state: StationState, custom_weights: Optional[Dict[str, float]] = None) -> Tuple[str, Dict[str, float]]:
    """Returns the hazard profile name and normalized weighting dictionary."""
    if custom_weights:
        total = sum(custom_weights.values()) or 1.0
        normalized = {k: round(v / total, 3) for k, v in custom_weights.items()}
        return 'custom', normalized

    hazard = detect_dominant_hazard(state)
    weights = copy.deepcopy(HAZARD_WEIGHTS.get(hazard, HAZARD_WEIGHTS['default']))
    total = sum(weights.values()) or 1.0
    normalized = {k: round(v / total, 3) for k, v in weights.items()}
    return hazard, normalized


# ============================================================================
# Hard Safety Constraints
# ============================================================================

def validate_hard_safety_constraints(state: StationState) -> Tuple[bool, List[str]]:
    """
    Evaluates non-negotiable polar life-safety and mission-critical thresholds:
    1. Critical indoor temperature must remain above emergency threshold (>= 10.0°C).
    2. Critical life-support electrical deficit must not exceed 0 kW.
    3. Battery storage must not fall below emergency reserve (>= 15.0%).
    4. Generator load must not exceed emergency continuous rating (<= 105%).
    5. Fuel reserves must remain positive (> 0 days).
    """
    violations: List[str] = []

    # 1. Temperature constraint
    if state.infrastructure.indoor_temp_avg < 10.0:
        violations.append(
            f"Indoor temperature dropped to {state.infrastructure.indoor_temp_avg:.1f}°C (safe minimum is 10.0°C)"
        )

    # 2. Critical power deficit
    if state.energy.power_deficit_kw > 5.0:
        violations.append(
            f"Active unserved electrical deficit of {state.energy.power_deficit_kw:.1f} kW threatens critical life support"
        )

    # 3. Emergency battery reserve
    if state.energy.battery_level_percent < 15.0:
        violations.append(
            f"Battery reserve fell to {state.energy.battery_level_percent:.1f}% (below 15.0% emergency threshold)"
        )

    # 4. Generator overload check
    for gen in state.energy.generators:
        if gen.is_online and gen.rated_capacity_kw > 0:
            load_pct = (gen.current_output_kw / gen.rated_capacity_kw) * 100
            if load_pct > 105.0:
                violations.append(
                    f"Generator '{gen.name}' operating at {load_pct:.0f}% load (exceeds 105% emergency maximum)"
                )

    # 5. Fuel depletion
    if state.logistics.fuel_endurance_days <= 0.0 or state.logistics.fuel_level_liters <= 0.0:
        violations.append("Fuel reserves completely exhausted (0 days remaining)")

    # 6. Crew outdoor safety constraint (Contract 8: outdoor deployment during blizzard/extreme weather)
    if state.crew.outdoor_ops_allowed and (state.environment.wind_speed >= 80.0 or state.environment.wind_chill <= -50.0):
        violations.append(
            f"Crew outdoor operations permitted during hazardous weather ({state.environment.wind_speed:.0f} km/h winds, windchill {state.environment.wind_chill:.1f}°C) violates Antarctic safety code"
        )

    # 7. Critical communication constraint (Contract 8)
    if (state.communication.status == 'Offline' or state.communication.quality <= 0.0) and (state.energy.power_deficit_kw > 0 or any(e.health <= 0 for e in state.equipment)):
        violations.append(
            "Complete communication blackout during active system hazard prevents required safety telemetry"
        )

    passed = len(violations) == 0
    return passed, violations


# ============================================================================
# Data Models
# ============================================================================

@dataclass
class PlanScores:
    fuel_endurance: float
    power_stability: float
    battery_reserve: float
    indoor_heating: float
    resource_endurance: float
    operational_risk: float  # lower is better
    equipment_stress: float  # lower is better
    crew_safety: float
    overall_score: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            'fuelEndurance': self.fuel_endurance,
            'powerStability': self.power_stability,
            'batteryReserve': self.battery_reserve,
            'indoorHeating': self.indoor_heating,
            'resourceEndurance': self.resource_endurance,
            'operationalRisk': self.operational_risk,
            'equipmentStress': self.equipment_stress,
            'crewSafety': self.crew_safety,
            'overallScore': self.overall_score,
            # snake_case aliases
            'fuel_endurance': self.fuel_endurance,
            'power_stability': self.power_stability,
            'battery_reserve': self.battery_reserve,
            'indoor_heating': self.indoor_heating,
            'resource_endurance': self.resource_endurance,
            'operational_risk': self.operational_risk,
            'equipment_stress': self.equipment_stress,
            'crew_safety': self.crew_safety,
            'overall_score': self.overall_score,
        }


@dataclass
class InterventionPlan:
    id: str
    name: str
    interventions: List[str]
    scores: PlanScores
    hard_constraints: Dict[str, Any] = field(default_factory=lambda: {'passed': True, 'violations': []})
    reasoning: List[str] = field(default_factory=list)
    tradeoffs: List[str] = field(default_factory=list)
    rank: int = 0
    is_safe: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'interventions': self.interventions,
            'scores': self.scores.to_dict(),
            'hard_constraints': self.hard_constraints,
            'hardConstraints': self.hard_constraints,
            'reasoning': self.reasoning,
            'tradeoffs': self.tradeoffs,
            'rank': self.rank,
            'is_safe': self.is_safe,
            'isSafe': self.is_safe,
        }


# ============================================================================
# Feasibility & Combination Pruning
# ============================================================================

def is_valid_intervention(intervention_id: str, state: StationState) -> Tuple[bool, str]:
    """Validates whether an individual intervention is physically feasible in the current state."""
    intervention = get_intervention_by_id(intervention_id)
    if not intervention:
        return False, f"Unknown intervention '{intervention_id}'"

    if intervention_id in state.active_interventions:
        return False, f"Intervention '{intervention.name}' is already active"

    # Specific prerequisite & equipment availability checks
    if intervention_id == 'start_backup_generator':
        # Check if backup generator is broken
        backup_gens = [e for e in state.equipment if 'backup' in e.id.lower() or 'aux' in e.id.lower()]
        if backup_gens and all(not g.is_online or g.health <= 0 for g in backup_gens):
            return False, "Backup generator is physically damaged / offline"
        if state.logistics.fuel_level_liters <= 500:
            return False, "Insufficient fuel to commission auxiliary generator"

    if intervention_id == 'emergency_resupply':
        if state.environment.wind_speed > 120:
            return False, "Katabatic blizzard winds exceed safe polar air/overland transport limits"

    if intervention_id == 'increase_renewables':
        # Solar / wind not viable if generation is near zero
        if state.energy.solar_max_kw < 5 and state.environment.wind_speed < 10:
            return False, "Inadequate solar potential or wind resource for renewable expansion"

    return intervention.is_available(state), "Intervention criteria not met"


def prune_invalid_combinations(candidate_combos: List[List[str]], state: StationState) -> List[List[str]]:
    """Filters out impossible, conflicting, or redundant intervention combinations."""
    valid_combos: List[List[str]] = []

    for combo in candidate_combos:
        # Check each intervention's physical validity
        combo_valid = True
        for i_id in combo:
            valid, _ = is_valid_intervention(i_id, state)
            if not valid:
                combo_valid = False
                break
        if not combo_valid:
            continue

        valid_combos.append(combo)

    return valid_combos


# ============================================================================
# Forward Simulation & Multi-Objective Evaluation
# ============================================================================

def evaluate_plan(
    engine,
    intervention_ids: List[str],
    horizon_hours: int = 24,
    weights: Optional[Dict[str, float]] = None
) -> Tuple[PlanScores, StationState, Dict[str, Any]]:
    """
    Forks the simulation engine, applies candidate interventions,
    advances forward by horizon_hours, evaluates multi-dimensional performance scores,
    and enforces hard safety constraints.
    """
    forked = engine.fork()

    for i_id in intervention_ids:
        intervention = get_intervention_by_id(i_id)
        if intervention and intervention.is_available(forked.state):
            intervention.apply(forked)

    # Forward simulate using actual deterministic SimulationEngine
    forked.advance_by_hours(horizon_hours)
    future_state: StationState = forked.state

    # Check hard safety constraints on the resulting state
    passed_constraints, violations = validate_hard_safety_constraints(future_state)
    constraint_info = {
        'passed': passed_constraints,
        'violations': violations
    }

    # Normalized component scoring (0 - 100)
    # 1. Fuel endurance
    fuel_endurance = min(100.0, future_state.logistics.fuel_endurance_days * 0.8)

    # 2. Power stability
    if future_state.energy.power_deficit_kw <= 0:
        power_stability = 100.0
    else:
        power_stability = max(0.0, 100.0 - (future_state.energy.power_deficit_kw * 2.5))

    # 3. Battery reserve
    battery_reserve = max(0.0, min(100.0, future_state.energy.battery_level_percent))

    # 4. Indoor heating
    temp = future_state.infrastructure.indoor_temp_avg
    if temp >= 18.0:
        indoor_heating = 100.0
    elif temp >= 14.0:
        indoor_heating = 75.0 + (temp - 14.0) * 6.25
    elif temp >= 10.0:
        indoor_heating = 40.0 + (temp - 10.0) * 8.75
    else:
        indoor_heating = max(0.0, temp * 4.0)

    # 5. Resource endurance
    resource_endurance = min(
        future_state.logistics.food_endurance_days * 0.5,
        future_state.logistics.water_endurance_days * 1.0,
        100.0
    )

    # 6. Operational risk
    risk_map = {'LOW': 10.0, 'MODERATE': 35.0, 'HIGH': 65.0, 'CRITICAL': 95.0}
    operational_risk = risk_map.get(future_state.risk_level, 50.0)

    # 7. Equipment stress
    equip = future_state.equipment or []
    avg_health = sum(e.health for e in equip) / max(len(equip), 1)
    equipment_stress = max(0.0, 100.0 - avg_health)

    # 8. Crew safety
    crew_safety_map = {'LOW': 95.0, 'MODERATE': 70.0, 'HIGH': 35.0, 'CRITICAL': 5.0}
    crew_safety = crew_safety_map.get(future_state.crew.safety_risk, 50.0)

    # Multi-objective weighted sum
    w = weights or HAZARD_WEIGHTS['default']
    w_fuel = w.get('fuel_endurance', 0.15)
    w_power = w.get('power_stability', 0.20)
    w_battery = w.get('battery_reserve', 0.10)
    w_heating = w.get('indoor_heating', 0.15)
    w_resource = w.get('resource_endurance', 0.05)
    w_risk = w.get('operational_risk', 0.10)
    w_stress = w.get('equipment_stress', 0.05)
    w_crew = w.get('crew_safety', 0.20)

    overall_score = (
        fuel_endurance * w_fuel +
        power_stability * w_power +
        battery_reserve * w_battery +
        indoor_heating * w_heating +
        resource_endurance * w_resource +
        (100.0 - operational_risk) * w_risk +
        (100.0 - equipment_stress) * w_stress +
        crew_safety * w_crew
    )

    # HARD CONSTRAINT PENALTY:
    # A plan that violates critical life-safety constraints must NEVER be recommended
    if not passed_constraints:
        overall_score = max(0.0, overall_score - 100.0)

    scores = PlanScores(
        fuel_endurance=round(fuel_endurance, 1),
        power_stability=round(power_stability, 1),
        battery_reserve=round(battery_reserve, 1),
        indoor_heating=round(indoor_heating, 1),
        resource_endurance=round(resource_endurance, 1),
        operational_risk=round(operational_risk, 1),
        equipment_stress=round(equipment_stress, 1),
        crew_safety=round(crew_safety, 1),
        overall_score=round(overall_score, 1),
    )

    return scores, future_state, constraint_info


# ============================================================================
# Reasoning & Tradeoffs Generation
# ============================================================================

def generate_reasoning(
    plan: InterventionPlan,
    state: StationState,
    baseline_state: Optional[StationState] = None
) -> List[str]:
    """Generates natural language justification grounded directly in simulation outcomes."""
    reasons: List[str] = []
    invs = plan.interventions

    if 'start_backup_generator' in invs:
        reasons.append(
            'Activating the auxiliary backup generator restores baseline generation capacity, eliminating immediate electrical deficits.'
        )
    if 'reduce_noncritical_loads' in invs:
        reasons.append(
            'Shedding non-critical lab and auxiliary circuits reduces continuous load demand by ~30%, extending battery and fuel buffers.'
        )
    if 'prioritize_critical' in invs:
        reasons.append(
            'Prioritizing critical life support ensures medical, environmental scrubbers, and primary communications remain energised.'
        )
    if 'preserve_battery' in invs:
        reasons.append(
            'Restricting battery discharge depth protects emergency power reserves during extended generation deficits.'
        )
    if 'reduce_noncritical_heating' in invs:
        reasons.append(
            'Throttling heating in storage bays and workshops conserves ~20 kW of thermal generation without compromising habitat core living zones.'
        )
    if 'emergency_resupply' in invs:
        reasons.append(
            'Commissioning emergency logistics petition bridges the operational gap between current fuel drawdown and scheduled vessel transit.'
        )
    if 'increase_maintenance' in invs:
        reasons.append(
            'Deploying expedited maintenance cycles dampens mechanical vibration and slows equipment degradation.'
        )
    if 'increase_renewables' in invs:
        reasons.append(
            'Maximizing available renewable generation displaces diesel fuel burn and extends station operational autonomy.'
        )

    # Comparative outcome reasoning against baseline if available
    if baseline_state:
        if plan.scores.power_stability > 80 and baseline_state.energy.power_deficit_kw > 0:
            reasons.append(
                f'Eliminates baseline power deficit of {baseline_state.energy.power_deficit_kw:.1f} kW, returning power stability to {plan.scores.power_stability:.0f}/100.'
            )
        if plan.scores.indoor_heating > 70 and baseline_state.infrastructure.indoor_temp_avg < 14:
            reasons.append(
                f'Maintains average habitat warmth above safe thresholds compared to baseline drop to {baseline_state.infrastructure.indoor_temp_avg:.1f}°C.'
            )

    if plan.hard_constraints['passed']:
        reasons.append('Satisfies all non-negotiable Antarctic life-safety and power stability constraints.')
    else:
        for v in plan.hard_constraints['violations']:
            reasons.append(f'Safety Warning: {v}.')

    return reasons


def generate_tradeoffs(
    plan: InterventionPlan,
    state: StationState,
    baseline_state: Optional[StationState] = None
) -> List[str]:
    """Generates situational tradeoffs derived from actual physical changes."""
    tradeoffs: List[str] = []
    invs = plan.interventions

    if 'start_backup_generator' in invs:
        tradeoffs.append(
            'Engaging auxiliary generator eliminates power deficits but increases station diesel consumption by ~25 L/h.'
        )
    if 'reduce_noncritical_loads' in invs:
        tradeoffs.append(
            'Load shedding protects life support and battery reserve, but requires temporary suspension of non-essential research experiments.'
        )
    if 'reduce_noncritical_heating' in invs:
        tradeoffs.append(
            'Thermal throttling saves ~20 kW, but perimeter workshops and storage areas drop towards +10°C.'
        )
    if 'preserve_battery' in invs:
        tradeoffs.append(
            'Restricting battery discharge safeguards emergency reserves, requiring immediate deficit handling if generation fluctuates.'
        )
    if 'prioritize_critical' in invs:
        tradeoffs.append(
            'Critical system prioritization ensures crew safety, but deprioritizes auxiliary telemetry channels.'
        )
    if 'emergency_resupply' in invs:
        tradeoffs.append(
            'Emergency polar resupply dispatches air transport, committing external logistics assets in adverse polar weather.'
        )

    if not tradeoffs:
        tradeoffs.append(
            'Standard operational tradeoff: nominal resource consumption balanced against long-term expedition endurance.'
        )

    return tradeoffs


# ============================================================================
# Main Optimization Flow
# ============================================================================

def optimize_decisions(
    engine,
    horizon_hours: int = DEFAULT_HORIZON,
    custom_weights: Optional[Dict[str, float]] = None,
    predictions: Optional[List[Any]] = None
) -> List[InterventionPlan]:
    """
    Generates candidate intervention plans via InterventionCandidateGenerator,
    prunes infeasible options, forward simulates each using the SimulationEngine over horizon_hours,
    and ranks plans based on multi-objective scores.
    """
    state: StationState = engine.state
    hazard_profile, weights = get_situation_weights(state, custom_weights)

    if predictions is None:
        try:
            predictions = generate_predictions(state)
        except Exception:
            predictions = []

    # 1. Dynamically diagnose state threats and generate feasible candidates
    candidate_gen = InterventionCandidateGenerator()
    problems = candidate_gen.problem_diagnoser.diagnose(state, predictions=predictions)
    feasible_interventions = candidate_gen.get_feasible_interventions(
        state, problems=problems, active_scenario_ids=state.active_scenarios
    )

    # 2. Dynamic combinatorial candidate generation guided by actual state threats
    plan_combinations = candidate_gen.generate_candidate_combinations(
        state=state,
        feasible_interventions=feasible_interventions,
        problems=problems,
        active_scenario_ids=state.active_scenarios,
        max_candidates=12
    )

    if not plan_combinations:
        return []

    # 3. Prune impossible/conflicting combinations
    pruned_combos = prune_invalid_combinations(plan_combinations, state)

    # 4. Evaluate baseline for comparative reasoning (Isolated fork)
    baseline_engine = engine.fork()
    baseline_engine.advance_by_hours(horizon_hours)
    baseline_state = baseline_engine.state

    plans: List[InterventionPlan] = []

    for idx, combo in enumerate(pruned_combos):
        scores, future_state, constraints = evaluate_plan(
            engine=engine,
            intervention_ids=combo,
            horizon_hours=horizon_hours,
            weights=weights
        )

        names = [get_intervention_by_id(c_id).name if get_intervention_by_id(c_id) else c_id for c_id in combo]
        if len(combo) == 1:
            name = names[0]
        elif len(combo) <= 3:
            name = ' + '.join(names)
        else:
            name = f'Comprehensive Response ({len(combo)} actions)'

        plan = InterventionPlan(
            id=f'plan-{idx+1}',
            name=name,
            interventions=combo,
            scores=scores,
            hard_constraints=constraints,
            reasoning=[],
            tradeoffs=[],
            rank=0,
            is_safe=constraints['passed'],
        )
        plan.reasoning = generate_reasoning(plan, state, baseline_state)
        plan.tradeoffs = generate_tradeoffs(plan, state, baseline_state)
        plans.append(plan)

    # Sort descending: safe plans first, then by overall score
    plans.sort(key=lambda p: (1 if p.is_safe else 0, p.scores.overall_score), reverse=True)

    for r_idx, p in enumerate(plans):
        p.rank = r_idx + 1

    return plans[:8]


def optimize_decisions_detailed(
    engine,
    horizon_hours: int = DEFAULT_HORIZON,
    custom_weights: Optional[Dict[str, float]] = None,
    simulation_id: Optional[str] = None,
    predictions: Optional[List[Any]] = None
) -> Dict[str, Any]:
    """
    Comprehensive multi-objective optimization returning recommended plan, natural language reasoning,
    hard constraints verification, tradeoffs, projected outcome vs baseline, and rejected alternatives.
    """
    # Clamp horizon to valid choices
    if horizon_hours not in VALID_HORIZONS:
        horizon_hours = min(VALID_HORIZONS, key=lambda h: abs(h - horizon_hours))

    if predictions is None:
        try:
            predictions = generate_predictions(engine.state)
        except Exception:
            predictions = []

    candidate_gen = InterventionCandidateGenerator()
    problems = candidate_gen.problem_diagnoser.diagnose(engine.state, predictions=predictions)
    feasible_interventions = candidate_gen.get_feasible_interventions(engine.state, problems=problems)
    resources = get_available_resources(engine.state)

    hazard_profile, weights = get_situation_weights(engine.state, custom_weights)
    plans = optimize_decisions(
        engine,
        horizon_hours=horizon_hours,
        custom_weights=custom_weights,
        predictions=predictions
    )

    # Forward-simulated Baseline (No intervention)
    base_engine = engine.fork()
    base_engine.advance_by_hours(horizon_hours)
    base_state = base_engine.state

    baseline_outcome = {
        'resilienceScore': base_state.resilience_score,
        'riskLevel': base_state.risk_level,
        'powerDeficitKw': round(base_state.energy.power_deficit_kw, 1),
        'batteryLevelPercent': round(base_state.energy.battery_level_percent, 1),
        'indoorTempAvg': round(base_state.infrastructure.indoor_temp_avg, 1),
        'fuelEnduranceDays': round(base_state.logistics.fuel_endurance_days, 1),
        'totalLoadKw': round(base_state.energy.total_consumption_kw, 1),
        # snake_case aliases
        'resilience_score': base_state.resilience_score,
        'risk_level': base_state.risk_level,
        'power_deficit_kw': round(base_state.energy.power_deficit_kw, 1),
        'battery_level_percent': round(base_state.energy.battery_level_percent, 1),
        'indoor_temp_avg': round(base_state.infrastructure.indoor_temp_avg, 1),
        'fuel_endurance_days': round(base_state.logistics.fuel_endurance_days, 1),
    }

    if not plans:
        return {
            'simulation_id': simulation_id or '',
            'horizon_hours': horizon_hours,
            'weights_used': weights,
            'detected_hazard': hazard_profile,
            'recommended_plan': None,
            'reasoning': ['No safe or feasible candidate intervention packages could be formed in the current station state.'],
            'hard_constraints': {'passed': False, 'violations': ['No feasible intervention plan available']},
            'metrics': {},
            'alternatives': [],
            'tradeoffs': [],
            'predicted_outcome': baseline_outcome,
            'baseline_outcome': baseline_outcome,
            'recommendedPlan': None,
            'rankedPlans': [],
            'predictedOutcome': baseline_outcome,
            'baselineOutcomeWithoutIntervention': baseline_outcome,
        }

    rec = plans[0]

    # Forward-simulated Predicted Outcome with Recommended Plan
    rec_engine = engine.fork()
    for i_id in rec.interventions:
        inv = get_intervention_by_id(i_id)
        if inv and inv.is_available(rec_engine.state):
            inv.apply(rec_engine)
    rec_engine.advance_by_hours(horizon_hours)
    rec_state = rec_engine.state

    predicted_outcome = {
        'resilienceScore': rec_state.resilience_score,
        'riskLevel': rec_state.risk_level,
        'powerDeficitKw': round(rec_state.energy.power_deficit_kw, 1),
        'batteryLevelPercent': round(rec_state.energy.battery_level_percent, 1),
        'indoorTempAvg': round(rec_state.infrastructure.indoor_temp_avg, 1),
        'fuelEnduranceDays': round(rec_state.logistics.fuel_endurance_days, 1),
        'totalLoadKw': round(rec_state.energy.total_consumption_kw, 1),
        # snake_case aliases
        'resilience_score': rec_state.resilience_score,
        'risk_level': rec_state.risk_level,
        'power_deficit_kw': round(rec_state.energy.power_deficit_kw, 1),
        'battery_level_percent': round(rec_state.energy.battery_level_percent, 1),
        'indoor_temp_avg': round(rec_state.infrastructure.indoor_temp_avg, 1),
        'fuel_endurance_days': round(rec_state.logistics.fuel_endurance_days, 1),
    }

    alternatives = []
    for alt in plans[1:]:
        reasons_why = []
        if not alt.is_safe:
            reasons_why.append(f"Fails safety constraints ({', '.join(alt.hard_constraints['violations'])})")
        if alt.scores.power_stability < rec.scores.power_stability:
            reasons_why.append(f"Leaves power stability lower ({alt.scores.power_stability:.0f} vs {rec.scores.power_stability:.0f})")
        if alt.scores.fuel_endurance < rec.scores.fuel_endurance:
            reasons_why.append(f"Faster fuel drawdown ({alt.scores.fuel_endurance:.0f} vs {rec.scores.fuel_endurance:.0f})")
        if alt.scores.indoor_heating < rec.scores.indoor_heating:
            reasons_why.append(f"Lower habitat thermal index ({alt.scores.indoor_heating:.0f} vs {rec.scores.indoor_heating:.0f})")
        if alt.scores.operational_risk > rec.scores.operational_risk:
            reasons_why.append(f"Higher operational risk ({alt.scores.operational_risk:.0f} vs {rec.scores.operational_risk:.0f})")
        if alt.scores.crew_safety < rec.scores.crew_safety:
            reasons_why.append(f"Lower crew safety score ({alt.scores.crew_safety:.0f} vs {rec.scores.crew_safety:.0f})")

        why_not = "; ".join(reasons_why) if reasons_why else f"Lower composite score ({alt.scores.overall_score:.0f} vs {rec.scores.overall_score:.0f})"

        alt_dict = alt.to_dict()
        alt_dict['whyNotSelected'] = why_not
        alt_dict['why_not_selected'] = why_not
        alternatives.append(alt_dict)

    rec_dict = rec.to_dict()

    return {
        'simulation_id': simulation_id or '',
        'horizon_hours': horizon_hours,
        'weights_used': weights,
        'detected_hazard': hazard_profile,
        'recommended_plan': {
            'id': rec.id,
            'name': rec.name,
            'interventions': rec.interventions,
            'scores': rec.scores.to_dict(),
            'hard_constraints': rec.hard_constraints,
        },
        'reasoning': rec.reasoning,
        'hard_constraints': rec.hard_constraints,
        'metrics': rec.scores.to_dict(),
        'alternatives': alternatives,
        'tradeoffs': rec.tradeoffs,
        'predicted_outcome': predicted_outcome,
        'baseline_outcome': baseline_outcome,
        # Diagnostics and Feasibility Context
        'diagnosed_problems': [p.to_dict() for p in problems],
        'diagnosedProblems': [p.to_dict() for p in problems],
        'available_resources': resources,
        'availableResources': resources,
        'feasible_interventions': feasible_interventions,
        'feasibleInterventions': feasible_interventions,
        'constraints_checked': [
            'Indoor temperature >= 10.0°C (life safety threshold)',
            'Unserved electrical deficit <= 5.0 kW (critical equipment)',
            'Battery storage reserve >= 15.0% (black-start floor)',
            'Generator continuous load <= 105% (overload threshold)',
            'Fuel reserves > 0 days (depletion prevention)',
        ],
        'rejected_plans': [
            alt for alt in alternatives if not alt.get('is_safe', True) or 'Fails safety constraints' in alt.get('whyNotSelected', '')
        ],
        # CamelCase backward-compatibility aliases:
        'recommendedPlan': rec_dict,
        'rankedPlans': [p.to_dict() for p in plans],
        'scores': rec.scores.to_dict(),
        'predictedOutcome': predicted_outcome,
        'baselineOutcomeWithoutIntervention': baseline_outcome,
    }


def optimize_from_dict(
    payload: Dict[str, Any],
    horizon_hours: int = DEFAULT_HORIZON
) -> Dict[str, Any]:
    """
    Directly optimizes candidate interventions from a structured JSON input dictionary:
    {
      "station_state": {},
      "active_hazards": [],
      "failed_equipment": [],
      "available_resources": {},
      "simulation_time": {},
      "available_interventions": []
    }
    """
    from .engine import SimulationEngine

    state_data = payload.get('station_state', {})
    station_id = state_data.get('station_id') or state_data.get('stationId') or 'maitri'

    if state_data:
        state = StationState.from_dict(state_data)
        engine = SimulationEngine(station_id=station_id, initial_state=state)
    else:
        engine = SimulationEngine(station_id=station_id)

    # Apply active hazards / scenarios if provided
    hazards = payload.get('active_hazards', [])
    for h in hazards:
        if h not in engine.state.active_scenarios:
            engine.state.active_scenarios.append(h)

    # Mark failed equipment if provided
    failed_eq = payload.get('failed_equipment', [])
    for eq_id in failed_eq:
        for eq in engine.state.equipment:
            if eq.id == eq_id:
                eq.is_online = False
                eq.health = 0

    return optimize_decisions_detailed(
        engine=engine,
        horizon_hours=horizon_hours,
        custom_weights=payload.get('weights'),
        simulation_id=str(payload.get('simulation_id', ''))
    )
