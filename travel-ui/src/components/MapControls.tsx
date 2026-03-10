import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { LocateFixed, Plus, Trash2 } from 'lucide-react';
import { MapLocation, MapControlsProps } from '@/types/googleMaps';
import { cn } from '@/lib/utils';

type UiSuggestion = {
  placeId: string;
  description: string;
};

const MapControls = ({
  startLocation,
  destinationLocation,
  stopLocation,
  onStartLocationChange,
  onDestinationChange,
  onStopChange,
  showValidation = false,
  isStartInvalid = false,
  isDestinationInvalid = false
}: MapControlsProps) => {
  const [startInput, setStartInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [stopInput, setStopInput] = useState('');
  const [startSuggestions, setStartSuggestions] = useState<UiSuggestion[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<UiSuggestion[]>([]);
  const [stopSuggestions, setStopSuggestions] = useState<UiSuggestion[]>([]);
  const [locating, setLocating] = useState<{ start: boolean; destination: boolean; stop: boolean }>({
    start: false,
    destination: false,
    stop: false
  });
  const [stopActive, setStopActive] = useState(Boolean(stopLocation));

  const startDebounceRef = useRef<number | null>(null);
  const destinationDebounceRef = useRef<number | null>(null);
  const stopDebounceRef = useRef<number | null>(null);
  const startRequestIdRef = useRef(0);
  const destinationRequestIdRef = useRef(0);
  const stopRequestIdRef = useRef(0);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const sessionToken = useMemo(() => uuidv4(), []);

  const startHasError = showValidation && isStartInvalid;
  const destinationHasError = showValidation && isDestinationInvalid;

  const buildQueryParams = (params: Record<string, string>): string => {
    const query = new URLSearchParams({ ...params, sessionToken });
    return query.toString();
  };

  const fetchAutocomplete = async (input: string): Promise<UiSuggestion[]> => {
    const res = await fetch(`/api/places/autocomplete?${buildQueryParams({ input })}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Autocomplete failed');
    return data.suggestions || [];
  };

  const fetchDetails = async (placeId: string): Promise<MapLocation> => {
    const res = await fetch(`/api/places/details?${buildQueryParams({ placeId })}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Details failed');

    return {
      lat: data.location.latitude,
      lng: data.location.longitude,
      address: data.address,
      placeId
    };
  };

  const getGeocoder = () => {
    if (typeof window === 'undefined' || !window.google?.maps?.Geocoder) {
      throw new Error('Google Maps Geocoder is not available');
    }

    if (!geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }

    return geocoderRef.current;
  };

  const reverseGeocode = async (location: google.maps.LatLngLiteral): Promise<MapLocation> => {
    const geocoder = getGeocoder();

    return new Promise((resolve, reject) => {
      geocoder.geocode({ location }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
          const result = results[0];
          resolve({
            lat: location.lat,
            lng: location.lng,
            address: result.formatted_address,
            placeId: result.place_id
          });
        } else {
          reject(new Error('Unable to determine your address.'));
        }
      });
    });
  };

  const handleLocate = (type: 'start' | 'destination' | 'stop') => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported in this browser.');
      return;
    }

    setLocating((prev) => ({ ...prev, [type]: true }));

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const location = await reverseGeocode({ lat: latitude, lng: longitude });

          if (type === 'start') {
            setStartInput(location.address);
            setStartSuggestions([]);
            onStartLocationChange(location);
          } else if (type === 'destination') {
            setDestinationInput(location.address);
            setDestinationSuggestions([]);
            onDestinationChange(location);
          } else {
            setStopInput(location.address);
            setStopSuggestions([]);
            onStopChange(location);
            setStopActive(true);
          }
        } catch (err) {
          console.error('Locate me failed:', err);
        } finally {
          setLocating((prev) => ({ ...prev, [type]: false }));
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocating((prev) => ({ ...prev, [type]: false }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const debounce = (callback: () => void, ref: MutableRefObject<number | null>) => {
    if (ref.current) window.clearTimeout(ref.current);
    ref.current = window.setTimeout(callback, 250);
  };

  const handleStartChange = (value: string) => {
    setStartInput(value);
    const trimmed = value.trim();

    if (!trimmed) {
      setStartSuggestions([]);
      onStartLocationChange(null);
      return;
    }

    if (trimmed.length < 3) {
      setStartSuggestions([]);
      return;
    }

    debounce(async () => {
      const requestId = ++startRequestIdRef.current;
      try {
        const suggestions = await fetchAutocomplete(trimmed);
        if (startRequestIdRef.current === requestId) {
          setStartSuggestions(suggestions);
        }
      } catch (err) {
        console.error('Start autocomplete failed:', err);
        if (startRequestIdRef.current === requestId) {
          setStartSuggestions([]);
        }
      }
    }, startDebounceRef);
  };

  const handleDestinationChange = (value: string) => {
    setDestinationInput(value);
    const trimmed = value.trim();

    if (!trimmed) {
      setDestinationSuggestions([]);
      onDestinationChange(null);
      return;
    }

    if (trimmed.length < 3) {
      setDestinationSuggestions([]);
      return;
    }

    debounce(async () => {
      const requestId = ++destinationRequestIdRef.current;
      try {
        const suggestions = await fetchAutocomplete(trimmed);
        if (destinationRequestIdRef.current === requestId) {
          setDestinationSuggestions(suggestions);
        }
      } catch (err) {
        console.error('Destination autocomplete failed:', err);
        if (destinationRequestIdRef.current === requestId) {
          setDestinationSuggestions([]);
        }
      }
    }, destinationDebounceRef);
  };

  const selectStart = async (suggestion: UiSuggestion) => {
    const location = await fetchDetails(suggestion.placeId);
    setStartInput(location.address);
    setStartSuggestions([]);
    onStartLocationChange(location);
  };

  const selectDestination = async (suggestion: UiSuggestion) => {
    const location = await fetchDetails(suggestion.placeId);
    setDestinationInput(location.address);
    setDestinationSuggestions([]);
    onDestinationChange(location);
  };

  const handleStopChangeInput = (value: string) => {
    setStopInput(value);
    const trimmed = value.trim();

    if (!trimmed) {
      setStopSuggestions([]);
      return;
    }

    if (trimmed.length < 3) {
      setStopSuggestions([]);
      return;
    }

    debounce(async () => {
      const requestId = ++stopRequestIdRef.current;
      try {
        const suggestions = await fetchAutocomplete(trimmed);
        if (stopRequestIdRef.current === requestId) {
          setStopSuggestions(suggestions);
        }
      } catch (err) {
        console.error('Stop autocomplete failed:', err);
        if (stopRequestIdRef.current === requestId) {
          setStopSuggestions([]);
        }
      }
    }, stopDebounceRef);
  };

  const selectStop = async (suggestion: UiSuggestion) => {
    const location = await fetchDetails(suggestion.placeId);
    setStopInput(location.address);
    setStopSuggestions([]);
    onStopChange(location);
    setStopActive(true);
  };

  useEffect(() => {
    if (startLocation) setStartInput(startLocation.address);
  }, [startLocation]);

  useEffect(() => {
    if (destinationLocation) setDestinationInput(destinationLocation.address);
  }, [destinationLocation]);

  useEffect(() => {
    if (stopLocation) {
      setStopActive(true);
      setStopInput(stopLocation.address);
    } else {
      setStopInput('');
      setStopSuggestions([]);
      setStopActive(false);
    }
  }, [stopLocation]);

  useEffect(() => {
    return () => {
      if (startDebounceRef.current) window.clearTimeout(startDebounceRef.current);
      if (destinationDebounceRef.current) window.clearTimeout(destinationDebounceRef.current);
      if (stopDebounceRef.current) window.clearTimeout(stopDebounceRef.current);
    };
  }, []);

  const renderLocateButton = (type: 'start' | 'destination' | 'stop') => (
    <button
      type="button"
      onClick={() => handleLocate(type)}
      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-full bg-white/70 hover:bg-white text-primary shadow transition-colors w-9 h-9"
      aria-label={
        type === 'start'
          ? 'Use my current location for start'
          : type === 'destination'
            ? 'Use my current location for destination'
            : 'Use my current location for stop'
      }
    >
      {locating[type] ? (
        <span className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      ) : (
        <LocateFixed className="h-4 w-4" />
      )}
    </button>
  );

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/20 backdrop-blur-xl shadow-2xl border border-white/30 text-slate-900">
      {/* START INPUT */}
      <div>
        <div className="relative">
          <input
            value={startInput}
            onChange={(e) => handleStartChange(e.target.value)}
            placeholder="Starting location"
            aria-label="Starting location"
            className={cn(
              "w-full px-3.5 py-2.5 pr-10 rounded-xl border bg-white/35 text-sm text-slate-900 placeholder:text-slate-500 focus:bg-white/90 shadow-sm transition",
              startHasError
                ? "border-destructive/80 ring-1 ring-destructive/40 focus:border-destructive"
                : "border-white/40 focus:border-primary"
            )}
            aria-invalid={startHasError}
            required
          />
          {renderLocateButton('start')}
          {startSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white/85 backdrop-blur rounded-xl shadow-xl border border-white/60 max-h-60 overflow-y-auto animate-fade-in">
              {startSuggestions.map((s) => (
                <div
                  key={s.placeId}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    void selectStart(s);
                  }}
                  className="px-4 py-2 text-sm text-slate-800 hover:bg-primary/5 cursor-pointer transition"
                >
                  {s.description}
                </div>
              ))}
            </div>
          )}
        </div>
        {startHasError && (
          <p className="mt-1 text-xs text-destructive">Starting location is required.</p>
        )}
      </div>

      {/* ADD STOP BUTTON */}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (stopActive) {
              onStopChange(null);
              setStopInput('');
              setStopSuggestions([]);
              setStopActive(false);
            } else {
              setStopActive(true);
            }
          }}
          className="w-full inline-flex items-center justify-between gap-2 text-sm font-medium text-slate-900 bg-white/35 hover:bg-white/60 px-3.5 py-1.75 rounded-xl transition"
        >
          <span className="inline-flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" />
            Add stop
          </span>
        </button>
      </div>

      {/* STOP INPUT */}
      {stopActive && (
        <div>
          <div className="relative">
            <input
              value={stopInput}
              onChange={(e) => handleStopChangeInput(e.target.value)}
              placeholder="Stop location"
              aria-label="Trip stop"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-white/40 bg-white/35 text-sm text-slate-900 placeholder:text-slate-500 focus:bg-white/90 focus:border-primary shadow-sm transition"
            />
            <div className="absolute left-2 top-1/2 -translate-y-1/2">
              <Trash2
                className="h-4 w-4 cursor-pointer text-slate-500 hover:text-destructive"
                onClick={() => {
                  onStopChange(null);
                  setStopInput('');
                  setStopSuggestions([]);
                  setStopActive(false);
                }}
                aria-label="Remove stop"
              />
            </div>
            <button
              type="button"
              onClick={() => handleLocate('stop')}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-full bg-white/70 hover:bg-white text-primary shadow transition-colors w-9 h-9"
              aria-label="Use my current location for stop"
            >
              {locating.stop ? (
                <span className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <LocateFixed className="h-4 w-4" />
              )}
            </button>
            {stopSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-white/85 backdrop-blur rounded-xl shadow-xl border border-white/60 max-h-60 overflow-y-auto animate-fade-in">
                {stopSuggestions.map((s) => (
                  <div
                    key={s.placeId}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      void selectStop(s);
                    }}
                    className="px-4 py-2 text-sm text-slate-800 hover:bg-primary/5 cursor-pointer transition"
                  >
                    {s.description}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DESTINATION INPUT */}
      <div>
        <div className="relative">
          <input
            value={destinationInput}
            onChange={(e) => handleDestinationChange(e.target.value)}
            placeholder="Destination"
            aria-label="Destination"
            className={cn(
              "w-full px-3.5 py-2.5 pr-10 rounded-xl border bg-white/35 text-sm text-slate-900 placeholder:text-slate-500 focus:bg-white/90 shadow-sm transition",
              destinationHasError
                ? "border-destructive/80 ring-1 ring-destructive/40 focus:border-destructive"
                : "border-white/40 focus:border-primary"
            )}
            aria-invalid={destinationHasError}
            required
          />
          {renderLocateButton('destination')}
          {destinationSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white/85 backdrop-blur rounded-xl shadow-xl border border-white/60 max-h-60 overflow-y-auto animate-fade-in">
              {destinationSuggestions.map((s) => (
                <div
                  key={s.placeId}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    void selectDestination(s);
                  }}
                  className="px-4 py-2 text-sm text-slate-800 hover:bg-primary/5 cursor-pointer transition"
                >
                  {s.description}
                </div>
              ))}
            </div>
          )}
        </div>
        {destinationHasError && (
          <p className="mt-1 text-xs text-destructive">Destination is required.</p>
        )}
      </div>
    </div>
  );
};

export default MapControls;
