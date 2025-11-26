import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TruckIcon, Package } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

// Login form schema
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

// Registration form schema
const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(1, "Full name is required"),
  role: z.enum(["sender", "carrier", "both"]),
  phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits").optional().nullable(),
  // Allow either true or false for terms during development
  terms: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

const AuthPage = () => {
  // Temporarily removed useAuth dependency
  const [, setLocation] = useLocation();
  const { loginMutation, registerMutation } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("login");
  const [isPending, setIsPending] = useState(false);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      fullName: "",
      role: "both",
      phoneNumber: "",
      terms: false,
    },
  });

  const onLoginSubmit = async (data: LoginFormValues) => {
    try {
      setIsPending(true);
      await loginMutation.mutateAsync({
        username: data.username,
        password: data.password,
      });

      setLocation("/dashboard");
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setIsPending(false);
    }
  };

  const onRegisterSubmit = async (data: RegisterFormValues) => {
    try {
      setIsPending(true);
      await registerMutation.mutateAsync({
        username: data.username,
        password: data.password,
        fullName: data.fullName,
        role: data.role,
        phoneNumber: data.phoneNumber || null,
      });

      setLocation("/dashboard");
    } catch (error) {
      console.error("Registration error:", error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col py-12">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Package className="h-12 w-12 text-primary" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {activeTab === "login" ? "Sign in to your account" : "Create your account"}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-5xl px-4">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left side: Auth forms */}
            <div className="md:w-1/2">
              <Tabs 
                defaultValue="login" 
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex items-center justify-between">
                        <FormField
                          control={loginForm.control}
                          name="rememberMe"
                          render={({ field }) => (
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="remember-me"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                              <label
                                htmlFor="remember-me"
                                className="text-sm font-medium text-gray-700"
                              >
                                Remember me
                              </label>
                            </div>
                          )}
                        />

                        <div className="text-sm">
                          <a href="#" className="font-medium text-primary hover:text-primary-600">
                            Forgot your password?
                          </a>
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={isPending}
                      >
                        {isPending ? "Signing in..." : "Sign in"}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
                
                <TabsContent value="register">
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-6">
                      <FormField
                        control={registerForm.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="johndoe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>I want to be a</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select your role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="sender">Sender (send packages)</SelectItem>
                                <SelectItem value="carrier">Carrier (deliver packages)</SelectItem>
                                <SelectItem value="both">Both</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number (10 digits)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="1234567890" 
                                {...field}
                                maxLength={10}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, ''); // Only digits
                                  field.onChange(value);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="terms"
                        render={({ field }) => (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="terms"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                            <label
                              htmlFor="terms"
                              className="text-sm font-medium text-gray-700"
                            >
                              I agree to the{" "}
                              <a href="#" className="text-primary hover:text-primary-600">
                                Terms
                              </a>{" "}
                              and{" "}
                              <a href="#" className="text-primary hover:text-primary-600">
                                Privacy Policy
                              </a>
                            </label>
                            {registerForm.formState.errors.terms && (
                              <p className="text-sm font-medium text-destructive">
                                {registerForm.formState.errors.terms.message}
                              </p>
                            )}
                          </div>
                        )}
                      />

                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={isPending}
                      >
                        {isPending ? "Creating account..." : "Create account"}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </div>
            
            {/* Right side: App info */}
            <div className="md:w-1/2 bg-gray-50 rounded-lg p-6 mt-6 md:mt-0">
              <div className="text-center">
                <TruckIcon className="mx-auto h-12 w-12 text-primary" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">
                  Join Carry & Connect Today
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Connect with people traveling your route to deliver packages efficiently
                </p>
              </div>
              
              <div className="mt-8">
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">For Senders</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>
                        Create delivery requests and save money by connecting with carriers
                        who are already traveling your route.
                      </CardDescription>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">For Carriers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>
                        Earn extra income by delivering packages along routes you're already traveling.
                      </CardDescription>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">How It Works</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                        <li>Create an account</li>
                        <li>Post a delivery request or browse available deliveries</li>
                        <li>Connect with senders/carriers</li>
                        <li>Complete deliveries and leave reviews</li>
                      </ol>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
