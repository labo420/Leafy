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
  const pendingCameraRef = useRef(false);

  const registerReset = useCallback((fn: () => void) => {
    resetFnRef.current = fn;
  }, []);

  const triggerReset = useCallback(() => {
    resetFnRef.current?.();
  }, []);

  const registerCamera = useCallback((fn: () => void) => {
    cameraFnRef.current = fn;
    if (pendingCameraRef.current) {
      pendingCameraRef.current = false;
      fn();
    }
  }, []);

  const triggerCamera = useCallback(() => {
    if (cameraFnRef.current) {
      cameraFnRef.current();
    } else {
      pendingCameraRef.current = true;
    }
  }, []);

  return (
    <ScanResetContext.Provider value={{ registerReset, triggerReset, registerCamera, triggerCamera }}>
      {children}
    </ScanResetContext.Provider>
  );
}

export const useScanReset = () => useContext(ScanResetContext);
