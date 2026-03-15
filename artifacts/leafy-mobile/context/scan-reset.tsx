import React, { createContext, useContext, useRef, useCallback } from "react";

interface ScanResetContextType {
  registerReset: (fn: () => void) => void;
  triggerReset: () => void;
}

const ScanResetContext = createContext<ScanResetContextType>({
  registerReset: () => {},
  triggerReset: () => {},
});

export function ScanResetProvider({ children }: { children: React.ReactNode }) {
  const resetFnRef = useRef<(() => void) | null>(null);

  const registerReset = useCallback((fn: () => void) => {
    resetFnRef.current = fn;
  }, []);

  const triggerReset = useCallback(() => {
    resetFnRef.current?.();
  }, []);

  return (
    <ScanResetContext.Provider value={{ registerReset, triggerReset }}>
      {children}
    </ScanResetContext.Provider>
  );
}

export const useScanReset = () => useContext(ScanResetContext);
