import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import ReviewList from "@/components/reviews/ReviewList";
import DeliveryList from "@/components/deliveries/DeliveryList";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { User } from "@shared/schema";

const ProfilePage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, navigate] = useLocation();
  
  useEffect(() => {
    const fetchUser = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/user", {
          credentials: "include",
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          setUser(null);
          navigate("/auth");
        }
      } catch (error) {
        setUser(null);
        navigate("/auth");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUser();
  }, [navigate]);
  
  // If loading or no user, show loading
  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Format user role for display
  const formatRole = (role: string) => {
    switch (role) {
      case "sender":
        return "Sender";
      case "carrier":
        return "Carrier";
      case "both":
        return "Sender & Carrier";
      default:
        return role;
    }
  };
  
  // Determine if user is a sender, carrier, or both
  const isSender = user.role === "sender" || user.role === "both";
  const isCarrier = user.role === "carrier" || user.role === "both";

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="pb-5 border-b border-gray-200 mb-6">
        <h2 className="text-2xl font-bold leading-tight text-gray-900">User Profile</h2>
        <p className="mt-1 text-sm text-gray-500">View and manage your account information</p>
      </div>
      
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center">
            <Avatar className="h-16 w-16">
              <AvatarFallback>{user.fullName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="ml-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">{user.fullName}</h3>
              <p className="text-sm text-gray-500">
                Username: {user.username}
              </p>
              {user.phoneNumber && (
                <p className="text-sm text-gray-500">
                  📞 {user.phoneNumber}
                </p>
              )}
              {user.rating && (
                <div className="flex items-center mt-1">
                  {[...Array(5)].map((_, i) => (
                    <svg 
                      key={i} 
                      className={`h-4 w-4 ${
                        i < user.rating! ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                      }`}
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                  <span className="ml-1 text-sm text-gray-500">
                    ({user.rating} • {user.totalReviews} {user.totalReviews === 1 ? "review" : "reviews"})
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-8 border-t border-gray-200 pt-8">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <h4 className="text-lg font-medium text-gray-900">Account Information</h4>
                <dl className="mt-2 text-sm text-gray-500">
                  <div className="mt-3">
                    <dt className="font-medium text-gray-500">User Role</dt>
                    <dd className="mt-1 text-gray-900">{formatRole(user.role)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Separator className="my-8" />
      
      <Tabs defaultValue="deliveries" className="w-full">
        <TabsList>
          <TabsTrigger value="deliveries">My Deliveries</TabsTrigger>
          <TabsTrigger value="reviews">My Reviews</TabsTrigger>
        </TabsList>
        
        <TabsContent value="deliveries" className="mt-6">
          {user.role === "both" ? (
            <Tabs defaultValue="sender">
              <TabsList>
                <TabsTrigger value="sender">As Sender</TabsTrigger>
                <TabsTrigger value="carrier">As Carrier</TabsTrigger>
              </TabsList>
              
              <TabsContent value="sender" className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">My Delivery Requests</h3>
                <DeliveryList 
                  queryKey="/api/user/deliveries/sender" 
                  emptyMessage="You haven't created any delivery requests yet."
                />
              </TabsContent>
              
              <TabsContent value="carrier" className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">My Accepted Deliveries</h3>
                <DeliveryList 
                  queryKey="/api/user/deliveries/carrier"
                  emptyMessage="You haven't accepted any deliveries yet."
                />
              </TabsContent>
            </Tabs>
          ) : isSender ? (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-4">My Delivery Requests</h3>
              <DeliveryList 
                queryKey="/api/user/deliveries/sender" 
                emptyMessage="You haven't created any delivery requests yet."
              />
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-4">My Accepted Deliveries</h3>
              <DeliveryList 
                queryKey="/api/user/deliveries/carrier"
                emptyMessage="You haven't accepted any deliveries yet."
              />
            </>
          )}
        </TabsContent>
        
        <TabsContent value="reviews" className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Reviews</h3>
          {user.id && <ReviewList userId={user.id} />}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfilePage;
