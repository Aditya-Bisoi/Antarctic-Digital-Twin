from rest_framework import serializers
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

class EnergyDataSerializer(serializers.ModelSerializer):
    powerGenerationKw = serializers.FloatField(source='power_generation_kw')
    powerConsumptionKw = serializers.FloatField(source='power_consumption_kw')
    solarGenerationKw = serializers.FloatField(source='solar_generation_kw')
    generatorLoadPercent = serializers.FloatField(source='generator_load_percent')
    batteryLevelPercent = serializers.FloatField(source='battery_level_percent')
    dailyUsageKwh = serializers.FloatField(source='daily_usage_kwh')
    primarySource = serializers.CharField(source='primary_source')

    class Meta:
        model = EnergyData
        fields = [
            'primarySource',
            'powerGenerationKw',
            'powerConsumptionKw',
            'solarGenerationKw',
            'generatorLoadPercent',
            'batteryLevelPercent',
            'dailyUsageKwh',
        ]

class EnvironmentDataSerializer(serializers.ModelSerializer):
    windSpeed = serializers.FloatField(source='wind_speed')
    windDirection = serializers.CharField(source='wind_direction')
    windChill = serializers.FloatField(source='wind_chill')
    humidityPercent = serializers.FloatField(source='humidity_percent')
    airPressureHpa = serializers.FloatField(source='air_pressure_hpa')
    uvIndex = serializers.FloatField(source='uv_index')
    visibilityKm = serializers.FloatField(source='visibility_km')
    snowAccumulationCm = serializers.FloatField(source='snow_accumulation_cm')

    class Meta:
        model = EnvironmentData
        fields = [
            'temperature',
            'windSpeed',
            'windDirection',
            'windChill',
            'humidityPercent',
            'airPressureHpa',
            'uvIndex',
            'visibilityKm',
            'snowAccumulationCm',
        ]

class InfrastructureDataSerializer(serializers.ModelSerializer):
    overallHealthPercent = serializers.IntegerField(source='overall_health_percent')
    lifeSupportStatus = serializers.CharField(source='life_support_status')
    heatingSystemStatus = serializers.CharField(source='heating_system_status')
    waterTreatmentCapacityLpd = serializers.IntegerField(source='water_treatment_capacity_lpd')
    indoorTemp = serializers.FloatField(source='indoor_temp')
    satelliteUplinkMbps = serializers.IntegerField(source='satellite_uplink_mbps')
    activeSensors = serializers.IntegerField(source='active_sensors')
    totalSensors = serializers.IntegerField(source='total_sensors')

    class Meta:
        model = InfrastructureData
        fields = [
            'overallHealthPercent',
            'lifeSupportStatus',
            'heatingSystemStatus',
            'waterTreatmentCapacityLpd',
            'indoorTemp',
            'satelliteUplinkMbps',
            'activeSensors',
            'totalSensors',
        ]

class InfrastructureItemSerializer(serializers.ModelSerializer):
    healthPercent = serializers.IntegerField(source='health_percent')

    class Meta:
        model = InfrastructureItem
        fields = ['id', 'name', 'category', 'status', 'healthPercent']

class LogisticsDataSerializer(serializers.ModelSerializer):
    fuelReserveDays = serializers.IntegerField(source='fuel_reserve_days')
    fuelLevelLiters = serializers.IntegerField(source='fuel_level_liters')
    foodRationDays = serializers.IntegerField(source='food_ration_days')
    waterStorageLiters = serializers.IntegerField(source='water_storage_liters')
    medicalSupplyStatus = serializers.CharField(source='medical_supply_status')
    nextResupplyDate = serializers.CharField(source='next_resupply_date')
    expeditionTeam = serializers.CharField(source='expedition_team')

    class Meta:
        model = LogisticsData
        fields = [
            'fuelReserveDays',
            'fuelLevelLiters',
            'foodRationDays',
            'waterStorageLiters',
            'medicalSupplyStatus',
            'nextResupplyDate',
            'expeditionTeam',
        ]

class LogisticsItemSerializer(serializers.ModelSerializer):
    itemName = serializers.CharField(source='item_name')
    reserveDays = serializers.IntegerField(source='reserve_days')

    class Meta:
        model = LogisticsItem
        fields = ['id', 'itemName', 'quantity', 'unit', 'reserveDays', 'status']

class AlertSerializer(serializers.ModelSerializer):
    stationId = serializers.CharField(source='station.id', read_only=True)
    stationName = serializers.CharField(source='station.name', read_only=True)

    class Meta:
        model = Alert
        fields = [
            'id',
            'stationId',
            'stationName',
            'severity',
            'title',
            'message',
            'timestamp',
            'category',
        ]

class DigitalTwinModuleSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='module_id')

    class Meta:
        model = DigitalTwinModule
        fields = [
            'id',
            'name',
            'type',
            'status',
            'temp',
            'power',
            'description',
            'x',
            'y',
            'width',
            'height',
        ]

class StationListSerializer(serializers.ModelSerializer):
    lastPing = serializers.CharField(source='last_ping')
    commissionedYear = serializers.IntegerField(source='commissioned_year')
    crewCount = serializers.IntegerField(source='crew_count')
    temperature = serializers.SerializerMethodField()
    windSpeed = serializers.SerializerMethodField()
    windDirection = serializers.SerializerMethodField()
    energy = EnergyDataSerializer(read_only=True)
    environment = EnvironmentDataSerializer(read_only=True)
    infrastructure = InfrastructureDataSerializer(read_only=True)
    logistics = LogisticsDataSerializer(read_only=True)

    class Meta:
        model = Station
        fields = [
            'id',
            'name',
            'region',
            'coordinates',
            'status',
            'lastPing',
            'image',
            'description',
            'commissionedYear',
            'elevation',
            'crewCount',
            'temperature',
            'windSpeed',
            'windDirection',
            'energy',
            'environment',
            'infrastructure',
            'logistics',
        ]

    def get_temperature(self, obj):
        return obj.environment.temperature if hasattr(obj, 'environment') else -25.0

    def get_windSpeed(self, obj):
        return obj.environment.wind_speed if hasattr(obj, 'environment') else 35.0

    def get_windDirection(self, obj):
        return obj.environment.wind_direction if hasattr(obj, 'environment') else 'NE (42°)'

class StationDashboardSerializer(serializers.ModelSerializer):
    lastPing = serializers.CharField(source='last_ping')
    commissionedYear = serializers.IntegerField(source='commissioned_year')
    crewCount = serializers.IntegerField(source='crew_count')
    temperature = serializers.SerializerMethodField()
    windSpeed = serializers.SerializerMethodField()
    windDirection = serializers.SerializerMethodField()
    energy = EnergyDataSerializer(read_only=True)
    environment = EnvironmentDataSerializer(read_only=True)
    infrastructure = InfrastructureDataSerializer(read_only=True)
    logistics = LogisticsDataSerializer(read_only=True)
    digitalTwinModules = DigitalTwinModuleSerializer(source='digital_twin_modules', many=True, read_only=True)
    alerts = AlertSerializer(many=True, read_only=True)
    infrastructureItems = InfrastructureItemSerializer(source='infrastructure_items', many=True, read_only=True)
    logisticsItems = LogisticsItemSerializer(source='logistics_items', many=True, read_only=True)

    class Meta:
        model = Station
        fields = [
            'id',
            'name',
            'region',
            'coordinates',
            'status',
            'lastPing',
            'image',
            'description',
            'commissionedYear',
            'elevation',
            'crewCount',
            'temperature',
            'windSpeed',
            'windDirection',
            'energy',
            'environment',
            'infrastructure',
            'logistics',
            'digitalTwinModules',
            'alerts',
            'infrastructureItems',
            'logisticsItems',
        ]

    def get_temperature(self, obj):
        return obj.environment.temperature if hasattr(obj, 'environment') else -25.0

    def get_windSpeed(self, obj):
        return obj.environment.wind_speed if hasattr(obj, 'environment') else 35.0

    def get_windDirection(self, obj):
        return obj.environment.wind_direction if hasattr(obj, 'environment') else 'NE (42°)'

class EnergyHistorySerializer(serializers.ModelSerializer):
    timeLabel = serializers.CharField(source='time_label')
    powerGenerationKw = serializers.FloatField(source='power_generation_kw')
    powerConsumptionKw = serializers.FloatField(source='power_consumption_kw')
    batteryLevelPercent = serializers.FloatField(source='battery_level_percent')

    class Meta:
        model = EnergyHistory
        fields = ['timeLabel', 'powerGenerationKw', 'powerConsumptionKw', 'batteryLevelPercent']

class EnvironmentHistorySerializer(serializers.ModelSerializer):
    timeLabel = serializers.CharField(source='time_label')
    windSpeed = serializers.FloatField(source='wind_speed')
    airPressureHpa = serializers.FloatField(source='air_pressure_hpa')

    class Meta:
        model = EnvironmentHistory
        fields = ['timeLabel', 'temperature', 'windSpeed', 'airPressureHpa']
