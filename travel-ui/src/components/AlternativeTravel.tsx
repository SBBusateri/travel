import { useState } from "react";
import { Train, Plane, Bot, Clock, DollarSign, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TravelOption {
  id: string;
  type: "train" | "plane";
  provider: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  price: string;
  stops: number;
}

// Sample data - would come from API
const trainOptions: TravelOption[] = [
  {
    id: "1",
    type: "train",
    provider: "Amtrak",
    departureTime: "8:00 AM",
    arrivalTime: "2:30 PM",
    duration: "6h 30m",
    price: "$89",
    stops: 2,
  },
  {
    id: "2",
    type: "train",
    provider: "Amtrak Express",
    departureTime: "10:15 AM",
    arrivalTime: "3:45 PM",
    duration: "5h 30m",
    price: "$125",
    stops: 0,
  },
];

const flightOptions: TravelOption[] = [
  {
    id: "3",
    type: "plane",
    provider: "United Airlines",
    departureTime: "7:30 AM",
    arrivalTime: "9:45 AM",
    duration: "2h 15m",
    price: "$189",
    stops: 0,
  },
  {
    id: "4",
    type: "plane",
    provider: "Delta",
    departureTime: "12:00 PM",
    arrivalTime: "3:30 PM",
    duration: "3h 30m",
    price: "$145",
    stops: 1,
  },
];

function TravelCard({ option, onSelect }: { option: TravelOption; onSelect?: () => void }) {
  const Icon = option.type === "train" ? Train : Plane;
  const [isLoading, setIsLoading] = useState(false);

  const handleSelect = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onSelect?.();
    }, 1000);
  };

  return (
    <div className="group p-4 rounded-xl border-2 border-border bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
              option.type === "train" ? "bg-accent/10" : "bg-primary/10"
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5 transition-colors",
                option.type === "train" ? "text-accent" : "text-primary"
              )}
            />
          </div>
          <div>
            <p className="font-semibold text-foreground">{option.provider}</p>
            <p className="text-xs text-muted-foreground">
              {option.stops === 0 ? "Direct" : `${option.stops} stop${option.stops > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-primary">{option.price}</p>
          <p className="text-xs text-muted-foreground">per person</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-4">
          <div>
            <p className="font-semibold text-foreground text-sm md:text-base">{option.departureTime}</p>
            <p className="text-xs text-muted-foreground">Depart</p>
          </div>
          <div className="flex items-center gap-1 md:gap-2 text-muted-foreground">
            <div className="h-px w-4 md:w-8 bg-border" />
            <div className="flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3" />
              <span className="hidden sm:inline">{option.duration}</span>
              <span className="sm:hidden">{option.duration.replace('h ', 'h').replace('m', '')}</span>
            </div>
            <div className="h-px w-4 md:w-8 bg-border" />
            <ArrowRight className="h-3 md:h-4 w-3 md:w-4" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm md:text-base">{option.arrivalTime}</p>
            <p className="text-xs text-muted-foreground">Arrive</p>
          </div>
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleSelect}
          disabled={isLoading}
          aria-label={`Select ${option.provider} ${option.type}`}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Select"
          )}
        </Button>
      </div>
    </div>
  );
}

export function AlternativeTravel() {
  return (
    <div className="travel-card space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg teal-gradient flex items-center justify-center">
            <Plane className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Alternative Travel</h2>
            <p className="text-sm text-muted-foreground">Compare trains & flights</p>
          </div>
        </div>
      </div>

      {/* AI Recommendation Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-accent/10 via-accent/5 to-primary/10 p-4 border border-accent/20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center">
            <Bot className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">AI Recommendation</h3>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Based on your schedule and preferences, we recommend taking the{" "}
              <span className="font-medium text-accent">Amtrak Express at 10:15 AM</span>. 
              It offers the best balance of cost and comfort for your journey.
            </p>
          </div>
        </div>
      </div>

      {/* Train Options */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Train className="h-5 w-5 text-accent" />
          <h3 className="font-semibold text-foreground">Train Options</h3>
        </div>
        <div className="space-y-3">
          {trainOptions.map((option) => (
            <TravelCard key={option.id} option={option} onSelect={() => {}} />
          ))}
        </div>
      </div>

      {/* Flight Options */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Plane className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Flight Options</h3>
        </div>
        <div className="space-y-3">
          {flightOptions.map((option) => (
            <TravelCard key={option.id} option={option} onSelect={() => {}} />
          ))}
        </div>
      </div>

      {/* Cost Summary */}
      <div className="p-4 rounded-xl bg-secondary/50 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Cost Comparison</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-card">
            <p className="text-xl md:text-2xl font-bold text-foreground">~$45</p>
            <p className="text-xs text-muted-foreground">Driving (est. gas)</p>
          </div>
          <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
            <p className="text-xl md:text-2xl font-bold text-accent">$89</p>
            <p className="text-xs text-muted-foreground">Cheapest Train</p>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-xl md:text-2xl font-bold text-primary">$145</p>
            <p className="text-xs text-muted-foreground">Cheapest Flight</p>
          </div>
        </div>
      </div>
    </div>
  );
}
