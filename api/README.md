# Travel Service API

Backend API for the travel planning application.

## Features

- Vehicle data management with CSV-based datasets
- TensorFlow-based vehicle performance predictions
- Range calculations with weight adjustments
- RESTful API endpoints for frontend integration
- Security middleware (helmet, CORS, rate limiting)
- Health check endpoint

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. Start the development server:
```bash
npm run dev
```

4. Start in production:
```bash
npm start
```

## Vercel Deployment

This service is compatible with Vercel's Node serverless runtime.

1. Create a Vercel project pointing to the `/api` directory (monorepo mode).
2. Build command: `npm install` (or leave blank) and no separate build step is required.
3. Output directory: leave empty.
4. Vercel automatically runs the handler in `api/index.js`.

### Required Environment Variables

Configure the following in the Vercel project (same values as local `.env`):

- `NODE_ENV=production`
- `FRONTEND_URL` set to your deployed frontend origin (e.g. `https://your-site.vercel.app`).
- `GOOGLE_MAPS_API_KEY`
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DISABLE_TF=true` *(recommended)* to skip loading `@tensorflow/tfjs-node` in the serverless runtime.

> **Note:** TensorFlow native bindings are heavy and not supported on Vercel's serverless platform. Setting `DISABLE_TF=true` ensures deployment succeeds. The API will fall back to dataset-derived values when ML predictions are disabled.

### Local/Serverless Parity

- On local development, leave `DISABLE_TF` unset to keep ML predictions enabled.
- The API automatically initializes its CSV datasets and cached models on first request. Subsequent invocations reuse the cached state within the same serverless instance.
- `/api/health` reports initialization status and whether TensorFlow is disabled.

## API Endpoints

### Vehicle Data
- `GET /api/years?type=cars` - Get available years for vehicle type
- `GET /api/makes?year=2020&type=cars` - Get makes for a specific year
- `GET /api/models?year=2020&make=Toyota&type=cars` - Get models for year/make
- `GET /api/engines?year=2020&make=Toyota&model=Camry&type=cars` - Get engines for specific model

### Vehicle Information
- `POST /api/carInfo` - Get detailed vehicle information and calculations
  ```json
  {
    "year": "2020",
    "make": "Toyota",
    "model": "Camry",
    "engine": "2.5L I4",
    "passengerWeight": 200,
    "type": "cars"
  }
  ```

### Health Check
- `GET /api/health` - Check API status and service health

## Data Structure

The API uses CSV files in the `/data` directory:
- `cars.csv` - Automobile data
- `motorcycles.csv` - Motorcycle data
- `ev.csv` - Electric vehicle data
- `semi.csv` - Semi-truck data
- `rv.csv` - RV data

Each CSV should contain: year, make, model, engine, horsepower, mpg, gasType, gasTankSize, batteryLife

## Environment Variables

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment mode
- `FRONTEND_URL` - CORS allowed origin
- `GOOGLE_MAPS_API_KEY` - Google Maps API key
- `OPENAI_API_KEY` - OpenAI API key
- `DISABLE_TF` - Set to `true` to skip TensorFlow model loading (recommended for Vercel)

## Development

The server automatically restarts on file changes when using `npm run dev`.

## Security

- Helmet.js for security headers
- CORS configuration
- Rate limiting (100 requests per 15 minutes)
- Input validation and sanitization
