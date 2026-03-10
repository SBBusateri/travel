import { useRef, useEffect } from 'react';
import { useGoogleMapsLoader } from '@/hooks/useGoogleMapsLoader';
import { MapLocation, GasStop } from '@/types/googleMaps';
import { calculateRoute } from '@/components/routeService';
import { upsertMarker, MarkerCollection, syncFuelStopMarkers } from '@/components/mapMarkers';

interface GoogleMapComponentProps {
  startLocation: MapLocation | null;
  destinationLocation: MapLocation | null;
  stopLocation?: MapLocation | null;
  fuelStops?: GasStop[];
  onRouteCalculated?: (route: google.maps.DirectionsResult) => void;
  onMapReady?: (map: google.maps.Map) => void;
  className?: string;
}

const GoogleMapComponent = ({
  startLocation,
  destinationLocation,
  stopLocation = null,
  fuelStops = [],
  onRouteCalculated,
  onMapReady,
  className = ''
}: GoogleMapComponentProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const markersRef = useRef<MarkerCollection>({});
  const lastRouteRequestRef = useRef<string | null>(null);

  const { isLoaded, error } = useGoogleMapsLoader(
    import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_API_KEY
  );

  // Initialize map once
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return;

    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 39.8283, lng: -98.5795 },
      zoom: 4,
      mapTypeControl: false,
      streetViewControl: false
    });

    mapInstanceRef.current = map;
    directionsServiceRef.current = new google.maps.DirectionsService();
    const rendererOptions = { map, suppressMarkers: true } as google.maps.DirectionsRendererOptions;
    const renderer = new google.maps.DirectionsRenderer(rendererOptions);
    directionsRendererRef.current = renderer;

    onMapReady?.(map);
  }, [isLoaded, onMapReady]);

  // Update markers when inputs change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    upsertMarker(
      'start',
      startLocation
        ? { lat: startLocation.lat, lng: startLocation.lng }
        : null,
      map,
      markersRef,
      {
        label: 'S',
        title: startLocation?.address ?? 'Start',
        zIndex: 100
      }
    );

    let nextLabelIndex = 1;

    if (stopLocation) {
      upsertMarker(
        'stop',
        { lat: stopLocation.lat, lng: stopLocation.lng },
        map,
        markersRef,
        {
          label: String(nextLabelIndex),
          title: stopLocation.address ?? 'Stopover',
          zIndex: 90
        }
      );
      nextLabelIndex += 1;
    } else {
      upsertMarker('stop', null, map, markersRef);
    }

    const fuelStopCount = (fuelStops ?? []).filter((stop) => stop.type === 'fuel').length;
    const destinationLabel = String(nextLabelIndex + fuelStopCount);

    upsertMarker(
      'destination',
      destinationLocation
        ? { lat: destinationLocation.lat, lng: destinationLocation.lng }
        : null,
      map,
      markersRef,
      {
        label: destinationLabel,
        title: destinationLocation?.address ?? 'Destination',
        zIndex: 100
      }
    );
  }, [startLocation, destinationLocation, stopLocation, fuelStops]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const startIndex = 1 + (stopLocation ? 1 : 0);
    syncFuelStopMarkers(map, markersRef, fuelStops ?? [], startIndex);
  }, [fuelStops, stopLocation]);

  // Calculate and render routes when inputs change
  useEffect(() => {
    const directionsService = directionsServiceRef.current;
    const directionsRenderer = directionsRendererRef.current;

    if (!directionsService || !directionsRenderer) return;

    if (!startLocation || !destinationLocation) {
      lastRouteRequestRef.current = null;
      directionsRenderer.setDirections({ routes: [] } as google.maps.DirectionsResult);
      return;
    }

    const origin = { lat: startLocation.lat, lng: startLocation.lng };
    const destination = { lat: destinationLocation.lat, lng: destinationLocation.lng };
    const waypointList: google.maps.DirectionsWaypoint[] = [];

    if (stopLocation) {
      waypointList.push({
        location: { lat: stopLocation.lat, lng: stopLocation.lng },
        stopover: true
      });
    }

    fuelStops
      ?.filter((stop) => stop.type === 'fuel')
      .forEach((stop) => {
        waypointList.push({
          location: { lat: stop.location.lat, lng: stop.location.lng },
          stopover: true
        });
      });

    const cacheKey = `${origin.lat},${origin.lng}|${destination.lat},${destination.lng}|${stopLocation?.lat ?? ''},${stopLocation?.lng ?? ''}|${fuelStops
      .filter((stop) => stop.type === 'fuel')
      .map((stop) => `${stop.location.lat},${stop.location.lng}`)
      .join(';')}`;

    if (lastRouteRequestRef.current === cacheKey) return;
    lastRouteRequestRef.current = cacheKey;

    void (async () => {
      try {
        const result = await calculateRoute(directionsService, origin, destination, waypointList.length ? waypointList : undefined);
        directionsRenderer.setDirections(result);
        (directionsRenderer as google.maps.DirectionsRenderer & {
          set?: (key: string, value: unknown) => void;
        }).set?.('suppressMarkers', true);
        onRouteCalculated?.(result);
      } catch (err) {
        console.error('Route error:', err);
        lastRouteRequestRef.current = null;
      }
    })();
  }, [startLocation, destinationLocation, stopLocation, fuelStops, onRouteCalculated]);

  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!isLoaded) return <div className="p-4">Loading map...</div>;

  return (
    <div
      ref={mapRef}
      className={`w-full h-full ${className}`}
      style={{ minHeight: '400px' }}
    />
  );
}
;

export default GoogleMapComponent;
