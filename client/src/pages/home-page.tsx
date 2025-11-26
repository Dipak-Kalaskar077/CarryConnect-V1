import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  PackageCheck, Users, CreditCard,
  Edit, UserCheck, ArrowRight
} from "lucide-react";
import { useEffect, useState } from "react";
import { User } from "@shared/schema";

const HomePage = () => {
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/user", {
          credentials: "include",
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (error) {
        setUser(null);
      }
    };
    
    fetchUser();
  }, []);

  return (
    <>
      {/* Hero Section */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
              <span className="block">Community-driven</span>
              <span className="block text-primary">Package Delivery</span>
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              Connect with people who are already traveling your route to deliver your packages. Save money, reduce traffic, and lower carbon emissions.
            </p>
            <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
              <div className="rounded-md shadow">
                <Link href={user ? "/dashboard" : "/auth"}>
                  <Button size="lg" className="w-full">
                    Get started
                  </Button>
                </Link>
              </div>
              <div className="mt-3 sm:mt-0 sm:ml-3">
                <Link href="/available-deliveries">
                  <Button size="lg" variant="outline" className="w-full">
                    View Deliveries
                  </Button>
                </Link>
              </div>
              {user && (
                <div className="mt-3 sm:mt-0 sm:ml-3">
                  <Link href="/create-delivery">
                    <Button size="lg" variant="secondary" className="w-full">
                      Create Delivery Request
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* How it works section */}
        <div className="bg-gray-50 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:text-center">
              <h2 className="text-base text-primary font-semibold tracking-wide uppercase">
                How it works
              </h2>
              <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Delivery made simple
              </p>
              <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
                A community approach to package delivery, saving costs and helping the environment.
              </p>
            </div>

            <div className="mt-10">
              <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-10">
                <div className="relative">
                  <dt>
                    <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white">
                      <Edit className="h-6 w-6" />
                    </div>
                    <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                      Create a delivery request
                    </p>
                  </dt>
                  <dd className="mt-2 ml-16 text-base text-gray-500">
                    Specify pickup, drop location, package size, and preferred time.
                  </dd>
                </div>

                <div className="relative">
                  <dt>
                    <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white">
                      <UserCheck className="h-6 w-6" />
                    </div>
                    <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                      Match with a carrier
                    </p>
                  </dt>
                  <dd className="mt-2 ml-16 text-base text-gray-500">
                    Get matched with people who are already traveling along your route.
                  </dd>
                </div>

                <div className="relative">
                  <dt>
                    <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white">
                      <ArrowRight className="h-6 w-6" />
                    </div>
                    <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                      Track your delivery
                    </p>
                  </dt>
                  <dd className="mt-2 ml-16 text-base text-gray-500">
                    Follow the entire journey from request to delivery completion.
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
        
        {/* Benefits Section */}
        <div className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:text-center">
              <h2 className="text-base text-primary font-semibold tracking-wide uppercase">
                Benefits
              </h2>
              <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Why use Carry & Connect?
              </p>
            </div>

            <div className="mt-10">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                <div className="pt-6">
                  <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8">
                    <div className="-mt-6">
                      <div>
                        <span className="inline-flex items-center justify-center p-3 bg-primary rounded-md shadow-lg">
                          <CreditCard className="h-6 w-6 text-white" />
                        </span>
                      </div>
                      <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">Save Money</h3>
                      <p className="mt-5 text-base text-gray-500">
                        Lower delivery costs compared to traditional courier services by connecting with people already traveling your route.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8">
                    <div className="-mt-6">
                      <div>
                        <span className="inline-flex items-center justify-center p-3 bg-primary rounded-md shadow-lg">
                          <Users className="h-6 w-6 text-white" />
                        </span>
                      </div>
                      <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">Community Powered</h3>
                      <p className="mt-5 text-base text-gray-500">
                        Support the local community by enabling people to earn extra income from trips they're already taking.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8">
                    <div className="-mt-6">
                      <div>
                        <span className="inline-flex items-center justify-center p-3 bg-primary rounded-md shadow-lg">
                          <PackageCheck className="h-6 w-6 text-white" />
                        </span>
                      </div>
                      <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">Eco-Friendly</h3>
                      <p className="mt-5 text-base text-gray-500">
                        Reduce carbon emissions by utilizing existing trips instead of creating dedicated delivery journeys.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* CTA Section */}
        <div className="bg-primary">
          <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              <span className="block">Ready to start?</span>
              <span className="block text-gray-100">Join our community today.</span>
            </h2>
            <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
              <div className="inline-flex rounded-md shadow">
                <Link href={user ? "/dashboard" : "/auth"}>
                  <Button className="bg-white text-primary hover:bg-gray-100 border-white">
                    Get started
                  </Button>
                </Link>
              </div>
              <div className="ml-3 inline-flex rounded-md shadow">
                <Link href="/available-deliveries">
                  <Button variant="outline" className="text-white border-white hover:bg-white hover:text-primary">
                    View Deliveries
                  </Button>
                </Link>
              </div>
              {user && (
                <div className="ml-3 inline-flex rounded-md shadow">
                  <Link href="/create-delivery">
                    <Button variant="outline" className="text-white border-white hover:bg-white hover:text-primary">
                      Create Delivery Request
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default HomePage;
