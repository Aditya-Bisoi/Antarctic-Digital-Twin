"""
admin.py — Django Admin Registration for Simulation App
Antarctic Digital Twin — SIH26060
"""

from django.contrib import admin
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


@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'station', 'equipment_type', 'status', 'health_percentage', 'current_output', 'failure_probability')
    list_filter = ('station', 'equipment_type', 'status')
    search_fields = ('name', 'identifier')


@admin.register(Scenario)
class ScenarioAdmin(admin.ModelAdmin):
    list_display = ('name', 'scenario_id', 'category', 'severity', 'duration_hours', 'enabled')
    list_filter = ('category', 'severity', 'enabled')
    search_fields = ('name', 'scenario_id')


@admin.register(SimulationRun)
class SimulationRunAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'station', 'scenario', 'status', 'current_simulation_time', 'created_at')
    list_filter = ('status', 'station', 'scenario')
    search_fields = ('name',)


@admin.register(SimulationSnapshot)
class SimulationSnapshotAdmin(admin.ModelAdmin):
    list_display = ('id', 'simulation', 'simulation_hour', 'risk_level', 'resilience_score', 'created_at')
    list_filter = ('risk_level',)


@admin.register(SimulationEvent)
class SimulationEventAdmin(admin.ModelAdmin):
    list_display = ('title', 'simulation', 'simulation_hour', 'event_type', 'severity', 'created_at')
    list_filter = ('event_type', 'severity')
    search_fields = ('title', 'description')


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ('incident_type', 'station', 'simulation', 'severity', 'start_hour', 'active', 'resolved')
    list_filter = ('incident_type', 'severity', 'active', 'resolved')


@admin.register(InterventionDefinition)
class InterventionDefinitionAdmin(admin.ModelAdmin):
    list_display = ('name', 'intervention_id', 'category', 'priority', 'reversible', 'enabled')
    list_filter = ('category', 'enabled', 'reversible')


@admin.register(AppliedIntervention)
class AppliedInterventionAdmin(admin.ModelAdmin):
    list_display = ('intervention', 'simulation', 'applied_at_hour', 'reverted_at_hour', 'is_active')
    list_filter = ('is_active',)


@admin.register(CascadeEvent)
class CascadeEventAdmin(admin.ModelAdmin):
    list_display = ('source_event', 'affected_component', 'simulation', 'simulation_hour', 'severity')
    list_filter = ('severity',)


@admin.register(PredictionRecord)
class PredictionRecordAdmin(admin.ModelAdmin):
    list_display = ('equipment', 'station', 'failure_probability', 'estimated_failure_window', 'severity')
    list_filter = ('severity', 'trend')


@admin.register(SimulationReport)
class SimulationReportAdmin(admin.ModelAdmin):
    list_display = ('simulation', 'scenario_name', 'station_name', 'generated_at')
