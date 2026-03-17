import React, { createContext, useContext, useRef, useCallback } from "react";

interface ScanResetContextType {
  registerReset: (fn: () => void) => void;
  triggerReset: () => void;
  registerCamera: (fn: () => void) => void;
  triggerCamera: () => void;
}

const ScanResetContext = createContext<ScanResetContextType>({
  registerReset: () => {},
  triggerReset: () => {},
  registerCamera: () => {},
  triggerCamera: () => {},
});

export function ScanResetProvider({ children }: { children: React.ReactNode }) {
  const resetFnRef = useRef<(() => void) | null>(null);
  const cameraFnRef = useRef<(() => void) | null>(null);

  const registerReset = useCallback((fn: () => void) => {
    resetFnRef.current = fn;
  }, []);

  const triggerReset = useCallback(() => {
    resetFnRef.current?.();
  }, []);

  const registerCamera = useCallback((fn: () => void) => {
    cameraFnRef.current = fn;
  }, []);

  const triggerCamera = useCallback(() => {
    cameraFnRef.current?.();
  }, []);

  return (
    <ScanResetContext.Provider value={{ registerReset, triggerReset, registerCamera, triggerCamera }}>
      {children}
    </ScanResetContext.Provider>
  );
}

export const useScanReset = () => useContext(ScanResetContext);
