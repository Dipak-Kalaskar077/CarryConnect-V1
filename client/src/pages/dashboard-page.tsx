import { useState } from "react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import DeliveryList from "@/components/deliveries/DeliveryList";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";

const DashboardPage = () => {
  // Query user data from the backend
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/user"],
  });
  
  const [activeTab, setActiveTab] = useState("carrier");

  // These settings work whether user is logged in or not
  const isSender = user?.role === "sender" || user?.role === "both" || !user;
  const isCarrier = user?.role === "carrier" || user?.role === "both" || !user;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="pb-5 border-b border-gray-200 mb-6 flex flex-col md:flex-row md:justify-between md:items-center">
        <div>
          <h2 className="text-2xl font-bold leading-tight text-gray-900">Dashboard</h2>
          <p className="mt-1 text-sm text-gray-500">Manage your package deliveries</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-wrap gap-3 items-center">
          {isSender && (
            <Link href="/create-delivery">
              <Button className="flex items-center">
                <Plus className="h-4 w-4 mr-2" />
                Create Delivery
              </Button>
            </Link>
          )}
          {isCarrier && (
            <Link href="/available-deliveries">
              <Button variant="outline" className="flex items-center">
                <Search className="h-4 w-4 mr-2" />
                Find Deliveries
              </Button>
            </Link>
          )}
        </div>
      </div>

      {user?.role === "both" && (
        <Tabs 
          defaultValue={activeTab} 
          onValueChange={setActiveTab}
          className="mb-6"
        >
          <TabsList>
            <TabsTrigger value="sender">As Sender</TabsTrigger>
            <TabsTrigger value="carrier">As Carrier</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {(activeTab === "sender" && isSender) && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">My Delivery Requests</h3>
          <DeliveryList 
            queryKey="/api/user/deliveries/sender" 
            emptyMessage="You haven't created any delivery requests yet. Click 'Create Delivery' to get started."
          />
        </div>
      )}

      {(activeTab === "carrier" && isCarrier) && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">My Accepted Deliveries</h3>
          <DeliveryList 
            queryKey="/api/user/deliveries/carrier"
            emptyMessage="You haven't accepted any deliveries yet. Click 'Find Deliveries' to browse available requests."
          />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
