"""
resilience.py — Multi-dimensional Resilience Calculation Engine
Antarctic Digital Twin — SIH26060

Evaluates station resilience across 8 weighted dimensions:
1. Energy Availability (15%)
2. Fuel Endurance (15%)
3. Equipment Health (15%)
4. Environmental Conditions (10%)
5. Logistics Status (15%)
6. Communication (10%)
7. Crew Safety (10%)
8. System Integrity (10%)
"""

from typing import List, Tuple
from .state import StationState, ResilienceFactor
from .constants import RESILIENCE_WEIGHTS
from .physics import clamp


def evaluate_resilience(state: StationState) -> Tuple[int, List[ResilienceFactor]]:
    """
    Evaluates multi-dimensional resilience score (0-100) and returns
    (overall_score, list_of_resilience_factors).
    """
    s = state
    factors: List[ResilienceFactor] = []

    # 1. Energy availability (15%)
    gen_online = sum(1 for g in s.energy.generators if g.is_online)
    gen_total = max(len(s.energy.generators), 1)
    energy_score = clamp(
        (100 if s.energy.power_surplus_kw > 0 else max(0, 100 - s.energy.power_deficit_kw * 2))
        * (gen_online / gen_total),
        0, 100,
    )
    factors.append(ResilienceFactor('Energy Availability', energy_score, RESILIENCE_WEIGHTS['energy_availability']))

    # 2. Fuel endurance (15%)
    fuel_score = clamp(min(100, s.logistics.fuel_endurance_days * 1.0), 0, 100)
    factors.append(ResilienceFactor('Fuel Endurance', fuel_score, RESILIENCE_WEIGHTS['fuel_endurance']))

    # 3. Equipment health (15%)
    equip_list = s.equipment or []
    avg_health = sum(e.health for e in equip_list) / max(len(equip_list), 1)
    factors.append(ResilienceFactor('Equipment Health', avg_health, RESILIENCE_WEIGHTS['equipment_health']))

    # 4. Environmental conditions (10%)
    env_score = clamp(
        100 - max(0, (-s.environment.temperature - 30) * 2)
        - max(0, (s.environment.wind_speed - 50) * 0.5),
        0, 100,
    )
    factors.append(ResilienceFactor('Environmental Conditions', env_score, RESILIENCE_WEIGHTS['environmental_conditions']))

    # 5. Logistics status (15%)
    log_score = clamp(min(
        s.logistics.food_endurance_days * 0.5,
        s.logistics.water_endurance_days * 1.0,
        s.logistics.medical_supply_percent,
        100,
    ), 0, 100)
    factors.append(ResilienceFactor('Logistics Status', log_score, RESILIENCE_WEIGHTS['logistics_status']))

    # 6. Communication (10%)
    comm_score = s.communication.quality
    factors.append(ResilienceFactor('Communication', comm_score, RESILIENCE_WEIGHTS['communication']))

    # 7. Crew safety (10%)
    crew_map = {'LOW': 100, 'MODERATE': 65, 'HIGH': 30, 'CRITICAL': 5}
    crew_score = crew_map.get(s.crew.safety_risk, 50)
    factors.append(ResilienceFactor('Crew Safety', crew_score, RESILIENCE_WEIGHTS['crew_safety']))

    # 8. System integrity (10%)
    failure_count = (
        sum(1 for e in s.equipment if not e.is_online or e.health <= 0)
        + (1 if s.infrastructure.heating_system_status == 'Failed' else 0)
        + (1 if s.communication.status == 'Offline' else 0)
    )
    failure_score = clamp(100 - failure_count * 25, 0, 100)
    factors.append(ResilienceFactor('System Integrity', failure_score, RESILIENCE_WEIGHTS['system_integrity']))

    resilience_score = round(sum(f.score * f.weight for f in factors))
    return resilience_score, factors
