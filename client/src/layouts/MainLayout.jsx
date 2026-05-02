import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { useTheme } from "@/context/ThemeContext";
import { getWrapperThemeClasses } from "@/utils/themeUtils";

const MainLayout = ({ children }) => {
  const [sidebar, setSidebar] = useState(false);
  const [showNavbar, setShowNavbar] = useState(true);
  const lastScrollY = useRef(0);
  const { appTheme } = useTheme();
  const { pathname } = useLocation();

  // Reset navbar visibility on route change
  useEffect(() => {
    setShowNavbar(true);
  }, [pathname]);

  const handleScroll = (e) => {
    const currentScrollY = e.target.scrollTop;
    // Add a 15px scroll threshold to prevent jitter when scrolling slowly
    if (currentScrollY > lastScrollY.current + 15 && currentScrollY > 50) {
      setShowNavbar(false);
    } else if (currentScrollY < lastScrollY.current - 15 || currentScrollY <= 50) {
      setShowNavbar(true);
    }
    lastScrollY.current = currentScrollY;
  };

  return (
    <div
      className={`h-[100dvh] overflow-hidden flex flex-col transition-colors duration-300 w-full ${getWrapperThemeClasses(appTheme)}`}
    >
      <div 
        className={`w-full z-[60] shrink-0 transition-all duration-500 ease-in-out ${showNavbar ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"}`}
        style={{ marginTop: showNavbar ? '0px' : '-65px' }}
      >
        <div className="backdrop-blur-xl bg-white/5 dark:bg-black/20 border-b border-white/10 shadow-lg">
          <Navbar setSidebar={setSidebar} open={sidebar} />
        </div>
      </div>

      <div className="flex flex-1 relative z-0 overflow-hidden w-full">
        {/* Mobile Backdrop Overlay */}
        {sidebar && (
          <div 
            className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-40 sm:hidden transition-opacity duration-300"
            onClick={() => setSidebar(false)}
          />
        )}
        <div className={`z-50 shrink-0 h-full transition-all duration-500 ${sidebar ? 'absolute left-0 top-0 bottom-0 sm:relative' : 'relative'} ${sidebar ? 'translate-x-0' : '-translate-x-0'}`}>
          <div className="h-full border-r border-white/10 backdrop-blur-md bg-white/5 dark:bg-black/10">
            <Sidebar sidebar={sidebar} />
          </div>
        </div>

        <main id="main-scroll-container" onScroll={handleScroll} className="flex-1 overflow-y-auto scroll-smooth relative z-0 h-full w-full min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
