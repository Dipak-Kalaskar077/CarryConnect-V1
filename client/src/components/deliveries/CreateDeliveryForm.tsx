import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createDeliverySchema, CreateDeliveryInput } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

const CreateDeliveryForm = () => {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const locations = ["Pune", "Mumbai", "Bangalore", "Delhi", "Chennai", "Hyderabad"];
  const packageSizes = [
    { value: "small", label: "Small (up to 2 kg)" },
    { value: "medium", label: "Medium (2-5 kg)" },
    { value: "large", label: "Large (5-10 kg)" },
  ];
  const deliveryTimes = [
    "Before 12:00 PM",
    "Before 2:00 PM",
    "Before 6:00 PM",
    "Before 9:00 PM",
  ];

  const form = useForm<CreateDeliveryInput>({
    resolver: zodResolver(createDeliverySchema),
    mode: "onChange",
    defaultValues: {
      pickupLocation: "Bangalore",
      dropLocation: "Mumbai",
      packageSize: "medium",
      packageWeight: 1000, // 1 kg in grams
      preferredDeliveryDate: new Date().toISOString().split("T")[0],
      preferredDeliveryTime: "Before 6:00 PM",
      deliveryFee: 30000, // 300 rupees in cents (300 * 100)
      description: "",
      specialInstructions: "",
    },
  });

  const createDeliveryMutation = useMutation({
    mutationFn: async (data: CreateDeliveryInput) => {
      // Ensure deliveryFee is at least 1 cent (100 = 1 rupee)
      const deliveryFee = typeof data.deliveryFee === "number" ? data.deliveryFee : 0;
      const packageWeight = typeof data.packageWeight === "number" ? data.packageWeight : 0;
      
      // Remove carrierId if present (shouldn't be set on creation)
      const { carrierId, ...cleanData } = data as any;
      
      const payload = {
        ...cleanData,
        deliveryFee: Math.max(100, deliveryFee),
        packageWeight: Math.max(1, packageWeight),
        // Ensure date is a string
        preferredDeliveryDate: String(data.preferredDeliveryDate || ""),
        // Ensure time is a string
        preferredDeliveryTime: String(data.preferredDeliveryTime || ""),
        // Ensure optional fields are either string or null
        description: data.description || null,
        specialInstructions: data.specialInstructions || null,
      };
      
      console.log("Sending payload to API:", payload);
      const res = await apiRequest("POST", "/api/deliveries", payload);
      const result = await res.json();
      console.log("API response:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("Delivery created successfully:", data);
      toast({
        title: "Success",
        description: "Delivery request created successfully",
      });
      // Reset form to default values
      form.reset({
        pickupLocation: "Bangalore",
        dropLocation: "Mumbai",
        packageSize: "medium",
        packageWeight: 1000,
        preferredDeliveryDate: new Date().toISOString().split("T")[0],
        preferredDeliveryTime: "Before 6:00 PM",
        deliveryFee: 30000,
        description: "",
        specialInstructions: "",
      });
      // Invalidate all relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/user/deliveries/sender"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliveries"] });
      // Also invalidate any filtered queries
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/deliveries");
        }
      });
      // Navigate after a short delay to allow toast to show
      setTimeout(() => {
        navigate("/dashboard");
      }, 500);
    },
    onError: (error: Error) => {
      console.error("Delivery creation error:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      
      // Check if the error is due to being unauthorized
      if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        toast({
          title: "Authentication Required",
          description: "You need to be logged in to create a delivery. Please login or register first.",
          variant: "destructive",
        });
        navigate("/auth");
      } else if (error.message.includes("400") || error.message.includes("Validation")) {
        // Try to parse validation errors from response
        let errorMessage = "Please check your input and try again";
        try {
          // Try to extract JSON from error message
          const jsonMatch = error.message.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
              errorMessage = errorData.errors.map((e: any) => {
                const field = e.path ? `${e.path}: ` : "";
                return `${field}${e.message}`;
              }).join(", ");
            } else if (errorData.message) {
              errorMessage = errorData.message;
            }
          } else if (error.message) {
            errorMessage = error.message.replace(/^\d+:\s*/, "");
          }
        } catch (parseError) {
          console.error("Error parsing error message:", parseError);
          errorMessage = error.message || "Failed to create delivery request";
        }
        
        toast({
          title: "Validation Error",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        const errorMessage = error.message.replace(/^\d+:\s*/, "") || "Failed to create delivery request. Please try again.";
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (data: CreateDeliveryInput) => {
    console.log("Form submitted with data:", data);
    // Validate required fields before submission
    if (!data.pickupLocation || !data.dropLocation) {
      toast({
        title: "Validation Error",
        description: "Please select both pickup and drop locations",
        variant: "destructive",
      });
      return;
    }
    if (!data.packageSize) {
      toast({
        title: "Validation Error",
        description: "Please select a package size",
        variant: "destructive",
      });
      return;
    }
    if (!data.packageWeight || data.packageWeight < 1) {
      toast({
        title: "Validation Error",
        description: "Package weight must be at least 1 gram",
        variant: "destructive",
      });
      return;
    }
    if (!data.deliveryFee || data.deliveryFee < 100) {
      toast({
        title: "Validation Error",
        description: "Delivery fee must be at least ₹1",
        variant: "destructive",
      });
      return;
    }
    if (!data.preferredDeliveryDate) {
      toast({
        title: "Validation Error",
        description: "Please select a delivery date",
        variant: "destructive",
      });
      return;
    }
    if (!data.preferredDeliveryTime) {
      toast({
        title: "Validation Error",
        description: "Please select a delivery time",
        variant: "destructive",
      });
      return;
    }
    createDeliveryMutation.mutate(data);
  };

  useEffect(() => {
    if (Object.keys(form.formState.errors).length > 0) {
      console.log("CreateDeliveryForm validation errors:", form.formState.errors);
    }
  }, [form.formState.errors]);

  const handleFormSubmit = form.handleSubmit(
    onSubmit,
    (errors) => {
      console.log("Validation prevented submit:", errors);
      const firstError = Object.values(errors)[0];
      if (firstError) {
        toast({
          title: "Validation Error",
          description: firstError.message?.toString() || "Please review the highlighted fields.",
          variant: "destructive",
        });
      }
    },
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={handleFormSubmit} noValidate className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Pickup Location */}
              <FormField
                control={form.control}
                name="pickupLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup Location</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={String(field.value || "")}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select pickup location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location} value={location}>
                            {location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Drop Location */}
              <FormField
                control={form.control}
                name="dropLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Drop Location</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={String(field.value || "")}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select drop location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location} value={location}>
                            {location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Package Size */}
              <FormField
                control={form.control}
                name="packageSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Package Size</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={String(field.value || "")}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select package size" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {packageSizes.map((size) => (
                          <SelectItem key={size.value} value={size.value}>
                            {size.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Package Weight */}
              <FormField
                control={form.control}
                name="packageWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Package Weight (grams)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        value={typeof field.value === "number" ? field.value : ""}
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        onChange={(e) => {
                          const nextValue = e.target.valueAsNumber;
                          field.onChange(Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Weight in grams (1kg = 1000g)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Delivery Date */}
              <FormField
                control={form.control}
                name="preferredDeliveryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Delivery Time */}
              <FormField
                control={form.control}
                name="preferredDeliveryTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Time</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={String(field.value || "")}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select delivery time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {deliveryTimes.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Delivery Fee */}
              <FormField
                control={form.control}
                name="deliveryFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Fee (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={typeof field.value === "number" && field.value > 0 ? field.value / 100 : ""}
                        onChange={(e) => {
                          const rupees = e.target.value;
                          const parsed = Number(rupees);
                          if (rupees === "" || isNaN(parsed)) {
                            field.onChange(0);
                          } else if (parsed >= 1) {
                            field.onChange(Math.round(parsed * 100));
                          }
                        }}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>Enter amount in Rupees</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Package Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Package Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of your package contents (optional)"
                      value={field.value || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                    />
                  </FormControl>
                  <FormDescription>
                    Brief description to help carriers identify your package.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Special Instructions */}
            <FormField
              control={form.control}
              name="specialInstructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any special handling instructions (optional)"
                      value={field.value || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                    />
                  </FormControl>
                  <FormDescription>
                    Any handling instructions or delivery preferences.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => navigate("/dashboard")}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createDeliveryMutation.isPending}
              >
                {createDeliveryMutation.isPending ? "Creating..." : "Create Delivery Request"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default CreateDeliveryForm;
