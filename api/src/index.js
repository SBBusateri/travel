import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import VehicleDataService from './services/VehicleDataService.js';
import CarRangeModel from './models/CarRangeModel.js';
import vehicleRouter from './routes/vehicleRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const isVercelDeployment = Boolean(process.env.VERCEL);
const shouldDisableTensorflow = (process.env.DISABLE_TF ?? '').toLowerCase() === 'true'
  || (process.env.ENABLE_TF ?? '').toLowerCase() === 'false'
  || isVercelDeployment;
const state = globalThis.__travelAppState ?? (globalThis.__travelAppState = {
  carModel: globalThis.__travelAppState?.carModel ?? null,
  rangeModel: globalThis.__travelAppState?.rangeModel ?? null,
  tfInstance: globalThis.__travelAppState?.tfInstance ?? null,
  tfLoadPromise: globalThis.__travelAppState?.tfLoadPromise ?? null,
  initializationPromise: globalThis.__travelAppState?.initializationPromise ?? null,
  initializationError: globalThis.__travelAppState?.initializationError ?? null,
  initialized: globalThis.__travelAppState?.initialized ?? false,
  rangeModelTrained: globalThis.__travelAppState?.rangeModelTrained ?? false
});

const METERS_PER_MILE = 1609.34;
const GAS_SEARCH_RADII_METERS = [8046, 16093, 24140, 32186, 48280]; // 5, 10, 15, 20, 30 miles
const ROUTE_DEVIATION_MILES = 12;
const SEARCH_OFFSETS_METERS = [0, -8046, 8046, -16093, 16093, -24140, 24140];
const MIN_STOP_SPACING_MILES = 25;
const MIN_PROGRESS_METERS = METERS_PER_MILE; // Ensure loop advances at least 1 mile
const EARLY_STOP_TARGET_MILES = 1.2;
const EARLY_STOP_MAX_MILES = 8;
const EARLY_STOP_MIN_PROGRESS_METERS = METERS_PER_MILE * 0.25;
const WEEK_MINUTES = 7 * 24 * 60;
const DEFAULT_SPEED_MPS = 26.8224; // ~60 mph
const OVERNIGHT_START_HOUR = 23;
const OVERNIGHT_END_HOUR = 6;
const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.location',
  'places.types',
  'places.regularOpeningHours.periods.open.day',
  'places.regularOpeningHours.periods.open.hour',
  'places.regularOpeningHours.periods.open.minute',
  'places.regularOpeningHours.periods.close.day',
  'places.regularOpeningHours.periods.close.hour',
  'places.regularOpeningHours.periods.close.minute',
  'places.regularOpeningHours.weekdayDescriptions',
  'places.currentOpeningHours.openNow'
].join(',');

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:8080'
  ].filter(Boolean),
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/vehicles', vehicleRouter);

async function loadTensorFlowModule() {
  if (shouldDisableTensorflow) {
    return null;
  }

  if (!state.tfLoadPromise) {
    state.tfLoadPromise = import('@tensorflow/tfjs-node')
      .then((module) => {
        const tf = module?.default ?? module;
        state.tfInstance = tf;
        return tf;
      })
      .catch((error) => {
        console.warn('TensorFlow module failed to load, continuing without ML predictions.', error);
        state.tfInstance = null;
        return null;
      });
  }

  return state.tfLoadPromise;
}

async function createTensorFlowModel(tf) {
  if (!tf) {
    return null;
  }

  const vehicleData = VehicleDataService.getAllVehicles('cars');
  if (!vehicleData.length) {
    return null;
  }

  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 10, inputShape: [4], activation: 'relu' }));
  model.add(tf.layers.dense({ units: 3, activation: 'linear' }));
  model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

  const inputs = vehicleData.map((d) => [
    d.year - 1980,
    hashString(d.make),
    hashString(d.model),
    hashString(d.engine || ''),
  ]);
  const outputs = vehicleData.map((d) => [d.horsepower, d.mpg, d.gasTankSize || 0]);

  const xs = tf.tensor2d(inputs);
  const ys = tf.tensor2d(outputs);

  await model.fit(xs, ys, { epochs: 50, shuffle: true });

  xs.dispose();
  ys.dispose();

  console.log('TensorFlow model trained for cars');
  return model;
}

async function initializeServices() {
  if (state.initialized) {
    return;
  }

  if (state.initializationPromise) {
    return state.initializationPromise;
  }

  const initPromise = (async () => {
    try {
      await VehicleDataService.initialize();

      if (!state.rangeModel) {
        state.rangeModel = new CarRangeModel();
      }

      if (!state.rangeModelTrained) {
        const trainingData = [
          { weight: 0, actualMpgReduction: 0 },
          { weight: 100, actualMpgReduction: 0.5 },
          { weight: 200, actualMpgReduction: 1.0 },
          { weight: 300, actualMpgReduction: 1.5 },
          { weight: 400, actualMpgReduction: 2.0 }
        ];
        state.rangeModel.train(trainingData, 100);
        state.rangeModelTrained = true;
        console.log('Range model trained');
      }

      const tf = await loadTensorFlowModule();
      if (tf) {
        state.carModel = await createTensorFlowModel(tf);
      } else {
        state.carModel = null;
      }

      state.initialized = true;
      state.initializationError = null;
    } catch (error) {
      state.initializationError = error;
      throw error;
    }
  })();

  state.initializationPromise = initPromise;

  try {
    await initPromise;
  } finally {
    state.initializationPromise = null;
  }

  return initPromise;
}

async function ensureInitialized() {
  if (state.initialized) {
    return;
  }

  await initializeServices();
}

function withInitialization(handler) {
  return async (req, res, next) => {
    try {
      await ensureInitialized();
      return handler(req, res, next);
    } catch (error) {
      if (!state.initializationError) {
        state.initializationError = error;
      }
      next(error);
    }
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
  }
  return hash % 100 / 100;
}

// API Routes

// Vehicle dropdown endpoints
app.get('/api/years', withInitialization((req, res) => {
  try {
    const { type = 'cars' } = req.query;
    const years = VehicleDataService.getYears(type);
    res.json(years);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch years' });
  }
}));

app.post('/api/routes/gas-stops', withInitialization(async (req, res) => {
  try {
    const { start, destination, adjustedRangeMiles, departureTime } = req.body;

    if (!isValidLocation(start) || !isValidLocation(destination)) {
      return res.status(400).json({ error: 'start and destination with lat/lng are required' });
    }

    if (!adjustedRangeMiles || adjustedRangeMiles <= 0) {
      return res.status(400).json({ error: 'adjustedRangeMiles must be a positive number' });
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const effectiveRangeMiles = Math.max(adjustedRangeMiles - 35, 50);
    const toleranceBehindMiles = 20;
    const toleranceAheadMiles = 10;
    const finalBufferMiles = 5;

    const directionsRoute = await fetchDirectionsRoute(start, destination);
    if (!directionsRoute) {
      return res.status(500).json({ error: 'Directions route unavailable' });
    }

    const polyline = directionsRoute.overview_polyline?.points;
    if (!polyline) {
      return res.status(500).json({ error: 'Route polyline unavailable' });
    }

    const path = decodePolyline(polyline);
    if (!path.length) {
      return res.status(500).json({ error: 'Decoded route path is empty' });
    }

    const cumulative = buildCumulativeDistances(path);
    const totalDistanceMeters = cumulative[cumulative.length - 1];
    const totalDurationSeconds = directionsRoute.legs?.reduce(
      (total, leg) => total + (leg.duration?.value ?? 0),
      0
    ) ?? 0;
    const secondsPerMeter = totalDistanceMeters > 0 && totalDurationSeconds > 0
      ? totalDurationSeconds / totalDistanceMeters
      : 1 / DEFAULT_SPEED_MPS;
    const departureDate = departureTime ? new Date(departureTime) : new Date();
    if (Number.isNaN(departureDate.getTime())) {
      departureDate.setTime(Date.now());
    }
    const effectiveRangeMeters = effectiveRangeMiles * METERS_PER_MILE;
    const toleranceBehindMeters = toleranceBehindMiles * METERS_PER_MILE;
    const toleranceAheadMeters = toleranceAheadMiles * METERS_PER_MILE;
    const finalBufferMeters = finalBufferMiles * METERS_PER_MILE;

    const stops = [];
    const usedPlaceIds = new Set();

    stops.push({
      type: 'start',
      name: 'Start',
      address: start.address || '',
      location: start,
      distanceFromStartMiles: 0,
      distanceFromLastMiles: 0,
      arrivalTime: departureDate.toISOString()
    });

    let currentDistanceMeters = 0;
    let lastStopLocation = { lat: start.lat, lng: start.lng };

    const earlyStopTargetMeters = Math.min(
      EARLY_STOP_TARGET_MILES * METERS_PER_MILE,
      totalDistanceMeters - finalBufferMeters
    );
    const earlyStopMaxMeters = Math.min(
      EARLY_STOP_MAX_MILES * METERS_PER_MILE,
      totalDistanceMeters - finalBufferMeters
    );

    if (
      earlyStopMaxMeters > currentDistanceMeters + EARLY_STOP_MIN_PROGRESS_METERS &&
      earlyStopTargetMeters > currentDistanceMeters
    ) {
      const earlyStation = await findStationAlongRoute({
        path,
        cumulative,
        targetDistance: Math.max(
          earlyStopTargetMeters,
          currentDistanceMeters + EARLY_STOP_MIN_PROGRESS_METERS
        ),
        minDistance: currentDistanceMeters,
        maxDistance: earlyStopMaxMeters,
        usedPlaceIds,
        lastStopLocation,
        currentDistanceMeters,
        minStopSpacingMiles: 0,
        minProgressMeters: EARLY_STOP_MIN_PROGRESS_METERS,
        secondsPerMeter,
        departureDate
      });

      if (earlyStation) {
        stops.push({
          type: 'fuel',
          name: earlyStation.name,
          address: earlyStation.address,
          location: earlyStation.location,
          placeId: earlyStation.placeId,
          distanceFromStartMiles: Number(
            (earlyStation.distanceFromStartMeters / METERS_PER_MILE).toFixed(1)
          ),
          distanceFromLastMiles: Number(earlyStation.distanceFromLastMiles.toFixed(1)),
          hours: earlyStation.hours ?? null,
          isOpenNow: typeof earlyStation.isOpenNow === 'boolean' ? earlyStation.isOpenNow : null,
          arrivalTime: earlyStation.arrivalTime?.toISOString?.() ?? null,
          hoursAvailable: earlyStation.hoursAvailable
        });

        const identifier = earlyStation.placeId || extractShortName(earlyStation.name);
        if (identifier) {
          usedPlaceIds.add(identifier);
        }

        lastStopLocation = earlyStation.location;
        currentDistanceMeters = Math.max(
          earlyStation.distanceFromStartMeters,
          currentDistanceMeters + MIN_PROGRESS_METERS
        );
      }
    }

    while (currentDistanceMeters + toleranceBehindMeters < totalDistanceMeters - finalBufferMeters) {
      const idealDistance = currentDistanceMeters + effectiveRangeMeters;
      const lowerBound = Math.max(
        currentDistanceMeters + Math.max(effectiveRangeMeters - toleranceBehindMeters, METERS_PER_MILE),
        currentDistanceMeters + METERS_PER_MILE
      );
      const upperBound = Math.min(currentDistanceMeters + effectiveRangeMeters + toleranceAheadMeters, totalDistanceMeters - finalBufferMeters);

      if (upperBound <= lowerBound) {
        break;
      }

      const targetDistance = clamp(idealDistance, lowerBound, upperBound);
      const station = await findStationAlongRoute({
        path,
        cumulative,
        targetDistance,
        minDistance: lowerBound,
        maxDistance: upperBound,
        usedPlaceIds,
        lastStopLocation,
        currentDistanceMeters,
        secondsPerMeter,
        departureDate
      });

      if (!station) {
        if (upperBound <= currentDistanceMeters + MIN_PROGRESS_METERS) {
          break;
        }
        currentDistanceMeters = upperBound;
        continue;
      }

      stops.push({
        type: 'fuel',
        name: station.name,
        address: station.address,
        location: station.location,
        placeId: station.placeId,
        distanceFromStartMiles: Number((station.distanceFromStartMeters / METERS_PER_MILE).toFixed(1)),
        distanceFromLastMiles: Number(station.distanceFromLastMiles.toFixed(1)),
        hours: station.hours ?? null,
        isOpenNow: typeof station.isOpenNow === 'boolean' ? station.isOpenNow : null,
        arrivalTime: station.arrivalTime?.toISOString?.() ?? null,
        hoursAvailable: station.hoursAvailable
      });

      const identifier = station.placeId || extractShortName(station.name);
      if (identifier) {
        usedPlaceIds.add(identifier);
      }

      lastStopLocation = station.location;
      currentDistanceMeters = Math.max(
        station.distanceFromStartMeters,
        currentDistanceMeters + MIN_PROGRESS_METERS
      );
    }

    stops.push({
      type: 'destination',
      name: 'Destination',
      address: destination.address || '',
      location: destination,
      distanceFromStartMiles: Number((totalDistanceMeters / METERS_PER_MILE).toFixed(1)),
      distanceFromLastMiles: Number((haversineDistance(lastStopLocation, destination) / METERS_PER_MILE).toFixed(1)),
      arrivalTime: computeArrivalTime(totalDistanceMeters, departureDate, secondsPerMeter)?.toISOString?.() ?? null
    });

    res.json({
      stops,
      totalDistanceMiles: Number((totalDistanceMeters / METERS_PER_MILE).toFixed(1)),
      effectiveRangeMiles,
      toleranceMiles: {
        behind: toleranceBehindMiles,
        ahead: toleranceAheadMiles
      }
    });
  } catch (error) {
    console.error('Error in /api/routes/gas-stops:', error);
    res.status(500).json({ error: 'Failed to compute gas stops' });
  }
}));

// Google Places API (New) proxy endpoints
app.get('/api/places/autocomplete', withInitialization(async (req, res) => {
  try {
    const { input, sessionToken } = req.query;
    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'input query param is required' });
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const requestBody = {
      input,
      languageCode: 'en',
      regionCode: 'US',
      includedPrimaryTypes: ['street_address', 'premise', 'route', 'locality', 'postal_code']
    };

    if (sessionToken && typeof sessionToken === 'string') {
      requestBody.sessionToken = sessionToken;
    }

    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Places autocomplete failed', details: data });
    }

    const suggestions = (data.suggestions || [])
      .map((s) => s?.placePrediction)
      .filter(Boolean)
      .map((p) => ({
        placeId: p.placeId,
        description: p.text?.text || ''
      }));

    res.json({ suggestions });
  } catch (error) {
    console.error('Error in /api/places/autocomplete:', error);
    res.status(500).json({ error: 'Failed to autocomplete places' });
  }
}));

app.get('/api/places/details', withInitialization(async (req, res) => {
  try {
    const { placeId, sessionToken } = req.query;
    if (!placeId || typeof placeId !== 'string') {
      return res.status(400).json({ error: 'placeId query param is required' });
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    if (sessionToken && typeof sessionToken === 'string') {
      url.searchParams.set('sessionToken', sessionToken);
    }

    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'id,formattedAddress,displayName,location'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Places details failed', details: data });
    }

    if (!data.location) {
      return res.status(500).json({ error: 'Place location unavailable' });
    }

    res.json({
      placeId: data.id,
      address: data.formattedAddress || data.displayName?.text || '',
      location: data.location
    });
  } catch (error) {
    console.error('Error in /api/places/details:', error);
    res.status(500).json({ error: 'Failed to fetch place details' });
  }
}));

app.get('/api/makes', withInitialization((req, res) => {
  try {
    const { year, type = 'cars' } = req.query;
    if (!year) {
      return res.status(400).json({ error: 'Year parameter is required' });
    }
    const makes = VehicleDataService.getMakes(year, type);
    res.json(makes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch makes' });
  }
}));

app.get('/api/models', withInitialization((req, res) => {
  try {
    const { year, make, type = 'cars' } = req.query;
    if (!year || !make) {
      return res.status(400).json({ error: 'Year and make parameters are required' });
    }
    const models = VehicleDataService.getModels(year, make, type);
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
}));

app.get('/api/engines', withInitialization((req, res) => {
  try {
    const { year, make, model, type = 'cars' } = req.query;
    if (!year || !make || !model) {
      return res.status(400).json({ error: 'Year, make, and model parameters are required' });
    }
    const engines = VehicleDataService.getEngines(year, make, model, type);
    res.json(engines);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch engines' });
  }
}));

app.post('/api/carInfo', withInitialization(async (req, res) => {
  try {
    const { year, make, model, engine, passengerWeight = 0, type = 'cars' } = req.body;
    
    if (!year || !make || !model) {
      return res.status(400).json({ error: 'Year, make, and model are required' });
    }

    // Get vehicle data
    const car = VehicleDataService.getVehicleInfo(year, make, model, engine, type);
    if (!car) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // Get available engines for this model
    const engines = VehicleDataService.getEngines(year, make, model, type);

    // Use TensorFlow model for predictions
    let horsepower;
    let mpg;
    let gasTankSize;

    const tf = state.tfInstance;
    if (state.carModel && tf) {
      const input = tf.tensor2d([[year - 1980, hashString(make), hashString(model), engine ? hashString(engine) : 0]]);
      const predictionTensor = state.carModel.predict(input);
      const prediction = predictionTensor.dataSync();
      [horsepower, mpg, gasTankSize] = prediction;
      input.dispose();
      predictionTensor.dispose();
    } else {
      // Fallback to actual data if model is not available
      horsepower = car.horsepower;
      mpg = car.mpg;
      gasTankSize = car.gasTankSize;
    }

    // Calculate ranges
    const baseRange = Math.round(gasTankSize * mpg);
    const adjustedRange = state.rangeModel ? state.rangeModel.getRange(mpg, gasTankSize, passengerWeight) : baseRange;

    res.json({
      engines,
      horsepower: Math.round(horsepower),
      mpg: Math.round(mpg),
      gasType: car.gasType || (engine === "2.5L Hybrid" ? "Regular (Hybrid)" : "Regular"),
      gasTankSize: Math.round(gasTankSize),
      batteryLife: car.batteryLife || (engine === "2.5L Hybrid" ? "1.6 kWh" : null),
      baseRange,
      adjustedRange,
      passengerWeight
    });
  } catch (error) {
    console.error('Error in /api/carInfo:', error);
    res.status(500).json({ error: 'Failed to calculate vehicle info' });
  }
}));

// Route calculation endpoint
app.post('/api/calculate-route', withInitialization(async (req, res) => {
  try {
    const { startLocation, endLocation, adjustedRange } = req.body;
    
    if (!startLocation || !endLocation || !adjustedRange) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const googleMapsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(startLocation)}&destination=${encodeURIComponent(endLocation)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(googleMapsUrl);
    const data = await response.json();

    if (data.status !== 'OK') {
      return res.status(400).json({ error: 'Failed to calculate route', details: data.status });
    }

    const route = data.routes[0];
    const leg = route.legs[0];
    const distance = leg.distance.text;
    const duration = leg.duration.text;
    const distanceMeters = leg.distance.value;
    const distanceMiles = distanceMeters * 0.000621371;

    res.json({
      distance,
      duration,
      distanceMeters,
      distanceMiles: Math.round(distanceMiles * 10) / 10,
      route: route
    });
  } catch (error) {
    console.error('Error calculating route:', error);
    res.status(500).json({ error: 'Failed to calculate route' });
  }
}));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const response = {
    status: state.initializationError ? 'ERROR' : state.initialized ? 'OK' : 'INIT',
    timestamp: new Date().toISOString(),
    services: {
      vehicleData: VehicleDataService.dataLoaded,
      tensorFlowModel: !!state.carModel,
      rangeModel: !!state.rangeModel,
      tensorflowDisabled: shouldDisableTensorflow,
    },
  };

  if (state.initializationError) {
    response.error = {
      message: 'Service initialization failed',
    };
  }

  res.status(state.initializationError ? 500 : 200).json(response);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
async function startServer() {
  try {
    await ensureInitialized();
  } catch (error) {
    console.error('Failed to initialize services before startup:', error);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Travel service API running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    if (shouldDisableTensorflow) {
      console.log('⚠️  TensorFlow disabled for this environment');
    }
  });
}

if (!isVercelDeployment && process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
  });
}

export const handler = app;
export { ensureInitialized };
export default app;

function isValidLocation(location) {
  return (
    location &&
    typeof location.lat === 'number' &&
    typeof location.lng === 'number'
  );
}

async function fetchDirectionsRoute(start, destination) {
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', `${start.lat},${start.lng}`);
  url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY);

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK') {
    console.error('Directions API error:', data.status, data.error_message);
    return null;
  }

  return data.routes?.[0] || null;
}

async function findNearestGasStation(location, options = {}) {
  const {
    maxDeviationMiles = ROUTE_DEVIATION_MILES,
    usedPlaceIds,
    requireTwentyFourHours = false
  } = options;
  const locationLatLng = {
    lat: location.lat ?? location.latitude,
    lng: location.lng ?? location.longitude
  };

  let bestCandidate = null;

  for (const radius of GAS_SEARCH_RADII_METERS) {
    const places = await callPlacesSearchNearby(locationLatLng, radius);

    if (!places) {
      continue;
    }

    for (const place of places) {
      const lat = place?.location?.latitude;
      const lng = place?.location?.longitude;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        continue;
      }

      const placeIdentifier = place.id || place.name;

      if (placeIdentifier && usedPlaceIds?.has(placeIdentifier)) {
        continue;
      }

      const candidateLocation = { lat, lng };
      const deviationMiles = haversineDistance(locationLatLng, candidateLocation) / METERS_PER_MILE;

      if (Number.isFinite(maxDeviationMiles) && deviationMiles > maxDeviationMiles) {
        continue;
      }

      const distanceFromQueryMeters = haversineDistance(locationLatLng, candidateLocation);
      const openingHoursPeriods = Array.isArray(place.regularOpeningHours?.periods)
        ? place.regularOpeningHours.periods
        : null;
      const candidateIsTwentyFourHours = hasTwentyFourHourPeriod(openingHoursPeriods);

      if (requireTwentyFourHours && !candidateIsTwentyFourHours) {
        continue;
      }

      const candidate = {
        placeId: placeIdentifier,
        name: place.displayName?.text || place.displayName || extractShortName(place.name) || 'Gas Station',
        address: place.formattedAddress || place.shortFormattedAddress || '',
        location: candidateLocation,
        deviationMiles,
        distanceFromQueryMeters,
        hours: Array.isArray(place.regularOpeningHours?.weekdayDescriptions)
          ? place.regularOpeningHours.weekdayDescriptions
          : null,
        isOpenNow: typeof place.currentOpeningHours?.openNow === 'boolean'
          ? place.currentOpeningHours.openNow
          : null,
        openingHoursPeriods
      };

      if (!bestCandidate || distanceFromQueryMeters < bestCandidate.distanceFromQueryMeters) {
        bestCandidate = candidate;
      }
    }

    if (bestCandidate) {
      return bestCandidate;
    }
  }

  return bestCandidate;
}

async function findStationAlongRoute({
  path,
  cumulative,
  targetDistance,
  minDistance,
  maxDistance,
  usedPlaceIds,
  lastStopLocation,
  currentDistanceMeters,
  minStopSpacingMiles = MIN_STOP_SPACING_MILES,
  minProgressMeters = MIN_PROGRESS_METERS,
  secondsPerMeter,
  departureDate
}) {
  const candidateDistancesSet = new Set();

  for (const offset of SEARCH_OFFSETS_METERS) {
    const candidate = clamp(targetDistance + offset, minDistance, maxDistance);
    if (candidate > currentDistanceMeters + minProgressMeters) {
      candidateDistancesSet.add(candidate);
    }
  }

  if (!candidateDistancesSet.size) {
    const fallback = clamp(targetDistance, minDistance, maxDistance);
    if (fallback > currentDistanceMeters + minProgressMeters) {
      candidateDistancesSet.add(fallback);
    }
  }

  const candidateDistances = Array.from(candidateDistancesSet).sort(
    (a, b) => Math.abs(a - targetDistance) - Math.abs(b - targetDistance)
  );

  const deviationBudgets = [ROUTE_DEVIATION_MILES, ROUTE_DEVIATION_MILES * 1.5];
  let backup24HourStation = null;

  for (const candidateDistance of candidateDistances) {
    const waypoint = getCoordinateAtDistance(path, cumulative, candidateDistance);
    if (!waypoint) {
      continue;
    }

    for (const deviationBudget of deviationBudgets) {
      const station = await findNearestGasStation(waypoint, {
        maxDeviationMiles: deviationBudget,
        usedPlaceIds
      });

      if (!station) {
        continue;
      }

      const distanceFromLastMiles = haversineDistance(lastStopLocation, station.location) / METERS_PER_MILE;

      if (distanceFromLastMiles < minStopSpacingMiles) {
        continue;
      }

      const arrivalTime = computeArrivalTime(candidateDistance, departureDate, secondsPerMeter);
      const openingEvaluation = evaluateStationOpenState(station.openingHoursPeriods, arrivalTime);
      const isOvernightArrival = isArrivalDuringOvernight(arrivalTime);

      if (openingEvaluation.hoursAvailable === false && isOvernightArrival) {
        const twentyFourHourStation = await findNearestGasStation(waypoint, {
          maxDeviationMiles: deviationBudget,
          usedPlaceIds,
          requireTwentyFourHours: true
        });

        if (twentyFourHourStation) {
          const distanceFromLastMilesTwentyFourHour = haversineDistance(
            lastStopLocation,
            twentyFourHourStation.location
          ) / METERS_PER_MILE;

          if (distanceFromLastMilesTwentyFourHour < minStopSpacingMiles) {
            continue;
          }

          const twentyFourHourEvaluation = evaluateStationOpenState(
            twentyFourHourStation.openingHoursPeriods,
            arrivalTime
          );

          return {
            ...twentyFourHourStation,
            distanceFromStartMeters: candidateDistance,
            distanceFromLastMiles: distanceFromLastMilesTwentyFourHour,
            arrivalTime,
            hoursAvailable: twentyFourHourEvaluation.hoursAvailable
          };
        }

        continue;
      }

      if (openingEvaluation.isOpen === false) {
        if (openingEvaluation.isTwentyFourHours && !backup24HourStation) {
          backup24HourStation = {
            ...station,
            distanceFromStartMeters: candidateDistance,
            distanceFromLastMiles,
            arrivalTime,
            hoursAvailable: openingEvaluation.hoursAvailable
          };
        }
        continue;
      }

      return {
        ...station,
        distanceFromStartMeters: candidateDistance,
        distanceFromLastMiles,
        arrivalTime,
        hoursAvailable: openingEvaluation.hoursAvailable
      };
    }
  }

  return backup24HourStation;
}

async function callPlacesSearchNearby(location, radius) {
  const body = {
    includedPrimaryTypes: ['gas_station'],
    locationRestriction: {
      circle: {
        center: {
          latitude: location.lat,
          longitude: location.lng
        },
        radius: Math.min(radius, 50000)
      }
    },
    maxResultCount: 10,
    rankPreference: 'DISTANCE'
  };

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': PLACES_FIELD_MASK
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Places searchNearby error:', response.status, errorBody);
      return null;
    }

    const data = await response.json();
    if (!Array.isArray(data.places) || !data.places.length) {
      return null;
    }

    return data.places;
  } catch (error) {
    console.error('Places searchNearby request failed:', error);
    return null;
  }
}

function extractShortName(name) {
  if (!name) {
    return '';
  }

  const parts = name.split('/');
  return parts.length ? parts[parts.length - 1] : name;
}

function buildCumulativeDistances(path) {
  const cumulative = [0];
  for (let i = 1; i < path.length; i += 1) {
    const segment = haversineDistance(path[i - 1], path[i]);
    cumulative.push(cumulative[i - 1] + segment);
  }
  return cumulative;
}

function getCoordinateAtDistance(path, cumulative, targetDistance) {
  const total = cumulative[cumulative.length - 1];
  if (targetDistance >= total) {
    return path[path.length - 1];
  }

  for (let i = 1; i < cumulative.length; i += 1) {
    if (cumulative[i] >= targetDistance) {
      const prevDist = cumulative[i - 1];
      const segmentDist = cumulative[i] - prevDist;
      const ratio = segmentDist === 0 ? 0 : (targetDistance - prevDist) / segmentDist;
      return {
        lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * ratio,
        lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * ratio
      };
    }
  }

  return path[path.length - 1];
}

function haversineDistance(a, b) {
  const R = 6371000; // meters
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);

  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return R * c;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function decodePolyline(encoded) {
  let index = 0;
  const len = encoded.length;
  const path = [];
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLat = (result & 1) ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLng = (result & 1) ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    path.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return path;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function computeArrivalTime(distanceMeters, departureDate, secondsPerMeter) {
  if (!departureDate || typeof secondsPerMeter !== 'number') {
    return null;
  }
  const arrival = new Date(departureDate.getTime() + distanceMeters * secondsPerMeter * 1000);
  if (Number.isNaN(arrival.getTime())) {
    return null;
  }
  return arrival;
}

function evaluateStationOpenState(periods, arrivalTime) {
  if (!Array.isArray(periods) || !arrivalTime) {
    return {
      isOpen: null,
      isTwentyFourHours: false,
      hoursAvailable: false
    };
  }

  const arrivalMinutes = arrivalTime.getDay() * 24 * 60 + arrivalTime.getHours() * 60 + arrivalTime.getMinutes();
  const normalizedArrival = ((arrivalMinutes % WEEK_MINUTES) + WEEK_MINUTES) % WEEK_MINUTES;

  for (const period of periods) {
    const open = period?.open;
    const close = period?.close;

    if (!open) {
      continue;
    }

    const openMinutes = (open.day ?? 0) * 24 * 60 + (open.hour ?? 0) * 60 + (open.minute ?? 0);
    let closeMinutes;

    if (close) {
      closeMinutes = (close.day ?? 0) * 24 * 60 + (close.hour ?? 0) * 60 + (close.minute ?? 0);
    } else {
      // If no close provided, assume 24 hours from open
      closeMinutes = openMinutes + 24 * 60;
    }

    const spansIntoNextWeek = closeMinutes <= openMinutes;
    const normalizedOpen = ((openMinutes % WEEK_MINUTES) + WEEK_MINUTES) % WEEK_MINUTES;
    let normalizedClose = ((closeMinutes % WEEK_MINUTES) + WEEK_MINUTES) % WEEK_MINUTES;

    if (spansIntoNextWeek) {
      normalizedClose += WEEK_MINUTES;
    }

    const arrivalForComparison = spansIntoNextWeek && normalizedArrival < normalizedOpen
      ? normalizedArrival + WEEK_MINUTES
      : normalizedArrival;

    if (arrivalForComparison >= normalizedOpen && arrivalForComparison <= normalizedClose) {
      let durationMinutes = closeMinutes - openMinutes;
      if (durationMinutes <= 0) {
        durationMinutes += WEEK_MINUTES;
      }

      return {
        isOpen: true,
        isTwentyFourHours: durationMinutes >= 24 * 60,
        hoursAvailable: true
      };
    }
  }

  const has24HourPeriod = hasTwentyFourHourPeriod(periods);

  return {
    isOpen: false,
    isTwentyFourHours: has24HourPeriod,
    hoursAvailable: true
  };
}

function hasTwentyFourHourPeriod(periods) {
  if (!Array.isArray(periods)) {
    return false;
  }

  return periods.some((period) => {
    const open = period?.open;
    const close = period?.close;

    if (!open) {
      return false;
    }

    if (!close) {
      return true;
    }

    const openMinutes = (open.day ?? 0) * 24 * 60 + (open.hour ?? 0) * 60 + (open.minute ?? 0);
    const closeMinutes = (close.day ?? 0) * 24 * 60 + (close.hour ?? 0) * 60 + (close.minute ?? 0);
    let durationMinutes = closeMinutes - openMinutes;

    if (durationMinutes <= 0) {
      durationMinutes += WEEK_MINUTES;
    }

    return durationMinutes >= 24 * 60;
  });
}

function isArrivalDuringOvernight(arrivalTime) {
  if (!(arrivalTime instanceof Date) || Number.isNaN(arrivalTime.getTime())) {
    return false;
  }

  const hour = arrivalTime.getHours();
  return hour >= OVERNIGHT_START_HOUR || hour < OVERNIGHT_END_HOUR;
}
