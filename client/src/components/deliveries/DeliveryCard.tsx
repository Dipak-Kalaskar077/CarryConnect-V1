import { Delivery, User } from "@shared/schema";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import DeliveryStatusBadge from "./DeliveryStatusBadge";
import { 
  Package, Clock, DollarSign,
  CheckCircle, LogIn, User as UserIcon
} from "lucide-react";

interface DeliveryCardProps {
  delivery: Delivery & {
    sender?: User;
    carrier?: User;
  };
  showActions?: boolean;
}

const DeliveryCard = ({ delivery, showActions = true }: DeliveryCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const acceptDeliveryMutation = useMutation({
    mutationFn: async (deliveryId: number) => {
      const res = await apiRequest("PATCH", `/api/deliveries/${deliveryId}/status`, { status: "accepted" });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Delivery accepted",
        description: "You have successfully accepted this delivery",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/deliveries"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept delivery",
        variant: "destructive",
      });
    },
  });

  // Format currency from cents to dollars/rupees
  const formatCurrency = (amount: number) => {
    return `₹${(amount / 100).toFixed(2)}`;
  };

  const shouldFetchSenderProfile = !delivery.sender?.fullName && !!delivery.senderId;
  const { data: senderProfile } = useQuery({
    queryKey: ["sender-profile", delivery.senderId],
    enabled: shouldFetchSenderProfile,
    queryFn: async () => {
      const res = await fetch(`/api/users/${delivery.senderId}/profile`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load sender profile");
      }
      return await res.json();
    },
  });

  // Format package size
  const formatPackageSize = (size: string, weight: number) => {
    const weightInKg = weight / 1000;
    return `${size.charAt(0).toUpperCase() + size.slice(1)} package (${weightInKg} kg)`;
  };

  const senderName = delivery.sender?.fullName || senderProfile?.fullName;
  const senderPhone = delivery.sender?.phoneNumber || senderProfile?.phoneNumber;

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="pt-6 flex-grow">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {delivery.pickupLocation} → {delivery.dropLocation}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {delivery.preferredDeliveryDate}
            </p>
            {senderName && (
              <div className="mt-2 flex items-center text-sm text-gray-600">
                <UserIcon className="h-4 w-4 mr-2 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-700">Sender: {senderName}</p>
                  {senderPhone && <p className="text-xs text-gray-500">+91 {senderPhone}</p>}
                </div>
              </div>
            )}
          </div>
          <DeliveryStatusBadge status={delivery.status} />
        </div>
        
        <div className="mt-4 space-y-3">
          <div className="flex items-center text-sm">
            <Package className="text-gray-400 mr-2 h-5 w-5" />
            <p className="text-gray-500">
              {formatPackageSize(delivery.packageSize, delivery.packageWeight)}
            </p>
          </div>
          <div className="flex items-center text-sm">
            <Clock className="text-gray-400 mr-2 h-5 w-5" />
            <p className="text-gray-500">{delivery.preferredDeliveryTime}</p>
          </div>
          <div className="flex items-center text-sm">
            <DollarSign className="text-gray-400 mr-2 h-5 w-5" />
            <p className="text-gray-500">{formatCurrency(delivery.deliveryFee)} delivery fee</p>
          </div>
        </div>
      </CardContent>
      
      {showActions && (
        <CardFooter className="pt-0 border-t">
          {user ? (
            delivery.status === "requested" ? (
              user.id === delivery.senderId ? (
                <div className="w-full text-center py-3 rounded-md bg-gray-100 text-gray-700 text-sm font-medium">
                  Awaiting Delivery Acceptance
                </div>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => acceptDeliveryMutation.mutate(delivery.id)}
                  disabled={acceptDeliveryMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept Delivery
                </Button>
              )
            ) : (
              <Link href={`/deliveries/${delivery.id}`}>
                <Button variant="outline" className="w-full">
                  View Details
                </Button>
              </Link>
            )
          ) : (
            <Link href="/auth">
              <Button variant="secondary" className="w-full">
                <LogIn className="h-4 w-4 mr-2" />
                Login to Accept
              </Button>
            </Link>
          )}
        </CardFooter>
      )}
    </Card>
  );
};

export default DeliveryCard;
