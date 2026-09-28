"""
views.py — REST API ViewSets and Endpoints for Digital Twin Simulation
Antarctic Digital Twin — SIH26060

Comprehensive API endpoints for:
- Equipment inventory and real-time degradation status
- Scenario library and parametric execution
- Simulation session lifecycle (create, start, pause, advance, reset, replay)
- Timelines, state snapshots, cascade failure graphs, and risk/resilience scoring
- Decision optimization and what-if comparative analysis
- Explainable AI recommendations and formal post-run reports
- Station telemetry aggregation
"""

import copy
from typing import Dict, Any, List
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from stations.models import (
    Station, EnergyData, EnvironmentData, InfrastructureData,
    LogisticsData, Alert, EnergyHistory, EnvironmentHistory
)
from stations.serializers import (
    StationListSerializer, EnergyDataSerializer, EnvironmentDataSerializer,
    InfrastructureDataSerializer, LogisticsDataSerializer, AlertSerializer
)

from .models import (
    Equipment, Scenario, SimulationRun, SimulationSnapshot,
    SimulationEvent, Incident, InterventionDefinition,
    AppliedIntervention, CascadeEvent, PredictionRecord, SimulationReport
)
from .serializers import (
    EquipmentSerializer, ScenarioSerializer, SimulationRunSerializer,
    SimulationSnapshotSerializer, SimulationEventSerializer,
    IncidentSerializer, InterventionDefinitionSerializer,
    AppliedInterventionSerializer, CascadeEventSerializer,
    PredictionRecordSerializer, SimulationReportSerializer,
    RadarEventSerializer
)
from .engine import SimulationEngine
from .state import StationState
from .scenarios import apply_scenario_event, apply_scenario_events, SCENARIOS_CATALOG
from .interventions import INTERVENTIONS, get_intervention_by_id, get_available_interventions
from .risk import evaluate_risk
from .resilience import evaluate_resilience
from .physics import calculate_wind_chill
from .prediction import generate_predictions
from .optimizer import optimize_decisions, evaluate_plan, optimize_decisions_detailed, is_valid_intervention
from .incidents import inject_incident_into_engine, resolve_incident_in_engine
from .services import generate_simulation_insights
from .ai_decision_support import generate_decision_support, get_insight_provider
from .ml.predict import get_equipment_ml_prediction
from .reports import get_or_create_report_for_run, build_simulation_report
from .intervention_generator import (
    InterventionCandidateGenerator,
    StateProblemIdentifier,
    get_available_resources,
    STRUCTURED_INTERVENTIONS,
    IdentifiedProblem,
)


# ============================================================================
# Helper Functions
# ============================================================================

def _get_or_init_engine(run: SimulationRun) -> SimulationEngine:
    """Reconstructs a SimulationEngine instance matching the run's saved state."""
    st_id = (run.station.id or 'maitri').lower()
    if run.current_state:
        state = StationState.from_dict(run.current_state)
        engine = SimulationEngine(station_id=st_id, initial_state=state)
    else:
        engine = SimulationEngine(station_id=st_id)

        run.initial_state = engine.get_state_dict()
        run.current_state = engine.get_state_dict()
        run.save()
    return engine


def _sync_engine_to_run(engine: SimulationEngine, run: SimulationRun):
    """Persists engine state, snapshots, and events into the database."""
    state_dict = engine.get_state_dict()
    run.current_state = state_dict
    run.current_simulation_time = engine.state.simulation_hour
    run.active_scenarios = engine.state.active_scenarios
    run.active_interventions = engine.state.active_interventions

    # Persist hourly snapshot if not present
    current_hour_floor = round(engine.state.simulation_hour, 1)
    SimulationSnapshot.objects.update_or_create(
        simulation=run,
        simulation_hour=current_hour_floor,
        defaults={
            'state_data': state_dict,
            'risk_level': engine.state.risk_level,
            'resilience_score': engine.state.resilience_score,
            'active_events': [e.title for e in engine.state.events[-5:]],
            'active_failures': [e.name for e in engine.state.equipment if not e.is_online or e.health <= 0],
        }
    )

    # Persist cascade events
    for node in engine.state.cascade_chain:
        if node.is_active:
            CascadeEvent.objects.get_or_create(
                simulation=run,
                simulation_hour=current_hour_floor,
                source_event=node.id,
                affected_component=node.label,
                defaults={
                    'cause': 'Threshold exceeded',
                    'effect': node.detail,
                    'severity': node.severity if node.severity in ('info', 'warning', 'critical') else 'warning',
                    'downstream_consequences': node.children,
                }
            )

    run.save()


# ============================================================================
# ViewSets
# ============================================================================

class EquipmentViewSet(viewsets.ModelViewSet):
    """CRUD operations and telemetry status for station equipment."""
    queryset = Equipment.objects.all()
    serializer_class = EquipmentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        station_id = self.request.query_params.get('station')
        if station_id:
            qs = qs.filter(station_id=station_id)
        return qs


class ScenarioViewSet(viewsets.ReadOnlyModelViewSet):
    """Catalog of predefined hazard scenarios."""
    queryset = Scenario.objects.filter(enabled=True)
    serializer_class = ScenarioSerializer
    lookup_field = 'scenario_id'


class InterventionViewSet(viewsets.ViewSet):
    """Operational interventions catalog."""

    def list(self, request):
        station_id = request.query_params.get('station')
        sim_id = request.query_params.get('simulation')

        state = None
        if sim_id:
            try:
                run = SimulationRun.objects.get(pk=sim_id)
                if run.current_state:
                    state = StationState.from_dict(run.current_state)
            except SimulationRun.DoesNotExist:
                pass

        data = [i.to_dict(state=state) for i in INTERVENTIONS]
        return Response(data)

    def retrieve(self, request, pk=None):
        intervention = get_intervention_by_id(pk)
        if not intervention:
            return Response({'error': 'Intervention not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(intervention.to_dict())


class SimulationRunViewSet(viewsets.ModelViewSet):
    """Main simulation orchestration engine."""
    queryset = SimulationRun.objects.all()
    serializer_class = SimulationRunSerializer

    def create(self, request, *args, **kwargs):
        station_id = request.data.get('station')
        scenario_id = request.data.get('scenario')
        name = request.data.get('name', '')
        params = request.data.get('scenarioParameters', {})
        speed = float(request.data.get('speedMultiplier', 1.0))

        station = get_object_or_404(Station, pk=station_id)
        scenario = None
        if scenario_id:
            clean_id = str(scenario_id).strip()
            if clean_id == 'extreme_antarctic_storm':
                clean_id = 'antarctic_storm'
            scenario = Scenario.objects.filter(scenario_id=clean_id).first()
            if not scenario and (isinstance(scenario_id, int) or (isinstance(scenario_id, str) and str(scenario_id).isdigit())):
                scenario = Scenario.objects.filter(id=int(scenario_id)).first()

        st_id = (station.id or 'maitri').lower()
        engine = SimulationEngine(station_id=st_id)
        if scenario:
            if scenario.scenario_id not in engine.state.active_scenarios:
                engine.state.active_scenarios.append(scenario.scenario_id)
            if scenario.events_data:
                from .scenarios import apply_scenario_events
                apply_scenario_events(engine, scenario.events_data, 0.0, scenario.scenario_id, params)
                engine.recalculate_physics(immediate=True)

        initial_state = engine.get_state_dict()

        run = SimulationRun.objects.create(
            station=station,
            scenario=scenario,
            name=name or f"{scenario.name if scenario else 'Baseline'} Simulation",
            status='created',
            speed_multiplier=speed,
            initial_state=initial_state,
            current_state=initial_state,
            scenario_parameters=params,
            active_scenarios=engine.state.active_scenarios,
        )

        # Initial snapshot
        SimulationSnapshot.objects.create(
            simulation=run,
            simulation_hour=0.0,
            state_data=initial_state,
            risk_level=engine.state.risk_level,
            resilience_score=engine.state.resilience_score,
        )

        serializer = self.get_serializer(run)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        run = self.get_object()
        run.status = 'running'
        run.save()
        return Response({'status': 'running', 'simulationHour': run.current_simulation_time})

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        run = self.get_object()
        run.status = 'paused'
        run.save()
        return Response({'status': 'paused', 'simulationHour': run.current_simulation_time})

    @action(detail=True, methods=['post'])
    def reset(self, request, pk=None):
        run = self.get_object()
        st_id = (run.station.id or 'maitri').lower()
        engine = SimulationEngine(station_id=st_id)
        run.current_state = engine.get_state_dict()
        run.current_simulation_time = 0.0
        run.status = 'created'
        run.active_interventions = []
        run.save()
        run.snapshots.all().delete()
        run.events.all().delete()
        run.cascade_events.all().delete()

        SimulationSnapshot.objects.create(
            simulation=run,
            simulation_hour=0.0,
            state_data=run.current_state,
            risk_level=engine.state.risk_level,
            resilience_score=engine.state.resilience_score,
        )
        return Response({'status': 'reset', 'simulationHour': 0.0, 'state': run.current_state})

    @action(detail=True, methods=['post'])
    def advance(self, request, pk=None):
        """Advances the simulation by N hours, executing physics ticks and scenario events."""
        run = self.get_object()
        hours = float(request.data.get('hours', 1.0))
        engine = _get_or_init_engine(run)

        target_hour = engine.state.simulation_hour + hours
        step_hours = 0.5  # half-hour resolution

        while engine.state.simulation_hour < target_hour - 1e-4:
            current_h = engine.state.simulation_hour
            if run.scenario:
                events = run.scenario.events_data or []
                apply_scenario_events(engine, events, current_h, run.scenario.scenario_id, run.scenario_parameters)

            engine.advance_by_hours(min(step_hours, target_hour - current_h))

        _sync_engine_to_run(engine, run)

        return Response({
            'simulationHour': round(engine.state.simulation_hour, 1),
            'riskLevel': engine.state.risk_level,
            'resilienceScore': engine.state.resilience_score,
            'powerDeficitKw': engine.state.energy.power_deficit_kw,
            'indoorTempAvg': engine.state.infrastructure.indoor_temp_avg,
            'state': engine.get_state_dict(),
        })

    @action(detail=True, methods=['get'])
    def state(self, request, pk=None):
        run = self.get_object()
        if not run.current_state:
            engine = _get_or_init_engine(run)
            run.current_state = engine.get_state_dict()
            run.save()
        return Response(run.current_state)

    @action(detail=True, methods=['get'])
    def events(self, request, pk=None):
        run = self.get_object()
        events = run.events.all()
        serializer = SimulationEventSerializer(events, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        run = self.get_object()
        snapshots = run.snapshots.all()
        serializer = SimulationSnapshotSerializer(snapshots, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def risk(self, request, pk=None):
        run = self.get_object()
        engine = _get_or_init_engine(run)
        risk_level, reasons = evaluate_risk(engine.state)
        return Response({
            'riskLevel': risk_level,
            'reasons': [r.to_dict() for r in reasons],
        })

    @action(detail=True, methods=['get'])
    def resilience(self, request, pk=None):
        run = self.get_object()
        engine = _get_or_init_engine(run)
        score, factors = evaluate_resilience(engine.state)
        return Response({
            'resilienceScore': score,
            'factors': [f.to_dict() for f in factors],
        })

    @action(detail=True, methods=['get'])
    def predictions(self, request, pk=None):
        run = self.get_object()
        engine = _get_or_init_engine(run)
        preds = generate_predictions(engine.state)
        return Response([p.to_dict() for p in preds])

    @action(detail=True, methods=['get', 'post'])
    def incidents(self, request, pk=None):
        run = self.get_object()
        if request.method == 'POST':
            inc_type = request.data.get('incidentType', 'general')
            desc = request.data.get('description', '')
            severity = request.data.get('severity', 'high')
            start_hour = float(request.data.get('startHour', run.current_simulation_time))
            duration = float(request.data.get('expectedDurationHours', 24.0))
            affected = request.data.get('affectedSystems', [])
            params = request.data.get('parameters', {})

            incident = Incident.objects.create(
                simulation=run,
                station=run.station,
                incident_type=inc_type,
                severity=severity,
                description=desc,
                start_hour=start_hour,
                expected_duration_hours=duration,
                affected_systems=affected,
                parameters=params,
                active=True,
            )

            # Authoritatively mutate live SimulationEngine state
            engine = _get_or_init_engine(run)
            inject_info = inject_incident_into_engine(
                engine=engine,
                incident_type=inc_type,
                parameters=params,
                description=desc,
                severity=severity,
            )
            _sync_engine_to_run(engine, run)

            serializer = IncidentSerializer(incident)
            response_data = serializer.data
            response_data['engineStatus'] = inject_info
            return Response(response_data, status=status.HTTP_201_CREATED)

        incidents = run.incidents.all()
        serializer = IncidentSerializer(incidents, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path=r'incidents/(?P<incident_id>[^/.]+)/resolve')
    def resolve_incident(self, request, pk=None, incident_id=None):
        run = self.get_object()
        incident = run.incidents.filter(pk=incident_id).first() or run.incidents.filter(id=incident_id).first()
        if not incident:
            return Response({'error': f'Incident {incident_id} not found on simulation #{run.id}'}, status=status.HTTP_404_NOT_FOUND)

        engine = _get_or_init_engine(run)
        resolve_info = resolve_incident_in_engine(
            engine=engine,
            incident_type=incident.incident_type,
            parameters=incident.parameters,
            affected_systems=incident.affected_systems,
        )

        incident.active = False
        incident.resolved = True
        incident.resolved_at_hour = engine.state.simulation_hour
        incident.save()

        _sync_engine_to_run(engine, run)

        serializer = IncidentSerializer(incident)
        return Response({
            'status': 'resolved',
            'incident': serializer.data,
            'resolutionDetails': resolve_info,
            'simulationHour': round(engine.state.simulation_hour, 1),
        })

    @action(detail=True, methods=['post'], url_path='interventions/apply')
    def apply_intervention(self, request, pk=None):
        run = self.get_object()
        i_ids = request.data.get('interventions')
        if not i_ids:
            single_id = request.data.get('interventionId')
            i_ids = [single_id] if single_id else []
        if not i_ids:
            return Response({'error': 'No intervention specified'}, status=status.HTTP_400_BAD_REQUEST)

        engine = _get_or_init_engine(run)
        applied_list = []
        rejected_list = []

        for i_id in i_ids:
            # Re-validate candidate against current physical state (Contract 13)
            is_valid, reason = is_valid_intervention(i_id, engine.state)
            if not is_valid:
                rejected_list.append({'id': i_id, 'reason': reason})
                continue

            intervention = get_intervention_by_id(i_id)
            if not intervention:
                rejected_list.append({'id': i_id, 'reason': f"Intervention '{i_id}' not found in catalog"})
                continue

            if intervention.is_available(engine.state):
                intervention.apply(engine)
                interv_def, _ = InterventionDefinition.objects.get_or_create(
                    intervention_id=i_id,
                    defaults={
                        'name': intervention.name,
                        'description': intervention.description,
                        'category': intervention.category,
                        'icon': intervention.icon,
                    }
                )
                AppliedIntervention.objects.create(
                    simulation=run,
                    intervention=interv_def,
                    applied_at_hour=engine.state.simulation_hour,
                    is_active=True,
                )
                applied_list.append(i_id)
            else:
                rejected_list.append({'id': i_id, 'reason': "Intervention availability criteria not satisfied"})

        if not applied_list:
            return Response({
                'status': 'rejected',
                'error': 'None of the requested interventions could be safely applied',
                'rejectedInterventions': rejected_list,
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Continue simulation: Advance forward by 0.5h so physics and cascade effects propagate (Contract 13)
        engine.advance_by_hours(0.5)

        # Record persistent SimulationEvent model instance
        SimulationEvent.objects.create(
            simulation=run,
            simulation_hour=round(engine.state.simulation_hour, 1),
            event_type='intervention',
            title=f"Applied: {', '.join(applied_list)}",
            description=f"Executed {len(applied_list)} operational intervention(s) on station digital twin.",
            severity='info',
            source='Operator / Optimizer Plan',
            category='Operational',
            metadata={
                'applied_interventions': applied_list,
                'rejected_interventions': rejected_list,
            }
        )

        # 4. Recalculate Risk & Resilience authoritatively (Contract 13)
        risk_level, risk_reasons = evaluate_risk(engine.state)
        res_score, res_factors = evaluate_resilience(engine.state)
        engine.state.risk_level = risk_level
        engine.state.resilience_score = res_score
        _sync_engine_to_run(engine, run)

        return Response({
            'status': 'applied',
            'appliedInterventions': applied_list,
            'rejectedInterventions': rejected_list,
            'activeInterventions': engine.state.active_interventions,
            'currentState': engine.get_state_dict(),
            'riskLevel': risk_level,
            'resilienceScore': res_score,
            'simulationHour': round(engine.state.simulation_hour, 1),
        })

    @action(detail=True, methods=['post'], url_path='interventions/revert')
    def revert_intervention(self, request, pk=None):
        run = self.get_object()
        i_id = request.data.get('interventionId')
        intervention = get_intervention_by_id(i_id)
        if not intervention:
            return Response({'error': f'Intervention {i_id} not found'}, status=status.HTTP_404_NOT_FOUND)

        engine = _get_or_init_engine(run)
        intervention.revert(engine)
        _sync_engine_to_run(engine, run)

        AppliedIntervention.objects.filter(
            simulation=run,
            intervention__intervention_id=i_id,
            is_active=True,
        ).update(is_active=False, reverted_at_hour=engine.state.simulation_hour)

        return Response({
            'status': 'reverted',
            'intervention': i_id,
            'activeInterventions': engine.state.active_interventions,
            'simulationHour': round(engine.state.simulation_hour, 1),
        })

    @action(detail=True, methods=['get', 'post'])
    def optimize(self, request, pk=None):
        run = self.get_object()
        engine = _get_or_init_engine(run)
        data = request.data if request.method == 'POST' else request.query_params
        horizon_hours = int(data.get('horizon_hours', data.get('horizonHours', 24)))
        custom_weights = data.get('weights') or data.get('custom_weights')
        predictions = generate_predictions(engine.state)
        return Response(optimize_decisions_detailed(
            engine=engine,
            horizon_hours=horizon_hours,
            custom_weights=custom_weights,
            simulation_id=str(run.id),
            predictions=predictions,
        ))

    @action(detail=True, methods=['get'], url_path='candidate-interventions')
    def candidate_interventions(self, request, pk=None):
        run = self.get_object()
        engine = _get_or_init_engine(run)
        predictions = generate_predictions(engine.state)

        active_scenarios = list(engine.state.active_scenarios)
        if run.scenario and run.scenario.scenario_id not in active_scenarios:
            active_scenarios.append(run.scenario.scenario_id)

        candidate_gen = InterventionCandidateGenerator()
        problems = candidate_gen.problem_diagnoser.diagnose(engine.state, predictions=predictions)
        feasible = candidate_gen.get_feasible_interventions(
            engine.state, problems=problems, active_scenario_ids=active_scenarios
        )
        resources = get_available_resources(engine.state)
        candidate_combos = candidate_gen.generate_candidate_combinations(
            state=engine.state,
            feasible_interventions=feasible,
            problems=problems,
            active_scenario_ids=active_scenarios,
            max_candidates=12
        )

        return Response({
            'simulationId': str(run.id),
            'stationId': run.station.id,
            'simulationHour': round(engine.state.simulation_hour, 1),
            'diagnosedProblems': [p.to_dict() for p in problems],
            'availableResources': resources,
            'feasibleInterventions': feasible,
            'candidatePackages': candidate_combos,
        })

    @action(detail=True, methods=['get', 'post'], url_path='decision-support')
    def decision_support(self, request, pk=None):
        run = self.get_object()
        engine = _get_or_init_engine(run)

        data = request.data if request.method == 'POST' else request.query_params
        horizon_hours = int(data.get('horizon_hours', data.get('horizonHours', 24)))
        custom_weights = data.get('weights') or data.get('custom_weights')

        # 1. Predictions evaluated first so optimizer can use them for state-aware ranking
        predictions = generate_predictions(engine.state)

        # 2. Forward-simulated optimizer execution
        opt_result = optimize_decisions_detailed(
            engine=engine,
            horizon_hours=horizon_hours,
            custom_weights=custom_weights,
            simulation_id=str(run.id),
            predictions=predictions,
        )

        # 3. Risk & Resilience
        risk_level, risk_reasons = evaluate_risk(engine.state)
        res_score, res_factors = evaluate_resilience(engine.state)

        # 3. Active failures
        failures = [e.name for e in engine.state.equipment if not e.is_online or e.health <= 0]

        active_scenarios = list(engine.state.active_scenarios)
        if run.scenario and run.scenario.scenario_id not in active_scenarios:
            active_scenarios.append(run.scenario.scenario_id)

        # 4. Context for AI provider
        context = {
            'station': {
                'id': run.station.id,
                'name': run.station.name,
                'region': run.station.region,
            },
            'current_state': engine.get_state_dict(),
            'hazards': engine.state.active_scenarios,
            'active_scenarios': active_scenarios,
            'failures': failures,
            'risk': {
                'risk_level': risk_level,
                'reasons': [r.to_dict() for r in risk_reasons],
            },
            'resilience': {
                'resilience_score': res_score,
                'factors': [f.to_dict() for f in res_factors],
            },
            'predictions': [p.to_dict() for p in predictions],
            'baseline': opt_result.get('baseline_outcome', {}),
            'optimizer': opt_result,
            'candidate_plans': opt_result.get('alternatives', []),
        }

        # 5. AI Decision Support & Recommendation
        ai_res = generate_decision_support(context)

        # Traceability metadata
        traceability = {
            'simulation_id': str(run.id),
            'scenario_id': run.scenario.scenario_id if run.scenario else 'baseline',
            'station_id': run.station.id,
            'optimizer_run_id': f"opt-{run.id}-{int(engine.state.simulation_hour)}",
            'plan_id': (opt_result.get('recommended_plan') or {}).get('id', 'none'),
            'simulation_horizon': horizon_hours,
            'model_version': 'ml-degradation-v1.0',
            'engine_version': 'physics-engine-v2.0',
        }

        return Response({
            'situation': {
                'summary': ai_res.get('situation_summary'),
                'urgency': ai_res.get('urgency'),
                'riskLevel': risk_level,
                'resilienceScore': res_score,
                'activeHazards': engine.state.active_scenarios,
                'activeFailures': failures,
            },
            'risk': {
                'riskLevel': risk_level,
                'reasons': [r.to_dict() for r in risk_reasons],
            },
            'resilience': {
                'resilienceScore': res_score,
                'factors': [f.to_dict() for f in res_factors],
            },
            'predictions': [p.to_dict() for p in predictions],
            'baseline': opt_result.get('baseline_outcome', {}),
            'optimizer': opt_result,
            'recommendation': ai_res.get('recommended_action', {}),
            'explanation': {
                'why': ai_res.get('why', []),
                'expected_effects': ai_res.get('expected_effects', []),
                'tradeoffs': ai_res.get('tradeoffs', []),
                'alternative_actions': ai_res.get('alternative_actions', []),
                'confidence': ai_res.get('confidence', 'HIGH'),
                'assumptions': ai_res.get('assumptions', []),
            },
            'traceability': traceability,
            'timestamp': timezone.now().isoformat(),
            'diagnosedProblems': opt_result.get('diagnosedProblems', []),
            'diagnosed_problems': opt_result.get('diagnosed_problems', []),
            'feasibleInterventions': opt_result.get('feasibleInterventions', []),
            'feasible_interventions': opt_result.get('feasible_interventions', []),
            'availableResources': opt_result.get('availableResources', {}),
            'available_resources': opt_result.get('available_resources', {}),
            'constraintsChecked': opt_result.get('constraints_checked', []),
            'rejectedPlans': opt_result.get('rejected_plans', []),
            # Backward-compat top-level keys
            'situation_summary': ai_res.get('situation_summary'),
            'recommended_action': ai_res.get('recommended_action'),
            'why': ai_res.get('why'),
            'expected_effects': ai_res.get('expected_effects'),
            'tradeoffs': ai_res.get('tradeoffs'),
            'alternative_actions': ai_res.get('alternative_actions'),
            'urgency': ai_res.get('urgency'),
            'confidence': ai_res.get('confidence'),
            'assumptions': ai_res.get('assumptions'),
            'insights': generate_simulation_insights(engine.state, engine=engine),
            'optimization': opt_result,
        })

    @action(detail=True, methods=['get'])
    def recommendations(self, request, pk=None):
        return self.decision_support(request, pk=pk)

    @action(detail=True, methods=['get'])
    def insights(self, request, pk=None):
        run = self.get_object()
        engine = _get_or_init_engine(run)
        insights_data = generate_simulation_insights(engine.state, engine=engine)
        return Response(insights_data)

    @action(detail=True, methods=['get'])
    def report(self, request, pk=None):
        run = self.get_object()
        report_data = build_simulation_report(run)
        get_or_create_report_for_run(run)
        return Response(report_data)

    @action(detail=True, methods=['post'])
    def compare(self, request, pk=None):
        """Compares outcome of continuing without intervention vs applying a plan with optional historical branching."""
        run = self.get_object()
        intervention_ids = request.data.get('interventions', [])
        from_hour = request.data.get('from_hour') or request.data.get('fromHour')

        if from_hour is not None:
            try:
                target_h = float(from_hour)
                snap = run.snapshots.filter(simulation_hour=target_h).first()
                if snap and snap.state_data:
                    engine = SimulationEngine(
                        station_id=(run.station.id or 'maitri').lower(),
                        initial_state=StationState.from_dict(snap.state_data)
                    )
                else:
                    engine = _get_or_init_engine(run)
            except (ValueError, TypeError):
                engine = _get_or_init_engine(run)
        else:
            engine = _get_or_init_engine(run)

        # 1. Baseline projection (no new intervention)
        baseline_engine = engine.fork()
        baseline_engine.advance_by_hours(24)
        baseline_state = baseline_engine.get_state_dict()

        # 2. Intervened projection
        intervened_engine = engine.fork()
        for i_id in intervention_ids:
            inv = get_intervention_by_id(i_id)
            if inv and inv.is_available(intervened_engine.state):
                inv.apply(intervened_engine)
        intervened_engine.advance_by_hours(24)
        intervened_state = intervened_engine.get_state_dict()

        return Response({
            'withoutInterventions': {
                'resilienceScore': baseline_engine.state.resilience_score,
                'riskLevel': baseline_engine.state.risk_level,
                'powerDeficitKw': baseline_engine.state.energy.power_deficit_kw,
                'indoorTempAvg': baseline_engine.state.infrastructure.indoor_temp_avg,
                'fuelEnduranceDays': baseline_engine.state.logistics.fuel_endurance_days,
                'state': baseline_state,
            },
            'withInterventions': {
                'resilienceScore': intervened_engine.state.resilience_score,
                'riskLevel': intervened_engine.state.risk_level,
                'powerDeficitKw': intervened_engine.state.energy.power_deficit_kw,
                'indoorTempAvg': intervened_engine.state.infrastructure.indoor_temp_avg,
                'fuelEnduranceDays': intervened_engine.state.logistics.fuel_endurance_days,
                'state': intervened_state,
            }
        })

    @action(detail=True, methods=['get'], url_path='radar')
    def radar(self, request, pk=None):
        """
        Contract 12 Compliant Endpoint: GET /api/simulations/{id}/radar/
        Returns active radar observation derived authoritatively from the simulation state and active scenario.
        """
        run = self.get_object()
        engine = _get_or_init_engine(run)

        storm_scenario_ids = {'antarctic_storm', 'extreme_antarctic_storm', 'combined_emergency', 'full_cascade'}
        active_scenarios = set(engine.state.active_scenarios or [])
        if run.scenario:
            active_scenarios.add(run.scenario.scenario_id)

        has_storm = bool(storm_scenario_ids.intersection(active_scenarios))
        sim_hour = round(engine.state.simulation_hour, 1)

        scenario_id = run.scenario.scenario_id if run.scenario else ('antarctic_storm' if has_storm else 'normal')
        scenario_name = run.scenario.name if run.scenario else ('Extreme Antarctic Storm' if has_storm else 'Normal Operations')

        is_bharati = bool(run.station and (str(run.station.id).lower() == 'bharati' or 'bharati' in str(run.station.name).lower()))
        initial_distance = 200.0 if is_bharati else 180.0
        approach_speed = 50.0 if is_bharati else 45.0
        direction = '065° NE' if is_bharati else '135° SE'
        base_wind_init = 110.0 if is_bharati else 105.0
        peak_wind_max = 152.0 if is_bharati else 145.0

        if has_storm:
            # Proper kinematic distance calculation: d(t) = max(0, d_0 - v_approach * t)
            distance_km = max(0.0, round(initial_distance - approach_speed * sim_hour, 1))
            eta_hours = max(0.0, round(distance_km / approach_speed, 1)) if distance_km > 0 else 0.0
            status_text = 'APPROACHING' if eta_hours > 0 else 'IMPACT'
            severity = run.scenario.severity.upper() if run.scenario else 'CRITICAL'
            # Wind speed dynamically intensifies with atmospheric vortex gradient
            approach_factor = min(1.0, max(0.0, (initial_distance - distance_km) / initial_distance))
            vortex_wind = base_wind_init + (peak_wind_max - base_wind_init) * (approach_factor ** 1.15)
            engine_wind = float(engine.state.environment.wind_speed)
            wind_speed_kmh = round(max(engine_wind, vortex_wind), 1)
            temperature_c = round(engine.state.environment.temperature, 1)
            comm_impact = engine.state.communication.status
            logistics_impact = 'Resupply Suspended' if engine.state.logistics.resupply_delay_days > 0 or distance_km < 120 else 'Nominal'
        else:
            status_text = 'IDLE'
            distance_km = 0.0
            eta_hours = 0.0
            severity = run.scenario.severity.upper() if run.scenario else 'LOW'
            wind_speed_kmh = round(engine.state.environment.wind_speed, 1)
            direction = 'N/A'
            temperature_c = round(engine.state.environment.temperature, 1)
            comm_impact = engine.state.communication.status
            logistics_impact = 'Nominal'

        return Response({
            'simulation_id': str(run.id),
            'scenario_id': scenario_id,
            'scenario_name': scenario_name,
            'status': status_text,
            'severity': severity,
            'distance_km': distance_km,
            'storm_speed_kmh': approach_speed if has_storm else 0.0,
            'wind_speed_kmh': wind_speed_kmh,
            'estimated_arrival_hours': eta_hours,
            'simulation_time': sim_hour,
            'is_simulated': True,
            'has_storm': has_storm,
            'direction': direction,
            'temperature_c': temperature_c,
            'communication_impact': comm_impact,
            'logistics_impact': logistics_impact,
        })

    @action(detail=True, methods=['post'], url_path='radar-event')
    def radar_event(self, request, pk=None):
        """
        Receives radar storm detection event:
        Contract 2 Schema:
        {
          "station_id": "maitri" | "bharati",
          "hazard_type": "antarctic_storm",
          "severity": "HIGH",
          "distance_km": 180,
          "wind_speed_kmh": 115,
          "estimated_arrival_hours": 4,
          "source": "Polar Doppler Radar MK-IV",
          "confidence": 0.95,
          "is_simulated": true,
          "event_id": "optional-idempotency-key"
        }
        Triggers physics storm perturbation, cascade propagation, risk/resilience scoring,
        dynamic candidate generation, optimization, and AI decision support.
        """
        serializer = RadarEventSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        run = self.get_object()
        return _process_radar_event_on_run(run, serializer.validated_data)


# ============================================================================
# Radar Storm Event Pipeline Helper
# ============================================================================

def _process_radar_event_on_run(run: SimulationRun, event_data: dict) -> Response:
    """Authoritatively drives radar storm observation through simulation, cascade, optimizer, and AI layers."""
    engine = _get_or_init_engine(run)

    # 1. Capture baseline state before storm event
    force_fresh = event_data.get('force_fresh', False)
    if force_fresh or engine.state.environment.wind_speed > 80:
        fresh_engine = SimulationEngine(station_id=run.station.id)
        engine.state = copy.deepcopy(fresh_engine.state)
        prev_risk_level = 'LOW'
        prev_resilience_score = 92
    else:
        prev_risk_level = engine.state.risk_level
        prev_resilience_score = engine.state.resilience_score
    baseline_state = copy.deepcopy(engine.get_state_dict())

    # 2. Extract validated parameters (Contract 2)
    hazard_type = event_data.get('hazard_type', 'antarctic_storm')
    severity = event_data.get('severity', 'HIGH')
    distance_km = float(event_data.get('distance_km', 180.0))
    target_wind = float(event_data.get('wind_speed_kmh', 115.0))
    eta_hours = float(event_data.get('estimated_arrival_hours') or 4.0)
    source = event_data.get('source', 'Polar Doppler Radar MK-IV')
    confidence = float(event_data.get('confidence', 0.95))
    is_simulated = bool(event_data.get('is_simulated', True))
    event_id = str(event_data.get('event_id', '')).strip()

    # Contract 3: Idempotency check.
    # If same event_id was already processed on this simulation run, return existing state without duplicate alerts or events
    if event_id and not force_fresh:
        existing_sim_event = SimulationEvent.objects.filter(
            simulation=run,
            metadata__event_id=event_id
        ).first()
        if existing_sim_event:
            return Response({
                'status': 'already_processed',
                'idempotent': True,
                'eventId': event_id,
                'simulationRunId': run.id,
                'stationId': run.station.id,
                'simulationHour': round(engine.state.simulation_hour, 1),
                'radarEvent': {
                    'stationId': run.station.id,
                    'hazardType': hazard_type,
                    'severity': severity,
                    'distanceKm': distance_km,
                    'windSpeedKmh': target_wind,
                    'estimatedArrivalHours': eta_hours,
                    'source': source,
                    'confidence': confidence,
                    'isSimulated': is_simulated,
                    'eventId': event_id,
                },
                'currentState': engine.get_state_dict(),
                'riskLevel': engine.state.risk_level,
                'resilienceScore': engine.state.resilience_score,
            }, status=status.HTTP_200_OK)

    # 3. Authoritatively activate 'antarctic_storm' scenario if not active
    if 'antarctic_storm' not in engine.state.active_scenarios:
        engine.state.active_scenarios.append('antarctic_storm')
    storm_scenario = Scenario.objects.filter(scenario_id='antarctic_storm').first()
    if storm_scenario and not run.scenario:
        run.scenario = storm_scenario

    # 4. Apply storm weather perturbation authoritatively via scenario action (Contract 4)
    apply_scenario_event(
        engine,
        'antarctic_storm',
        'storm_warning',
        params={'wind_speed': target_wind, 'storm_temp': -38.5}
    )

    def _apply_radar_perturbation(s):
        s.environment.air_pressure = 952.0
        s.environment.visibility = 1.8
        s.environment.snow_accumulation += 18.0
        s.communication.status = 'Degraded'
        s.communication.quality = 45.0
        s.communication.satellite_uplink_mbps = max(5.0, s.communication.max_uplink_mbps * 0.35)
    engine.modify_state(_apply_radar_perturbation)

    # Record authoritative SimulationEvent in database (Contract 3)
    SimulationEvent.objects.create(
        simulation=run,
        simulation_hour=round(engine.state.simulation_hour, 1),
        event_type='radar_detection',
        title='Polar Doppler Radar Storm Detection',
        description=f"Hazard {hazard_type} detected {distance_km:.0f} km out with {target_wind:.0f} km/h winds, ETA {eta_hours:.1f}h.",
        severity='critical' if severity in ['HIGH', 'CRITICAL'] else 'warning',
        source=source,
        category='Environment',
        metadata={
            'event_id': event_id,
            'confidence': confidence,
            'is_simulated': is_simulated,
            'distance_km': distance_km,
            'wind_speed_kmh': target_wind,
            'estimated_arrival_hours': eta_hours,
            'hazard_type': hazard_type,
        }
    )

    # Record event in engine event history
    engine.add_event(
        'critical' if severity in ['HIGH', 'CRITICAL'] else 'warning',
        'Environment',
        'Radar Storm Detection Alert',
        f'Severe storm detected {distance_km:.0f} km out. Winds accelerating to {target_wind:.0f} km/h, ETA {eta_hours:.1f}h.'
    )

    # 5. Advance simulation forward by 1.5 hours to compute physics propagation
    engine.advance_by_hours(1.5)

    # Record alert in Station database
    Alert.objects.create(
        station=run.station,
        severity='high' if severity in ['HIGH', 'CRITICAL'] else 'medium',
        title='Katabatic Storm Detected on Radar',
        message=f'Radar tracking system ({source}) detected incoming storm at {distance_km:.0f} km with {target_wind:.0f} km/h winds.',
        category='Environment',
    )

    # 6. Authoritative Risk & Resilience Assessment (Contract 4)
    risk_level, risk_reasons = evaluate_risk(engine.state)
    resilience_score, res_factors = evaluate_resilience(engine.state)

    # 7. Dynamic Problem Diagnosis & Feasible Intervention Candidate Generation
    predictions = generate_predictions(engine.state)
    candidate_gen = InterventionCandidateGenerator()
    problems = candidate_gen.problem_diagnoser.diagnose(engine.state, predictions=predictions)
    feasible = candidate_gen.get_feasible_interventions(
        engine.state, problems=problems, active_scenario_ids=engine.state.active_scenarios
    )
    resources = get_available_resources(engine.state)

    # 8. Decision Optimizer: Forward-simulate candidate plans & reject unsafe ones
    opt_result = optimize_decisions_detailed(
        engine=engine,
        horizon_hours=24,
        simulation_id=str(run.id),
        predictions=predictions,
    )

    # 9. AI Decision Support: Explain recommended plan based on real numbers
    failures = [e.name for e in engine.state.equipment if not e.is_online or e.health <= 0]
    ai_context = {
        'station': {'id': run.station.id, 'name': run.station.name, 'region': run.station.region},
        'current_state': engine.get_state_dict(),
        'hazards': engine.state.active_scenarios,
        'active_scenarios': engine.state.active_scenarios,
        'failures': failures,
        'risk': {'risk_level': risk_level, 'reasons': [r.to_dict() for r in risk_reasons]},
        'resilience': {'resilience_score': resilience_score, 'factors': [f.to_dict() for f in res_factors]},
        'predictions': [p.to_dict() for p in predictions],
        'baseline': opt_result.get('baseline_outcome', {}),
        'optimizer': opt_result,
        'candidate_plans': opt_result.get('alternatives', []),
    }
    ai_res = generate_decision_support(ai_context)

    # Sync engine state to db run
    _sync_engine_to_run(engine, run)

    # Primary generator load & battery deltas
    primary_gen = engine.state.energy.generators[0] if engine.state.energy.generators else None
    gen_load_pct = primary_gen.load_percent if primary_gen else 85.0
    baseline_batt = baseline_state.get('energy', {}).get('battery_level_percent', 94.0)
    current_batt = engine.state.energy.battery_level_percent
    batt_delta = max(0.0, baseline_batt - current_batt)

    # 10. Format animated cascade chain from actual physics values
    cascade_chain = [
        {'id': 'storm', 'label': 'Radar Storm Detected', 'icon': 'CloudSnow', 'detail': f'{target_wind:.0f} km/h wind front, ETA {eta_hours:.0f}h', 'severity': 'critical'},
        {'id': 'temp', 'label': 'Temperature Drops', 'icon': 'Thermometer', 'detail': f'{engine.state.environment.temperature:.1f}°C (Wind Chill {engine.state.environment.wind_chill:.1f}°C)', 'severity': 'critical'},
        {'id': 'heating', 'label': 'Heating Demand Surges', 'icon': 'Flame', 'detail': f'Thermal demand: {engine.state.energy.heating_demand_kw:.1f} kW', 'severity': 'warning'},
        {'id': 'gen', 'label': 'Generator Load Increases', 'icon': 'Zap', 'detail': f'Output: {engine.state.energy.total_consumption_kw:.1f} kW ({gen_load_pct:.0f}% primary capacity)', 'severity': 'warning' if gen_load_pct < 85 else 'critical'},
        {'id': 'batt', 'label': 'Battery Reserve Decreasing', 'icon': 'Battery', 'detail': f'Reserve at {current_batt:.1f}% (-{batt_delta:.1f}%)', 'severity': 'warning'},
        {'id': 'comm', 'label': 'Satellite Uplink Degraded', 'icon': 'Radio', 'detail': f'{engine.state.communication.quality:.0f}% signal quality due to storm turbulence', 'severity': 'warning'},
        {'id': 'risk', 'label': 'Overall Risk Escalated', 'icon': 'AlertTriangle', 'detail': f'{prev_risk_level} → {risk_level} (Resilience: {prev_resilience_score} → {resilience_score})', 'severity': 'critical'},
    ]

    baseline_gen_load = (baseline_state.get('energy', {}).get('generators', [{}])[0].get('load_percent', 65.0)) if baseline_state.get('energy', {}).get('generators') else 65.0
    active_sc_id = run.scenario.scenario_id if run.scenario else 'antarctic_storm'

    return Response({
        'success': True,
        'status': 'storm_activated',
        'type': 'RADAR_STORM_DETECTED',
        'simulation_id': str(run.id),
        'simulationRunId': run.id,
        'scenario_id': active_sc_id,
        'stationId': run.station.id,
        'simulationHour': round(engine.state.simulation_hour, 1),
        'radarEvent': {
            'type': 'RADAR_STORM_DETECTED',
            'simulation_id': str(run.id),
            'simulationRunId': run.id,
            'scenario_id': active_sc_id,
            'stationId': run.station.id,
            'hazardType': hazard_type,
            'severity': severity,
            'distanceKm': distance_km,
            'windSpeedKmh': target_wind,
            'estimatedArrivalHours': eta_hours,
            'source': source,
            'confidence': confidence,
            'isSimulated': is_simulated,
            'eventId': event_id,
        },
        'baselineState': baseline_state,
        'currentState': engine.get_state_dict(),
        'deltas': {
            'wind': {'from': baseline_state['environment']['wind_speed'], 'to': engine.state.environment.wind_speed},
            'temperature': {'from': baseline_state['environment']['temperature'], 'to': engine.state.environment.temperature},
            'generatorLoad': {'from': baseline_gen_load, 'to': gen_load_pct},
            'battery': {'from': baseline_batt, 'to': current_batt},
            'risk': {'from': prev_risk_level, 'to': risk_level},
            'resilience': {'from': prev_resilience_score, 'to': resilience_score},
        },
        'cascadeChain': cascade_chain,
        'risk': {
            'riskLevel': risk_level,
            'reasons': [r.to_dict() for r in risk_reasons],
        },
        'resilience': {
            'resilienceScore': resilience_score,
            'factors': [f.to_dict() for f in res_factors],
        },
        'diagnosedProblems': [p.to_dict() for p in problems],
        'feasibleInterventions': feasible,
        'availableResources': resources,
        'optimizer': opt_result,
        'aiDecisionSupport': {
            'recommendedAction': ai_res.get('recommended_action'),
            'why': ai_res.get('why'),
            'expectedEffects': ai_res.get('expected_effects'),
            'tradeoffs': ai_res.get('tradeoffs'),
            'urgency': ai_res.get('urgency'),
            'confidence': ai_res.get('confidence'),
            'situationSummary': ai_res.get('situation_summary'),
            'alternativeActions': ai_res.get('alternative_actions'),
        },
    }, status=status.HTTP_200_OK)


class RadarEventView(APIView):
    """
    Contract 2 Compliant Standalone Endpoint: POST /api/radar/events/
    Accepts:
    {
      "station_id": "maitri" | "bharati",
      "simulation_id": "optional-sim-run-id",
      "scenario_id": "antarctic_storm",
      "hazard_type": "antarctic_storm",
      "severity": "HIGH",
      "distance_km": 180,
      "wind_speed_kmh": 115,
      "estimated_arrival_hours": 4,
      "source": "Polar Doppler Radar MK-IV",
      "confidence": 0.95,
      "is_simulated": true,
      "event_id": "optional-idempotency-key"
    }
    """
    def post(self, request):
        serializer = RadarEventSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated = serializer.validated_data
        st_key = validated['station_id']
        station = get_object_or_404(Station, pk=st_key)

        force_fresh = validated.get('force_fresh', False)
        event_id = str(validated.get('event_id', '')).strip()
        simulation_id = validated.get('simulation_id')
        scenario_id = validated.get('scenario_id')

        run = None
        if simulation_id and not force_fresh:
            try:
                run = SimulationRun.objects.filter(id=int(simulation_id), station=station).first()
            except (ValueError, TypeError):
                run = SimulationRun.objects.filter(id=simulation_id, station=station).first()

        if not run:
            run = SimulationRun.objects.filter(
                station=station, status__in=['created', 'running', 'paused']
            ).order_by('-created_at').first()

        if scenario_id and run and not run.scenario:
            clean_sc_id = 'antarctic_storm' if scenario_id == 'extreme_antarctic_storm' else scenario_id
            storm_sc = Scenario.objects.filter(scenario_id=clean_sc_id).first()
            if storm_sc:
                run.scenario = storm_sc
                run.save(update_fields=['scenario'])

        if not run:
            engine = SimulationEngine(station_id=st_key)
            init_state = engine.get_state_dict()
            run = SimulationRun.objects.create(
                station=station,
                name=f"Radar Storm Demo — {station.name}",
                status='running',
                speed_multiplier=1.0,
                initial_state=init_state,
                current_state=init_state,
                active_scenarios=[],
            )

        # Idempotency check (Contract 3)
        if event_id and not force_fresh:
            existing_event = SimulationEvent.objects.filter(
                simulation=run,
                metadata__event_id=event_id
            ).first()
            if existing_event:
                engine = _get_or_init_engine(run)
                return Response({
                    'status': 'already_processed',
                    'idempotent': True,
                    'eventId': event_id,
                    'simulationRunId': run.id,
                    'stationId': run.station.id,
                    'simulationHour': round(engine.state.simulation_hour, 1),
                    'radarEvent': validated,
                    'currentState': engine.get_state_dict(),
                    'riskLevel': engine.state.risk_level,
                    'resilienceScore': engine.state.resilience_score,
                }, status=status.HTTP_200_OK)

        return _process_radar_event_on_run(run, validated)


# ============================================================================
# Station Telemetry & Overview API Views
# ============================================================================

class StationOverviewView(APIView):
    """Combines all station operational facets into an aggregated overview."""

    def get(self, request, pk=None):
        station = get_object_or_404(Station, pk=pk)
        energy = EnergyData.objects.filter(station=station).first()
        env = EnvironmentData.objects.filter(station=station).first()
        infra = InfrastructureData.objects.filter(station=station).first()
        logistics = LogisticsData.objects.filter(station=station).first()
        equipment = Equipment.objects.filter(station=station)
        active_alerts = Alert.objects.filter(station=station, resolved=False)

        return Response({
            'id': station.id,
            'name': station.name,
            'code': station.id,
            'region': station.region,
            'status': station.status,
            'coordinates': station.coordinates,
            'energy': EnergyDataSerializer(energy).data if energy else None,
            'environment': EnvironmentDataSerializer(env).data if env else None,
            'infrastructure': InfrastructureDataSerializer(infra).data if infra else None,
            'logistics': LogisticsDataSerializer(logistics).data if logistics else None,
            'equipmentCount': equipment.count(),
            'activeAlertsCount': active_alerts.count(),
        })


class StationTelemetryView(APIView):
    """Current live telemetry snapshot."""

    def get(self, request, pk=None):
        station = get_object_or_404(Station, pk=pk)
        energy = EnergyData.objects.filter(station=station).first()
        env = EnvironmentData.objects.filter(station=station).first()
        infra = InfrastructureData.objects.filter(station=station).first()
        logistics = LogisticsData.objects.filter(station=station).first()

        return Response({
            'stationId': station.id,
            'stationName': station.name,
            'timestamp': timezone.now().isoformat(),
            'energy': EnergyDataSerializer(energy).data if energy else None,
            'environment': EnvironmentDataSerializer(env).data if env else None,
            'infrastructure': InfrastructureDataSerializer(infra).data if infra else None,
            'logistics': LogisticsDataSerializer(logistics).data if logistics else None,
        })


class StationTelemetryHistoryView(APIView):
    """Historical telemetry series for energy & environment."""

    def get(self, request, pk=None):
        station = get_object_or_404(Station, pk=pk)
        energy_hist = EnergyHistory.objects.filter(station=station).order_by('id')
        env_hist = EnvironmentHistory.objects.filter(station=station).order_by('id')

        return Response({
            'stationId': station.id,
            'energyHistory': [
                {
                    'timeLabel': eh.time_label,
                    'powerGenerationKw': eh.power_generation_kw,
                    'powerConsumptionKw': eh.power_consumption_kw,
                    'batteryLevelPercent': eh.battery_level_percent,
                }
                for eh in energy_hist
            ],
            'environmentHistory': [
                {
                    'timeLabel': evh.time_label,
                    'temperature': evh.temperature,
                    'windSpeed': evh.wind_speed,
                    'airPressureHpa': evh.air_pressure_hpa,
                }
                for evh in env_hist
            ]
        })


class StationEquipmentListView(APIView):
    """List equipment inventory for a specific station."""

    def get(self, request, pk=None):
        station = get_object_or_404(Station, pk=pk)
        equipment = Equipment.objects.filter(station=station)
        serializer = EquipmentSerializer(equipment, many=True)
        return Response(serializer.data)


class StationPredictionsView(APIView):
    """Predictive failure analysis for station equipment."""

    def get(self, request, pk=None):
        station = get_object_or_404(Station, pk=pk)
        st_id = (station.id or 'maitri').lower()
        engine = SimulationEngine(station_id=st_id)
        predictions = generate_predictions(engine.state)
        return Response([p.to_dict() for p in predictions])


class StationRecommendationsView(APIView):
    """AI insights and recommendations for station."""

    def get(self, request, pk=None):
        station = get_object_or_404(Station, pk=pk)
        st_id = (station.id or 'maitri').lower()
        engine = SimulationEngine(station_id=st_id)
        insights = generate_simulation_insights(engine.state, engine=engine)
        return Response(insights)


class StationHistoryView(APIView):
    """Unified operational history for a station (telemetry, alerts, incidents)."""

    def get(self, request, pk=None):
        station = get_object_or_404(Station, pk=pk)
        energy_hist = EnergyHistory.objects.filter(station=station).order_by('-id')[:24]
        env_hist = EnvironmentHistory.objects.filter(station=station).order_by('-id')[:24]
        alerts = Alert.objects.filter(station=station).order_by('-created_at')[:20]
        incidents = Incident.objects.filter(station=station).order_by('-created_at')[:20]

        return Response({
            'stationId': station.id,
            'stationName': station.name,
            'recentEnergyHistory': [
                {
                    'timeLabel': eh.time_label,
                    'generationKw': eh.power_generation_kw,
                    'consumptionKw': eh.power_consumption_kw,
                    'batteryPercent': eh.battery_level_percent,
                } for eh in reversed(energy_hist)
            ],
            'recentEnvironmentHistory': [
                {
                    'timeLabel': evh.time_label,
                    'temperature': evh.temperature,
                    'windSpeed': evh.wind_speed,
                    'pressure': evh.air_pressure_hpa,
                } for evh in reversed(env_hist)
            ],
            'recentAlerts': AlertSerializer(alerts, many=True).data,
            'recentIncidents': IncidentSerializer(incidents, many=True).data,
        })


class StationEquipmentPredictionView(APIView):
    """Predictive failure & RUL analysis for a single equipment item."""

    def get(self, request, pk=None, equipment_id=None):
        station = get_object_or_404(Station, pk=pk)
        equipment = Equipment.objects.filter(station=station, identifier=equipment_id).first()
        if not equipment and str(equipment_id).isdigit():
            equipment = Equipment.objects.filter(station=station, id=int(equipment_id)).first()
        if not equipment:
            equipment = Equipment.objects.filter(station=station, name__icontains=equipment_id).first()

        if not equipment:
            return Response({'error': f'Equipment {equipment_id} not found at station {station.name}'}, status=status.HTTP_404_NOT_FOUND)

        eq_payload = {
            'id': equipment.identifier or str(equipment.id),
            'name': equipment.name,
            'category': equipment.equipment_type,
            'health': equipment.health_percentage,
            'temperature': equipment.temperature,
            'vibration': equipment.vibration,
            'efficiency': equipment.efficiency,
            'load_percent': equipment.load_percentage,
            'operating_hours': equipment.operating_hours,
            'maintenance_age_days': 30.0,
        }

        pred = get_equipment_ml_prediction(eq_payload)

        return Response({
            'equipment': equipment.name,
            'equipment_id': equipment.identifier,
            'failure_probability': pred['failure_probability'],
            'prediction_window_hours': pred['prediction_window_hours'],
            'estimated_rul_hours': pred['estimated_rul_hours'],
            'trend': pred['trend'],
            'factors': pred['factors'],
            'recommended_maintenance': pred['recommended_maintenance'],
            'model_version': pred['model_version'],
            'model_type': pred.get('model_type', 'trained_ml'),
            # CamelCase aliases
            'failureProbability': pred['failure_probability'],
            'predictionWindowHours': pred['prediction_window_hours'],
            'estimatedRulHours': pred['estimated_rul_hours'],
            'recommendedMaintenance': pred['recommended_maintenance'],
            'modelVersion': pred['model_version'],
        })

