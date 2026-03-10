import { useState, useEffect } from "react";
import { Car, Bike, Truck, Zap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiService } from "@/services/apiService";

const ENABLE_SUPABASE_VEHICLE_SELECTOR = false;
const ENABLE_MANUAL_RANGE_ENTRY = true;
const MIN_MANUAL_RANGE_MILES = 75;

type VehicleType = "car" | "motorcycle" | "rv" | "electric";

interface VehicleOption {
  id: VehicleType;
  label: string;
  icon: React.ElementType;
}

const vehicleOptions: VehicleOption[] = [
  { id: "car", label: "Car", icon: Car },
  { id: "motorcycle", label: "Motorcycle", icon: Bike },
  { id: "rv", label: "RV", icon: Truck },
  { id: "electric", label: "Electric", icon: Zap },
];

const FALLBACK_YEARS = ["2024", "2023", "2022", "2021", "2020"];

const FALLBACK_MAKES: Record<VehicleType, string[]> = {
  car: ['Ford', 'Toyota', 'Honda', 'Chevrolet', 'BMW', 'Mercedes-Benz', 'Audi', 'Nissan', 'Hyundai', 'Kia'],
  motorcycle: ['Harley-Davidson', 'Honda', 'Yamaha', 'Kawasaki', 'Suzuki', 'BMW', 'Ducati'],
  rv: ['Winnebago', 'Thor', 'Forest River', 'Jayco', 'Coachmen', 'Keystone'],
  electric: ['Tesla', 'Ford', 'Chevrolet', 'Hyundai', 'Kia', 'Nissan', 'Audi', 'BMW', 'Mercedes-Benz', 'Volkswagen']
};

const FALLBACK_MODELS: Record<string, string[]> = {
  Ford: ['F-150', 'Mustang', 'Explorer', 'Escape', 'Focus'],
  Toyota: ['Camry', 'Corolla', 'RAV4', 'Prius', 'Highlander'],
  Honda: ['Civic', 'Accord', 'CR-V', 'Pilot', 'Fit'],
  Chevrolet: ['Silverado', 'Malibu', 'Equinox', 'Tahoe', 'Camaro'],
  Tesla: ['Model S', 'Model 3', 'Model X', 'Model Y', 'Cybertruck'],
  BMW: ['3 Series', '5 Series', 'X3', 'X5', 'i4'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'GLC', 'GLE', 'EQS'],
  Audi: ['A4', 'A6', 'Q5', 'Q7', 'e-tron'],
  Nissan: ['Altima', 'Sentra', 'Rogue', 'Leaf', 'Pathfinder'],
  Hyundai: ['Elantra', 'Sonata', 'Tucson', 'Santa Fe', 'Kona'],
  Kia: ['Forte', 'Optima', 'Sportage', 'Sorento', 'Telluride']
};

const FALLBACK_VEHICLE_INFO: Record<VehicleType, VehicleData> = {
  car: {
    year: 2026,
    make: 'Ford',
    model: 'Mustang',
    mpg: 30,
    gasType: 'Regular',
    gasTankSize: 15,
    adjustedRange: 450,
    horsepower: 480,
    baseRange: 450,
    batteryLife: null,
  },
  motorcycle: {
    year: 2024,
    make: 'Harley-Davidson',
    model: 'Sportster',
    mpg: 50,
    gasType: 'Regular',
    gasTankSize: 4,
    adjustedRange: 200,
    horsepower: 100,
    baseRange: 200,
    batteryLife: null,
  },
  rv: {
    year: 2024,
    make: 'Winnebago',
    model: 'Adventurer',
    mpg: 15,
    gasType: 'Regular',
    gasTankSize: 30,
    adjustedRange: 225,
    horsepower: 300,
    baseRange: 225,
    batteryLife: null,
  },
  electric: {
    year: 2024,
    make: 'Tesla',
    model: 'Model Y',
    mpg: 120,
    gasType: 'Electric',
    gasTankSize: 0,
    adjustedRange: 300,
    horsepower: 300,
    baseRange: 300,
    batteryLife: 300,
  },
};

interface VehicleSelectorProps {
  onVehicleChange?: (data: VehicleData) => void;
  showValidation?: boolean;
}

type VehicleData = {
  adjustedRange?: number;
  mpg?: number;
  horsepower?: number;
  gasTankSize?: number;
  gasType?: string;
  baseRange?: number;
  isManualRangeValid?: boolean;
  [key: string]: unknown;
};

function ManualRangeSection({ onVehicleChange, showValidation = false }: VehicleSelectorProps) {
  const [rangeInput, setRangeInput] = useState<string>("");

  const parsedRange = Number(rangeInput);
  const hasValue = rangeInput.trim().length > 0;
  const isValidRange = hasValue && !Number.isNaN(parsedRange) && parsedRange >= MIN_MANUAL_RANGE_MILES;
  const shouldShowError = showValidation && !isValidRange;

  useEffect(() => {
    if (isValidRange) {
      onVehicleChange?.({ adjustedRange: parsedRange, isManualRangeValid: true });
    } else {
      onVehicleChange?.({ adjustedRange: undefined, isManualRangeValid: false });
    }
  }, [isValidRange, parsedRange, onVehicleChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg sunset-gradient flex items-center justify-center">
          <Car className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Add Vehicle Range</h2>
          <p className="text-xs text-muted-foreground">Enter your vehicle&apos;s estimated range to plan fuel stops.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="vehicle-range" className="text-xs font-medium text-foreground">
          Vehicle range (miles)
        </Label>
        <Input
          id="vehicle-range"
          type="number"
          min={MIN_MANUAL_RANGE_MILES}
          value={rangeInput}
          onChange={(event) => {
            setRangeInput(event.target.value);
          }}
          className="h-10 text-sm"
          aria-describedby="vehicle-range-helper"
          aria-invalid={shouldShowError}
          required
          placeholder="eg 300"
        />
        <div id="vehicle-range-helper" className="text-xs text-muted-foreground">
          Minimum range is {MIN_MANUAL_RANGE_MILES} miles.
        </div>
        {shouldShowError && (
          <div className="text-xs text-destructive">
            Please enter a range of at least {MIN_MANUAL_RANGE_MILES} miles.
          </div>
        )}
      </div>
    </div>
  );
}

export function VehicleSelector({ onVehicleChange, showValidation }: VehicleSelectorProps) {
  if (ENABLE_MANUAL_RANGE_ENTRY && !ENABLE_SUPABASE_VEHICLE_SELECTOR) {
    return <ManualRangeSection onVehicleChange={onVehicleChange} showValidation={showValidation} />;
  }

  const [selectedType, setSelectedType] = useState<VehicleType>("car");
  const [year, setYear] = useState<string>("");
  const [make, setMake] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [trim, setTrim] = useState<string>("");

  // API data states
  const [years, setYears] = useState<string[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [vehicleInfo, setVehicleInfo] = useState<VehicleData | null>(null);
  const [requiresManualRange, setRequiresManualRange] = useState(false);
  const [manualRange, setManualRange] = useState("");

  const isSupabaseSupported = selectedType === 'car';
  const fallbackVehicle = FALLBACK_VEHICLE_INFO[selectedType];
  const showFallbackVehicle = !vehicleInfo && !year && !make && !model && !isSupabaseSupported;

  // Load years on mount
  useEffect(() => {
    loadYears();
  }, [selectedType]);

  // Load makes when year changes
  useEffect(() => {
    if (year) {
      loadMakes();
    } else {
      setMakes([]);
      setModels([]);
      setTrims([]);
      setTrim("");
    }
  }, [year, selectedType]);

  // Load models when make changes
  useEffect(() => {
    if (year && make) {
      loadModels();
    } else {
      setModels([]);
      setTrims([]);
      setTrim("");
    }
  }, [year, make, selectedType]);

  // Load trims when model changes
  useEffect(() => {
    if (year && make && model) {
      loadTrims();
    } else {
      setTrims([]);
      setTrim("");
    }
  }, [year, make, model, selectedType]);

  // Fetch vehicle info when selection changes
  useEffect(() => {
    if (year && make && model) {
      fetchVehicleInfo();
    }
  }, [year, make, model, trim, selectedType]);

  // Notify parent when vehicle info changes
  useEffect(() => {
    if (vehicleInfo) {
      const manualRangeValue = manualRange ? Number(manualRange) : undefined;
      const infoForParent = {
        ...vehicleInfo,
        adjustedRange: requiresManualRange ? manualRangeValue : vehicleInfo.adjustedRange,
      };
      onVehicleChange?.(infoForParent);
    } else if (showFallbackVehicle) {
      onVehicleChange?.(fallbackVehicle);
    }
  }, [
    vehicleInfo,
    requiresManualRange,
    manualRange,
    onVehicleChange,
    showFallbackVehicle,
    fallbackVehicle,
  ]);

  const loadYears = async () => {
    try {
      setLoading(true);
      setError("");
      if (!isSupabaseSupported) {
        setYears(FALLBACK_YEARS);
        return;
      }
      const data = await apiService.getYears();
      setYears((data || []).map((value) => value.toString()));
    } catch (err) {
      console.error('Failed to load years:', err);
      setYears(FALLBACK_YEARS);
      setError('Unable to load vehicle years from database. Showing fallback options.');
    } finally {
      setLoading(false);
    }
  };

  const loadMakes = async () => {
    try {
      setLoading(true);
      setError("");
      if (!isSupabaseSupported) {
        setMakes(FALLBACK_MAKES[selectedType]);
        return;
      }
      const data = await apiService.getMakes(year);
      setMakes(data);
    } catch (err) {
      console.error('Failed to load makes:', err);
      setMakes(FALLBACK_MAKES[selectedType]);
      setError('Unable to load vehicle makes from database. Showing fallback options.');
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      setLoading(true);
      setError("");
      if (!isSupabaseSupported) {
        setModels(FALLBACK_MODELS[make] || ['Base Model', 'Sport', 'Limited', 'Premium']);
        return;
      }
      const data = await apiService.getModels(year, make);
      setModels(data);
    } catch (err) {
      console.error('Failed to load models:', err);
      setModels(FALLBACK_MODELS[make] || ['Base Model', 'Sport', 'Limited', 'Premium']);
      setError('Unable to load vehicle models from database. Showing fallback options.');
    } finally {
      setLoading(false);
    }
  };

  const loadTrims = async () => {
    try {
      setLoading(true);
      setError("");
      if (!isSupabaseSupported) {
        setTrims([]);
        setTrim("");
        return;
      }
      const data = await apiService.getTrims(year, make, model);
      setTrims(data);
      if (data.length && !data.includes(trim)) {
        setTrim(data[0]);
      }
    } catch (err) {
      console.error('Failed to load trims:', err);
      setTrims([]);
      setTrim("");
    } finally {
      setLoading(false);
    }
  };

  const mapVehicleResponse = (vehicle: Record<string, unknown>): VehicleData => {
    const tankSize = typeof vehicle.tank_size === 'number' ? vehicle.tank_size : null;
    const mpgHighway = typeof vehicle.UHighway === 'number' && vehicle.UHighway > 0 ? vehicle.UHighway : null;
    const mpgFromRange = typeof vehicle.range === 'number' && tankSize
      ? Math.round(vehicle.range / tankSize)
      : null;
    const mpg = mpgFromRange ?? mpgHighway ?? (typeof vehicle.UCity === 'number' ? vehicle.UCity : null);

    let baseRange: number | null = null;
    if (typeof vehicle.range === 'number' && vehicle.range > 0) {
      baseRange = vehicle.range;
    } else if (tankSize && mpgHighway) {
      baseRange = Math.round(tankSize * mpgHighway);
    }

    return {
      year: typeof vehicle.year === 'number' ? vehicle.year : parseInt(String(vehicle.year || 0), 10),
      make: String(vehicle.make ?? make),
      model: String(vehicle.model ?? model),
      trim: vehicle.trim ? String(vehicle.trim) : undefined,
      mpg: mpg ?? undefined,
      gasType: vehicle.fuelType ? String(vehicle.fuelType) : undefined,
      gasTankSize: tankSize ?? undefined,
      adjustedRange: baseRange ?? undefined,
      baseRange: baseRange ?? undefined,
      horsepower: typeof vehicle.horsepower === 'number' ? Math.round(vehicle.horsepower) : undefined,
      batteryLife: typeof vehicle.charge240 === 'number'
        ? vehicle.charge240
        : typeof vehicle.charge120 === 'number'
          ? vehicle.charge120
          : null,
    };
  };

  const fetchVehicleInfo = async () => {
    try {
      setLoading(true);
      setError("");
      setRequiresManualRange(false);
      setManualRange('');

      if (!isSupabaseSupported) {
        setVehicleInfo(fallbackVehicle);
        return;
      }

      const vehicle = await apiService.getVehicleInfo({
        year,
        make,
        model,
        trim: trim || undefined,
      });

      if (!vehicle) {
        setVehicleInfo({
          year: Number(year) || undefined,
          make,
          model,
          trim: trim || undefined,
        });
        setRequiresManualRange(true);
        return;
      }

      const mapped = mapVehicleResponse(vehicle as Record<string, unknown>);
      setVehicleInfo(mapped);
      setRequiresManualRange(!mapped.adjustedRange);
    } catch (err) {
      console.error('Failed to fetch vehicle info:', err);
      if (!isSupabaseSupported) {
        setVehicleInfo(fallbackVehicle);
        setError('Unable to fetch vehicle details from database. Showing fallback values.');
        setRequiresManualRange(false);
        setManualRange('');
      } else {
        setVehicleInfo({
          year: Number(year) || undefined,
          make,
          model,
          trim: trim || undefined,
        });
        setRequiresManualRange(true);
        setError('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMakeChange = (value: string) => {
    setMake(value);
    setModel(""); // Reset model when make changes
    setTrims([]);
    setTrim("");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg sunset-gradient flex items-center justify-center">
          <Car className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Select your transportation</h2>
        </div>
      </div>

      {/* Vehicle Type Selection - More Compact */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {vehicleOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedType === option.id;
          return (
            <button
              key={option.id}
              onClick={() => setSelectedType(option.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all duration-200 hover:scale-[1.02]",
                isSelected
                  ? "border-primary bg-primary/10 shadow-md"
                  : "border-border hover:border-primary/30 hover:bg-secondary/30"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Vehicle Details - Side-by-Side Layout */}
      {error && (
        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 animate-fade-in">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label htmlFor="year" className="text-xs font-medium text-foreground">
          </Label>
          <Select value={year} onValueChange={setYear} disabled={loading}>
            <SelectTrigger id="year" className="h-9 text-sm">
              {loading && !year ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : (
                <SelectValue placeholder="Year" />
              )}
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="make" className="text-xs font-medium text-foreground">
          </Label>
          <Select value={make} onValueChange={handleMakeChange} disabled={loading || !year}>
            <SelectTrigger id="make" className="h-9 text-sm">
              {loading && year && !make ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : (
                <SelectValue placeholder="Make" />
              )}
            </SelectTrigger>
            <SelectContent>
              {makes.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="model" className="text-xs font-medium text-foreground">
          </Label>
          <Select value={model} onValueChange={setModel} disabled={loading || !make}>
            <SelectTrigger id="model" className="h-9 text-sm">
              {loading && make && !model ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : (
                <SelectValue placeholder={make ? "Model" : "Model "}/>
              )}
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isSupabaseSupported && trims.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor="trim" className="text-xs font-medium text-foreground">
            </Label>
            <Select value={trim} onValueChange={setTrim} disabled={loading}>
              <SelectTrigger id="trim" className="h-9 text-sm">
                {loading && model && !trim ? (
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs">Loading...</span>
                  </div>
                ) : (
                  <SelectValue placeholder="Trim" />
                )}
              </SelectTrigger>
              <SelectContent>
                {trims.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Vehicle Info Display - More Compact */}
      {(vehicleInfo || showFallbackVehicle) && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {vehicleInfo ? 'Vehicle Selected' : 'Default Vehicle'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {vehicleInfo
                    ? `${year} ${make} ${model}${trim ? ` ${trim}` : ''}`
                    : `${fallbackVehicle.year} ${fallbackVehicle.make} ${fallbackVehicle.model}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">
                  {requiresManualRange
                    ? manualRange || '—'
                    : vehicleInfo?.adjustedRange ?? fallbackVehicle.adjustedRange ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">mile range</p>
              </div>
            </div>
          </div>

          {requiresManualRange && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Sorry, we couldn’t find the range for this vehicle. Enter your expected range below:
              </p>
              <Input
                type="number"
                min={0}
                value={manualRange}
                onChange={(event) => setManualRange(event.target.value)}
                placeholder="Enter range in miles"
                className="h-9 text-sm"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
