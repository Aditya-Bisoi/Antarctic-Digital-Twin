"""
physics.py — Physics relationship functions
Antarctic Digital Twin — SIH26060

All physically/logically meaningful formulas for the simulation.
Each function is pure (no side effects), testable, and documented.
Values are clamped to prevent physically impossible results.
"""

import math
from .constants import (
    HEATING_TEMP_COEFFICIENT, WIND_HEATING_PENALTY_KW_PER_KMH,
    WIND_HEATING_PENALTY_THRESHOLD, FUEL_LOAD_EXPONENT,
    HEALTH_OUTPUT_EXPONENT, GENERATOR_FUEL_BASE_RATE_LPH,
    BATTERY_MAX_CHARGE_RATE_KW, SOLAR_WINTER_BASELINE_FACTOR,
    INDOOR_TEMP_DECAY_RATE, CREW_POWER_KW_PER_PERSON,
    CREW_FOOD_KG_PER_PERSON_PER_DAY, CREW_WATER_L_PER_PERSON_PER_DAY,
    WIND_TURBINE_LOCK,
)


def clamp(value: float, min_val: float, max_val: float) -> float:
    """Clamp value to [min_val, max_val]."""
    return max(min_val, min(max_val, value))


def lerp(current: float, target: float, rate: float) -> float:
    """Linear interpolation from current toward target at the given rate."""
    return current + (target - current) * rate


def calculate_wind_chill(temp: float, wind_speed: float) -> float:
    """
    Standard wind chill formula (Environment Canada / NWS).
    Only applicable when temp <= 10°C and wind >= 4.8 km/h.

    Formula: 13.12 + 0.6215*T - 11.37*V^0.16 + 0.3965*T*V^0.16
    where T = temperature (°C), V = wind speed (km/h)
    """
    if temp > 10 or wind_speed < 4.8:
        return temp
    v_exp = math.pow(wind_speed, 0.16)
    return 13.12 + 0.6215 * temp - 11.37 * v_exp + 0.3965 * temp * v_exp


def calculate_heating_demand(
    base_heating_kw: float,
    base_temp: float,
    current_temp: float,
    wind_speed: float,
    heating_efficiency: float = 1.0,
) -> float:
    """
    Calculate heating demand based on temperature and wind.

    Physics: heating_kw = base_heating * (1 + 0.03 * max(0, base_temp - current_temp))
             + wind_penalty (extra kW above 50 km/h wind)

    Assumptions:
    - base_temp is the station's normal operating outdoor temperature
    - 3% additional heating per degree below baseline
    - Wind above 50 km/h adds 0.15 kW per km/h due to convective heat loss
    - Heating efficiency scales output (degraded equipment → less effective)

    Returns: heating demand in kW, clamped to [0, 300]
    """
    temp_delta = max(0, base_temp - current_temp)
    heating_multiplier = 1 + HEATING_TEMP_COEFFICIENT * temp_delta
    wind_penalty = max(0, (wind_speed - WIND_HEATING_PENALTY_THRESHOLD) * WIND_HEATING_PENALTY_KW_PER_KMH)

    target_heating = base_heating_kw * heating_multiplier + wind_penalty
    target_heating *= clamp(heating_efficiency, 0.3, 1.0)

    return clamp(target_heating, 0, 300)


def calculate_fuel_rate(current_output_kw: float, rated_capacity_kw: float) -> float:
    """
    Calculate fuel consumption rate for a generator.

    Physics: fuel_rate = (current_output / rated_capacity) * base_rate * (load%)^1.15

    The exponent > 1 models the non-linear efficiency curve where generators
    consume disproportionately more fuel at higher loads.

    Returns: fuel consumption in liters per hour, clamped to [0, 100]
    """
    if rated_capacity_kw <= 0 or current_output_kw <= 0:
        return 0.0
    load_fraction = current_output_kw / rated_capacity_kw
    rate = load_fraction * GENERATOR_FUEL_BASE_RATE_LPH * math.pow(
        clamp(load_fraction, 0, 1), FUEL_LOAD_EXPONENT
    )
    return clamp(rate, 0, 100)


def calculate_fuel_endurance(fuel_liters: float, fuel_rate_lph: float) -> float:
    """
    Calculate fuel endurance in days.

    fuel_endurance_days = fuel_remaining / (fuel_rate * 24)

    Returns: endurance in days. Returns 9999 if fuel rate is 0.
    """
    if fuel_rate_lph <= 0:
        return 9999.0
    return fuel_liters / (fuel_rate_lph * 24)


def calculate_effective_output(rated_output_kw: float, health_percent: float) -> float:
    """
    Calculate effective output of equipment based on health.

    effective_output = rated_output * (health / 100)^0.5

    The square root models the fact that equipment doesn't lose output
    linearly with health — it degrades gracefully until critical thresholds.

    Returns: effective output in kW, clamped to [0, rated_output]
    """
    if health_percent <= 0:
        return 0.0
    efficiency = math.pow(clamp(health_percent, 0, 100) / 100, HEALTH_OUTPUT_EXPONENT)
    return clamp(rated_output_kw * efficiency, 0, rated_output_kw)


def calculate_generator_load(consumption_kw: float, generation_kw: float) -> float:
    """
    Calculate generator load percentage.

    generator_load_percent = consumption / generation * 100

    Returns: load percentage, clamped to [0, 150] (can exceed 100% under overload)
    """
    if generation_kw <= 0:
        return 0.0 if consumption_kw <= 0 else 150.0
    return clamp((consumption_kw / generation_kw) * 100, 0, 150)


def calculate_battery_change(
    power_balance_kw: float,
    capacity_kwh: float,
    current_percent: float,
    dt_hours: float,
    preserve_mode: bool = False,
) -> tuple:
    """
    Calculate battery state change over a time step.

    Args:
        power_balance_kw: generation - consumption (positive = surplus)
        capacity_kwh: total battery capacity
        current_percent: current battery level (0-100)
        dt_hours: time step in hours
        preserve_mode: if True, discharge rate reduced by 40%

    Returns:
        (new_percent, charge_rate_kw, discharge_rate_kw, is_charging)
    """
    if power_balance_kw > 0:
        # Surplus charges battery
        charge_rate = min(power_balance_kw, BATTERY_MAX_CHARGE_RATE_KW)
        charge_kwh = charge_rate * dt_hours
        new_percent = clamp(
            current_percent + (charge_kwh / max(capacity_kwh, 1)) * 100,
            0, 100
        )
        return new_percent, charge_rate, 0.0, True

    elif power_balance_kw < 0:
        # Deficit drains battery
        discharge_rate = abs(power_balance_kw)
        if preserve_mode:
            discharge_rate *= 0.6
        discharge_kwh = discharge_rate * dt_hours
        new_percent = clamp(
            current_percent - (discharge_kwh / max(capacity_kwh, 1)) * 100,
            0, 100
        )
        return new_percent, 0.0, discharge_rate, False

    else:
        return current_percent, 0.0, 0.0, False


def calculate_solar_factor(
    visibility: float,
    snow_accumulation: float,
    increase_renewables: bool = False,
) -> float:
    """
    Calculate solar generation factor based on conditions.

    Factors:
    - Antarctic winter baseline: 40% of max
    - Low visibility (<10km): 30% reduction
    - Heavy snow (>30cm): 50% reduction
    - Renewable optimization intervention: +40%

    Returns: factor 0.0-1.0
    """
    factor = SOLAR_WINTER_BASELINE_FACTOR
    if visibility < 10:
        factor *= 0.3
    if snow_accumulation > 30:
        factor *= 0.5
    if increase_renewables:
        factor *= 1.4
    return clamp(factor, 0, 1.0)


def calculate_wind_generation(wind_speed: float) -> float:
    """
    Calculate wind turbine generation based on wind speed.

    - Above 100 km/h: turbines locked (0 kW)
    - 60-100 km/h: feathered (15 kW)
    - Below 60 km/h: proportional to wind speed (0.5 kW per km/h, max 25 kW)

    Returns: wind generation in kW
    """
    if wind_speed > WIND_TURBINE_LOCK:
        return 0.0
    elif wind_speed > 60:
        return 15.0
    else:
        return clamp(wind_speed * 0.5, 0, 25)


def calculate_equipment_degradation(
    base_rate: float,
    dt_hours: float,
    outdoor_temp: float,
    wind_speed: float,
    gen_load_percent: float = 0.0,
    is_generator: bool = False,
    maintenance_intervention: bool = False,
) -> float:
    """
    Calculate equipment health degradation for a time step.

    Factors:
    - Base degradation rate (health % per hour)
    - Extreme cold (<-40°C): 1.5x degradation
    - High wind (>80 km/h): 1.3x degradation
    - Generator high load (>85%): 2.0x; (>70%): 1.3x
    - Maintenance intervention: 0.4x (60% reduction)

    Returns: health points to subtract
    """
    degradation = base_rate * dt_hours

    if outdoor_temp < -40:
        degradation *= 1.5
    if wind_speed > 80:
        degradation *= 1.3

    if is_generator:
        if gen_load_percent > 85:
            degradation *= 2.0
        elif gen_load_percent > 70:
            degradation *= 1.3

    if maintenance_intervention:
        degradation *= 0.4

    return degradation


def calculate_indoor_temperature(
    current_temp: float,
    target_temp: float,
    outdoor_temp: float,
    heating_active: bool,
    heating_failed: bool,
    power_deficit_kw: float,
    total_consumption_kw: float,
    dt_hours: float,
) -> float:
    """
    Calculate zone indoor temperature change over a time step.

    Scenarios:
    1. Heating failed or inactive: temperature decays toward outdoor temp
    2. Power deficit: heating at reduced capacity
    3. Normal: temperature moves toward target

    Returns: new temperature, clamped between outdoor_temp and 35°C
    """
    if heating_failed or not heating_active:
        # No heating — temperature decays toward outdoor
        new_temp = lerp(current_temp, outdoor_temp, INDOOR_TEMP_DECAY_RATE * dt_hours * 0.02)
    elif power_deficit_kw > 0 and total_consumption_kw > 0:
        # Partial power — heating at reduced capacity
        deficit_factor = 1 - clamp(power_deficit_kw / total_consumption_kw, 0, 0.8)
        effective_target = target_temp * deficit_factor + outdoor_temp * (1 - deficit_factor)
        new_temp = lerp(current_temp, effective_target, 0.05 * dt_hours)
    else:
        # Normal — temperature moves toward target
        new_temp = lerp(current_temp, target_temp, 0.08 * dt_hours)

    return clamp(new_temp, outdoor_temp, 35)


def calculate_crew_safety_risk(
    indoor_temp_avg: float,
    battery_percent: float,
    power_deficit_kw: float,
    fuel_endurance_days: float,
    wind_speed: float,
) -> str:
    """
    Determine crew safety risk level.

    Returns: 'LOW', 'MODERATE', 'HIGH', or 'CRITICAL'
    """
    if indoor_temp_avg < 5 or battery_percent < 5:
        return 'CRITICAL'
    elif indoor_temp_avg < 10 or power_deficit_kw > 50 or fuel_endurance_days < 3:
        return 'HIGH'
    elif indoor_temp_avg < 15 or fuel_endurance_days < 14 or wind_speed > 80:
        return 'MODERATE'
    else:
        return 'LOW'


def calculate_communication_quality(
    current_quality: float,
    wind_speed: float,
    comm_equipment_health: float,
) -> tuple:
    """
    Calculate communication quality based on wind and equipment health.

    Returns: (quality, status) where status is 'Online', 'Degraded', or 'Offline'
    """
    if wind_speed > 100:
        target = max(20, 100 - (wind_speed - 100) * 1.5)
        quality = clamp(lerp(current_quality, target, 0.05), 0, 100)
    elif wind_speed > 60:
        quality = clamp(lerp(current_quality, 80, 0.03), 0, 100)
    else:
        quality = clamp(lerp(current_quality, 100, 0.02), 0, 100)

    # Equipment health affects quality
    quality *= clamp(comm_equipment_health / 100, 0.2, 1)

    if quality <= 0:
        status = 'Offline'
    elif quality < 50:
        status = 'Degraded'
    else:
        status = 'Online'

    return quality, status
