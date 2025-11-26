import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Search, X } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DeliveryFiltersProps {
  onFilterChange: (filters: Record<string, string>) => void;
}

const DeliveryFilters = ({ onFilterChange }: DeliveryFiltersProps) => {
  const [location, setLocation] = useLocation();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  
  // Parse query parameters from the URL
  const getParamsFromUrl = () => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      return {
        pickupLocation: searchParams.get("pickupLocation") || "any",
        dropLocation: searchParams.get("dropLocation") || "any",
        packageSize: searchParams.get("packageSize") || "any",
        minWeight: searchParams.get("minWeight") || "",
        maxWeight: searchParams.get("maxWeight") || "",
        minFee: searchParams.get("minFee") || "",
        maxFee: searchParams.get("maxFee") || "",
        minRating: searchParams.get("minRating") || "",
        startDate: searchParams.get("startDate") || "",
        endDate: searchParams.get("endDate") || "",
      };
    }
    return { 
      pickupLocation: "any", 
      dropLocation: "any", 
      packageSize: "any",
      minWeight: "",
      maxWeight: "",
      minFee: "",
      maxFee: "",
      minRating: "",
      startDate: "",
      endDate: "",
    };
  };
  
  const [filters, setFilters] = useState(getParamsFromUrl());

  useEffect(() => {
    // Apply initial filters from URL if present
    if (Object.values(filters).some(value => value && value !== "any")) {
      onFilterChange(filters);
    }
  }, []);

  const locations = [
    { value: "any", label: "Any location" },
    { value: "Pune", label: "Pune" },
    { value: "Mumbai", label: "Mumbai" },
    { value: "Bangalore", label: "Bangalore" },
    { value: "Delhi", label: "Delhi" },
    { value: "Chennai", label: "Chennai" },
    { value: "Hyderabad", label: "Hyderabad" }
  ];
  
  const packageSizes = [
    { value: "any", label: "Any size" },
    { value: "small", label: "Small" },
    { value: "medium", label: "Medium" },
    { value: "large", label: "Large" },
  ];

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    const cleared = {
      pickupLocation: "any",
      dropLocation: "any",
      packageSize: "any",
      minWeight: "",
      maxWeight: "",
      minFee: "",
      maxFee: "",
      minRating: "",
      startDate: "",
      endDate: "",
    };
    setFilters(cleared);
    onFilterChange({});
  };

  const applyFilters = () => {
    // For backend filters, remove "any" values and empty strings
    const backendFilters: Record<string, string> = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "any") {
        backendFilters[key] = value;
      }
    });
    
    // Notify parent component
    onFilterChange(backendFilters);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Filter Deliveries</CardTitle>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Basic Filters */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="from-location" className="block text-sm font-medium text-gray-700 mb-1">
                Pickup Location
              </label>
              <Select
                value={filters.pickupLocation}
                onValueChange={(value) => handleFilterChange("pickupLocation", value)}
              >
                <SelectTrigger id="from-location">
                  <SelectValue placeholder="Any location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.value} value={loc.value}>
                      {loc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label htmlFor="to-location" className="block text-sm font-medium text-gray-700 mb-1">
                Drop Location
              </label>
              <Select
                value={filters.dropLocation}
                onValueChange={(value) => handleFilterChange("dropLocation", value)}
              >
                <SelectTrigger id="to-location">
                  <SelectValue placeholder="Any location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.value} value={loc.value}>
                      {loc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label htmlFor="package-size" className="block text-sm font-medium text-gray-700 mb-1">
                Package Size
              </label>
              <Select
                value={filters.packageSize}
                onValueChange={(value) => handleFilterChange("packageSize", value)}
              >
                <SelectTrigger id="package-size">
                  <SelectValue placeholder="Any size" />
                </SelectTrigger>
                <SelectContent>
                  {packageSizes.map((size) => (
                    <SelectItem key={size.value} value={size.value}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button 
                className="w-full flex items-center justify-center"
                onClick={applyFilters}
              >
                <Search className="h-4 w-4 mr-2" />
                Apply Filters
              </Button>
            </div>
          </div>

          {/* Advanced Filters */}
          <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full">
                {isAdvancedOpen ? "Hide" : "Show"} Advanced Filters
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label htmlFor="min-weight" className="block text-sm font-medium text-gray-700 mb-1">
                    Min Weight (grams)
                  </label>
                  <Input
                    id="min-weight"
                    type="number"
                    placeholder="e.g., 1000"
                    value={filters.minWeight}
                    onChange={(e) => handleFilterChange("minWeight", e.target.value)}
                  />
                </div>
                
                <div>
                  <label htmlFor="max-weight" className="block text-sm font-medium text-gray-700 mb-1">
                    Max Weight (grams)
                  </label>
                  <Input
                    id="max-weight"
                    type="number"
                    placeholder="e.g., 5000"
                    value={filters.maxWeight}
                    onChange={(e) => handleFilterChange("maxWeight", e.target.value)}
                  />
                </div>
                
                <div>
                  <label htmlFor="min-fee" className="block text-sm font-medium text-gray-700 mb-1">
                    Min Fee (₹)
                  </label>
                  <Input
                    id="min-fee"
                    type="number"
                    placeholder="e.g., 100"
                    value={filters.minFee}
                    onChange={(e) => handleFilterChange("minFee", e.target.value)}
                  />
                </div>
                
                <div>
                  <label htmlFor="max-fee" className="block text-sm font-medium text-gray-700 mb-1">
                    Max Fee (₹)
                  </label>
                  <Input
                    id="max-fee"
                    type="number"
                    placeholder="e.g., 1000"
                    value={filters.maxFee}
                    onChange={(e) => handleFilterChange("maxFee", e.target.value)}
                  />
                </div>
                
                <div>
                  <label htmlFor="min-rating" className="block text-sm font-medium text-gray-700 mb-1">
                    Min Carrier Rating
                  </label>
                  <Input
                    id="min-rating"
                    type="number"
                    min="1"
                    max="5"
                    placeholder="1-5"
                    value={filters.minRating}
                    onChange={(e) => handleFilterChange("minRating", e.target.value)}
                  />
                </div>
                
                <div>
                  <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <Input
                    id="start-date"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange("startDate", e.target.value)}
                  />
                </div>
                
                <div>
                  <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <Input
                    id="end-date"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange("endDate", e.target.value)}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeliveryFilters;
