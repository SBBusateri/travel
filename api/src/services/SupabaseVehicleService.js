import supabase from '../lib/supabase.js';

const VEHICLES_TABLE = 'vehicles';

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

const getField = (row, keys) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
  }
  return undefined;
};

const mapDistinctValues = (rows, key) => {
  if (!Array.isArray(rows)) {
    return [];
  }
  const values = rows
    .map((row) => row?.[key])
    .filter((value) => value !== null && value !== undefined && value !== '');
  return Array.from(new Set(values));
};

const SupabaseVehicleService = {
  async getYears() {
    const { data, error } = await supabase
      .from(VEHICLES_TABLE)
      .select('year')
      .order('year', { ascending: false });

    if (error) {
      throw error;
    }

    return mapDistinctValues(data, 'year')
      .map((year) => year.toString())
      .sort((a, b) => Number(b) - Number(a));
  },

  async getMakes(year) {
    const { data, error } = await supabase
      .from(VEHICLES_TABLE)
      .select('make')
      .eq('year', Number(year))
      .order('make');

    if (error) {
      throw error;
    }

    return mapDistinctValues(data, 'make').sort((a, b) => a.localeCompare(b));
  },

  async getModels(year, make) {
    const { data, error } = await supabase
      .from(VEHICLES_TABLE)
      .select('model')
      .eq('year', Number(year))
      .eq('make', make)
      .order('model');

    if (error) {
      throw error;
    }

    return mapDistinctValues(data, 'model').sort((a, b) => a.localeCompare(b));
  },

  async getTrims(year, make, model) {
    const { data, error } = await supabase
      .from(VEHICLES_TABLE)
      .select('trim')
      .eq('year', Number(year))
      .eq('make', make)
      .eq('model', model)
      .order('trim');

    if (error) {
      throw error;
    }

    return mapDistinctValues(data, 'trim').sort((a, b) => a.localeCompare(b));
  },

  async getVehicle(year, make, model, trim) {
    let query = supabase
      .from(VEHICLES_TABLE)
      .select('*')
      .eq('year', Number(year))
      .eq('make', make)
      .eq('model', model)
      .limit(1);

    if (trim) {
      query = query.eq('trim', trim);
    }

    const { data, error } = await query.maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return null;
    }

    const vehicle = {
      ...data,
      year: toNumber(getField(data, ['year'])),
      UCity: toNumber(getField(data, ['UCity', 'ucity'])),
      UHighway: toNumber(getField(data, ['UHighway', 'uhighway'])),
      tank_size: toNumber(getField(data, ['tank_size', 'tankSize'])),
      range: toNumber(getField(data, ['range'])),
      rangeCity: toNumber(getField(data, ['rangeCity', 'rangecity'])),
      rangeHwy: toNumber(getField(data, ['rangeHwy', 'rangehwy'])),
      charge120: toNumber(getField(data, ['charge120'])),
      charge240: toNumber(getField(data, ['charge240'])),
      cylinders: toNumber(getField(data, ['cylinders'])),
      displ: toNumber(getField(data, ['displ'])),
    };

    if (!vehicle.range || vehicle.range <= 0) {
      const mpgHighway = vehicle.UHighway && vehicle.UHighway > 0 ? vehicle.UHighway : null;
      if (vehicle.tank_size && mpgHighway) {
        vehicle.range = Math.round(vehicle.tank_size * mpgHighway);
      }
    }

    return vehicle;
  },
};

export default SupabaseVehicleService;
