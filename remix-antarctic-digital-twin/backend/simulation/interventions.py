"""
interventions.py — Interventions engine and definitions
Antarctic Digital Twin — SIH26060

Python port of InterventionEngine.ts interventions.
Provides all 9 operational interventions, availability rules, apply and revert logic.
"""

from typing import Callable, List, Optional, Dict, Any
from dataclasses import dataclass
from .state import StationState


@dataclass
class InterventionDef:
    id: str
    name: str
    description: str
    category: str  # 'energy', 'heating', 'logistics', 'maintenance', 'crew'
    icon: str
    is_available: Callable[[StationState], bool]
    apply: Callable[[Any], None]
    revert: Callable[[Any], None]

    def to_dict(self, state: Optional[StationState] = None) -> Dict[str, Any]:
        available = self.is_available(state) if state else True
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'category': self.category,
            'icon': self.icon,
            'isAvailable': available,
        }


def _apply_start_backup_generator(engine):
    s = engine.state
    s.energy.backup_generator.is_online = True
    s.energy.backup_generator.status = 'Nominal'
    if 'start_backup_generator' not in s.active_interventions:
        s.active_interventions.append('start_backup_generator')
    engine.add_event(
        'intervention', 'Energy', 'Backup Generator Activated',
        f'Emergency backup generator online. Additional {s.energy.backup_generator.rated_capacity_kw} kW capacity available.'
    )


def _revert_start_backup_generator(engine):
    s = engine.state
    s.energy.backup_generator.is_online = False
    s.energy.backup_generator.current_output_kw = 0.0
    s.energy.backup_generator.load_percent = 0.0
    s.energy.backup_generator.status = 'Nominal'
    if 'start_backup_generator' in s.active_interventions:
        s.active_interventions.remove('start_backup_generator')


def _apply_reduce_noncritical_loads(engine):
    s = engine.state
    if 'reduce_noncritical_loads' not in s.active_interventions:
        s.active_interventions.append('reduce_noncritical_loads')
    engine.add_event(
        'intervention', 'Energy', 'Non-Critical Load Shedding',
        'Non-essential electrical loads disconnected. Recreational systems, optional lab equipment, and non-essential lighting powered down. ~30% consumption reduction.'
    )


def _revert_reduce_noncritical_loads(engine):
    s = engine.state
    if 'reduce_noncritical_loads' in s.active_interventions:
        s.active_interventions.remove('reduce_noncritical_loads')


def _apply_prioritize_critical(engine):
    s = engine.state
    if 'prioritize_critical' not in s.active_interventions:
        s.active_interventions.append('prioritize_critical')
    engine.add_event(
        'intervention', 'Energy', 'Critical System Prioritization',
        'Power redistributed to critical systems: Heating, Medical, Communication, Safety. Non-essential science loads deferred. ~10% consumption reduction.'
    )


def _revert_prioritize_critical(engine):
    s = engine.state
    if 'prioritize_critical' in s.active_interventions:
        s.active_interventions.remove('prioritize_critical')


def _apply_increase_renewables(engine):
    s = engine.state
    if 'increase_renewables' not in s.active_interventions:
        s.active_interventions.append('increase_renewables')
    engine.add_event(
        'intervention', 'Energy', 'Renewable Energy Maximized',
        'Solar panel tracking optimized. Wind turbine configuration adjusted. Renewable contribution increased ~40%.'
    )


def _revert_increase_renewables(engine):
    s = engine.state
    if 'increase_renewables' in s.active_interventions:
        s.active_interventions.remove('increase_renewables')


def _apply_preserve_battery(engine):
    s = engine.state
    if 'preserve_battery' not in s.active_interventions:
        s.active_interventions.append('preserve_battery')
    engine.add_event(
        'intervention', 'Energy', 'Battery Preservation Mode',
        'Battery switched to conservation mode. Discharge rate reduced by 40%. Extended backup duration at the cost of reduced supplemental power.'
    )


def _revert_preserve_battery(engine):
    s = engine.state
    if 'preserve_battery' in s.active_interventions:
        s.active_interventions.remove('preserve_battery')


def _apply_reduce_noncritical_heating(engine):
    s = engine.state
    if 'reduce_noncritical_heating' not in s.active_interventions:
        s.active_interventions.append('reduce_noncritical_heating')
    for zone in s.infrastructure.zones:
        if zone.category == 'non-critical':
            zone.target_temperature = max(2.0, zone.target_temperature - 8.0)
    engine.add_event(
        'intervention', 'Heating', 'Non-Critical Heating Reduced',
        'Heating reduced in storage, workshops, and non-essential areas. Saving ~20kW. Critical zones (living quarters, medical, comms) maintained at full heating.'
    )


def _revert_reduce_noncritical_heating(engine):
    s = engine.state
    if 'reduce_noncritical_heating' in s.active_interventions:
        s.active_interventions.remove('reduce_noncritical_heating')
    baseline = engine.baseline_state
    for zone in s.infrastructure.zones:
        if zone.category == 'non-critical':
            base_zone = next((z for z in baseline.infrastructure.zones if z.name == zone.name), None)
            if base_zone:
                zone.target_temperature = base_zone.target_temperature


def _apply_emergency_resupply(engine):
    s = engine.state
    if 'emergency_resupply' not in s.active_interventions:
        s.active_interventions.append('emergency_resupply')
    engine.add_event(
        'intervention', 'Logistics', 'Emergency Resupply Requested',
        'Emergency resupply dispatched via NCPOR Goa. Estimated arrival reduced by ~15 days. Priority: fuel, food, critical spare parts.'
    )


def _revert_emergency_resupply(engine):
    s = engine.state
    if 'emergency_resupply' in s.active_interventions:
        s.active_interventions.remove('emergency_resupply')


def _apply_increase_maintenance(engine):
    s = engine.state
    if 'increase_maintenance' not in s.active_interventions:
        s.active_interventions.append('increase_maintenance')
    engine.add_event(
        'intervention', 'Maintenance', 'Maintenance Priority Increased',
        'Additional maintenance crew assigned. Equipment degradation rate reduced by 60%. Spare parts consumption increased.'
    )


def _revert_increase_maintenance(engine):
    s = engine.state
    if 'increase_maintenance' in s.active_interventions:
        s.active_interventions.remove('increase_maintenance')


def _apply_generator_schedule(engine):
    s = engine.state
    if 'generator_schedule' not in s.active_interventions:
        s.active_interventions.append('generator_schedule')
    engine.add_event(
        'intervention', 'Energy', 'Generator Schedule Optimized',
        'Load distribution optimized across online generators. Peak loads reduced. Generator longevity improved.'
    )


def _revert_generator_schedule(engine):
    s = engine.state
    if 'generator_schedule' in s.active_interventions:
        s.active_interventions.remove('generator_schedule')


INTERVENTIONS: List[InterventionDef] = [
    InterventionDef(
        id='start_backup_generator',
        name='Start Backup Generator',
        description='Activate the emergency backup generator to provide additional power generation capacity.',
        category='energy',
        icon='Zap',
        is_available=lambda s: not s.energy.backup_generator.is_online and s.energy.backup_generator.health > 10,
        apply=_apply_start_backup_generator,
        revert=_revert_start_backup_generator,
    ),
    InterventionDef(
        id='reduce_noncritical_loads',
        name='Reduce Non-Critical Loads',
        description='Shed non-essential electrical loads (recreational, optional lab equipment, non-essential lighting) to reduce total power consumption by ~30%.',
        category='energy',
        icon='Power',
        is_available=lambda s: True,
        apply=_apply_reduce_noncritical_loads,
        revert=_revert_reduce_noncritical_loads,
    ),
    InterventionDef(
        id='prioritize_critical',
        name='Prioritize Critical Systems',
        description='Redistribute power to heating, medical, communication, and safety systems. Reduce optional laboratory and science loads.',
        category='energy',
        icon='Shield',
        is_available=lambda s: True,
        apply=_apply_prioritize_critical,
        revert=_revert_prioritize_critical,
    ),
    InterventionDef(
        id='increase_renewables',
        name='Maximize Renewable Energy',
        description='Optimize solar panel tracking and wind turbine configuration to increase renewable energy contribution by ~40%.',
        category='energy',
        icon='Sun',
        is_available=lambda s: s.environment.wind_speed < 100 and s.environment.visibility > 1,
        apply=_apply_increase_renewables,
        revert=_revert_increase_renewables,
    ),
    InterventionDef(
        id='preserve_battery',
        name='Preserve Battery Power',
        description='Switch battery to trickle-charge/conservation mode. Reduces discharge rate by 40% to extend backup duration.',
        category='energy',
        icon='Battery',
        is_available=lambda s: True,
        apply=_apply_preserve_battery,
        revert=_revert_preserve_battery,
    ),
    InterventionDef(
        id='reduce_noncritical_heating',
        name='Reduce Non-Critical Area Heating',
        description='Lower heating in storage, workshops, and non-essential areas to save ~20kW. Those zones will cool toward ambient.',
        category='heating',
        icon='ThermometerSnowflake',
        is_available=lambda s: s.infrastructure.heating_system_status != 'Failed',
        apply=_apply_reduce_noncritical_heating,
        revert=_revert_reduce_noncritical_heating,
    ),
    InterventionDef(
        id='emergency_resupply',
        name='Request Emergency Resupply',
        description='Dispatch request for emergency polar supply vessel or air-drop. Reduces effective resupply wait by ~15 days.',
        category='logistics',
        icon='Ship',
        is_available=lambda s: s.communication.status != 'Offline',
        apply=_apply_emergency_resupply,
        revert=_revert_emergency_resupply,
    ),
    InterventionDef(
        id='increase_maintenance',
        name='Increase Maintenance Priority',
        description='Assign additional crew to equipment maintenance. Slows degradation by 60% but increases spare parts consumption.',
        category='maintenance',
        icon='Wrench',
        is_available=lambda s: True,
        apply=_apply_increase_maintenance,
        revert=_revert_increase_maintenance,
    ),
    InterventionDef(
        id='generator_schedule',
        name='Optimize Generator Schedule',
        description='Redistribute load between generators to reduce peak stress. Lower individual generator loads improve longevity.',
        category='energy',
        icon='Clock',
        is_available=lambda s: len([g for g in s.energy.generators if g.is_online]) >= 2,
        apply=_apply_generator_schedule,
        revert=_revert_generator_schedule,
    ),
]


def get_intervention_by_id(intervention_id: str) -> Optional[InterventionDef]:
    return next((i for i in INTERVENTIONS if i.id == intervention_id), None)


def get_available_interventions(state: StationState) -> List[InterventionDef]:
    return [i for i in INTERVENTIONS if i.is_available(state)]
