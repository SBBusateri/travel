import { useEffect, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

interface GoogleMapsLoaderState {
  isLoaded: boolean;
  error: string | null;
}

const REQUIRED_LIBRARIES = ['maps', 'marker', 'places', 'routes', 'geocoding'] as const;
type RequiredLibrary = (typeof REQUIRED_LIBRARIES)[number];

let optionsConfigured = false;
let loaderPromise: Promise<void> | null = null;

const ensureGoogleMapsLoaded = (apiKey: string) => {
  if (!loaderPromise) {
    loaderPromise = (async () => {
      if (!optionsConfigured) {
        setOptions({ key: apiKey, v: 'weekly' });
        optionsConfigured = true;
      }

      await Promise.all(
        REQUIRED_LIBRARIES.map((library) => importLibrary(library as RequiredLibrary))
      );
    })();
  }

  return loaderPromise;
};

export const useGoogleMapsLoader = (apiKey: string) => {
  const [state, setState] = useState<GoogleMapsLoaderState>({
    isLoaded: false,
    error: null,
  });

  useEffect(() => {
    if (!apiKey) {
      setState({
        isLoaded: false,
        error: 'Google Maps API key is required',
      });
      return;
    }

    ensureGoogleMapsLoaded(apiKey)
      .then(() => {
        setState({
          isLoaded: true,
          error: null,
        });
      })
      .catch((err) => {
        console.error('Google Maps failed to load:', err);
        setState({
          isLoaded: false,
          error:
            err instanceof Error ? err.message : 'Failed to load Google Maps API',
        });
      });
  }, [apiKey]);

  return state;
};
