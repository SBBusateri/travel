const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiService {
  async getYears() {
    const response = await fetch(`${API_BASE_URL}/vehicles/years`);
    if (!response.ok) throw new Error('Failed to fetch years');
    const { data } = await response.json();
    return data ?? [];
  }

  async getMakes(year: string) {
    const response = await fetch(`${API_BASE_URL}/vehicles/makes?year=${encodeURIComponent(year)}`);
    if (!response.ok) throw new Error('Failed to fetch makes');
    const { data } = await response.json();
    return data ?? [];
  }

  async getModels(year: string, make: string) {
    const params = new URLSearchParams({ year, make });
    const response = await fetch(`${API_BASE_URL}/vehicles/models?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch models');
    const { data } = await response.json();
    return data ?? [];
  }

  async getTrims(year: string, make: string, model: string) {
    const params = new URLSearchParams({ year, make, model });
    const response = await fetch(`${API_BASE_URL}/vehicles/trims?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch trims');
    const { data } = await response.json();
    return data ?? [];
  }

  async getVehicleInfo(params: {
    year: string;
    make: string;
    model: string;
    trim?: string;
  }) {
    const searchParams = new URLSearchParams({
      year: params.year,
      make: params.make,
      model: params.model,
    });

    if (params.trim) {
      searchParams.set('trim', params.trim);
    }

    const response = await fetch(`${API_BASE_URL}/vehicles?${searchParams.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch vehicle info');
    const { data } = await response.json();
    return data ?? null;
  }

  async calculateRoute(data: {
    startLocation: string;
    endLocation: string;
    adjustedRange: number;
  }) {
    const response = await fetch(`${API_BASE_URL}/calculate-route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) throw new Error('Failed to calculate route');
    return response.json();
  }

  async getGasStops(data: {
    start: { lat: number; lng: number; address?: string };
    destination: { lat: number; lng: number; address?: string };
    adjustedRangeMiles: number;
    departureTime?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/routes/gas-stops`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to compute gas stops');
    return response.json();
  }

  async checkHealth() {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) throw new Error('Health check failed');
    return response.json();
  }
}

export const apiService = new ApiService();
