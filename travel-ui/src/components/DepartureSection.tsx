import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0"));
const minutes = ["00", "15", "30", "45"];

interface DepartureSectionProps {
  value: Date | null;
  onChange?: (value: Date) => void;
}

const deriveTimeParts = (date: Date) => {
  const hour24 = date.getHours();
  const minuteValue = Math.floor(date.getMinutes() / 15) * 15;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return {
    hour: hour12.toString().padStart(2, "0"),
    minute: minuteValue.toString().padStart(2, "0"),
    period: period as "AM" | "PM"
  };
};

const buildDateWithParts = (baseDate: Date, hour: string, minute: string, period: "AM" | "PM") => {
  const result = new Date(baseDate);
  let hourNumber = parseInt(hour, 10);
  if (Number.isNaN(hourNumber)) {
    hourNumber = 12;
  }
  let minuteNumber = parseInt(minute, 10);
  if (Number.isNaN(minuteNumber)) {
    minuteNumber = 0;
  }

  if (period === "PM" && hourNumber !== 12) {
    hourNumber += 12;
  }
  if (period === "AM" && hourNumber === 12) {
    hourNumber = 0;
  }

  result.setHours(hourNumber, minuteNumber, 0, 0);
  return result;
};

export function DepartureSection({ value, onChange }: DepartureSectionProps) {
  const [date, setDate] = useState<Date | null>(value);
  const [hour, setHour] = useState<string>("12");
  const [minute, setMinute] = useState<string>("00");
  const [period, setPeriod] = useState<"AM" | "PM">("AM");

  const currentValue = useMemo(() => value ?? null, [value]);

  useEffect(() => {
    if (currentValue) {
      setDate(currentValue);
      const parts = deriveTimeParts(currentValue);
      setHour(parts.hour);
      setMinute(parts.minute);
      setPeriod(parts.period);
      return;
    }

    const fallback = new Date();
    const parts = deriveTimeParts(fallback);
    setDate(fallback);
    setHour(parts.hour);
    setMinute(parts.minute);
    setPeriod(parts.period);
    onChange?.(fallback);
  }, [currentValue, onChange]);

  const emitChange = (nextDate: Date | null) => {
    if (!nextDate) return;
    setDate(nextDate);
    onChange?.(nextDate);
  };

  const handleDateChange = (selected: Date | undefined) => {
    if (!selected) return;
    const next = buildDateWithParts(selected, hour, minute, period);
    emitChange(next);
  };

  const handleHourChange = (value: string) => {
    setHour(value);
    if (!date) return;
    emitChange(buildDateWithParts(date, value, minute, period));
  };

  const handleMinuteChange = (value: string) => {
    setMinute(value);
    if (!date) return;
    emitChange(buildDateWithParts(date, hour, value, period));
  };

  const handlePeriodChange = (nextPeriod: "AM" | "PM") => {
    setPeriod(nextPeriod);
    if (!date) return;
    emitChange(buildDateWithParts(date, hour, minute, nextPeriod));
  };

  return (
    <div className="space-y-4">
      {/* Header */}


      {/* Separator Line */}
      <div className="border-t border-dashed border-border/1000 my-2" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg sunset-gradient flex items-center justify-center">
            <Clock className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Departure time</h2>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground">
        </div>
      </div>

      {/* Date & Time Pickers - More Compact */}
      <div className="grid grid-cols-1 gap-2">
        {/* Date Picker */}
        <div className="space-y-1">
          <Label className="text-xs font-medium text-foreground mb-1">Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full h-8 justify-start text-left font-normal text-sm",
                  !date && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-3 w-3" />
                {date ? format(date, "MMM d, yyyy") : <span>Select date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={date}
                onSelect={handleDateChange}
                initialFocus
                className="pointer-events-auto"
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Time Picker */}
        <div className="space-y-1">
          <Label className="text-xs font-medium text-foreground mb-1">Time</Label>
          <div className="flex gap-1">
            <Select value={hour} onValueChange={handleHourChange}>
              <SelectTrigger className="h-8 flex-1 text-sm">
                <SelectValue placeholder="HH" />
              </SelectTrigger>
              <SelectContent>
                {hours.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="flex items-center text-muted-foreground font-bold text-sm">:</span>
            <Select value={minute} onValueChange={handleMinuteChange}>
              <SelectTrigger className="h-8 flex-1 text-sm">
                <SelectValue placeholder="MM" />
              </SelectTrigger>
              <SelectContent>
                {minutes.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex rounded-md border border-input overflow-hidden">
              <button
                onClick={() => handlePeriodChange("AM")}
                className={cn(
                  "px-2 h-8 text-xs font-medium transition-colors",
                  period === "AM"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-secondary"
                )}
              >
                AM
              </button>
              <button
                onClick={() => handlePeriodChange("PM")}
                className={cn(
                  "px-2 h-8 text-xs font-medium transition-colors",
                  period === "PM"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-secondary"
                )}
              >
                PM
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
