from django.db import models

class Station(models.Model):
    STATUS_CHOICES = [
        ('Online', 'Online'),
        ('Offline', 'Offline'),
        ('Maintenance', 'Maintenance'),
    ]

    id = models.CharField(max_length=50, primary_key=True, help_text="Station ID e.g. maitri or bharati")
    name = models.CharField(max_length=100)
    region = models.CharField(max_length=100, default="East Antarctica")
    coordinates = models.CharField(max_length=150)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Online')
    last_ping = models.CharField(max_length=100, default="Just now (Telemetry synced)")
    image = models.CharField(max_length=500)
    description = models.TextField()
    commissioned_year = models.IntegerField()
    elevation = models.CharField(max_length=100)
    crew_count = models.IntegerField(default=25)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class EnergyData(models.Model):
    station = models.OneToOneField(Station, on_delete=models.CASCADE, related_name='energy')
    primary_source = models.CharField(max_length=150, default="Polar Diesel & Microgrid")
    power_generation_kw = models.FloatField(default=185.0)
    power_consumption_kw = models.FloatField(default=142.0)
    solar_generation_kw = models.FloatField(default=28.0)
    generator_load_percent = models.FloatField(default=68.0)
    battery_level_percent = models.FloatField(default=94.0)
    daily_usage_kwh = models.FloatField(default=3408.0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Energy - {self.station.name}"

class EnvironmentData(models.Model):
    station = models.OneToOneField(Station, on_delete=models.CASCADE, related_name='environment')
    temperature = models.FloatField(default=-28.0)
    wind_speed = models.FloatField(default=42.0)
    wind_direction = models.CharField(max_length=50, default="ESE (115°)")
    wind_chill = models.FloatField(default=-41.0)
    humidity_percent = models.FloatField(default=48.0)
    air_pressure_hpa = models.FloatField(default=986.0)
    uv_index = models.FloatField(default=1.2)
    visibility_km = models.FloatField(default=35.0)
    snow_accumulation_cm = models.FloatField(default=14.0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Environment - {self.station.name}"

class InfrastructureData(models.Model):
    STATUS_LEVEL_CHOICES = [
        ('Nominal', 'Nominal'),
        ('Warning', 'Warning'),
        ('Critical', 'Critical'),
    ]

    station = models.OneToOneField(Station, on_delete=models.CASCADE, related_name='infrastructure')
    overall_health_percent = models.IntegerField(default=97)
    life_support_status = models.CharField(max_length=20, choices=STATUS_LEVEL_CHOICES, default='Nominal')
    heating_system_status = models.CharField(max_length=20, choices=STATUS_LEVEL_CHOICES, default='Nominal')
    water_treatment_capacity_lpd = models.IntegerField(default=4200)
    indoor_temp = models.FloatField(default=21.5)
    satellite_uplink_mbps = models.IntegerField(default=50)
    active_sensors = models.IntegerField(default=248)
    total_sensors = models.IntegerField(default=252)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Infrastructure - {self.station.name}"

class InfrastructureItem(models.Model):
    CATEGORY_CHOICES = [
        ('Buildings', 'Buildings'),
        ('Generator', 'Generator'),
        ('Solar Panels', 'Solar Panels'),
        ('Water System', 'Water System'),
        ('Communication System', 'Communication System'),
    ]

    station = models.ForeignKey(Station, on_delete=models.CASCADE, related_name='infrastructure_items')
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    status = models.CharField(max_length=50, default='Operational')
    health_percent = models.IntegerField(default=98)

    def __str__(self):
        return f"{self.station.name} - {self.name} ({self.category})"

class LogisticsData(models.Model):
    MEDICAL_STATUS_CHOICES = [
        ('Full', 'Full'),
        ('Good', 'Good'),
        ('Restock Needed', 'Restock Needed'),
    ]

    station = models.OneToOneField(Station, on_delete=models.CASCADE, related_name='logistics')
    fuel_reserve_days = models.IntegerField(default=240)
    fuel_level_liters = models.IntegerField(default=185000)
    food_ration_days = models.IntegerField(default=310)
    water_storage_liters = models.IntegerField(default=48000)
    medical_supply_status = models.CharField(max_length=30, choices=MEDICAL_STATUS_CHOICES, default='Full')
    next_resupply_date = models.CharField(max_length=100, default="November 2026")
    expedition_team = models.CharField(max_length=200, default="45th Indian Scientific Expedition to Antarctica (ISEA)")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Logistics - {self.station.name}"

class LogisticsItem(models.Model):
    STATUS_CHOICES = [
        ('NORMAL', 'NORMAL'),
        ('WARNING', 'WARNING'),
        ('CRITICAL', 'CRITICAL'),
    ]

    station = models.ForeignKey(Station, on_delete=models.CASCADE, related_name='logistics_items')
    item_name = models.CharField(max_length=100, help_text="e.g. Fuel, Food, Water, Medical supplies, Spare parts")
    quantity = models.FloatField(default=100.0)
    unit = models.CharField(max_length=50, default="units")
    reserve_days = models.IntegerField(default=180)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='NORMAL')

    def save(self, *args, **kwargs):
        # Auto compute status based on reserve days or quantity if not explicitly set
        if self.reserve_days < 30 or self.quantity < 15:
            self.status = 'CRITICAL'
        elif self.reserve_days < 90 or self.quantity < 40:
            self.status = 'WARNING'
        else:
            self.status = 'NORMAL'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.station.name} - {self.item_name} [{self.status}]"

class Alert(models.Model):
    SEVERITY_CHOICES = [
        ('low', 'low'),
        ('medium', 'medium'),
        ('high', 'high'),
    ]

    station = models.ForeignKey(Station, on_delete=models.CASCADE, related_name='alerts')
    alert_id = models.CharField(max_length=50)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='low')
    title = models.CharField(max_length=200)
    message = models.TextField()
    timestamp = models.CharField(max_length=100, default="Just now")
    category = models.CharField(max_length=100, default="Operational")
    source = models.CharField(max_length=200, blank=True, default='')
    acknowledged = models.BooleanField(default=False)
    resolved = models.BooleanField(default=False)
    related_equipment = models.CharField(max_length=200, blank=True, default='')
    related_simulation = models.IntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.severity.upper()}] {self.station.name}: {self.title}"

class DigitalTwinModule(models.Model):
    TYPE_CHOICES = [
        ('living', 'living'),
        ('energy', 'energy'),
        ('science', 'science'),
        ('comms', 'comms'),
        ('logistics', 'logistics'),
    ]
    STATUS_CHOICES = [
        ('Optimal', 'Optimal'),
        ('Active', 'Active'),
        ('Warning', 'Warning'),
    ]

    station = models.ForeignKey(Station, on_delete=models.CASCADE, related_name='digital_twin_modules')
    module_id = models.CharField(max_length=50)
    name = models.CharField(max_length=150)
    type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Optimal')
    temp = models.CharField(max_length=50, default='+21.0°C')
    power = models.CharField(max_length=50, default='30 kW')
    description = models.TextField()
    x = models.FloatField(default=10.0)
    y = models.FloatField(default=10.0)
    width = models.FloatField(default=30.0)
    height = models.FloatField(default=25.0)

    def __str__(self):
        return f"{self.station.name} Module - {self.name}"

class EnergyHistory(models.Model):
    station = models.ForeignKey(Station, on_delete=models.CASCADE, related_name='energy_history')
    timestamp = models.DateTimeField(auto_now_add=True)
    time_label = models.CharField(max_length=50, default="00:00")
    power_generation_kw = models.FloatField()
    power_consumption_kw = models.FloatField()
    battery_level_percent = models.FloatField()

    def __str__(self):
        return f"{self.station.name} Energy at {self.time_label}"

class EnvironmentHistory(models.Model):
    station = models.ForeignKey(Station, on_delete=models.CASCADE, related_name='environment_history')
    timestamp = models.DateTimeField(auto_now_add=True)
    time_label = models.CharField(max_length=50, default="00:00")
    temperature = models.FloatField()
    wind_speed = models.FloatField()
    air_pressure_hpa = models.FloatField()

    def __str__(self):
        return f"{self.station.name} Environment at {self.time_label}"
