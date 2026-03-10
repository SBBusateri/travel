import fs from 'fs';
import { parse } from 'csv-parse';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class VehicleDataService {
  constructor() {
    this.vehicleData = {
      cars: [],
      motorcycles: [],
      ev: [],
      semi: [],
      rv: []
    };
    this.dataLoaded = false;
  }

  async loadVehicleData(type, filePath) {
    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping ${type} data load: ${filePath} not found. Endpoints will return Supabase-backed results only.`);
      return [];
    }

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(parse({ columns: true }))
        .on('data', (row) => {
          this.vehicleData[type].push({
            year: parseInt(row.year),
            make: row.make,
            model: row.model,
            engine: row.engine,
            horsepower: parseFloat(row.horsepower),
            mpg: parseFloat(row.mpg?.split('/')[0] || 0),
            gasType: row.gasType,
            gasTankSize: parseFloat(row.gasTankSize || 0),
            batteryLife: row.batteryLife ? parseFloat(row.batteryLife) : null,
          });
        })
        .on('end', () => {
          console.log(`Loaded ${type} data:`, this.vehicleData[type].length, 'entries');
          resolve(this.vehicleData[type]);
        })
        .on('error', (error) => {
          console.error(`Error loading ${type} CSV:`, error);
          reject(error);
        });
    });
  }

  async initialize() {
    if (this.dataLoaded) return;

    const dataDir = path.join(__dirname, '../../data');
    
    await Promise.all([
      this.loadVehicleData('cars', path.join(dataDir, 'cars.csv')),
      this.loadVehicleData('motorcycles', path.join(dataDir, 'motorcycles.csv')),
      this.loadVehicleData('ev', path.join(dataDir, 'ev.csv')),
      this.loadVehicleData('semi', path.join(dataDir, 'semi.csv')),
      this.loadVehicleData('rv', path.join(dataDir, 'rv.csv'))
    ]);

    this.dataLoaded = true;
    console.log('All vehicle data loaded successfully');
  }

  getYears(type = 'cars') {
    if (!this.vehicleData[type]) return [];
    return [...new Set(this.vehicleData[type].map(d => d.year))].sort((a, b) => b - a);
  }

  getMakes(year, type = 'cars') {
    if (!this.vehicleData[type]) return [];
    if (!year) return [];
    return [...new Set(this.vehicleData[type]
      .filter(d => d.year === parseInt(year))
      .map(d => d.make))].sort();
  }

  getModels(year, make, type = 'cars') {
    if (!this.vehicleData[type]) return [];
    if (!year || !make) return [];
    return [...new Set(this.vehicleData[type]
      .filter(d => d.year === parseInt(year) && d.make === make)
      .map(d => d.model))].sort();
  }

  getEngines(year, make, model, type = 'cars') {
    if (!this.vehicleData[type]) return [];
    if (!year || !make || !model) return [];
    return [...new Set(this.vehicleData[type]
      .filter(d => d.year === parseInt(year) && d.make === make && d.model === model)
      .map(d => d.engine))].sort();
  }

  getVehicleInfo(year, make, model, engine, type = 'cars') {
    if (!this.vehicleData[type]) return null;
    return this.vehicleData[type].find(d => 
      d.year === parseInt(year) && 
      d.make === make && 
      d.model === model && 
      (!engine || d.engine === engine)
    );
  }

  getAllVehicles(type = 'cars') {
    return this.vehicleData[type] || [];
  }
}

export default new VehicleDataService();
