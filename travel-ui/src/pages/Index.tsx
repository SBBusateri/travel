import { Header } from "@/components/Header";
import { RouteSection } from "@/components/RouteSection";
import { AlternativeTravel } from "@/components/AlternativeTravel";
import { useState } from "react";

type VehicleData = {
  adjustedRange?: number;
  mpg?: number;
  [key: string]: unknown;
};

const Index = () => {
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);

  const handleVehicleChange = (data: VehicleData) => {
    setVehicleData(data);
  };

  // Extract MPG from vehicle data for gas predictions
  const vehicleMPG = vehicleData?.mpg || 25; // Fallback to 25 MPG

  return (
    <div className="min-h-screen hero-bg">
      <Header />
      
      {/* Hero Section */}
      <section className="container py-8 md:py-12 lg:py-6 px-4">
        <div className="max-w-3xl mx-auto text-center mb-8 md:mb-12">
          <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-foreground mb-4 leading-tight">
            Plan Your Perfect
            <span className="block bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              Road Trip
            </span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="container pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <RouteSection 
            adjustedRange={vehicleData?.adjustedRange} 
            vehicleMPG={vehicleMPG} 
            onVehicleDataChange={handleVehicleChange}
          />
        </div>

        {/* Alternative Travel Section - Full Width */}
        {/* <div className="max-w-7xl mx-auto mt-12 px-4">
          <AlternativeTravel />
        </div> */}
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-card">
        <div className="container text-center">
          <p className="text-sm text-muted-foreground">
            © 2026 . Smart travel planning made simple.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
