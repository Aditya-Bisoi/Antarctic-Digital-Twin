"""
models.py — Simulation data models
Antarctic Digital Twin — SIH26060

All simulation-related models: Equipment, Scenarios, SimulationRuns,
Snapshots, Events, Incidents, Interventions, Predictions, Reports.
"""

import json
from django.db import models
from django.utils import timezone
from stations.models import Station
from .constants import (
    EQUIPMENT_TYPES, EQUIPMENT_STATUSES, ALERT_SEVERITIES,
    RISK_LEVELS, SIMULATION_STATUSES, SCENARIO_SEVERITIES,
    SCENARIO_CATEGORIES, INCIDENT_TYPES, COMM_STATUSES,
    SYSTEM_STATUSES, EVENT_TYPES, INTERVENTION_CATEGORIES,
)


# ============================================================================
# Equipment
# ============================================================================

class Equipment(models.Model):
    """Detailed equipment record for a station."""
    station = models.ForeignKey(
        Station, on_delete=models.CASCADE, related_name='sim_equipment'
    )
    name = models.CharField(max_length=200)
    equipment_type = models.CharField(max_length=50, choices=EQUIPMENT_TYPES)
    identifier = models.CharField(
        max_length=100, help_text="Unique ID within station, e.g. gen1, gen2, backup"
    )
    rated_output = models.FloatField(default=0, help_text="Rated output in kW")
    current_output = models.FloatField(default=0, help_text="Current output in kW")
    health_percentage = models.FloatField(default=100)
    efficiency = models.FloatField(default=0.95, help_text="0.0 to 1.0")
    temperature = models.FloatField(default=20, help_text="Operating temperature °C")
    vibration = models.FloatField(default=0, help_text="Normalized 0-100")
    load_percentage = models.FloatField(default=0)
    operating_hours = models.FloatField(default=0)
    status = models.CharField(
        max_length=20, choices=EQUIPMENT_STATUSES, default='operational'
    )
    failure_probability = models.FloatField(default=0, help_text="0-100")
    degradation_rate = models.FloatField(
        default=0.02, help_text="Health % lost per hour under normal conditions"
    )
    last_maintenance = models.DateTimeField(null=True, blank=True)
    next_maintenance = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('station', 'identifier')
        ordering = ['station', 'equipment_type', 'name']

    def __str__(self):
        return f"{self.station.name} — {self.name} ({self.get_equipment_type_display()})"


# ============================================================================
# Scenario + Scenario Events
# ============================================================================

class Scenario(models.Model):
    """A predefined or custom scenario definition."""
    scenario_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField()
    severity = models.CharField(max_length=20, choices=SCENARIO_SEVERITIES, default='medium')
    category = models.CharField(max_length=50, choices=SCENARIO_CATEGORIES, default='baseline')
    duration_hours = models.FloatField(default=24, help_text="Expected scenario duration in hours")
    configurable_parameters = models.JSONField(
        default=dict, blank=True,
        help_text="JSON schema of configurable parameters"
    )
    events_data = models.JSONField(
        default=list, blank=True,
        help_text="List of scenario events [{at_hour, event_type, action, parameters, description}]"
    )
    icon = models.CharField(max_length=50, default='AlertTriangle')
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'severity', 'name']

    def __str__(self):
        return f"{self.name} ({self.get_severity_display()})"


# ============================================================================
# Simulation Run
# ============================================================================

class SimulationRun(models.Model):
    """A simulation session."""
    station = models.ForeignKey(
        Station, on_delete=models.CASCADE, related_name='simulation_runs'
    )
    scenario = models.ForeignKey(
        Scenario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='simulation_runs'
    )
    name = models.CharField(max_length=200, blank=True)
    status = models.CharField(
        max_length=20, choices=SIMULATION_STATUSES, default='created'
    )
    speed_multiplier = models.FloatField(default=1.0)

    # Time tracking
    simulation_start = models.DateTimeField(default=timezone.now)
    current_simulation_time = models.FloatField(
        default=0, help_text="Current simulation hour"
    )
    simulation_end = models.FloatField(
        null=True, blank=True, help_text="End simulation hour (null = open-ended)"
    )

    # State snapshots (JSON blobs)
    initial_state = models.JSONField(default=dict, blank=True)
    current_state = models.JSONField(default=dict, blank=True)
    final_state = models.JSONField(default=dict, blank=True)

    # Configuration
    scenario_parameters = models.JSONField(
        default=dict, blank=True,
        help_text="Custom parameters for the scenario"
    )
    random_seed = models.IntegerField(
        null=True, blank=True,
        help_text="Random seed for reproducibility (null = deterministic)"
    )

    # Active lists
    active_scenarios = models.JSONField(default=list, blank=True)
    active_interventions = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        scenario_name = self.scenario.name if self.scenario else 'Custom'
        return f"Simulation #{self.pk}: {self.station.name} — {scenario_name} ({self.get_status_display()})"


# ============================================================================
# Simulation Snapshot (hourly state persistence)
# ============================================================================

class SimulationSnapshot(models.Model):
    """Hourly state snapshot for replay."""
    simulation = models.ForeignKey(
        SimulationRun, on_delete=models.CASCADE, related_name='snapshots'
    )
    simulation_hour = models.FloatField()
    state_data = models.JSONField(
        help_text="Complete StationState at this simulation hour"
    )
    risk_level = models.CharField(max_length=20, choices=RISK_LEVELS, default='LOW')
    resilience_score = models.FloatField(default=100)
    active_events = models.JSONField(default=list, blank=True)
    active_failures = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['simulation', 'simulation_hour']
        unique_together = ('simulation', 'simulation_hour')

    def __str__(self):
        return f"Snapshot @ hour {self.simulation_hour:.1f} — Simulation #{self.simulation_id}"


# ============================================================================
# Simulation Event (event timeline)
# ============================================================================

class SimulationEvent(models.Model):
    """An event in the simulation timeline."""
    simulation = models.ForeignKey(
        SimulationRun, on_delete=models.CASCADE, related_name='events'
    )
    simulation_hour = models.FloatField()
    event_type = models.CharField(max_length=30, choices=EVENT_TYPES)
    title = models.CharField(max_length=300)
    description = models.TextField()
    severity = models.CharField(max_length=20, choices=ALERT_SEVERITIES, default='info')
    source = models.CharField(max_length=100, blank=True, default='')
    category = models.CharField(max_length=100, blank=True, default='')
    cause = models.CharField(max_length=300, blank=True, default='')
    effect = models.CharField(max_length=300, blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['simulation', 'simulation_hour']

    def __str__(self):
        return f"[{self.event_type}] {self.title} @ hour {self.simulation_hour:.1f}"


# ============================================================================
# Incident / Hazard
# ============================================================================

class Incident(models.Model):
    """A hazard/incident injected during simulation."""
    simulation = models.ForeignKey(
        SimulationRun, on_delete=models.CASCADE, related_name='incidents'
    )
    station = models.ForeignKey(
        Station, on_delete=models.CASCADE, related_name='incidents'
    )
    incident_type = models.CharField(max_length=50, choices=INCIDENT_TYPES)
    severity = models.CharField(max_length=20, choices=ALERT_SEVERITIES, default='high')
    description = models.TextField()
    start_hour = models.FloatField(help_text="Simulation hour when incident begins")
    expected_duration_hours = models.FloatField(
        default=24, help_text="Expected duration in simulation hours"
    )
    affected_systems = models.JSONField(
        default=list, blank=True,
        help_text="List of affected system identifiers"
    )
    parameters = models.JSONField(default=dict, blank=True)
    active = models.BooleanField(default=True)
    resolved = models.BooleanField(default=False)
    resolved_at_hour = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['simulation', 'start_hour']

    def __str__(self):
        status = 'Active' if self.active else 'Resolved'
        return f"[{status}] {self.get_incident_type_display()} — {self.station.name}"


# ============================================================================
# Intervention Definition
# ============================================================================

class InterventionDefinition(models.Model):
    """A predefined intervention that can be applied to simulations."""
    intervention_id = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField()
    category = models.CharField(max_length=30, choices=INTERVENTION_CATEGORIES)
    icon = models.CharField(max_length=50, default='Wrench')

    # Conditions and effects (JSON for flexibility)
    applicable_conditions = models.JSONField(
        default=dict, blank=True,
        help_text="Conditions under which this intervention is available"
    )
    effects = models.JSONField(
        default=dict, blank=True,
        help_text="Effects when applied"
    )
    resource_cost = models.JSONField(
        default=dict, blank=True,
        help_text="Resource costs of applying this intervention"
    )
    side_effects = models.JSONField(
        default=list, blank=True,
        help_text="List of side effect descriptions"
    )
    priority = models.IntegerField(default=5, help_text="1=highest priority")
    reversible = models.BooleanField(default=True)
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['priority', 'category', 'name']

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"


# ============================================================================
# Applied Intervention (intervention applied to a simulation run)
# ============================================================================

class AppliedIntervention(models.Model):
    """An intervention applied to a specific simulation run."""
    simulation = models.ForeignKey(
        SimulationRun, on_delete=models.CASCADE, related_name='applied_interventions'
    )
    intervention = models.ForeignKey(
        InterventionDefinition, on_delete=models.CASCADE, related_name='applications'
    )
    applied_at_hour = models.FloatField()
    reverted_at_hour = models.FloatField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    effects_applied = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['simulation', 'applied_at_hour']

    def __str__(self):
        return f"{self.intervention.name} @ hour {self.applied_at_hour:.1f}"


# ============================================================================
# Cascade Event
# ============================================================================

class CascadeEvent(models.Model):
    """Records a cascade failure event in the dependency chain."""
    simulation = models.ForeignKey(
        SimulationRun, on_delete=models.CASCADE, related_name='cascade_events'
    )
    simulation_hour = models.FloatField()
    source_event = models.CharField(max_length=200)
    affected_component = models.CharField(max_length=200)
    cause = models.CharField(max_length=300)
    effect = models.CharField(max_length=300)
    severity = models.CharField(max_length=20, choices=ALERT_SEVERITIES, default='warning')
    downstream_consequences = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['simulation', 'simulation_hour']

    def __str__(self):
        return f"Cascade: {self.source_event} → {self.affected_component}"


# ============================================================================
# Prediction Record
# ============================================================================

class PredictionRecord(models.Model):
    """Equipment failure prediction record."""
    simulation = models.ForeignKey(
        SimulationRun, on_delete=models.CASCADE, related_name='predictions',
        null=True, blank=True
    )
    station = models.ForeignKey(
        Station, on_delete=models.CASCADE, related_name='predictions'
    )
    equipment = models.ForeignKey(
        Equipment, on_delete=models.CASCADE, related_name='predictions'
    )
    simulation_hour = models.FloatField(default=0)
    current_health = models.FloatField()
    trend = models.CharField(max_length=30, default='stable')
    trend_rate = models.FloatField(default=0, help_text="Health % lost per hour")
    failure_probability = models.FloatField(help_text="0-100")
    estimated_failure_hours = models.FloatField(null=True, blank=True)
    estimated_failure_window = models.CharField(max_length=100, default='No failure expected')
    severity = models.CharField(max_length=20, choices=ALERT_SEVERITIES, default='info')
    abnormal_factors = models.JSONField(default=list, blank=True)
    recommended_maintenance = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-failure_probability']

    def __str__(self):
        return f"Prediction: {self.equipment.name} — {self.failure_probability:.0f}% failure prob"


# ============================================================================
# Simulation Report
# ============================================================================

class SimulationReport(models.Model):
    """Generated report from a simulation run."""
    simulation = models.OneToOneField(
        SimulationRun, on_delete=models.CASCADE, related_name='report'
    )
    scenario_name = models.CharField(max_length=200)
    station_name = models.CharField(max_length=200)

    # Condition snapshots
    start_condition = models.JSONField(default=dict)
    final_condition = models.JSONField(default=dict)

    # Analysis results
    major_impacts = models.JSONField(default=list)
    cascading_events = models.JSONField(default=list)
    failures = models.JSONField(default=list)
    interventions_applied = models.JSONField(default=list)
    predicted_consequences = models.JSONField(default=list)
    recommended_actions = models.JSONField(default=list)

    # Evolution data
    risk_evolution = models.JSONField(default=list)
    resilience_evolution = models.JSONField(default=list)
    timeline = models.JSONField(default=list)

    # Comparison data
    without_intervention_outcome = models.JSONField(default=dict, blank=True)
    with_intervention_outcome = models.JSONField(default=dict, blank=True)

    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-generated_at']

    def __str__(self):
        return f"Report: {self.station_name} — {self.scenario_name}"
