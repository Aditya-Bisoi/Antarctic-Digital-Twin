"""
services.py — AI Insight & Operational Recommendation Layer
Antarctic Digital Twin — SIH26060

Analyzes station state, active hazards, equipment degradation, resource depletion rates,
and simulation outcomes to generate explainable, natural language decision support.
Deterministic rule-based reasoning engine ensuring consistent, reproducible advice.
"""

from typing import Dict, Any, List, Optional
from .state import StationState
from .optimizer import optimize_decisions


def generate_simulation_insights(state: StationState, engine=None) -> Dict[str, Any]:
    """
    Produces structured, explainable AI insights from station/simulation state.
    """
    s = state
    threats: List[Dict[str, Any]] = []
    actions: List[Dict[str, Any]] = []
    tradeoffs: List[str] = []
    assumptions: List[str] = [
        "Fuel consumption assumes baseline specific fuel consumption of 0.28 L/kWh under nominal load.",
        "Building thermal inertia estimated at 0.05°C/hr heat loss coefficient.",
        "Solar generation modeled per solar altitude angle and current cloud/atmospheric visibility.",
    ]

    # Assess Environmental Severity
    if s.environment.wind_speed > 100:
        threats.append({
            "category": "Environmental",
            "severity": "critical",
            "title": "Severe Blizzard / Katabatic Winds",
            "detail": f"Wind speeds at {s.environment.wind_speed:.0f} km/h with gusts exceeding safe thresholds.",
        })
        actions.append({
            "priority": 1,
            "action": "Enforce station shelter-in-place protocol and secure exterior sensor mounts.",
            "rationale": "High structural and hypothermia hazard to personnel outdoors.",
        })
    elif s.environment.temperature < -40:
        threats.append({
            "category": "Environmental",
            "severity": "warning",
            "title": "Extreme Ambient Cold",
            "detail": f"Temperature at {s.environment.temperature:.1f}°C placing heavy demand on thermal heating circuits.",
        })

    # Assess Energy & Generation
    if s.energy.power_deficit_kw > 0:
        threats.append({
            "category": "Energy",
            "severity": "critical",
            "title": f"Active Power Deficit ({s.energy.power_deficit_kw:.1f} kW)",
            "detail": "Station electrical demand exceeds currently active generation sources.",
        })
        actions.append({
            "priority": 1,
            "action": "Execute non-critical load shedding and bring auxiliary backup generator online.",
            "rationale": "Prevents rapid battery depletion and protects critical life support subsystems.",
        })
        tradeoffs.append("Load shedding shuts down non-essential lab experiments to protect habitability.")
    elif s.energy.battery_level_percent < 30:
        threats.append({
            "category": "Energy",
            "severity": "warning",
            "title": f"Low Battery Storage ({s.energy.battery_level_percent:.1f}%)",
            "detail": "Emergency battery buffer is substantially depleted.",
        })

    # Assess Heating & Habitat
    if s.infrastructure.indoor_temp_avg < 10:
        threats.append({
            "category": "Habitat",
            "severity": "critical",
            "title": "Interior Habitat Freezing Danger",
            "detail": f"Average indoor temperature down to {s.infrastructure.indoor_temp_avg:.1f}°C.",
        })
        actions.append({
            "priority": 1,
            "action": "Consolidate crew into insulated primary core and isolate perimeter workshops.",
            "rationale": "Reduces heating volume and prevents crew hypothermia.",
        })
        tradeoffs.append("Restricting living zones concentrates crew and limits workspace availability.")

    # Assess Fuel Logistics
    if s.logistics.fuel_endurance_days < s.logistics.next_resupply_days:
        shortage_gap = s.logistics.next_resupply_days - s.logistics.fuel_endurance_days
        threats.append({
            "category": "Logistics",
            "severity": "critical" if s.logistics.fuel_endurance_days < 14 else "warning",
            "title": "Fuel Exhaustion Before Scheduled Resupply",
            "detail": f"Fuel will be exhausted in {s.logistics.fuel_endurance_days:.1f} days, {shortage_gap:.1f} days before vessel arrival.",
        })
        actions.append({
            "priority": 2,
            "action": "Dispatch emergency resupply petition via NCPOR Goa and throttle generator output to eco-mode.",
            "rationale": "Extends endurance to bridge polar vessel transit time.",
        })

    # Assess Communications
    if s.communication.status == "Offline":
        threats.append({
            "category": "Communication",
            "severity": "critical",
            "title": "Primary Satellite Ground Link Severed",
            "detail": "Remote telemetry and voice links are down. Operating on autonomous local protocols.",
        })
        actions.append({
            "priority": 2,
            "action": "Initiate automated secondary UHF/HF polar beacon broadcast.",
            "rationale": "Maintains mission emergency heartbeat signal.",
        })

    # Assess Equipment Degradation
    degraded = [e for e in s.equipment if e.health < 50 and e.is_online]
    if degraded:
        names = ", ".join(e.name for e in degraded[:3])
        threats.append({
            "category": "Equipment",
            "severity": "warning",
            "title": f"Degraded Critical Subsystems ({len(degraded)})",
            "detail": f"Elevated vibration/thermal strain detected on: {names}.",
        })
        actions.append({
            "priority": 3,
            "action": "Assign preventive maintenance inspection cycle and reduce mechanical load factor.",
            "rationale": "Prevents catastrophic cascade failure.",
        })

    # Determine Urgency
    if s.risk_level == "CRITICAL" or any(t["severity"] == "critical" for t in threats):
        urgency = "critical"
        summary = (
            f"CRITICAL OPERATIONAL ALERT: Station {s.station_name} is facing immediate life-safety or subsystem collapse risks. "
            f"Overall risk level is {s.risk_level} with resilience at {s.resilience_score}/100. "
            f"Immediate emergency intervention is required to maintain habitability and vital electrical buses."
        )
    elif s.risk_level in ("HIGH", "MODERATE") or len(threats) > 0:
        urgency = "elevated"
        summary = (
            f"ELEVATED RISK NOTICE: Station {s.station_name} operating with reduced margins (Resilience: {s.resilience_score}/100). "
            f"Key challenges involve {', '.join(t['title'] for t in threats[:2])}. "
            f"Strategic preventative measures should be applied to prevent cascade degradation."
        )
    else:
        urgency = "routine"
        summary = (
            f"NOMINAL STATE: Station {s.station_name} systems are balanced. Resilience index is {s.resilience_score}/100. "
            f"Power surplus stands at {s.energy.power_surplus_kw:.1f} kW and fuel reserves provide {s.logistics.fuel_endurance_days:.0f} days of endurance."
        )

    # If engine is available, compute decision optimization
    optimized_plans = []
    if engine:
        try:
            plans = optimize_decisions(engine)
            optimized_plans = [p.to_dict() for p in plans[:3]]
        except Exception:
            optimized_plans = []

    return {
        "stationId": s.station_id,
        "stationName": s.station_name,
        "simulationHour": round(s.simulation_hour, 1),
        "urgency": urgency,
        "riskLevel": s.risk_level,
        "resilienceScore": s.resilience_score,
        "situationSummary": summary,
        "primaryThreats": threats,
        "recommendedActions": sorted(actions, key=lambda a: a.get("priority", 99)),
        "tradeoffs": tradeoffs,
        "assumptions": assumptions,
        "recommendedInterventions": optimized_plans,
    }
