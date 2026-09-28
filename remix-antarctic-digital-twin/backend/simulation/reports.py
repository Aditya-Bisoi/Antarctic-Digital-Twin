"""
reports.py — Comprehensive Simulation Report Generator
Antarctic Digital Twin — SIH26060

Compiles post-simulation evaluation reports detailing:
- Executive summary & incident timeline
- Environmental & energy extrema (min indoor temp, peak deficit, fuel depletion)
- Subsystem resilience trajectory
- Interventions effectiveness analysis
- Equipment health & predictive degradation audit
- Long-term operational recommendations
"""

from typing import Dict, Any, List
from .models import SimulationRun, SimulationReport
from .prediction import generate_predictions
from .state import StationState


def build_simulation_report(run: SimulationRun) -> Dict[str, Any]:
    """
    Analyzes historical snapshots and events for a SimulationRun to compile
    a complete analytical report.
    """
    snapshots = list(run.snapshots.all().order_by('simulation_hour'))
    incidents = list(run.incidents.all().order_by('start_hour'))
    interventions = list(run.applied_interventions.all().order_by('applied_at_hour'))
    events = list(run.events.all().order_by('simulation_hour'))

    # Calculate metrics over timeline
    min_temp = 999.0
    max_deficit = 0.0
    min_fuel_days = 9999.0
    min_resilience = 100.0
    risk_hours = {'LOW': 0.0, 'MODERATE': 0.0, 'HIGH': 0.0, 'CRITICAL': 0.0}

    risk_evolution = []
    resilience_evolution = []

    last_state_dict = run.current_state or (snapshots[-1].state_data if snapshots else {})

    for snap in snapshots:
        sd = snap.state_data or {}
        env = sd.get('environment', {})
        infra = sd.get('infrastructure', {})
        energy = sd.get('energy', {})
        logistics = sd.get('logistics', {})

        temp = infra.get('indoor_temp_avg', infra.get('indoorTempAvg', 20.0))
        if temp < min_temp:
            min_temp = temp

        deficit = energy.get('power_deficit_kw', energy.get('powerDeficitKw', 0.0))
        if deficit > max_deficit:
            max_deficit = deficit

        fuel_end = logistics.get('fuel_endurance_days', logistics.get('fuelEnduranceDays', 180.0))
        if fuel_end < min_fuel_days:
            min_fuel_days = fuel_end

        res = snap.resilience_score
        if res < min_resilience:
            min_resilience = res

        rl = snap.risk_level or 'LOW'
        risk_hours[rl] = risk_hours.get(rl, 0.0) + 1.0

        risk_evolution.append({
            'hour': snap.simulation_hour,
            'riskLevel': rl,
        })
        resilience_evolution.append({
            'hour': snap.simulation_hour,
            'resilienceScore': snap.resilience_score,
        })

    if min_temp == 999.0:
        min_temp = 20.0
    if min_fuel_days == 9999.0:
        min_fuel_days = 180.0

    # Predictions at final state
    final_state = StationState.from_dict(last_state_dict) if last_state_dict else None
    predictions_data = []
    if final_state:
        preds = generate_predictions(final_state)
        predictions_data = [p.to_dict() for p in preds[:5]]

    # Formulate Executive Summary
    station_name = run.station.name if run.station else "Antarctic Station"
    scenario_title = run.scenario.name if run.scenario else "Custom Simulation"
    hours_simulated = round(run.current_simulation_time, 1)

    summary = (
        f"Simulation '{scenario_title}' executed on {station_name} over {hours_simulated} simulated hours. "
        f"The station reached a minimum resilience index of {min_resilience:.0f}/100 and a minimum indoor temperature of {min_temp:.1f}°C. "
    )
    if max_deficit > 0:
        summary += f"Peak power deficit peaked at {max_deficit:.1f} kW during hazard exposure. "
    else:
        summary += "Power balance was maintained without electrical blackout. "

    if len(interventions) > 0:
        summary += f"{len(interventions)} mitigation interventions were executed, stabilizing core life support."
    else:
        summary += "No operator interventions were applied during this run."

    # Major impacts
    major_impacts = []
    if min_temp < 10:
        major_impacts.append(f"Severe indoor temperature drop to {min_temp:.1f}°C")
    if max_deficit > 0:
        major_impacts.append(f"Peak electrical power deficit of {max_deficit:.1f} kW")
    if min_fuel_days < 30:
        major_impacts.append(f"Fuel reserves depleted to {min_fuel_days:.1f} days")

    timeline_data = [
        {
            'hour': ev.simulation_hour,
            'type': ev.event_type,
            'title': ev.title,
            'description': ev.description,
            'severity': ev.severity,
        }
        for ev in events
    ]

    applied_interventions_data = [
        {
            'id': ai.id,
            'interventionId': ai.intervention.intervention_id,
            'name': ai.intervention.name,
            'hourApplied': ai.applied_at_hour,
            'isActive': ai.is_active,
        }
        for ai in interventions
    ]

    report_dict = {
        "runId": run.id,
        "stationId": run.station.id if run.station else None,
        "stationName": station_name,
        "scenarioName": scenario_title,
        "simulationDurationHours": hours_simulated,
        "status": run.status,
        "executiveSummary": summary,
        "majorImpacts": major_impacts,
        "cascadingEvents": [
            {
                'hour': ce.simulation_hour,
                'source': ce.source_event,
                'affected': ce.affected_component,
                'cause': ce.cause,
                'effect': ce.effect,
                'severity': ce.severity,
            }
            for ce in run.cascade_events.all()
        ],
        "keyMetrics": {
            "minIndoorTemperature": round(min_temp, 1),
            "maxPowerDeficitKw": round(max_deficit, 1),
            "minFuelEnduranceDays": round(min_fuel_days, 1),
            "minResilienceScore": round(min_resilience, 1),
            "riskHoursBreakdown": risk_hours,
        },
        "incidentsInjected": [
            {
                "id": inc.id,
                "type": inc.incident_type,
                "severity": inc.severity,
                "description": inc.description,
                "startHour": inc.start_hour,
                "isResolved": inc.resolved,
            }
            for inc in incidents
        ],
        "appliedInterventions": applied_interventions_data,
        "equipmentPredictions": predictions_data,
        "riskEvolution": risk_evolution,
        "resilienceEvolution": resilience_evolution,
        "timeline": timeline_data,
    }

    return report_dict


def get_or_create_report_for_run(run: SimulationRun) -> SimulationReport:
    """
    Finds existing report or generates and persists a new SimulationReport model instance.
    """
    data = build_simulation_report(run)

    report, created = SimulationReport.objects.get_or_create(
        simulation=run,
        defaults={
            'scenario_name': data['scenarioName'],
            'station_name': data['stationName'],
            'start_condition': run.initial_state,
            'final_condition': run.current_state,
            'major_impacts': data['majorImpacts'],
            'cascading_events': data['cascadingEvents'],
            'failures': data.get('equipmentPredictions', []),
            'interventions_applied': data['appliedInterventions'],
            'predicted_consequences': [p['equipmentName'] for p in data.get('equipmentPredictions', []) if p.get('failureProbability', 0) > 50],
            'recommended_actions': [p.get('recommendedMaintenance', []) for p in data.get('equipmentPredictions', [])],
            'risk_evolution': data['riskEvolution'],
            'resilience_evolution': data['resilienceEvolution'],
            'timeline': data['timeline'],
        }
    )

    if not created:
        report.scenario_name = data['scenarioName']
        report.station_name = data['stationName']
        report.final_condition = run.current_state
        report.major_impacts = data['majorImpacts']
        report.cascading_events = data['cascadingEvents']
        report.failures = data.get('equipmentPredictions', [])
        report.interventions_applied = data['appliedInterventions']
        report.risk_evolution = data['riskEvolution']
        report.resilience_evolution = data['resilienceEvolution']
        report.timeline = data['timeline']
        report.save()

    return report
