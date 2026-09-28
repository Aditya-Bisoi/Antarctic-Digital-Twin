from django.contrib import admin
from .models import (
    Station,
    EnergyData,
    EnvironmentData,
    InfrastructureData,
    InfrastructureItem,
    LogisticsData,
    LogisticsItem,
    Alert,
    DigitalTwinModule,
    EnergyHistory,
    EnvironmentHistory,
)

@admin.register(Station)
class StationAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'status', 'temperature', 'wind_speed', 'crew_count', 'last_ping')
    list_filter = ('status', 'region')
    search_fields = ('name', 'id', 'coordinates')

    def temperature(self, obj):
        return f"{obj.environment.temperature}°C" if hasattr(obj, 'environment') else "N/A"

    def wind_speed(self, obj):
        return f"{obj.environment.wind_speed} km/h" if hasattr(obj, 'environment') else "N/A"

@admin.register(EnergyData)
class EnergyDataAdmin(admin.ModelAdmin):
    list_display = ('station', 'power_generation_kw', 'power_consumption_kw', 'generator_load_percent', 'battery_level_percent')

@admin.register(EnvironmentData)
class EnvironmentDataAdmin(admin.ModelAdmin):
    list_display = ('station', 'temperature', 'wind_speed', 'air_pressure_hpa', 'visibility_km')

@admin.register(InfrastructureData)
class InfrastructureDataAdmin(admin.ModelAdmin):
    list_display = ('station', 'overall_health_percent', 'life_support_status', 'heating_system_status', 'active_sensors')

@admin.register(InfrastructureItem)
class InfrastructureItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'station', 'category', 'status', 'health_percent')
    list_filter = ('category', 'status', 'station')

@admin.register(LogisticsData)
class LogisticsDataAdmin(admin.ModelAdmin):
    list_display = ('station', 'fuel_reserve_days', 'fuel_level_liters', 'food_ration_days', 'medical_supply_status')

@admin.register(LogisticsItem)
class LogisticsItemAdmin(admin.ModelAdmin):
    list_display = ('item_name', 'station', 'quantity', 'unit', 'reserve_days', 'status')
    list_filter = ('status', 'station')

@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ('title', 'station', 'severity', 'category', 'timestamp')
    list_filter = ('severity', 'category', 'station')
    search_fields = ('title', 'message')

@admin.register(DigitalTwinModule)
class DigitalTwinModuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'station', 'type', 'status', 'temp', 'power')
    list_filter = ('type', 'status', 'station')

@admin.register(EnergyHistory)
class EnergyHistoryAdmin(admin.ModelAdmin):
    list_display = ('station', 'time_label', 'power_generation_kw', 'power_consumption_kw', 'battery_level_percent')

@admin.register(EnvironmentHistory)
class EnvironmentHistoryAdmin(admin.ModelAdmin):
    list_display = ('station', 'time_label', 'temperature', 'wind_speed', 'air_pressure_hpa')
