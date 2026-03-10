/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_PLATFORM_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  namespace google {
    namespace maps {
      class Geocoder {
        geocode(
          request: { address?: string; location?: LatLngLiteral },
          callback: (results: GeocoderResult[] | null, status: GeocoderStatus) => void
        ): void;
      }
      
      interface GeocoderResult {
        geometry: {
          location: LatLng;
        };
        formatted_address?: string;
        place_id?: string;
      }
      
      interface LatLng {
        lat(): number;
        lng(): number;
      }
      
      enum GeocoderStatus {
        OK = "OK"
      }
      
      class Map {
        constructor(mapDiv: HTMLElement, opts?: MapOptions);
      }
      
      interface MapOptions {
        center: LatLngLiteral;
        zoom: number;
        mapTypeControl?: boolean;
        streetViewControl?: boolean;
      }
      
      class DirectionsService {
        route(request: DirectionsRequest, callback: (result: DirectionsResult | null, status: DirectionsStatus) => void): void;
      }
      
      class DirectionsRenderer {
        constructor(opts?: DirectionsRendererOptions);
        setDirections(result: DirectionsResult): void;
        setMap(map: Map | null): void;
      }
      
      interface DirectionsRendererOptions {
        map?: Map;
      }
      
      interface DirectionsRequest {
        origin: LatLngLiteral;
        destination: LatLngLiteral;
        waypoints?: DirectionsWaypoint[];
        travelMode: TravelMode;
      }
      
      interface DirectionsWaypoint {
        location: LatLngLiteral;
        stopover: boolean;
      }
      
      interface LatLngLiteral {
        lat: number;
        lng: number;
      }
      
      enum TravelMode {
        DRIVING = "DRIVING"
      }
      
      interface DirectionsResult {
        routes: DirectionsRoute[];
      }
      
      interface DirectionsRoute {
        legs: DirectionsLeg[];
        overview_path: LatLng[];
      }
      
      interface DirectionsLeg {
        distance: {
          value: number;
          text: string;
        };
        duration: {
          value: number;
          text: string;
        };
      }
      
      enum DirectionsStatus {
        OK = "OK"
      }
      
      interface MarkerOptions {
        map?: Map;
        position?: LatLngLiteral;
        title?: string;
      }

      class Marker {
        constructor(opts?: MarkerOptions);
        setMap(map: Map | null): void;
        setPosition(position: LatLngLiteral): void;
      }
      
      function importLibrary(name: string): Promise<unknown>;
    }
  }
}

export {};
