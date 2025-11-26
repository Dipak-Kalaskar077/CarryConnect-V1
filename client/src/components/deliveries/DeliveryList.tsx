import { useQuery } from "@tanstack/react-query";
import DeliveryCard from "./DeliveryCard";
import { Delivery, User } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

interface DeliveryListProps {
  queryKey: string;
  emptyMessage?: string;
  showActions?: boolean;
}

const DeliveryList = ({
  queryKey,
  emptyMessage = "No deliveries found",
  showActions = true,
}: DeliveryListProps) => {
  const { data: deliveries, isLoading, error } = useQuery<
    (Delivery & { sender?: User; carrier?: User })[]
  >({
    queryKey: [queryKey],
    queryFn: async () => {
      const res = await fetch(queryKey, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return await res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/4 mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
            <div className="border-t border-gray-200 p-4">
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    // Check if the error is an unauthorized error
    if (error.message.includes("401") || error.message.includes("Unauthorized")) {
      return (
        <div className="text-yellow-600 bg-yellow-50 p-4 rounded-md">
          <p>You need to be logged in to view deliveries.</p>
          <p className="mt-2">Please <Link href="/auth" className="text-blue-600 underline">login or register</Link> to continue.</p>
        </div>
      );
    }
    return <div className="text-red-500">Error loading deliveries: {error.message}</div>;
  }

  if (!deliveries || deliveries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {deliveries.map((delivery) => (
        <DeliveryCard 
          key={delivery.id} 
          delivery={delivery} 
          showActions={showActions}
        />
      ))}
    </div>
  );
};

export default DeliveryList;
