import { StationData, StationAlert } from '../types';
import { STATIONS, MOCK_ALERTS } from '../data/mockData';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

export interface SimulationResponse {
  stationId: string;
  stationName: string;
  result: {
    scenario: string;
    batteryImpact: string;
    backupDuration: string;
    riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
    recommendedActions: string[];
    projectedBatteryIn24h?: number;
    projectedTempDrop?: string;
  };
}

export interface AIInsight {
  type: 'energy' | 'environment' | 'infrastructure' | 'logistics';
  severity: 'nominal' | 'medium' | 'high';
  title: string;
  message: string;
}

export interface StationDashboardData extends StationData {
  aiInsights?: AIInsight[];
  infrastructureItems?: Array<{
    id: number;
    name: string;
    category: string;
    status: string;
    healthPercent: number;
  }>;
  logisticsItems?: Array<{
    id: number;
    itemName: string;
    quantity: number;
    unit: string;
    reserveDays: number;
    status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  }>;
  alerts?: StationAlert[];
}

export const api = {
  /**
   * Fetch list of all stations
   */
  async getStations(): Promise<StationData[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/stations/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('API connection failed, using local station data:', err);
      return Object.values(STATIONS);
    }
  },

  /**
   * Fetch single station details & dashboard payload
   */
  async getStationDashboard(stationId: string): Promise<StationDashboardData> {
    const key = (stationId.toLowerCase() === 'bharati' ? 'bharati' : 'maitri') as 'maitri' | 'bharati';
    try {
      const res = await fetch(`${API_BASE_URL}/stations/${key}/dashboard/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn(`API connection failed for ${key}, using fallback data:`, err);
      return STATIONS[key];
    }
  },

  /**
   * Fetch station alerts
   */
  async getAlerts(stationId?: string): Promise<StationAlert[]> {
    try {
      const url = stationId 
        ? `${API_BASE_URL}/stations/${stationId}/alerts/`
        : `${API_BASE_URL}/alerts/`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('API alerts fetch failed, using fallback alerts:', err);
      return MOCK_ALERTS;
    }
  },

  /**
   * Run What-If simulation for a station
   */
  async runSimulation(stationId: string, scenario: string): Promise<SimulationResponse> {
    const key = (stationId.toLowerCase() === 'bharati' ? 'bharati' : 'maitri') as 'maitri' | 'bharati';
    const res = await fetch(`${API_BASE_URL}/stations/${key}/simulate/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    });
    if (!res.ok) {
      throw new Error(`SIMULATION_BACKEND_UNAVAILABLE: Failed to run simulation against backend (HTTP ${res.status})`);
    }
    return await res.json();
  },

  // --------------------------------------------------------------------------
  // Server-Side Digital Twin & Simulation APIs
  // --------------------------------------------------------------------------

  async getScenarios(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/scenarios/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Failed to fetch scenarios from backend:', err);
      return [];
    }
  },

  async getInterventions(simulationId?: number | string): Promise<any[]> {
    try {
      const url = simulationId
        ? `${API_BASE_URL}/interventions/?simulation=${simulationId}`
        : `${API_BASE_URL}/interventions/`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Failed to fetch interventions from backend:', err);
      return [];
    }
  },

  async createSimulationRun(stationId: string, scenarioId?: string, name?: string, params?: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/simulations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station: stationId,
          scenario: scenarioId,
          name: name || '',
          scenarioParameters: params || {},
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Failed to create simulation run on backend:', err);
      return null;
    }
  },

  async advanceSimulation(runId: number | string, hours: number = 1.0): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/simulations/${runId}/advance/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to advance simulation ${runId}:`, err);
      return null;
    }
  },

  async getSimulationState(runId: number | string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/simulations/${runId}/state/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch simulation state ${runId}:`, err);
      return null;
    }
  },

  async getSimulationRadar(runId: number | string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/simulations/${runId}/radar/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch simulation radar ${runId}:`, err);
      return null;
    }
  },

  async getSimulationEvents(runId: number | string): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/simulations/${runId}/events/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch simulation events ${runId}:`, err);
      return [];
    }
  },

  async getSimulationHistory(runId: number | string): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/simulations/${runId}/history/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch simulation history ${runId}:`, err);
      return [];
    }
  },

  async getSimulationRisk(runId: number | string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/simulations/${runId}/risk/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch simulation risk ${runId}:`, err);
      return null;
    }
  },

  async getSimulationResilience(runId: number | string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/simulations/${runId}/resilience/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch simulation resilience ${runId}:`, err);
      return null;
    }
  },

  async getSimulationPredictions(runId: number | string): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/simulations/${runId}/predictions/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch simulation predictions ${runId}:`, err);
      return [];
    }
  },

  async applySimulationIntervention(runId: number | string, interventionId: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/simulations/${runId}/interventions/apply/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interventionId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to apply intervention ${interventionId} to ${runId}:`, err);
      return null;
    }
  },

  async revertSimulationIntervention(runId: number | string, interventionId: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/simulations/${runId}/interventions/revert/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interventionId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to revert intervention ${interventionId} on ${runId}:`, err);
      return null;
    }
  },

  async optimizeSimulation(runId: number | string, horizonHours: number = 24, weights?: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/simulations/${runId}/optimize/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horizon_hours: horizonHours, weights }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to optimize simulation ${runId}:`, err);
      return null;
    }
  },

  async getDecisionSupport(runId: number | string, horizonHours: number = 24, weights?: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/simulations/${runId}/decision-support/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horizon_hours: horizonHours, weights }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch decision support for ${runId}:`, err);
      return null;
    }
  },

  async getCandidateInterventions(runId: number | string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/simulations/${runId}/candidate-interventions/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch candidate interventions for ${runId}:`, err);
      return null;
    }
  },

  async getEquipmentPrediction(stationId: string, equipmentId: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/stations/${stationId}/equipment/${equipmentId}/prediction/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch prediction for ${equipmentId}:`, err);
      return null;
    }
  },

  async injectIncident(runId: number | string, incidentData: { incidentType: string; description?: string; severity?: string; parameters?: any }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/simulations/${runId}/incidents/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incidentData),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  async resolveIncident(runId: number | string, incidentId: number | string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/simulations/${runId}/incidents/${incidentId}/resolve/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  async getStationHistory(stationId: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/stations/${stationId}/history/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch history for ${stationId}:`, err);
      return null;
    }
  },

  async getSimulationInsights(runId: number | string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/simulations/${runId}/insights/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch insights for simulation ${runId}:`, err);
      return null;
    }
  },

  async getSimulationReport(runId: number | string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/simulations/${runId}/report/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch report for simulation ${runId}:`, err);
      return null;
    }
  },

  async compareSimulation(runId: number | string, interventions: string[], fromHour?: number): Promise<any> {
    try {
      const body: any = { interventions };
      if (fromHour !== undefined) {
        body.from_hour = fromHour;
      }
      const res = await fetch(`${API_BASE_URL}/simulations/${runId}/compare/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to compare simulation ${runId}:`, err);
      return null;
    }
  },

  async getStationEquipment(stationId: string): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/stations/${stationId}/equipment/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch equipment for ${stationId}:`, err);
      return [];
    }
  },

  async getStationPredictions(stationId: string): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/stations/${stationId}/predictions/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch predictions for ${stationId}:`, err);
      return [];
    }
  },

  async getStationRecommendations(stationId: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/stations/${stationId}/recommendations/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch recommendations for ${stationId}:`, err);
      return null;
    }
  },

  async sendRadarStormEvent(params?: {
    stationId?: string;
    simulationId?: string | number;
    scenarioId?: string;
    distanceKm?: number;
    windSpeedKmh?: number;
    etaHours?: number;
    severity?: string;
    hazardType?: string;
    confidence?: number;
    source?: string;
    isSimulated?: boolean;
    eventId?: string;
    forceFresh?: boolean;
  }): Promise<any> {
    const payload = {
      station_id: params?.stationId || 'maitri',
      simulation_id: params?.simulationId ? String(params.simulationId) : undefined,
      scenario_id: params?.scenarioId || 'antarctic_storm',
      hazard_type: params?.hazardType || 'STORM',
      distance_km: params?.distanceKm ?? 180,
      wind_speed_kmh: params?.windSpeedKmh ?? 115,
      estimated_arrival_hours: params?.etaHours ?? 4,
      severity: params?.severity || 'HIGH',
      confidence: params?.confidence ?? 0.95,
      source: params?.source || 'Polar Doppler Radar MK-IV',
      is_simulated: params?.isSimulated ?? true,
      event_id: params?.eventId,
      force_fresh: params?.forceFresh ?? true,
    };
    const res = await fetch(`${API_BASE_URL}/radar/events/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Radar event failed: HTTP ${res.status}`);
    return await res.json();
  },

  async applyPlanInterventions(runId: number | string, interventions: string[]): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/simulations/${runId}/interventions/apply/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interventions }),
    });
    if (!res.ok) throw new Error(`Applying interventions failed: HTTP ${res.status}`);
    return await res.json();
  },
};

