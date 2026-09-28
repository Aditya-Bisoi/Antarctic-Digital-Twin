"""
cascade.py — Cascade failure engine
Antarctic Digital Twin — SIH26060

Evaluates system dependency graph and identifies cascade failure chains.
"""

from typing import List
from .state import StationState, CascadeNode


# ============================================================================
# Dependency Graph
# ============================================================================

DEPENDENCY_EDGES = [
    # (source_id, target_id, cause_template, effect_template)
    ('environment', 'heating',
     'Extreme cold ({temp:.1f}°C) and wind ({wind:.0f} km/h)',
     'Heating demand increases to {heating:.0f} kW'),
    ('heating', 'power',
     'Heating demand at {heating:.0f} kW',
     'Total power consumption rises to {consumption:.0f} kW'),
    ('power', 'generators',
     'Power consumption at {consumption:.0f} kW',
     'Generator load increases to {load:.0f}%'),
    ('generators', 'fuel',
     'Generator load at {load:.0f}%',
     'Fuel consumption rises to {fuel_rate:.1f} L/hr'),
    ('fuel', 'endurance',
     'Fuel consumption at {fuel_rate:.1f} L/hr',
     'Fuel endurance drops to {endurance:.1f} days'),
    ('endurance', 'risk',
     'Fuel endurance at {endurance:.1f} days',
     'Station risk level elevated to {risk}'),
]


def evaluate_cascade(state: StationState, baseline: StationState) -> dict:
    """
    Evaluate the current cascade state.

    Returns a dict with:
    - chain: list of CascadeNode dicts
    - active_cascades: list of active cascade descriptions
    - severity: overall cascade severity
    """
    active_cascades = []

    # Check each dependency edge
    if (state.environment.temperature < -35 or state.environment.wind_speed > 60):
        if state.energy.heating_demand_kw > baseline.energy.heating_demand_kw * 1.2:
            active_cascades.append({
                'source': 'Environment',
                'target': 'Heating',
                'cause': f'Extreme conditions ({state.environment.temperature:.1f}°C, {state.environment.wind_speed:.0f} km/h)',
                'effect': f'Heating demand increased to {state.energy.heating_demand_kw:.0f} kW (+{((state.energy.heating_demand_kw / max(baseline.energy.heating_demand_kw, 1)) - 1) * 100:.0f}%)',
                'severity': 'critical' if state.energy.heating_demand_kw > baseline.energy.heating_demand_kw * 1.8 else 'warning',
            })

    if state.energy.total_consumption_kw > baseline.energy.total_consumption_kw * 1.15:
        if state.energy.power_deficit_kw > 0:
            active_cascades.append({
                'source': 'Power Demand',
                'target': 'Power Supply',
                'cause': f'Consumption ({state.energy.total_consumption_kw:.0f} kW) exceeds generation ({state.energy.total_generation_kw:.0f} kW)',
                'effect': f'Power deficit of {state.energy.power_deficit_kw:.0f} kW',
                'severity': 'critical',
            })

    if any(g.is_online and g.load_percent > 85 for g in state.energy.generators):
        active_cascades.append({
            'source': 'Power Demand',
            'target': 'Generators',
            'cause': 'High power demand',
            'effect': 'Generator(s) operating above 85% load — accelerated wear',
            'severity': 'warning',
        })

    if state.logistics.fuel_consumption_lph > baseline.logistics.fuel_consumption_lph * 1.3:
        active_cascades.append({
            'source': 'Generator Load',
            'target': 'Fuel',
            'cause': f'Generator fuel consumption at {state.logistics.fuel_consumption_lph:.1f} L/hr',
            'effect': f'Fuel endurance reduced to {state.logistics.fuel_endurance_days:.1f} days',
            'severity': 'critical' if state.logistics.fuel_endurance_days < 14 else 'warning',
        })

    if (state.infrastructure.heating_system_status == 'Failed' and
            state.infrastructure.indoor_temp_avg < 15):
        active_cascades.append({
            'source': 'Heating Failure',
            'target': 'Indoor Environment',
            'cause': 'Heating system offline',
            'effect': f'Indoor temperature dropping — currently {state.infrastructure.indoor_temp_avg:.1f}°C',
            'severity': 'critical',
        })

    if state.communication.status == 'Offline':
        active_cascades.append({
            'source': 'Communication',
            'target': 'Data Sync',
            'cause': 'Satellite communication offline',
            'effect': f'{state.communication.pending_data_packets:.0f} data packets buffered locally',
            'severity': 'warning',
        })

    # Overall severity
    critical_count = sum(1 for c in active_cascades if c['severity'] == 'critical')
    if critical_count >= 2:
        overall_severity = 'critical'
    elif critical_count >= 1:
        overall_severity = 'high'
    elif active_cascades:
        overall_severity = 'warning'
    else:
        overall_severity = 'normal'

    return {
        'active_cascades': active_cascades,
        'severity': overall_severity,
        'chain': [node_to_dict(n) for n in state.cascade_chain],
    }


def node_to_dict(node: CascadeNode) -> dict:
    return {
        'id': node.id,
        'label': node.label,
        'detail': node.detail,
        'isActive': node.is_active,
        'severity': node.severity,
        'children': node.children,
    }
