"""
incidents.py — Real In-Flight Incident Injection and Resolution
Antarctic Digital Twin — SIH26060

Mutates live SimulationEngine state during active runs when unforeseen
hazards or equipment trips are injected, and handles operational resolution.
"""

from typing import Dict, Any, Optional, List
from .state import SimulationEventData


def inject_incident_into_engine(
    engine,
    incident_type: str,
    parameters: Optional[Dict[str, Any]] = None,
    description: str = '',
    severity: str = 'high',
) -> Dict[str, Any]:
    """
    Directly mutates engine state for an in-flight incident and appends
    an authoritative SimulationEvent to the timeline.
    """
    params = parameters or {}
    hour = round(engine.state.simulation_hour, 1)
    affected: List[str] = []

    inc_lower = incident_type.lower()

    if 'gen' in inc_lower or 'trip' in inc_lower:
        gen_id = params.get('generator_id', 'gen1')
        for gen in engine.state.energy.generators:
            if gen.id == gen_id or gen_id in gen.name.lower() or gen_id == 'primary':
                gen.is_online = False
                gen.current_output_kw = 0
                gen.status = 'Failed'
                gen.health = 0.0
                gen.vibration = 95.0
                affected.append(gen.name)
        for eq in engine.state.equipment:
            cat = getattr(eq, 'category', getattr(eq, 'type', ''))
            if gen_id in eq.id or cat == 'generator':
                eq.is_online = False
                eq.health = 0.0
                eq.status = 'Failed'
                affected.append(eq.name)

        title = f"Incident: Generator {gen_id} Trip"
        cause = f"Unexpected mechanical trip on {gen_id}"
        effect = "Active power deficit incurred; microgrid bus disrupted"

    elif 'heat' in inc_lower:
        engine.state.infrastructure.heating_system_status = 'Critical'
        for zone in engine.state.infrastructure.zones:
            cat = getattr(zone, 'category', getattr(zone, 'type', ''))
            if cat == 'non-critical':
                zone.heating_active = False
        for eq in engine.state.equipment:
            cat = getattr(eq, 'category', getattr(eq, 'type', ''))
            if cat == 'heating':
                eq.health = 10.0
                eq.status = 'Failed'
                affected.append(eq.name)

        title = "Incident: Central Heating Loop Fault"
        cause = "Circulation pump pressure drop in primary heating loop"
        effect = "Indoor temperatures dropping; non-critical thermal zones shedding heat"

    elif 'freeze' in inc_lower or 'water' in inc_lower:
        engine.state.infrastructure.water_treatment_status = 'Critical'
        for eq in engine.state.equipment:
            cat = getattr(eq, 'category', getattr(eq, 'type', ''))
            if cat == 'water':
                eq.health = 15.0
                eq.status = 'Critical'
                affected.append(eq.name)

        title = "Incident: Water Intake Pipeline Freeze"
        cause = "Thermal tracing line failure during sub-zero temperature excursion"
        effect = "Freshwater processing halted; reserve buffer depleting"

    elif 'comm' in inc_lower or 'blackout' in inc_lower:
        engine.state.communication.quality = 0
        engine.state.communication.satellite_uplink_mbps = 0
        engine.state.communication.status = 'Offline'
        engine.state.communication.is_data_syncing = False
        for eq in engine.state.equipment:
            cat = getattr(eq, 'category', getattr(eq, 'type', ''))
            if cat == 'comms':
                eq.health = 20.0
                eq.status = 'Failed'
                affected.append(eq.name)

        title = "Incident: Satellite Array Desynchronization"
        cause = "Severe ionospheric storm and antenna servo lockup"
        effect = "Zero uplink throughput; telemetry buffering locally"

    elif 'fuel' in inc_lower or 'leak' in inc_lower:
        loss_rate = float(params.get('rate_lph', 60.0))
        engine.state.logistics.fuel_consumption_lph += loss_rate
        engine.state.logistics.fuel_level_liters = max(0.0, engine.state.logistics.fuel_level_liters - 500.0)
        affected.append("Bulk Fuel Storage & Feed Line")

        title = "Incident: Fuel Feed Line Breach"
        cause = "Permafrost ground shifting fractured auxiliary fuel supply line"
        effect = f"Fuel drain accelerated by {loss_rate:.1f} L/h"

    else:
        # Generic hazard
        title = f"Incident: {incident_type}"
        cause = "System anomaly detected"
        effect = description or "Operational stress across subsystems"
        affected.append("General Station Subsystems")

    # Record authoritative simulation event
    event = SimulationEventData(
        hour=hour,
        type=severity if severity in ('info', 'warning', 'critical') else 'critical',
        category='incident',
        title=title,
        description=description or cause,
    )
    engine.state.events.append(event)

    return {
        'status': 'injected',
        'title': title,
        'simulationHour': hour,
        'affectedSystems': list(set(affected)),
    }


def resolve_incident_in_engine(
    engine,
    incident_type: str,
    parameters: Optional[Dict[str, Any]] = None,
    affected_systems: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Restores subsystem operability and registers a resolution event in the engine.
    """
    params = parameters or {}
    hour = round(engine.state.simulation_hour, 1)
    inc_lower = incident_type.lower()

    if 'gen' in inc_lower or 'trip' in inc_lower:
        gen_id = params.get('generator_id', 'gen1')
        for gen in engine.state.energy.generators:
            if gen.id == gen_id or gen_id in gen.name.lower() or gen_id == 'primary':
                gen.is_online = True
                gen.status = 'Nominal'
                gen.health = 88.0
                gen.current_output_kw = gen.rated_capacity_kw * 0.75
                gen.vibration = 22.0
        for eq in engine.state.equipment:
            cat = getattr(eq, 'category', getattr(eq, 'type', ''))
            if gen_id in eq.id or cat == 'generator':
                eq.is_online = True
                eq.health = 88.0
                eq.status = 'Nominal'

        title = f"Resolved: Generator {gen_id} Returned to Bus"
        effect = "Power generation restored to nominal baseline capacity"

    elif 'heat' in inc_lower:
        engine.state.infrastructure.heating_system_status = 'Nominal'
        for zone in engine.state.infrastructure.zones:
            zone.is_heating_active = True
        for eq in engine.state.equipment:
            cat = getattr(eq, 'category', getattr(eq, 'type', ''))
            if cat == 'heating':
                eq.health = 92.0
                eq.status = 'Nominal'

        title = "Resolved: Central Heating System Restored"
        effect = "Active circulation re-established across all habitat zones"

    elif 'freeze' in inc_lower or 'water' in inc_lower:
        engine.state.infrastructure.water_treatment_status = 'Nominal'
        for eq in engine.state.equipment:
            cat = getattr(eq, 'category', getattr(eq, 'type', ''))
            if cat == 'water':
                eq.health = 94.0
                eq.status = 'Nominal'

        title = "Resolved: Water Pipeline Thawed and Secured"
        effect = "Freshwater loop operational; normal delivery restored"

    elif 'comm' in inc_lower or 'blackout' in inc_lower:
        engine.state.communication.quality = 100
        engine.state.communication.satellite_uplink_mbps = engine.state.communication.max_uplink_mbps
        engine.state.communication.status = 'Online'
        engine.state.communication.is_data_syncing = True
        for eq in engine.state.equipment:
            cat = getattr(eq, 'category', getattr(eq, 'type', ''))
            if cat == 'comms':
                eq.health = 96.0
                eq.status = 'Nominal'

        title = "Resolved: Satellite Uplink Restored"
        effect = "High-throughput data synchronization active"

    elif 'fuel' in inc_lower or 'leak' in inc_lower:
        engine.state.logistics.fuel_consumption_lph = 40.0
        title = "Resolved: Fuel Line Isolated and Repaired"
        effect = "Excess consumption stopped; fuel telemetry stabilized"

    else:
        title = f"Resolved: Incident {incident_type}"
        effect = "Subsystems restored to normal parameters"

    # Add resolution event
    event = SimulationEventData(
        hour=hour,
        type='info',
        category='resolution',
        title=title,
        description=f"Field crew successfully completed emergency response for {incident_type}.",
    )
    engine.state.events.append(event)

    return {
        'status': 'resolved',
        'title': title,
        'simulationHour': hour,
    }
