import { RouteData, GasStop, GoogleMapsInstance, Location } from '@/types/googleMaps';

export class RouteCalculatorService {
  constructor(private googleMaps: GoogleMapsInstance) {}

  private async geocodeAddress(address: string): Promise<Location | null> {
    return new Promise((resolve) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const location = results[0].geometry.location;
          resolve({ lat: location.lat(), lng: location.lng() });
        } else {
          resolve(null);
        }
      });
    });
  }

  async calculateRoute(
    startInput: string,
    endInput: string,
    stops: string[],
    adjustedRange?: number
  ): Promise<{ routeData: RouteData; gasStops: GasStop[] } | null> {
    try {
      const startLocation = await this.geocodeAddress(startInput);
      const endLocation = await this.geocodeAddress(endInput);

      if (!startLocation || !endLocation) {
        return null;
      }

      const waypoints = [];
      // Add stops as waypoints if they exist
      for (const stop of stops) {
        if (stop.trim()) {
          const stopLocation = await this.geocodeAddress(stop);
          if (stopLocation) {
            waypoints.push({
              location: { lat: stopLocation.lat, lng: stopLocation.lng },
              stopover: true
            });
          }
        }
      }

      const request = {
        origin: { lat: startLocation.lat, lng: startLocation.lng },
        destination: { lat: endLocation.lat, lng: endLocation.lng },
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING
      };

      return new Promise((resolve) => {
        this.googleMaps.directionsService.route(request, (result: google.maps.DirectionsResult, status: google.maps.DirectionsStatus) => {
          if (status === 'OK' && result.routes[0]) {
            const route = result.routes[0];
            const leg = route.legs[0];
            
            const distance = leg.distance.value / 1609.34; // Convert meters to miles
            
            const routeData: RouteData = {
              distance,
              duration: leg.duration.value / 3600, // Convert seconds to hours
              geometry: route.overview_path
            };

            // Calculate gas stops
            const gasStops = this.predictGasStops(route, distance, adjustedRange);

            resolve({ routeData, gasStops });
          } else {
            resolve(null);
          }
        });
      });
    } catch (error) {
      return null;
    }
  }

  private predictGasStops(route: google.maps.DirectionsRoute, totalDistanceMiles: number, adjustedRange?: number): GasStop[] {
    const range = adjustedRange || 300;
    const adjusted = Math.max(50, range - 50);

    const WINDOW_BEFORE = 20;
    const WINDOW_AFTER = 10;
    const MAX_STOPS = 10;

    const stops: GasStop[] = [];

    if (totalDistanceMiles <= adjusted) {
      return stops;
    }

    // Find gas stations along route (simplified for Google Maps)
    // This would need to be implemented with Google Places API
    // For now, creating placeholder stops
    const numStops = Math.ceil(totalDistanceMiles / adjusted);
    
    for (let i = 1; i < numStops && i <= MAX_STOPS; i++) {
      const targetMile = i * adjusted;
      
      const stop: GasStop = {
        id: `gas-${i}`,
        name: `Gas Station ${i}`,
        position: [0, 0], // Would be calculated from route geometry
        distanceFromStart: Math.round(targetMile),
        distanceFromLast: adjusted,
        vicinity: `Gas Station at mile ${targetMile}`,
        price: (Math.random() * 0.5 + 3.5).toFixed(2),
        estimatedArrival: new Date(Date.now() + targetMile * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fuelRemaining: Math.max(0, 50 - (targetMile % 200)),
      };

      stops.push(stop);
    }

    return stops;
  }
}
