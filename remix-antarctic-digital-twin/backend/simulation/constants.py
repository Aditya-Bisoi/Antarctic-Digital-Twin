"""
constants.py — Thresholds, enumerations, and configuration constants
Antarctic Digital Twin — SIH26060
"""

# ============================================================================
# Equipment Types
# ============================================================================
EQUIPMENT_TYPES = [
    ('generator', 'Generator'),
    ('backup_generator', 'Backup Generator'),
    ('heating', 'Heating'),
    ('battery', 'Battery'),
    ('solar', 'Solar'),
    ('wind_turbine', 'Wind Turbine'),
    ('water_treatment', 'Water Treatment'),
    ('communication', 'Communication'),
    ('medical', 'Medical'),
    ('fuel_system', 'Fuel System'),
    ('electrical_distribution', 'Electrical Distribution'),
    ('other', 'Other'),
]

EQUIPMENT_STATUSES = [
    ('operational', 'Operational'),
    ('degraded', 'Degraded'),
    ('warning', 'Warning'),
    ('failed', 'Failed'),
    ('maintenance', 'Maintenance'),
    ('offline', 'Offline'),
]

# ============================================================================
# Alert Severities
# ============================================================================
ALERT_SEVERITIES = [
    ('info', 'Info'),
    ('warning', 'Warning'),
    ('high', 'High'),
    ('critical', 'Critical'),
]

# ============================================================================
# Risk Levels
# ============================================================================
RISK_LEVELS = [
    ('LOW', 'Low'),
    ('MODERATE', 'Moderate'),
    ('HIGH', 'High'),
    ('CRITICAL', 'Critical'),
]

# ============================================================================
# Simulation Statuses
# ============================================================================
SIMULATION_STATUSES = [
    ('created', 'Created'),
    ('running', 'Running'),
    ('paused', 'Paused'),
    ('completed', 'Completed'),
    ('failed', 'Failed'),
]

# ============================================================================
# Scenario Severities
# ============================================================================
SCENARIO_SEVERITIES = [
    ('low', 'Low'),
    ('medium', 'Medium'),
    ('high', 'High'),
    ('critical', 'Critical'),
]

# ============================================================================
# Scenario Categories
# ============================================================================
SCENARIO_CATEGORIES = [
    ('baseline', 'Baseline'),
    ('environment', 'Environment'),
    ('energy', 'Energy'),
    ('infrastructure', 'Infrastructure'),
    ('logistics', 'Logistics'),
    ('communication', 'Communication'),
    ('equipment', 'Equipment'),
    ('crew', 'Crew'),
    ('combined', 'Combined'),
]

# ============================================================================
# Incident / Hazard Types
# ============================================================================
INCIDENT_TYPES = [
    ('storm', 'Storm'),
    ('extreme_cold', 'Extreme Cold'),
    ('generator_failure', 'Generator Failure'),
    ('heating_failure', 'Heating Failure'),
    ('fire', 'Fire'),
    ('fuel_leak', 'Fuel Leak'),
    ('fuel_shortage', 'Fuel Shortage'),
    ('communication_failure', 'Communication Failure'),
    ('water_system_failure', 'Water System Failure'),
    ('medical_emergency', 'Medical Emergency'),
    ('equipment_failure', 'Equipment Failure'),
    ('resupply_delay', 'Resupply Delay'),
    ('multi_system_emergency', 'Multi-System Emergency'),
]

# ============================================================================
# Communication Statuses
# ============================================================================
COMM_STATUSES = [
    ('online', 'Online'),
    ('degraded', 'Degraded'),
    ('offline', 'Offline'),
]

# ============================================================================
# System Statuses (for infrastructure subsystems)
# ============================================================================
SYSTEM_STATUSES = [
    ('nominal', 'Nominal'),
    ('warning', 'Warning'),
    ('critical', 'Critical'),
    ('failed', 'Failed'),
]

# ============================================================================
# Event Types (for simulation event timeline)
# ============================================================================
EVENT_TYPES = [
    ('info', 'Info'),
    ('warning', 'Warning'),
    ('critical', 'Critical'),
    ('intervention', 'Intervention'),
    ('prediction', 'Prediction'),
    ('scenario', 'Scenario'),
    ('hazard', 'Hazard'),
    ('system', 'System'),
]

# ============================================================================
# Intervention Categories
# ============================================================================
INTERVENTION_CATEGORIES = [
    ('energy', 'Energy'),
    ('heating', 'Heating'),
    ('logistics', 'Logistics'),
    ('maintenance', 'Maintenance'),
    ('crew', 'Crew'),
]

# ============================================================================
# Physics Thresholds
# ============================================================================

# Temperature thresholds (°C)
TEMP_EXTREME_COLD = -50
TEMP_SEVERE_COLD = -40
TEMP_INDOOR_HYPOTHERMIA = 5
TEMP_INDOOR_WARNING = 12
TEMP_INDOOR_LOW = 15

# Wind thresholds (km/h)
WIND_TURBINE_LOCK = 100
WIND_OUTDOOR_RESTRICTED = 80
WIND_COMM_DEGRADATION = 60
WIND_HEATING_PENALTY_THRESHOLD = 50

# Battery thresholds (%)
BATTERY_CRITICAL = 10
BATTERY_LOW = 30

# Generator load thresholds (%)
GENERATOR_LOAD_CRITICAL = 90
GENERATOR_LOAD_HIGH = 75

# Fuel endurance thresholds (days)
FUEL_CRITICAL_DAYS = 7
FUEL_WARNING_DAYS = 14

# Equipment health thresholds (%)
EQUIPMENT_HEALTH_FAILED = 0
EQUIPMENT_HEALTH_CRITICAL = 40
EQUIPMENT_HEALTH_WARNING = 70

# Visibility thresholds (km)
VISIBILITY_WHITEOUT = 2
VISIBILITY_LOW = 10

# Communication quality thresholds (%)
COMM_QUALITY_OFFLINE = 0
COMM_QUALITY_DEGRADED = 50

# Food/water critical thresholds (days)
FOOD_CRITICAL_DAYS = 14
WATER_CRITICAL_DAYS = 7

# ============================================================================
# Physics Constants
# ============================================================================

# Heating demand coefficient: heating_kw = base * (1 + HEATING_TEMP_COEFFICIENT * delta_T)
HEATING_TEMP_COEFFICIENT = 0.03

# Wind heating penalty: extra kW per km/h above threshold
WIND_HEATING_PENALTY_KW_PER_KMH = 0.15

# Fuel consumption exponent: fuel_rate = base_rate * (load%)^FUEL_LOAD_EXPONENT
FUEL_LOAD_EXPONENT = 1.15

# Effective output: rated_output * (health/100)^HEALTH_OUTPUT_EXPONENT
HEALTH_OUTPUT_EXPONENT = 0.5

# Generator fuel base rate (liters per hour at rated capacity)
GENERATOR_FUEL_BASE_RATE_LPH = 30.0

# Crew resource consumption rates
CREW_POWER_KW_PER_PERSON = 0.8
CREW_FOOD_KG_PER_PERSON_PER_DAY = 1.0
CREW_WATER_L_PER_PERSON_PER_DAY = 20.0

# Medical consumption rate (% per day per 25 crew)
MEDICAL_DAILY_RATE_PER_25_CREW = 0.025

# Spare parts consumption rates (% per day)
SPARE_PARTS_NORMAL_RATE = 0.015
SPARE_PARTS_MAINTENANCE_RATE = 0.04

# Battery max charge/discharge rates
BATTERY_MAX_CHARGE_RATE_KW = 30.0

# Solar factor (Antarctic winter baseline)
SOLAR_WINTER_BASELINE_FACTOR = 0.4

# Indoor temperature decay rate (°C per hour toward outdoor temp when heating fails)
INDOOR_TEMP_DECAY_RATE = 0.5

# ============================================================================
# Resilience Weights
# ============================================================================
RESILIENCE_WEIGHTS = {
    'energy_availability': 0.15,
    'fuel_endurance': 0.15,
    'equipment_health': 0.15,
    'environmental_conditions': 0.10,
    'logistics_status': 0.15,
    'communication': 0.10,
    'crew_safety': 0.10,
    'system_integrity': 0.10,
}

# ============================================================================
# Optimizer Weights
# ============================================================================
OPTIMIZER_WEIGHTS = {
    'fuel_endurance': 0.20,
    'power_stability': 0.20,
    'battery_reserve': 0.10,
    'resource_endurance': 0.10,
    'operational_risk': 0.15,
    'equipment_stress': 0.10,
    'crew_safety': 0.15,
}

# ============================================================================
# Normal operating ranges per equipment category (for predictive engine)
# ============================================================================
EQUIPMENT_NORMAL_RANGES = {
    'generator': {'temp_max': 90, 'vib_max': 30, 'eff_min': 0.85},
    'backup_generator': {'temp_max': 90, 'vib_max': 30, 'eff_min': 0.85},
    'heating': {'temp_max': 75, 'vib_max': 15, 'eff_min': 0.85},
    'water_treatment': {'temp_max': 50, 'vib_max': 12, 'eff_min': 0.90},
    'solar': {'temp_max': 40, 'vib_max': 5, 'eff_min': 0.75},
    'wind_turbine': {'temp_max': 40, 'vib_max': 20, 'eff_min': 0.75},
    'communication': {'temp_max': 35, 'vib_max': 8, 'eff_min': 0.90},
    'battery': {'temp_max': 45, 'vib_max': 5, 'eff_min': 0.90},
    'medical': {'temp_max': 30, 'vib_max': 5, 'eff_min': 0.95},
    'fuel_system': {'temp_max': 50, 'vib_max': 10, 'eff_min': 0.90},
    'electrical_distribution': {'temp_max': 60, 'vib_max': 10, 'eff_min': 0.90},
    'other': {'temp_max': 50, 'vib_max': 15, 'eff_min': 0.85},
}
