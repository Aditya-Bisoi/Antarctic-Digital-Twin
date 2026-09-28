export type StationId = 'maitri' | 'bharati';

export interface StationData {
  id: StationId;
  name: string;
  region: string;
  coordinates: string;
  status: 'Online' | 'Offline' | 'Maintenance';
  lastPing: string;
  temperature: number; // in °C
  windSpeed: number; // in km/h
  windDirection: string;
  image: string;
  description: string;
  commissionedYear: number;
  elevation: string;
  crewCount: number;
  
  energy: {
    primarySource: string;
    powerGenerationKw: number;
    powerConsumptionKw: number;
    solarGenerationKw: number;
    generatorLoadPercent: number;
    batteryLevelPercent: number;
    dailyUsageKwh: number;
  };

  environment: {
    temperature: number;
    windSpeed: number;
    windChill: number;
    humidityPercent: number;
    airPressureHpa: number;
    uvIndex: number;
    visibilityKm: number;
    snowAccumulationCm: number;
  };

  infrastructure: {
    overallHealthPercent: number;
    lifeSupportStatus: 'Nominal' | 'Warning' | 'Critical';
    heatingSystemStatus: 'Nominal' | 'Warning' | 'Critical';
    waterTreatmentCapacityLpd: number;
    indoorTemp: number;
    satelliteUplinkMbps: number;
    activeSensors: number;
    totalSensors: number;
  };

  logistics: {
    fuelReserveDays: number;
    fuelLevelLiters: number;
    foodRationDays: number;
    waterStorageLiters: number;
    medicalSupplyStatus: 'Full' | 'Good' | 'Restock Needed';
    nextResupplyDate: string;
    expeditionTeam: string;
  };

  digitalTwinModules: TwinModule[];
}

export interface TwinModule {
  id: string;
  name: string;
  type: 'living' | 'energy' | 'science' | 'comms' | 'logistics';
  status: 'Optimal' | 'Active' | 'Warning';
  temp: string;
  power: string;
  description: string;
  x: number; // percentage on schematic
  y: number; // percentage on schematic
  width: number;
  height: number;
}

export interface QuickAccessItem {
  id: string;
  title: string;
  description: string;
  iconName: 'Zap' | 'CloudSnow' | 'Package' | 'Bell';
  category: 'energy' | 'environment' | 'logistics' | 'alerts';
}

export interface StationAlert {
  id: string;
  stationId: StationId;
  stationName: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  timestamp: string;
  category: string;
}
