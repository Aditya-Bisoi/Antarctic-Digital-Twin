"""
storm_physics.py — Authoritative Physical Kinematics for Approaching Storms
Antarctic Digital Twin — SIH26060

Implements exact physical kinematics:
  distance_travelled_km = storm_motion_speed_kmh * elapsed_simulation_hours
  remaining_distance_km = max(0.0, initial_distance_km - distance_travelled_km)
  eta_hours = remaining_distance_km / storm_motion_speed_kmh (0.0 when arrived)

Strictly separates:
  - storm_motion_speed_kmh: Translation velocity toward research station (e.g. 60 km/h)
  - wind_speed_kmh: Cyclonic blizzard wind speed (e.g. 115 km/h)
"""

from typing import Dict, Any, Tuple


DEFAULT_STORM_INITIAL_DISTANCE_KM = 180.0
DEFAULT_STORM_MOTION_SPEED_KMH = 60.0
DEFAULT_BLIZZARD_WIND_KMH = 115.0
DEFAULT_RADAR_MAX_RANGE_KM = 200.0


def calculate_storm_kinematics(
    initial_distance_km: float = DEFAULT_STORM_INITIAL_DISTANCE_KM,
    storm_motion_speed_kmh: float = DEFAULT_STORM_MOTION_SPEED_KMH,
    elapsed_simulation_hours: float = 0.0,
    wind_speed_kmh: float = DEFAULT_BLIZZARD_WIND_KMH,
) -> Dict[str, Any]:
    """
    Computes exact storm position, distance travelled, remaining distance, and ETA.
    Clamps remaining distance to 0.0 (never negative).
    """
    initial_dist = max(0.0, float(initial_distance_km))
    storm_speed = max(0.1, float(storm_motion_speed_kmh))
    elapsed_hours = max(0.0, float(elapsed_simulation_hours))
    wind_speed = float(wind_speed_kmh)

    # distance_travelled = storm_speed * elapsed_time
    distance_travelled = storm_speed * elapsed_hours

    # remaining_distance = max(0, initial_distance - distance_travelled)
    remaining_distance = max(0.0, initial_dist - distance_travelled)

    # ETA_hours = remaining_distance / storm_speed
    eta_hours = round(remaining_distance / storm_speed, 2) if remaining_distance > 0.0 else 0.0

    has_arrived = remaining_distance <= 0.0001
    status = "ARRIVED" if has_arrived else "APPROACHING"

    return {
        "initial_distance_km": round(initial_dist, 2),
        "storm_motion_speed_kmh": round(storm_speed, 2),
        "elapsed_simulation_hours": round(elapsed_hours, 3),
        "distance_travelled_km": round(distance_travelled, 2),
        "remaining_distance_km": round(remaining_distance, 2),
        "eta_hours": eta_hours,
        "status": status,
        "has_arrived": has_arrived,
        "wind_speed_kmh": round(wind_speed, 2),
    }


def calculate_sim_elapsed_hours(real_elapsed_seconds: float, simulation_time_scale: float) -> float:
    """Converts real demo seconds to simulation hours using explicit time scale."""
    real_sec = max(0.0, float(real_elapsed_seconds))
    scale = max(1.0, float(simulation_time_scale))
    sim_elapsed_seconds = real_sec * scale
    return sim_elapsed_seconds / 3600.0


def calculate_storm_kinematics_variable_speed(
    initial_distance_km: float = DEFAULT_STORM_INITIAL_DISTANCE_KM,
    speed_steps: list = None,
    current_speed_kmh: float = DEFAULT_STORM_MOTION_SPEED_KMH,
    wind_speed_kmh: float = DEFAULT_BLIZZARD_WIND_KMH,
) -> Dict[str, Any]:
    """
    Computes kinematics when storm movement speed varies over discrete simulation steps:
      distance_travelled = sum(step_speed * step_duration)
      remaining_distance = max(0.0, initial_distance - distance_travelled)
      eta_hours = remaining_distance / current_speed
    """
    initial_dist = max(0.0, float(initial_distance_km))
    cumulative_travelled = 0.0
    total_elapsed_hours = 0.0

    steps = speed_steps or []
    for step in steps:
        if isinstance(step, (tuple, list)):
            s_speed, s_duration = step
        else:
            s_speed = step.get('speed_kmh', 0.0)
            s_duration = step.get('duration_hours', 0.0)
        cumulative_travelled += max(0.0, float(s_speed)) * max(0.0, float(s_duration))
        total_elapsed_hours += max(0.0, float(s_duration))

    remaining_dist = max(0.0, initial_dist - cumulative_travelled)
    curr_speed = max(0.1, float(current_speed_kmh))
    eta_hours = round(remaining_dist / curr_speed, 2) if remaining_dist > 0.0 else 0.0
    has_arrived = remaining_dist <= 0.0001

    return {
        "initial_distance_km": round(initial_dist, 2),
        "storm_motion_speed_kmh": round(curr_speed, 2),
        "elapsed_simulation_hours": round(total_elapsed_hours, 3),
        "distance_travelled_km": round(cumulative_travelled, 2),
        "remaining_distance_km": round(remaining_dist, 2),
        "eta_hours": eta_hours,
        "status": "ARRIVED" if has_arrived else "APPROACHING",
        "has_arrived": has_arrived,
        "wind_speed_kmh": round(float(wind_speed_kmh), 2),
    }

