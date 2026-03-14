import React from "react";
import { BottomNav } from "./BottomNav";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-gray-200/80 flex justify-center selection:bg-primary/20">
      <div className="w-full max-w-md bg-background min-h-screen relative shadow-2xl flex flex-col overflow-hidden">
        {/* Abstract background elements */}
        <div className="absolute top-0 left-0 w-full h-96 overflow-hidden pointer-events-none z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
            alt="" 
            className="w-full h-full object-cover opacity-60 mix-blend-multiply"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background" />
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden z-10 scroll-smooth relative" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="min-h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
        
        <BottomNav />
      </div>
    </div>
  );
}
