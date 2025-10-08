import { Menu, LogOut, User, X, History } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";
import { SearchBar } from "./SearchBar";

interface NavigationProps {
  onSearchStateChange?: (isOpen: boolean) => void;
  onAccountModalChange?: (isOpen: boolean) => void;
  isTrailerPlaying?: boolean;
}

// Commenting out these interfaces since they might be defined in their respective files
// and we don't have access to those to check the exact definitions
// Instead, we'll just remove type checking by using any for now

/*
// Define the props interfaces for the modal components
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SignInModalProps extends ModalProps {
  onSignUp: () => void;
}

interface SignUpModalProps extends ModalProps {
  onSignIn: () => void;
}

interface AccountModalProps extends ModalProps {}

// Update SearchBar interface
interface SearchBarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}
*/

export const Navigation = (props: NavigationProps) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      if (scrollPosition > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (showMobileMenu) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }, [showMobileMenu]);

  useEffect(() => {
    props.onSearchStateChange?.(isSearchOpen);
  }, [isSearchOpen, props.onSearchStateChange]);

  const toggleMobileMenu = () => {
    setShowMobileMenu(!showMobileMenu);
  };

  const toggleProfileMenu = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  // Remove handleLogout and handleOpenAccount, handleCloseAccount, and related logic

  useEffect(() => {
    return () => {
      props.onAccountModalChange?.(false);
    };
  }, [props.onAccountModalChange]);

  const isOnTrendingPage = location.pathname === '/trending';

  // Remove any UI that depends on user or authentication

  return (
    <>
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
        props.isTrailerPlaying && "opacity-0 pointer-events-none",
        isScrolled ? "bg-background/90 backdrop-blur-md border-b border-border/30 shadow-md" : "bg-transparent"
      )}>
        <div className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 md:h-20 items-center justify-between">
            {/* Left section - Logo */}
            <div className="flex-shrink-0">
              <Link to="/" className="flex items-center gap-2.5 group">
                <span className="brand-logo text-base md:text-lg whitespace-nowrap">
                  <span className="text-white/90">PULSE</span>
                </span>
              </Link>
            </div>

            {/* Center section - Main Navigation */}
            <div className="hidden md:flex items-center justify-center flex-1 mx-auto">
              <div className="flex items-center justify-center gap-8 lg:gap-12">
                <Link 
                  to="/" 
                  className={cn(
                    "text-sm font-medium transition-all duration-300 hover:text-primary/90 relative py-2 px-1",
                    "after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-primary after:rounded-full",
                    "after:transform after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300",
                    location.pathname === '/' && "text-primary after:scale-x-100",
                    location.pathname !== '/' && "text-gray-300"
                  )}
                >
                  Featured
                </Link>
                <Link 
                  to="/trending" 
                  className={cn(
                    "text-sm font-medium transition-all duration-300 hover:text-primary/90 relative py-2 px-1",
                    "after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-primary after:rounded-full",
                    "after:transform after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300",
                    location.pathname === '/trending' && "text-primary after:scale-x-100",
                    location.pathname !== '/trending' && "text-gray-300"
                  )}
                >
                  Trending
                </Link>
                <Link 
                  to="/watch-history" 
                  className={cn(
                    "text-sm font-medium transition-all duration-300 hover:text-primary/90 relative py-2 px-1",
                    "after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-primary after:rounded-full",
                    "after:transform after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300",
                    location.pathname === '/watch-history' && "text-primary after:scale-x-100",
                    location.pathname !== '/watch-history' && "text-gray-300"
                  )}
                >
                  Watch History
                </Link>
                <Link 
                  to="/more" 
                  className={cn(
                    "text-sm font-medium transition-all duration-300 hover:text-primary/90 relative py-2 px-1",
                    "after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-primary after:rounded-full",
                    "after:transform after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300",
                    location.pathname === '/more' && "text-primary after:scale-x-100",
                    location.pathname !== '/more' && "text-gray-300"
                  )}
                >
                  More
                </Link>
              </div>
            </div>

            {/* Right section - User Actions */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Search Bar */}
              <SearchBar isOpen={isSearchOpen} setIsOpen={setIsSearchOpen} />

              {/* Profile Menu Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-background border border-border rounded-lg shadow-lg py-1 z-50">
                  <button
                    onClick={() => props.onAccountModalChange?.(true)}
                    className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <User className="w-4 h-4" />
                    <span>Account Settings</span>
                  </button>
                  <Link
                    to="/watch-history"
                    className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <History className="w-4 h-4" />
                    <span>Watch History</span>
                  </Link>
                  <button
                    onClick={() => props.onAccountModalChange?.(false)}
                    className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={toggleMobileMenu}
                className="md:hidden p-2 text-white/70 hover:text-white transition-colors"
              >
                {showMobileMenu ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden bg-background border-t border-border">
            <div className="px-4 py-3 space-y-1">
              <Link
                to="/"
                className={cn(
                  "block px-3 py-2 rounded-md text-base font-medium",
                  location.pathname === '/' ? "text-white bg-white/10" : "text-white/70 hover:text-white hover:bg-white/5"
                )}
                onClick={() => setShowMobileMenu(false)}
              >
                Featured
              </Link>
              <Link
                to="/trending"
                className={cn(
                  "block px-3 py-2 rounded-md text-base font-medium",
                  location.pathname === '/trending' ? "text-white bg-white/10" : "text-white/70 hover:text-white hover:bg-white/5"
                )}
                onClick={() => setShowMobileMenu(false)}
              >
                Trending
              </Link>
              <Link
                to="/watch-history"
                className={cn(
                  "block px-3 py-2 rounded-md text-base font-medium",
                  location.pathname === '/watch-history' ? "text-white bg-white/10" : "text-white/70 hover:text-white hover:bg-white/5"
                )}
                onClick={() => setShowMobileMenu(false)}
              >
                Watch History
              </Link>
              <Link
                to="/more"
                className={cn(
                  "block px-3 py-2 rounded-md text-base font-medium",
                  location.pathname === '/more' ? "text-white bg-white/10" : "text-white/70 hover:text-white hover:bg-white/5"
                )}
                onClick={() => setShowMobileMenu(false)}
              >
                More
              </Link>
            </div>
          </div>
        )}
      </nav>
    </>
  );
};
