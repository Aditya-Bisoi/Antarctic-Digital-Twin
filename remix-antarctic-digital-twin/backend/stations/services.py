def generate_ai_insights(station):
    """
    Generate rule-based AI prediction insights based on current station telemetry.
    """
    insights = []
    
    # 1. Energy Analysis
    energy = getattr(station, 'energy', None)
    if energy:
        load_ratio = energy.power_consumption_kw / max(energy.power_generation_kw, 1.0)
        if load_ratio > 0.85 or energy.generator_load_percent > 80:
            insights.append({
                "type": "energy",
                "severity": "high",
                "title": "High Generator Load Advisory",
                "message": f"Power consumption is at {int(load_ratio * 100)}% of total capacity. Consider enabling auxiliary microgrid solar trace."
            })
        elif energy.battery_level_percent < 30:
            insights.append({
                "type": "energy",
                "severity": "high",
                "title": "Critical Battery Reserve Warning",
                "message": f"Battery bank level has dropped to {energy.battery_level_percent}%. Immediate generator cycle required."
            })
        else:
            insights.append({
                "type": "energy",
                "severity": "nominal",
                "title": "Optimal Microgrid Load Balance",
                "message": f"Microgrid operating efficiently at {int(load_ratio * 100)}% capacity. Battery reserves healthy at {energy.battery_level_percent}%."
            })

    # 2. Environment & Weather Analysis
    env = getattr(station, 'environment', None)
    if env:
        if env.wind_speed > 60:
            insights.append({
                "type": "environment",
                "severity": "high",
                "title": "Severe Katabatic Blizzard Alert",
                "message": f"Wind speeds of {env.wind_speed} km/h detected. Recommendation: Lock auxiliary wind turbines and restrict outdoor EVA."
            })
        elif env.temperature < -35:
            insights.append({
                "type": "environment",
                "severity": "medium",
                "title": "Extreme Freeze Warning",
                "message": f"Ambient temperature dropped to {env.temperature}°C. Automated thermal tracing active on water pipelines."
            })
        else:
            insights.append({
                "type": "environment",
                "severity": "nominal",
                "title": "Stable Polar Weather Conditions",
                "message": f"Ambient temperature at {env.temperature}°C with visibility of {env.visibility_km} km."
            })

    # 3. Infrastructure Health Analysis
    infra = getattr(station, 'infrastructure', None)
    if infra:
        if infra.overall_health_percent < 85:
            insights.append({
                "type": "infrastructure",
                "severity": "medium",
                "title": "Subsystem Maintenance Recommended",
                "message": f"Station infrastructure health is at {infra.overall_health_percent}%. Check life support and heating loops."
            })
        else:
            insights.append({
                "type": "infrastructure",
                "severity": "nominal",
                "title": "Infrastructure Nominal",
                "message": f"All {infra.active_sensors}/{infra.total_sensors} telemetry sensors reporting green with {infra.overall_health_percent}% health."
            })

    # 4. Logistics & Reserves Analysis
    logistics = getattr(station, 'logistics', None)
    if logistics:
        if logistics.fuel_reserve_days < 60:
            insights.append({
                "type": "logistics",
                "severity": "high",
                "title": "Critical Fuel Shortage Warning",
                "message": f"Fuel reserves down to {logistics.fuel_reserve_days} days. Prioritize resupply dispatch."
            })
        elif logistics.food_ration_days < 90:
            insights.append({
                "type": "logistics",
                "severity": "medium",
                "title": "Low Food Stock Advisory",
                "message": f"Cold store rations sufficient for {logistics.food_ration_days} days. Restock needed."
            })
        else:
            insights.append({
                "type": "logistics",
                "severity": "nominal",
                "title": "Sufficient Expedition Rations & Fuel",
                "message": f"Fuel reserve covers {logistics.fuel_reserve_days} days ({logistics.fuel_level_liters:,} L); food covers {logistics.food_ration_days} days."
            })

    return insights


def run_what_if_simulation(station, scenario_name: str):
    """
    Run dynamic physics-based What-If simulation using SimulationEngine.
    Initial state is authoritative from the station database, and outcomes
    are computed via deterministic thermodynamics and electrical models.
    """
    from simulation.engine import SimulationEngine
    from simulation.optimizer import optimize_decisions

    station_id = (station.id or 'maitri').lower()
    engine = SimulationEngine(station_id=station_id)
    initial_battery = engine.state.energy.battery_level_percent
    initial_temp = engine.state.infrastructure.indoor_temp_avg

    scenario_lower = scenario_name.lower().replace(' ', '_')

    # Apply appropriate scenario perturbations at hour 0
    if 'generator' in scenario_lower:
        engine.modify_state(lambda s: _trip_primary_generator(s))
    elif 'power' in scenario_lower:
        engine.modify_state(lambda s: _trip_all_generators(s))
    elif 'weather' in scenario_lower or 'blizzard' in scenario_lower:
        engine.modify_state(lambda s: _apply_blizzard(s))
    elif 'fuel' in scenario_lower:
        engine.modify_state(lambda s: _apply_fuel_shortage(s))
    else:
        # Default mild perturbation
        engine.modify_state(lambda s: _apply_general_stress(s))

    # Advance engine forward 24 simulation hours
    engine.advance_by_hours(24)

    final_battery = engine.state.energy.battery_level_percent
    battery_delta = final_battery - initial_battery
    battery_rate = round(battery_delta / 24.0, 1)
    battery_impact_str = f"{battery_rate:+0.1f}% / hr"

    temp_drop = round(initial_temp - engine.state.infrastructure.indoor_temp_avg, 1)
    if temp_drop > 0.1:
        temp_drop_str = f"{temp_drop:.1f}°C indoor drop over 24 hours"
    else:
        temp_drop_str = f"Nominal ({engine.state.infrastructure.indoor_temp_avg:.1f}°C)"

    # Compute backup duration
    if engine.state.energy.power_deficit_kw > 0:
        kwh_left = (engine.state.energy.battery_level_percent / 100.0) * engine.state.energy.battery_capacity_kwh
        hrs_left = round(kwh_left / max(1.0, engine.state.energy.power_deficit_kw), 1)
        backup_duration_str = f"{hrs_left} hours critical emergency battery buffer"
    else:
        backup_duration_str = f"{round(engine.state.logistics.fuel_endurance_days, 1)} days standard fuel & microgrid buffer"

    # Get actionable recommendations from optimizer
    plans = optimize_decisions(engine)
    if plans and plans[0].reasoning:
        recommended_actions = plans[0].reasoning[:4]
    else:
        recommended_actions = [
            "Maintain automated microgrid load balance",
            "Monitor auxiliary battery reserve levels",
            "Verify thermal pipeline tracing integrity",
            "Keep telemetry sync verified with operations desk",
        ]

    risk_level_display = engine.state.risk_level.title()
    if risk_level_display not in ('Low', 'Medium', 'High', 'Critical'):
        risk_level_display = 'Medium'

    return {
        "scenario": scenario_name,
        "batteryImpact": battery_impact_str,
        "backupDuration": backup_duration_str,
        "riskLevel": risk_level_display,
        "recommendedActions": recommended_actions,
        "projectedBatteryIn24h": round(final_battery, 1),
        "projectedTempDrop": temp_drop_str,
    }


def _trip_primary_generator(state):
    """Auxiliary: Trip primary generator."""
    for gen in state.energy.generators:
        if '1' in gen.id or 'gen1' in gen.id:
            gen.is_online = False
            gen.current_output_kw = 0
            gen.status = 'Failed'
            gen.health = 0
    state.events.append(type('Event', (), {
        'id': 'sim-gen-trip',
        'simulation_hour': state.simulation_hour,
        'title': 'Primary Generator Failure',
        'description': 'Primary diesel generator tripped unexpectedly.',
        'severity': 'critical',
        'category': 'energy',
        'cause': 'Mechanical trip',
        'effect': 'Power deficit incurred',
        'timestamp': '00:00',
    })())


def _trip_all_generators(state):
    """Auxiliary: Total blackout."""
    for gen in state.energy.generators:
        gen.is_online = False
        gen.current_output_kw = 0
        gen.status = 'Failed'
        gen.health = 0
    state.energy.total_generation_kw = state.energy.solar_generation_kw + state.energy.wind_generation_kw


def _apply_blizzard(state):
    """Auxiliary: Extreme Katabatic Blizzard."""
    state.environment.wind_speed = 135
    state.environment.temperature = -42
    state.environment.visibility = 2.0
    state.environment.wind_chill = -62


def _apply_fuel_shortage(state):
    """Auxiliary: Fuel line leak and resupply delay."""
    state.logistics.fuel_level_liters = max(5000, state.logistics.fuel_level_liters * 0.25)
    state.logistics.fuel_endurance_days = round(state.logistics.fuel_level_liters / max(1.0, state.logistics.fuel_consumption_lph * 24), 1)
    state.logistics.resupply_delay_days = 45


def _apply_general_stress(state):
    """Auxiliary: Environmental stress."""
    state.environment.temperature -= 8
    state.environment.wind_speed += 20

