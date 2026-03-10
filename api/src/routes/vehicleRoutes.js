import { Router } from 'express';
import SupabaseVehicleService from '../services/SupabaseVehicleService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { year, make, model, trim } = req.query;

    if (!year || !make || !model) {
      return res.status(400).json({
        error: 'Missing required query parameters: year, make, model',
      });
    }

    const vehicle = await SupabaseVehicleService.getVehicle(year, make, model, trim);

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    return res.json({ data: vehicle });
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    return res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

router.get('/years', async (_req, res) => {
  try {
    const years = await SupabaseVehicleService.getYears();
    res.json({ data: years });
  } catch (error) {
    console.error('Error fetching years:', error);
    res.status(500).json({ error: 'Failed to fetch years' });
  }
});

router.get('/makes', async (req, res) => {
  try {
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({ error: 'Year is required' });
    }

    const makes = await SupabaseVehicleService.getMakes(year);
    res.json({ data: makes });
  } catch (error) {
    console.error('Error fetching makes:', error);
    res.status(500).json({ error: 'Failed to fetch makes' });
  }
});

router.get('/models', async (req, res) => {
  try {
    const { year, make } = req.query;

    if (!year || !make) {
      return res.status(400).json({ error: 'Year and make are required' });
    }

    const models = await SupabaseVehicleService.getModels(year, make);
    res.json({ data: models });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

router.get('/trims', async (req, res) => {
  try {
    const { year, make, model } = req.query;

    if (!year || !make || !model) {
      return res.status(400).json({ error: 'Year, make, and model are required' });
    }

    const trims = await SupabaseVehicleService.getTrims(year, make, model);
    res.json({ data: trims });
  } catch (error) {
    console.error('Error fetching trims:', error);
    res.status(500).json({ error: 'Failed to fetch trims' });
  }
});

export default router;
