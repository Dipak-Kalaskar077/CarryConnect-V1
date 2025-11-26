import { useState } from "react";
import DeliveryList from "@/components/deliveries/DeliveryList";
import DeliveryFilters from "@/components/deliveries/DeliveryFilters";
import { useQuery } from "@tanstack/react-query";
import { Delivery, User } from "@shared/schema";

const AvailableDeliveriesPage = () => {
  const [filters, setFilters] = useState<Record<string, string | number>>({});
  
  // Build the query string for filtering
  const buildQueryString = () => {
    const queryParams = new URLSearchParams();
    
    // Add status=requested filter by default
    queryParams.append("status", "requested");
    
    // Add any additional filters (convert numbers to strings for query params)
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "any") {
        queryParams.append(key, String(value));
      }
    });
    
    return `/api/deliveries?${queryParams.toString()}`;
  };
  
  // Custom query key that changes when filters change
  const queryKey = buildQueryString();
  
  const handleFilterChange = (newFilters: Record<string, string>) => {
    setFilters(newFilters);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="pb-5 border-b border-gray-200 mb-6">
        <h2 className="text-2xl font-bold leading-tight text-gray-900">Available Deliveries</h2>
        <p className="mt-2 text-sm text-gray-500">These packages need carriers. Login to accept a delivery.</p>
      </div>

      {/* Filters */}
      <DeliveryFilters onFilterChange={handleFilterChange} />

      {/* Delivery listings */}
      <DeliveryList 
        queryKey={queryKey} 
        emptyMessage="No deliveries match your filters. Try adjusting your search criteria."
      />

      {/* Pagination - To be implemented in future versions */}
      {/* <div className="mt-6 flex justify-center">
        <Pagination />
      </div> */}
    </div>
  );
};

export default AvailableDeliveriesPage;
