"""
serializers.py — Django REST Framework Serializers for Simulation App
Antarctic Digital Twin — SIH26060

Serializers for all models with camelCase frontend mapping.
"""

from rest_framework import serializers
from stations.models import Station, Alert
from .models import (
    Equipment,
    Scenario,
    SimulationRun,
    SimulationSnapshot,
    SimulationEvent,
    Incident,
    InterventionDefinition,
    AppliedIntervention,
    CascadeEvent,
    PredictionRecord,
    SimulationReport,
)


class EquipmentSerializer(serializers.ModelSerializer):
    equipmentType = serializers.CharField(source='equipment_type')
    ratedOutput = serializers.FloatField(source='rated_output')
    currentOutput = serializers.FloatField(source='current_output')
    healthPercentage = serializers.FloatField(source='health_percentage')
    loadPercentage = serializers.FloatField(source='load_percentage')
    operatingHours = serializers.FloatField(source='operating_hours')
    failureProbability = serializers.FloatField(source='failure_probability')
    degradationRate = serializers.FloatField(source='degradation_rate')
    lastMaintenance = serializers.DateTimeField(source='last_maintenance', allow_null=True, required=False)
    nextMaintenance = serializers.DateTimeField(source='next_maintenance', allow_null=True, required=False)
    stationName = serializers.CharField(source='station.name', read_only=True)

    class Meta:
        model = Equipment
        fields = [
            'id', 'station', 'stationName', 'name', 'equipmentType', 'identifier',
            'ratedOutput', 'currentOutput', 'healthPercentage', 'efficiency',
            'temperature', 'vibration', 'loadPercentage', 'operatingHours',
            'status', 'failureProbability', 'degradationRate',
            'lastMaintenance', 'nextMaintenance', 'metadata', 'created_at', 'updated_at'
        ]


class ScenarioSerializer(serializers.ModelSerializer):
    scenarioId = serializers.CharField(source='scenario_id')
    durationHours = serializers.FloatField(source='duration_hours')
    configurableParameters = serializers.JSONField(source='configurable_parameters')
    eventsData = serializers.JSONField(source='events_data')

    class Meta:
        model = Scenario
        fields = [
            'id', 'scenarioId', 'name', 'description', 'severity', 'category',
            'durationHours', 'configurableParameters', 'eventsData', 'icon',
            'enabled', 'created_at', 'updated_at'
        ]


class SimulationEventSerializer(serializers.ModelSerializer):
    simulationHour = serializers.FloatField(source='simulation_hour')
    eventType = serializers.CharField(source='event_type')

    class Meta:
        model = SimulationEvent
        fields = [
            'id', 'simulation', 'simulationHour', 'eventType', 'title',
            'description', 'severity', 'source', 'category', 'cause',
            'effect', 'metadata', 'created_at'
        ]


class SimulationSnapshotSerializer(serializers.ModelSerializer):
    simulationHour = serializers.FloatField(source='simulation_hour')
    stateData = serializers.JSONField(source='state_data')
    riskLevel = serializers.CharField(source='risk_level')
    resilienceScore = serializers.FloatField(source='resilience_score')
    activeEvents = serializers.JSONField(source='active_events')
    activeFailures = serializers.JSONField(source='active_failures')

    class Meta:
        model = SimulationSnapshot
        fields = [
            'id', 'simulation', 'simulationHour', 'stateData', 'riskLevel',
            'resilienceScore', 'activeEvents', 'activeFailures', 'created_at'
        ]


class IncidentSerializer(serializers.ModelSerializer):
    incidentType = serializers.CharField(source='incident_type')
    startHour = serializers.FloatField(source='start_hour')
    expectedDurationHours = serializers.FloatField(source='expected_duration_hours')
    affectedSystems = serializers.JSONField(source='affected_systems')
    resolvedAtHour = serializers.FloatField(source='resolved_at_hour', allow_null=True, required=False)

    class Meta:
        model = Incident
        fields = [
            'id', 'simulation', 'station', 'incidentType', 'severity',
            'description', 'startHour', 'expectedDurationHours',
            'affectedSystems', 'parameters', 'active', 'resolved',
            'resolvedAtHour', 'created_at'
        ]


class InterventionDefinitionSerializer(serializers.ModelSerializer):
    interventionId = serializers.CharField(source='intervention_id')
    applicableConditions = serializers.JSONField(source='applicable_conditions')
    resourceCost = serializers.JSONField(source='resource_cost')
    sideEffects = serializers.JSONField(source='side_effects')

    class Meta:
        model = InterventionDefinition
        fields = [
            'id', 'interventionId', 'name', 'description', 'category',
            'icon', 'applicableConditions', 'effects', 'resourceCost',
            'sideEffects', 'priority', 'reversible', 'enabled', 'created_at'
        ]


class AppliedInterventionSerializer(serializers.ModelSerializer):
    appliedAtHour = serializers.FloatField(source='applied_at_hour')
    revertedAtHour = serializers.FloatField(source='reverted_at_hour', allow_null=True, required=False)
    isActive = serializers.BooleanField(source='is_active')
    effectsApplied = serializers.JSONField(source='effects_applied')
    interventionDetails = InterventionDefinitionSerializer(source='intervention', read_only=True)

    class Meta:
        model = AppliedIntervention
        fields = [
            'id', 'simulation', 'intervention', 'interventionDetails',
            'appliedAtHour', 'revertedAtHour', 'isActive', 'effectsApplied', 'created_at'
        ]


class CascadeEventSerializer(serializers.ModelSerializer):
    simulationHour = serializers.FloatField(source='simulation_hour')
    sourceEvent = serializers.CharField(source='source_event')
    affectedComponent = serializers.CharField(source='affected_component')
    downstreamConsequences = serializers.JSONField(source='downstream_consequences')

    class Meta:
        model = CascadeEvent
        fields = [
            'id', 'simulation', 'simulationHour', 'sourceEvent',
            'affectedComponent', 'cause', 'effect', 'severity',
            'downstreamConsequences', 'created_at'
        ]


class PredictionRecordSerializer(serializers.ModelSerializer):
    simulationHour = serializers.FloatField(source='simulation_hour')
    currentHealth = serializers.FloatField(source='current_health')
    trendRate = serializers.FloatField(source='trend_rate')
    failureProbability = serializers.FloatField(source='failure_probability')
    estimatedFailureHours = serializers.FloatField(source='estimated_failure_hours', allow_null=True, required=False)
    estimatedFailureWindow = serializers.CharField(source='estimated_failure_window')
    abnormalFactors = serializers.JSONField(source='abnormal_factors')
    recommendedMaintenance = serializers.JSONField(source='recommended_maintenance')
    equipmentName = serializers.CharField(source='equipment.name', read_only=True)

    class Meta:
        model = PredictionRecord
        fields = [
            'id', 'simulation', 'station', 'equipment', 'equipmentName',
            'simulationHour', 'currentHealth', 'trend', 'trendRate',
            'failureProbability', 'estimatedFailureHours', 'estimatedFailureWindow',
            'severity', 'abnormalFactors', 'recommendedMaintenance', 'created_at'
        ]


class SimulationRunSerializer(serializers.ModelSerializer):
    speedMultiplier = serializers.FloatField(source='speed_multiplier')
    simulationStart = serializers.DateTimeField(source='simulation_start')
    currentSimulationTime = serializers.FloatField(source='current_simulation_time')
    simulationEnd = serializers.FloatField(source='simulation_end', allow_null=True, required=False)
    initialState = serializers.JSONField(source='initial_state')
    currentState = serializers.JSONField(source='current_state')
    finalState = serializers.JSONField(source='final_state')
    scenarioParameters = serializers.JSONField(source='scenario_parameters')
    randomSeed = serializers.IntegerField(source='random_seed', allow_null=True, required=False)
    activeScenarios = serializers.JSONField(source='active_scenarios')
    activeInterventions = serializers.JSONField(source='active_interventions')
    stationName = serializers.CharField(source='station.name', read_only=True)
    scenarioName = serializers.CharField(source='scenario.name', read_only=True, allow_null=True)

    class Meta:
        model = SimulationRun
        fields = [
            'id', 'station', 'stationName', 'scenario', 'scenarioName', 'name',
            'status', 'speedMultiplier', 'simulationStart', 'currentSimulationTime',
            'simulationEnd', 'initialState', 'currentState', 'finalState',
            'scenarioParameters', 'randomSeed', 'activeScenarios',
            'activeInterventions', 'created_at', 'updated_at'
        ]


class SimulationReportSerializer(serializers.ModelSerializer):
    scenarioName = serializers.CharField(source='scenario_name')
    stationName = serializers.CharField(source='station_name')
    startCondition = serializers.JSONField(source='start_condition')
    finalCondition = serializers.JSONField(source='final_condition')
    majorImpacts = serializers.JSONField(source='major_impacts')
    cascadingEvents = serializers.JSONField(source='cascading_events')
    interventionsApplied = serializers.JSONField(source='interventions_applied')
    predictedConsequences = serializers.JSONField(source='predicted_consequences')
    recommendedActions = serializers.JSONField(source='recommended_actions')
    riskEvolution = serializers.JSONField(source='risk_evolution')
    resilienceEvolution = serializers.JSONField(source='resilience_evolution')
    withoutInterventionOutcome = serializers.JSONField(source='without_intervention_outcome')
    withInterventionOutcome = serializers.JSONField(source='with_intervention_outcome')
    generatedAt = serializers.DateTimeField(source='generated_at')

    class Meta:
        model = SimulationReport
        fields = [
            'id', 'simulation', 'scenarioName', 'stationName', 'startCondition',
            'finalCondition', 'majorImpacts', 'cascadingEvents', 'failures',
            'interventionsApplied', 'predictedConsequences', 'recommendedActions',
            'riskEvolution', 'resilienceEvolution', 'timeline',
            'withoutInterventionOutcome', 'withInterventionOutcome', 'generatedAt'
        ]


class AlertExtendedSerializer(serializers.ModelSerializer):
    alertId = serializers.CharField(source='alert_id')
    isActive = serializers.SerializerMethodField()
    relatedEquipment = serializers.CharField(source='related_equipment', allow_null=True, required=False)
    relatedSimulation = serializers.CharField(source='related_simulation', allow_null=True, required=False)

    def get_isActive(self, obj):
        return not obj.resolved

    class Meta:
        model = Alert
        fields = [
            'id', 'station', 'alertId', 'severity', 'title', 'message',
            'timestamp', 'isActive', 'acknowledged', 'resolved',
            'relatedEquipment', 'relatedSimulation', 'metadata'
        ]


# ============================================================================
# Radar Event Serializer (Contract 2)
# ============================================================================

class RadarEventSerializer(serializers.Serializer):
    """
    Validates radar storm observation payloads strictly against Contract 2.
    Ensures:
      - distance_km >= 0
      - wind_speed_kmh >= 0
      - confidence in [0.0, 1.0]
      - estimated_arrival_hours >= 0 (when provided)
      - station_id in {'maitri', 'bharati'}
    Accepts consistent field names and backwards-compatible aliases.
    """
    station_id = serializers.CharField(required=False, default='maitri')
    hazard_type = serializers.CharField(required=False, default='antarctic_storm')
    severity = serializers.ChoiceField(
        choices=['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default='HIGH'
    )
    distance_km = serializers.FloatField(min_value=0.0, default=180.0)
    wind_speed_kmh = serializers.FloatField(min_value=0.0, default=115.0)
    estimated_arrival_hours = serializers.FloatField(
        min_value=0.0, required=False, allow_null=True, default=4.0
    )
    source = serializers.CharField(required=False, default='Polar Doppler Radar MK-IV')
    confidence = serializers.FloatField(min_value=0.0, max_value=1.0, default=0.95)
    is_simulated = serializers.BooleanField(required=False, default=True)
    event_id = serializers.CharField(required=False, allow_blank=True, default='')
    force_fresh = serializers.BooleanField(required=False, default=False)
    simulation_id = serializers.CharField(required=False, allow_blank=True, default='')
    scenario_id = serializers.CharField(required=False, allow_blank=True, default='')

    def to_internal_value(self, data):
        # Normalize backwards-compatible aliases
        mutable = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'stationId' in mutable and 'station_id' not in mutable:
            mutable['station_id'] = mutable['stationId']
        if 'station' in mutable and 'station_id' not in mutable:
            mutable['station_id'] = mutable['station']

        if 'simulationRunId' in mutable and 'simulation_id' not in mutable:
            mutable['simulation_id'] = str(mutable['simulationRunId'])
        elif 'simulation' in mutable and 'simulation_id' not in mutable:
            mutable['simulation_id'] = str(mutable['simulation'])

        if 'scenarioId' in mutable and 'scenario_id' not in mutable:
            mutable['scenario_id'] = str(mutable['scenarioId'])
        elif 'scenario' in mutable and 'scenario_id' not in mutable:
            mutable['scenario_id'] = str(mutable['scenario'])

        # Canonicalize scenario_id if passed as extreme_antarctic_storm
        if mutable.get('scenario_id') == 'extreme_antarctic_storm':
            mutable['scenario_id'] = 'antarctic_storm'

        if 'event_type' in mutable and 'hazard_type' not in mutable:
            mutable['hazard_type'] = mutable['event_type']
        elif 'type' in mutable and 'hazard_type' not in mutable:
            mutable['hazard_type'] = mutable['type']

        if 'distance' in mutable and 'distance_km' not in mutable:
            mutable['distance_km'] = mutable['distance']

        if 'wind_speed' in mutable and 'wind_speed_kmh' not in mutable:
            mutable['wind_speed_kmh'] = mutable['wind_speed']

        if 'eta_hours' in mutable and 'estimated_arrival_hours' not in mutable:
            mutable['estimated_arrival_hours'] = mutable['eta_hours']
        elif 'eta' in mutable and 'estimated_arrival_hours' not in mutable:
            mutable['estimated_arrival_hours'] = mutable['eta']

        if 'idempotency_key' in mutable and 'event_id' not in mutable:
            mutable['event_id'] = mutable['idempotency_key']

        # Upper-case severity
        if 'severity' in mutable and isinstance(mutable['severity'], str):
            mutable['severity'] = mutable['severity'].upper()

        return super().to_internal_value(mutable)

    def validate_station_id(self, value):
        st = str(value).lower().strip()
        if st not in ['maitri', 'bharati']:
            raise serializers.ValidationError("station_id must be either 'maitri' or 'bharati'")
        return st

