import type { MutableRefObject } from 'react';

export type MarkerCollection = Record<string, google.maps.Marker>;

interface MapMarkerOptions {
  label?: string;
  title?: string;
  zIndex?: number;
}

export const upsertMarker = (
  key: string,
  location: { lat: number; lng: number } | null,
  map: google.maps.Map,
  markersRef: MutableRefObject<MarkerCollection>,
  options: MapMarkerOptions = {}
) => {
  const existing = markersRef.current[key];

  if (!location) {
    if (existing) {
      existing.setMap(null);
      delete markersRef.current[key];
    }
    return;
  }

  if (existing) {
    existing.setMap(null);
    delete markersRef.current[key];
  }

  const markerOptions = {
    map,
    position: location,
    title: options.title,
    zIndex: options.zIndex
  } as google.maps.MarkerOptions;

  if (options.label !== undefined) {
    (markerOptions as google.maps.MarkerOptions & { label: string }).label = options.label;
  }

  markersRef.current[key] = new google.maps.Marker(markerOptions);
};

export const removeMarker = (
  key: string,
  markersRef: MutableRefObject<MarkerCollection>
) => {
  const marker = markersRef.current[key];
  if (marker) {
    marker.setMap(null);
    delete markersRef.current[key];
  }
};

export const syncFuelStopMarkers = (
  map: google.maps.Map,
  markersRef: MutableRefObject<MarkerCollection>,
  gasStops: Array<{
    location: { lat: number; lng: number };
    name: string;
    address: string;
    type: string;
    distanceFromLastMiles?: number;
  }>,
  startingIndex = 1
) => {
  const prefix = 'fuel-';
  const fuelStops = gasStops.filter((stop) => stop.type === 'fuel');
  const desiredKeys = new Set(fuelStops.map((_, index) => `${prefix}${index}`));

  Object.keys(markersRef.current).forEach((markerKey) => {
    if (markerKey.startsWith(prefix) && !desiredKeys.has(markerKey)) {
      removeMarker(markerKey, markersRef);
    }
  });

  fuelStops.forEach((stop, index) => {
    const key = `${prefix}${index}`;
    const distanceLabel =
      typeof stop.distanceFromLastMiles === 'number'
        ? `${Math.round(stop.distanceFromLastMiles)} mi from last stop`
        : null;
    const titleParts = [stop.name, stop.address, distanceLabel].filter(Boolean).join(' • ');

    upsertMarker(
      key,
      stop.location,
      map,
      markersRef,
      {
        label: String(startingIndex + index),
        title: titleParts || `Fuel Stop ${index + 1}`,
        zIndex: 50
      }
    );
  });
};
