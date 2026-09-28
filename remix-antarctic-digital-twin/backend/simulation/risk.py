"""
risk.py — Explainable Risk Assessment Engine
Antarctic Digital Twin — SIH26060

Evaluates station state across all physical dimensions and determines
an overall risk level (LOW, MODERATE, HIGH, CRITICAL) along with
explainable reasons and severity indicators.
"""

from typing import List, Tuple
from .state import StationState, RiskReason
from .constants import (
    TEMP_EXTREME_COLD,
    TEMP_SEVERE_COLD,
    WIND_OUTDOOR_RESTRICTED,
    VISIBILITY_WHITEOUT,
    BATTERY_CRITICAL,
    BATTERY_LOW,
    FUEL_CRITICAL_DAYS,
    TEMP_INDOOR_HYPOTHERMIA,
    TEMP_INDOOR_WARNING,
    FOOD_CRITICAL_DAYS,
    WATER_CRITICAL_DAYS,
    EQUIPMENT_HEALTH_CRITICAL,
)


def evaluate_risk(state: StationState) -> Tuple[str, List[RiskReason]]:
    """
    Pure function evaluating the multi-dimensional risk of a station state.
    Returns (risk_level, list_of_risk_reasons).
    """
    s = state
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

    return risk_level, reasons
