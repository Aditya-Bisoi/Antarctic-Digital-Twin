"""
scenarios.py — Scenario definitions and event application
Antarctic Digital Twin — SIH26060

Python port of the 13 scenarios from ScenarioLibrary.ts.
Each scenario is data-driven with events at specific hours.
"""

from typing import Optional
from .engine import SimulationEngine
from .physics import clamp, lerp, calculate_wind_chill


# ============================================================================
# Scenario Event Application
# ============================================================================

def _apply_gradual_change(engine: SimulationEngine, target_temp: float,
                          target_wind: float, target_vis: float,
                          target_pressure: float, description: str):
    """Apply gradual environmental change."""
    def modifier(s):
        rate = 0.15
        s.environment.temperature += (target_temp - s.environment.temperature) * rate
        s.environment.wind_speed += (target_wind - s.environment.wind_speed) * rate
        s.environment.visibility += (target_vis - s.environment.visibility) * rate
        s.environment.air_pressure += (target_pressure - s.environment.air_pressure) * rate
        if target_wind > 80:
            s.environment.snow_accumulation += 2
    engine.modify_state(modifier)
    engine.add_event('warning', 'Environment', 'Environmental Change', description)


def apply_scenario_event(engine: SimulationEngine, scenario_id: str,
                         action: str, params: Optional[dict] = None):
    """
    Apply a single scenario event to the engine.
    This is the main dispatch function for all scenario actions.
    """
    s = engine.get_state()
    params = params or {}

    # ---- Normal Operations ----
    if action == 'reset_to_normal':
        engine.reset()
        engine.add_event('info', 'System', 'Normal Operations',
                         'Station reset to nominal baseline conditions.')

    # ---- Extreme Cold ----
    elif action == 'cold_onset':
        target_temp = float(params.get('target_temp', -45.0))
        def _co(s):
            s.environment.temperature = target_temp
            s.environment.wind_chill = calculate_wind_chill(target_temp, s.environment.wind_speed)
        engine.modify_state(_co)
        engine.add_event('warning', 'Environment', 'Extreme Cold Wave',
                         f'Rapid temperature decline to {target_temp:.1f}°C detected. Heating demand surging.')
    elif action == 'cold_phase1':
        _apply_gradual_change(engine, -38, 45, 30, 980,
                              'Temperature dropping to -38°C. Heating demand increasing.')
    elif action == 'cold_phase2':
        _apply_gradual_change(engine, -45, 48, 25, 975,
                              'Temperature at -45°C. Significant heating load increase.')
    elif action == 'cold_peak':
        _apply_gradual_change(engine, -52, 50, 20, 970,
                              'Extreme cold peak: -52°C. Maximum heating demand.')
        engine.add_event('critical', 'Environment', 'Extreme Cold Peak',
                         'Temperature has reached -52°C. Heating system at maximum capacity.')
    elif action == 'cold_recovery':
        _apply_gradual_change(engine, -40, 42, 30, 980,
                              'Temperature recovering. Cold event subsiding.')

    # ---- Antarctic Storm ----
    elif action == 'storm_warning':
        target_wind = float(params.get('wind_speed', 105.0))
        target_temp = float(params.get('storm_temp', -40.0))
        def _sw(s):
            s.environment.air_pressure = 955.0
            s.environment.wind_speed = target_wind
            s.environment.temperature = target_temp
            s.environment.wind_chill = calculate_wind_chill(target_temp, target_wind)
            s.environment.visibility = 4.0
            s.crew.outdoor_ops_allowed = False
            s.crew.shelter_in_place = target_wind > 100.0
        engine.modify_state(_sw)
        engine.add_event('warning', 'Environment', 'Storm Warning Issued',
                         f'Katabatic blizzard hitting station with {target_wind:.0f} km/h winds.')
    elif action == 'storm_onset':
        _apply_gradual_change(engine, -35, 75, 15, 965,
                              'Storm front arriving. Winds accelerating to 75 km/h.')
        engine.add_event('warning', 'Environment', 'Storm Front Arrival',
                         'Katabatic storm front has reached the station. Outdoor operations restricted.')
    elif action == 'storm_intensify':
        _apply_gradual_change(engine, -42, 110, 5, 955,
                              'Storm intensifying. Winds at 110 km/h.')
        def _si(s):
            s.crew.shelter_in_place = True
            s.crew.outdoor_ops_allowed = False
        engine.modify_state(_si)
        engine.add_event('critical', 'Environment', 'Storm Intensifying',
                         'Wind speeds exceed 110 km/h. Shelter-in-place activated.')
    elif action == 'storm_peak':
        _apply_gradual_change(engine, -48, 145, 0.5, 942,
                              'STORM PEAK: 145 km/h winds, -48°C, near-zero visibility.')
        engine.add_event('critical', 'Environment', 'Storm at Maximum Intensity',
                         'Katabatic blizzard at peak intensity. All systems under maximum stress.')
    elif action == 'storm_weakening':
        _apply_gradual_change(engine, -40, 85, 8, 960,
                              'Storm weakening. Winds decreasing.')
        engine.add_event('info', 'Environment', 'Storm Weakening',
                         'Storm intensity decreasing. Conditions remain hazardous.')
    elif action == 'storm_passing':
        _apply_gradual_change(engine, -32, 50, 25, 978,
                              'Storm passing. Conditions gradually normalizing.')
        def _sp(s):
            s.crew.shelter_in_place = False
        engine.modify_state(_sp)
        engine.add_event('info', 'Environment', 'Storm Passing',
                         'Katabatic blizzard has largely passed. Begin damage assessment.')

    # ---- Generator Failure ----
    elif action == 'gen_warning':
        gen_id = params.get('which_generator', 'gen1')
        def _gw(s):
            target = next((g for g in s.energy.generators if g.id == gen_id), None)
            if target:
                target.is_online = False
                target.failed_at_hour = s.simulation_hour
                target.current_output_kw = 0.0
                target.load_percent = 0.0
                target.fuel_rate_lph = 0.0
                target.status = 'Failed'
                eq = next((e for e in s.equipment if e.id == f'eq-{gen_id}'), None)
                if eq:
                    eq.is_online = False
                    eq.status = 'Failed'
                    eq.health = 0.0
        engine.modify_state(_gw)
        engine.add_event('critical', 'Energy', 'Generator Failure',
                         f'Generator {gen_id} has failed. Remaining unit absorbing surge load.')
    elif action == 'gen_fail':
        gen_id = params.get('which_generator', 'gen1')
        def _gf(s):
            target = next((g for g in s.energy.generators if g.id == gen_id), None)
            if target:
                target.is_online = False
                target.failed_at_hour = s.simulation_hour
                target.current_output_kw = 0
                target.load_percent = 0
                target.fuel_rate_lph = 0
                target.status = 'Failed'
                eq = next((e for e in s.equipment if e.id == f'eq-{gen_id}'), None)
                if eq:
                    eq.is_online = False
                    eq.status = 'Failed'
                    eq.health = 0
        engine.modify_state(_gf)
        label = 'Primary' if gen_id == 'gen1' else 'Secondary'
        engine.add_event('critical', 'Energy', 'Generator Failure',
                         f'{label} generator has failed. Remaining generator(s) absorbing additional load.')

    # ---- Heating System Failure ----
    elif action == 'heating_warning':
        def _hw(s):
            s.infrastructure.heating_system_status = 'Failed'
            heq = next((e for e in s.equipment if e.category == 'heating'), None)
            if heq:
                heq.health = 0.0
                heq.is_online = False
                heq.status = 'Failed'
            for zone in s.infrastructure.zones:
                if zone.category != 'critical':
                    zone.is_heating_active = False
        engine.modify_state(_hw)
        engine.add_event('critical', 'Infrastructure', 'Central Heating Trip',
                         'Central heating circulation pump tripped. Non-critical zones losing thermal support.')
    elif action == 'heating_fail':
        def _hf(s):
            s.infrastructure.heating_system_status = 'Failed'
            heq = next((e for e in s.equipment if e.category == 'heating'), None)
            if heq:
                heq.health = 0
                heq.is_online = False
                heq.status = 'Failed'
            for zone in s.infrastructure.zones:
                zone.is_heating_active = False
        engine.modify_state(_hf)
        engine.add_event('critical', 'Infrastructure', 'Heating System Failed',
                         'Central heating system has completely failed. Indoor temperatures will begin declining.')

    # ---- Fuel Shortage ----
    elif action == 'fuel_shortage':
        fuel_level = float(params.get('fuel_level', 25000))
        def _fs(s):
            s.logistics.fuel_level_liters = fuel_level
        engine.modify_state(_fs)
        engine.add_event('critical', 'Logistics', 'Critical Fuel Shortage',
                         f'Fuel reserves set to {fuel_level:,.0f} liters.')

    # ---- Resupply Delay ----
    elif action == 'resupply_delay':
        delay = int(params.get('delay_days', 14))
        def _rd(s):
            s.logistics.resupply_delay_days = delay
        engine.modify_state(_rd)
        engine.add_event('warning', 'Logistics', 'Resupply Mission Delayed',
                         f'Next resupply mission delayed by {delay} days.')

    # ---- Communication Failure ----
    elif action == 'comm_degrade':
        def _cd(s):
            s.communication.quality = 40
            s.communication.status = 'Degraded'
        engine.modify_state(_cd)
        engine.add_event('warning', 'Communication', 'Communication Degrading',
                         'Satellite uplink quality declining.')
    elif action == 'comm_fail':
        def _cf(s):
            s.communication.quality = 0
            s.communication.status = 'Offline'
            s.communication.is_data_syncing = False
            s.communication.satellite_uplink_mbps = 0
            ceq = next((e for e in s.equipment if e.category == 'comms'), None)
            if ceq:
                ceq.health = 15
                ceq.is_online = False
                ceq.status = 'Failed'
        engine.modify_state(_cf)
        engine.add_event('critical', 'Communication', 'Communication Offline',
                         'Satellite communication completely unavailable.')
    elif action == 'comm_restore':
        def _cr(s):
            ceq = next((e for e in s.equipment if e.category == 'comms'), None)
            if ceq:
                ceq.health = 70
                ceq.is_online = True
                ceq.status = 'Warning'
            s.communication.quality = 60
            s.communication.status = 'Degraded'
            s.communication.is_data_syncing = True
        engine.modify_state(_cr)
        engine.add_event('info', 'Communication', 'Communication Partially Restored',
                         'Satellite uplink restored at reduced capacity.')

    # ---- Equipment Degradation ----
    elif action == 'degradation_accelerate':
        def _da(s):
            for eq in s.equipment:
                eq.degradation_rate *= 8
        engine.modify_state(_da)
        engine.add_event('info', 'Equipment', 'Equipment Degradation Simulation',
                         'Equipment degradation rate accelerated for simulation.')

    # ---- Crew Increase ----
    elif action == 'crew_arrives':
        additional = int(params.get('additional_crew', 10))
        def _ca(s):
            s.crew.count = s.crew.base_count + additional
        engine.modify_state(_ca)
        engine.add_event('info', 'Crew', f'+{additional} Crew Members',
                         f'{additional} additional expedition members. Total crew now {engine.get_state().crew.count}.')

    # ---- Multi Equipment Failure ----
    elif action == 'multi_fail_warning':
        engine.add_event('warning', 'Equipment', 'Multiple Anomalies Detected',
                         'Abnormal readings from Generator 2 and water treatment plant.')
    elif action == 'gen2_fail':
        def _g2f(s):
            gen2 = next((g for g in s.energy.generators if g.id == 'gen2'), None)
            if gen2:
                gen2.is_online = False
                gen2.failed_at_hour = s.simulation_hour
                gen2.status = 'Failed'
            eq = next((e for e in s.equipment if e.id == 'eq-gen2'), None)
            if eq:
                eq.is_online = False
                eq.status = 'Failed'
                eq.health = 0
        engine.modify_state(_g2f)
        engine.add_event('critical', 'Energy', 'Generator 2 Failed',
                         'Secondary generator has failed.')
    elif action == 'water_fail':
        def _wf(s):
            weq = next((e for e in s.equipment if e.category == 'water'), None)
            if weq:
                weq.is_online = False
                weq.status = 'Failed'
                weq.health = 0
            s.infrastructure.water_treatment_status = 'Failed'
        engine.modify_state(_wf)
        engine.add_event('critical', 'Infrastructure', 'Water Treatment Failed',
                         'Water treatment plant offline.')

    # ---- Combined Emergency ----
    elif action == 'storm_begins':
        engine.add_event('warning', 'Environment', 'Combined Emergency — Storm Warning',
                         'Severe storm approaching while systems are under stress.')
    elif action == 'storm_arrives':
        _apply_gradual_change(engine, -42, 110, 3, 950,
                              'Storm arrives with 110 km/h winds and -42°C.')
    elif action == 'gen1_fails_in_storm':
        def _g1fs(s):
            gen1 = next((g for g in s.energy.generators if g.id == 'gen1'), None)
            if gen1:
                gen1.is_online = False
                gen1.failed_at_hour = s.simulation_hour
                gen1.status = 'Failed'
            eq = next((e for e in s.equipment if e.id == 'eq-gen1'), None)
            if eq:
                eq.is_online = False
                eq.status = 'Failed'
                eq.health = 0
        engine.modify_state(_g1fs)
        engine.add_event('critical', 'Energy', 'Generator 1 Failed During Storm',
                         'Primary generator has failed under storm-induced stress.')
    elif action == 'storm_peak_combined':
        _apply_gradual_change(engine, -48, 135, 0.8, 940,
                              'Storm at peak intensity. Single generator under extreme load.')
        engine.add_event('critical', 'System', 'Critical Combined Emergency',
                         'Storm at peak with only one generator. Immediate intervention required.')
    elif action == 'storm_weakens_combined':
        _apply_gradual_change(engine, -35, 65, 15, 968,
                              'Storm weakening. Single generator still operational.')

    # ---- Full Cascade Failure ----
    elif action == 'cascade_start':
        engine.add_event('warning', 'System', 'Full Cascade Scenario',
                         'Extreme multi-failure cascade simulation initiated.')
    elif action == 'cascade_storm':
        _apply_gradual_change(engine, -45, 130, 2, 945,
                              'Severe katabatic blizzard. Temperature plummeting. Winds 130 km/h.')
    elif action == 'cascade_gen_fail':
        def _cgf(s):
            gen1 = s.energy.generators[0] if s.energy.generators else None
            if gen1:
                gen1.is_online = False
                gen1.failed_at_hour = s.simulation_hour
                gen1.status = 'Failed'
            eq = next((e for e in s.equipment if e.id == 'eq-gen1'), None)
            if eq:
                eq.is_online = False
                eq.health = 0
                eq.status = 'Failed'
        engine.modify_state(_cgf)
        engine.add_event('critical', 'Energy', 'CASCADE: Generator 1 Failed',
                         'Storm-induced generator failure.')
    elif action == 'cascade_heating_fail':
        def _chf(s):
            s.infrastructure.heating_system_status = 'Failed'
            heq = next((e for e in s.equipment if e.category == 'heating'), None)
            if heq:
                heq.health = 0
                heq.is_online = False
                heq.status = 'Failed'
            for zone in s.infrastructure.zones:
                zone.is_heating_active = False
        engine.modify_state(_chf)
        engine.add_event('critical', 'Infrastructure', 'CASCADE: Heating System Failed',
                         'Heating system overloaded and failed. Crew safety at immediate risk.')
    elif action == 'cascade_resupply_delay':
        def _crd(s):
            s.logistics.resupply_delay_days = 21
        engine.modify_state(_crd)
        engine.add_event('critical', 'Logistics', 'CASCADE: Resupply Delayed 21 Days',
                         'Storm has made resupply impossible.')
    elif action == 'cascade_comm_degrade':
        def _ccd(s):
            s.communication.quality = 25
            s.communication.status = 'Degraded'
        engine.modify_state(_ccd)
        engine.add_event('critical', 'Communication', 'CASCADE: Communication Severely Degraded',
                         'Satellite communication at 25% quality.')
    elif action == 'cascade_fuel_critical':
        def _cfc(s):
            s.logistics.fuel_level_liters = min(s.logistics.fuel_level_liters, 30000)
        engine.modify_state(_cfc)
        engine.add_event('critical', 'Logistics', 'CASCADE: Fuel Critical',
                         'Elevated consumption has depleted fuel reserves to critical levels.')


def apply_scenario_events(engine: SimulationEngine, events_data: list,
                          current_hour: float, scenario_id: str = '',
                          params: Optional[dict] = None):
    """
    Apply all scenario events that match the current simulation hour.

    events_data: list of dicts with 'at_hour' and 'action' keys
    """
    for event in events_data:
        at_hour = event.get('at_hour', 0)
        action = event.get('action', '')
        if abs(current_hour - at_hour) < 0.15:
            apply_scenario_event(engine, scenario_id, action, params)


# ============================================================================
# Scenario definitions as data (for seeding)
# ============================================================================

SCENARIO_DEFINITIONS = [
    {
        'scenario_id': 'normal',
        'name': 'Normal Operations',
        'description': 'Station operating under standard Antarctic conditions. All systems nominal.',
        'severity': 'low',
        'category': 'baseline',
        'icon': 'CheckCircle',
        'duration_hours': 24,
        'events_data': [
            {'at_hour': 0, 'action': 'reset_to_normal', 'description': 'All systems reset to nominal baseline'},
        ],
    },
    {
        'scenario_id': 'extreme_cold',
        'name': 'Extreme Cold',
        'description': 'Temperature drops to -52°C. Heating demand surges, power consumption increases.',
        'severity': 'high',
        'category': 'environment',
        'icon': 'Thermometer',
        'duration_hours': 24,
        'events_data': [
            {'at_hour': 0, 'action': 'cold_onset', 'description': 'Temperature begins dropping'},
            {'at_hour': 1, 'action': 'cold_phase1', 'description': 'Temperature reaches -38°C'},
            {'at_hour': 3, 'action': 'cold_phase2', 'description': 'Temperature reaches -45°C'},
            {'at_hour': 6, 'action': 'cold_peak', 'description': 'Temperature reaches -52°C'},
            {'at_hour': 18, 'action': 'cold_recovery', 'description': 'Temperature begins recovering'},
        ],
    },
    {
        'scenario_id': 'antarctic_storm',
        'name': 'Extreme Antarctic Storm',
        'description': 'Full katabatic blizzard: -48°C, 145 km/h winds, 0.5 km visibility.',
        'severity': 'critical',
        'category': 'environment',
        'icon': 'CloudLightning',
        'duration_hours': 24,
        'events_data': [
            {'at_hour': 0, 'action': 'storm_warning', 'description': 'Storm warning issued'},
            {'at_hour': 2, 'action': 'storm_onset', 'description': 'Storm arrives'},
            {'at_hour': 4, 'action': 'storm_intensify', 'description': 'Storm intensifying — winds 110 km/h'},
            {'at_hour': 6, 'action': 'storm_peak', 'description': 'Storm peak — 145 km/h'},
            {'at_hour': 12, 'action': 'storm_weakening', 'description': 'Storm beginning to weaken'},
            {'at_hour': 20, 'action': 'storm_passing', 'description': 'Storm passing'},
        ],
    },
    {
        'scenario_id': 'generator_failure',
        'name': 'Generator Failure',
        'description': 'Primary or secondary generator fails. Power reserve decreases.',
        'severity': 'high',
        'category': 'energy',
        'icon': 'ZapOff',
        'duration_hours': 24,
        'configurable_parameters': {
            'which_generator': {'type': 'select', 'default': 'gen1',
                                'options': [{'label': 'Generator 1 (Primary)', 'value': 'gen1'},
                                            {'label': 'Generator 2 (Secondary)', 'value': 'gen2'}]},
        },
        'events_data': [
            {'at_hour': 0, 'action': 'gen_warning', 'description': 'Generator showing abnormal readings'},
            {'at_hour': 2, 'action': 'gen_fail', 'description': 'Generator fails'},
        ],
    },
    {
        'scenario_id': 'heating_failure',
        'name': 'Heating System Failure',
        'description': 'Central heating system fails. Indoor temperature begins declining.',
        'severity': 'critical',
        'category': 'infrastructure',
        'icon': 'Flame',
        'duration_hours': 24,
        'events_data': [
            {'at_hour': 0, 'action': 'heating_warning', 'description': 'Heating system degrading'},
            {'at_hour': 3, 'action': 'heating_fail', 'description': 'Heating system fails'},
        ],
    },
    {
        'scenario_id': 'fuel_shortage',
        'name': 'Fuel Shortage',
        'description': 'Fuel reserves are critically low.',
        'severity': 'high',
        'category': 'logistics',
        'icon': 'Fuel',
        'duration_hours': 48,
        'configurable_parameters': {
            'fuel_level': {'type': 'slider', 'min': 5000, 'max': 200000, 'step': 1000, 'default': 25000},
        },
        'events_data': [
            {'at_hour': 0, 'action': 'fuel_shortage', 'description': 'Fuel reserves critically low'},
        ],
    },
    {
        'scenario_id': 'resupply_delay',
        'name': 'Resupply Delayed',
        'description': 'Next resupply mission delayed.',
        'severity': 'medium',
        'category': 'logistics',
        'icon': 'Ship',
        'duration_hours': 48,
        'configurable_parameters': {
            'delay_days': {'type': 'select', 'default': 14,
                           'options': [{'label': '7 days', 'value': 7},
                                       {'label': '14 days', 'value': 14},
                                       {'label': '21 days', 'value': 21},
                                       {'label': '30 days', 'value': 30},
                                       {'label': '45 days', 'value': 45}]},
        },
        'events_data': [
            {'at_hour': 0, 'action': 'resupply_delay', 'description': 'Resupply mission delayed'},
        ],
    },
    {
        'scenario_id': 'comm_failure',
        'name': 'Satellite Communication Failure',
        'description': 'Satellite uplink fails. Tests station autonomy.',
        'severity': 'high',
        'category': 'communication',
        'icon': 'WifiOff',
        'duration_hours': 24,
        'events_data': [
            {'at_hour': 0, 'action': 'comm_degrade', 'description': 'Communication degrading'},
            {'at_hour': 2, 'action': 'comm_fail', 'description': 'Communication goes offline'},
            {'at_hour': 12, 'action': 'comm_restore', 'description': 'Communication restored'},
        ],
    },
    {
        'scenario_id': 'equipment_degradation',
        'name': 'Equipment Degradation',
        'description': 'Gradual equipment degradation with predictive warnings.',
        'severity': 'medium',
        'category': 'equipment',
        'icon': 'Wrench',
        'duration_hours': 48,
        'events_data': [
            {'at_hour': 0, 'action': 'degradation_accelerate', 'description': 'Degradation rate increases'},
        ],
    },
    {
        'scenario_id': 'crew_increase',
        'name': 'Crew Increase',
        'description': 'Additional expedition members arrive.',
        'severity': 'low',
        'category': 'crew',
        'icon': 'Users',
        'duration_hours': 24,
        'configurable_parameters': {
            'additional_crew': {'type': 'select', 'default': 10,
                                'options': [{'label': '+5', 'value': 5},
                                            {'label': '+10', 'value': 10},
                                            {'label': '+15', 'value': 15},
                                            {'label': '+20', 'value': 20},
                                            {'label': '+30', 'value': 30}]},
        },
        'events_data': [
            {'at_hour': 0, 'action': 'crew_arrives', 'description': 'Additional crew members arrive'},
        ],
    },
    {
        'scenario_id': 'multi_equipment_failure',
        'name': 'Multiple Equipment Failure',
        'description': 'Generator 2 and water treatment fail simultaneously.',
        'severity': 'high',
        'category': 'equipment',
        'icon': 'AlertOctagon',
        'duration_hours': 24,
        'events_data': [
            {'at_hour': 0, 'action': 'multi_fail_warning', 'description': 'Multiple anomalies detected'},
            {'at_hour': 2, 'action': 'gen2_fail', 'description': 'Generator 2 fails'},
            {'at_hour': 4, 'action': 'water_fail', 'description': 'Water treatment fails'},
        ],
    },
    {
        'scenario_id': 'combined_emergency',
        'name': 'Combined Emergency',
        'description': 'Storm + Generator failure. Concurrent crises with cascading effects.',
        'severity': 'critical',
        'category': 'combined',
        'icon': 'ShieldAlert',
        'duration_hours': 24,
        'events_data': [
            {'at_hour': 0, 'action': 'storm_begins', 'description': 'Storm warning issued'},
            {'at_hour': 3, 'action': 'storm_arrives', 'description': 'Storm hits'},
            {'at_hour': 6, 'action': 'gen1_fails_in_storm', 'description': 'Generator 1 fails'},
            {'at_hour': 10, 'action': 'storm_peak_combined', 'description': 'Storm at peak'},
            {'at_hour': 18, 'action': 'storm_weakens_combined', 'description': 'Storm weakening'},
        ],
    },
    {
        'scenario_id': 'full_cascade',
        'name': 'Full Cascade Failure',
        'description': 'Storm → Gen failure → Heating failure → Resupply delay → Comm degradation.',
        'severity': 'critical',
        'category': 'combined',
        'icon': 'Zap',
        'duration_hours': 24,
        'events_data': [
            {'at_hour': 0, 'action': 'cascade_start', 'description': 'Cascade scenario initiated'},
            {'at_hour': 2, 'action': 'cascade_storm', 'description': 'Severe storm arrives'},
            {'at_hour': 5, 'action': 'cascade_gen_fail', 'description': 'Generator 1 fails'},
            {'at_hour': 9, 'action': 'cascade_heating_fail', 'description': 'Heating system fails'},
            {'at_hour': 12, 'action': 'cascade_resupply_delay', 'description': 'Resupply delayed'},
            {'at_hour': 14, 'action': 'cascade_comm_degrade', 'description': 'Communication degraded'},
            {'at_hour': 18, 'action': 'cascade_fuel_critical', 'description': 'Fuel shortage critical'},
        ],
    },
]

SCENARIOS_CATALOG = SCENARIO_DEFINITIONS
