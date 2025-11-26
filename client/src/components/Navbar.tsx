import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Package, Menu, User as UserIcon, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [, navigate] = useLocation();
  const { user, isLoading, logoutMutation } = useAuth();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      navigate("/auth");
    } catch (error) {
      // errors are surfaced via toast in the mutation
      console.error("Logout failed:", error);
    }
  };

  return (
    <header className="bg-white shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center">
              <Package className="w-6 h-6 text-primary mr-2" />
              <span className="text-xl font-bold text-primary-700">Carry & Connect</span>
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link href="/" className="border-primary text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                Home
              </Link>
              <Link href="/available-deliveries" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                Available Deliveries
              </Link>
              <Link href="/dashboard" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                Dashboard
              </Link>
            </div>
          </div>
          
          <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
            {isLoading ? (
              <div className="text-sm text-gray-500">Checking session…</div>
            ) : user ? (
              <>
                <div className="text-sm font-medium text-gray-700">
                  Welcome, {user.fullName}
                </div>
                <Link href="/profile" className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium inline-flex items-center">
                  <UserIcon className="w-4 h-4 mr-1" />
                  Profile
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLogout}
                  className="flex items-center"
                  disabled={logoutMutation.isPending}
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  {logoutMutation.isPending ? "Logging out…" : "Logout"}
                </Button>
              </>
            ) : (
              <>
                <Link href="/auth" className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium">
                  Login
                </Link>
                <Link href="/auth">
                  <Button size="sm">Register</Button>
                </Link>
              </>
            )}
          </div>
          
          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleMobileMenu}
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`sm:hidden ${isMobileMenuOpen ? 'block' : 'hidden'}`} id="mobile-menu">
        <div className="pt-2 pb-3 space-y-1">
          <Link href="/" className="bg-primary-50 border-primary text-primary-700 block pl-3 pr-4 py-2 border-l-4 text-base font-medium">
            Home
          </Link>
          <Link href="/available-deliveries" className="border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 block pl-3 pr-4 py-2 border-l-4 text-base font-medium">
            Available Deliveries
          </Link>
          <Link href="/dashboard" className="border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 block pl-3 pr-4 py-2 border-l-4 text-base font-medium">
            Dashboard
          </Link>
        </div>
        <div className="pt-4 pb-3 border-t border-gray-200">
          {user ? (
            <div className="flex flex-col space-y-2 px-4">
              <div className="text-sm font-medium text-gray-700">
                Welcome, {user.fullName}
              </div>
              <Link href="/profile" className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 flex items-center">
                <UserIcon className="w-4 h-4 mr-2" />
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 flex items-center disabled:opacity-60"
                disabled={logoutMutation.isPending}
              >
                <LogOut className="w-4 h-4 mr-2" />
                {logoutMutation.isPending ? "Logging out…" : "Logout"}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-around">
              <Link href="/auth" className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800">
                Login
              </Link>
              <Link href="/auth" className="block px-4 py-2 text-base font-medium bg-primary text-white rounded-md">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
