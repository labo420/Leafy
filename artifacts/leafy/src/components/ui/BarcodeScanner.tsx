import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/browser";
import { X, SwitchCamera } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BarcodeScannerProps {
  open: boolean;
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ open, onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraIdx, setCameraIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState(false);

  const startScanning = useCallback(async (deviceId?: string) => {
    if (!videoRef.current) return;
    setError(null);

    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }

    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader();
    }

    try {
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      setCameras(devices);

      const selectedId = deviceId ?? devices[cameraIdx]?.deviceId;

      const controls = await readerRef.current.decodeFromVideoDevice(
        selectedId,
        videoRef.current,
        (result, err) => {
          if (result) {
            setDetected(true);
            setTimeout(() => {
              onDetected(result.getText());
              setDetected(false);
            }, 300);
          }
          if (err && !(err instanceof NotFoundException)) {
            console.warn("Scan error:", err);
          }
        }
      );
      controlsRef.current = controls;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Permission") || msg.includes("denied")) {
        setError("Accesso alla fotocamera negato. Abilita i permessi nel browser.");
      } else {
        setError("Impossibile avviare la fotocamera. Riprova.");
      }
    }
  }, [cameraIdx, onDetected]);

  useEffect(() => {
    if (open) {
      startScanning();
    } else {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      readerRef.current = null;
      setError(null);
      setDetected(false);
    }

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, [open, startScanning]);

  const switchCamera = () => {
    const next = (cameraIdx + 1) % cameras.length;
    setCameraIdx(next);
    startScanning(cameras[next]?.deviceId);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 z-10">
            <span className="text-white text-sm font-semibold">Scansiona barcode</span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Camera view */}
          <div className="flex-1 relative overflow-hidden">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />

            {/* Viewfinder overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-64 h-40">
                {/* Corner brackets */}
                {["top-0 left-0", "top-0 right-0 rotate-90", "bottom-0 right-0 rotate-180", "bottom-0 left-0 -rotate-90"].map((pos, i) => (
                  <div key={i} className={`absolute ${pos} w-8 h-8`}>
                    <div className="absolute top-0 left-0 w-8 h-1 bg-white rounded-sm" />
                    <div className="absolute top-0 left-0 w-1 h-8 bg-white rounded-sm" />
                  </div>
                ))}

                {/* Scan line animation */}
                <motion.div
                  className="absolute left-1 right-1 h-0.5 bg-green-400 shadow-[0_0_8px_2px_rgba(74,222,128,0.6)]"
                  animate={detected ? { opacity: [1, 0, 1] } : { y: [0, 152, 0] }}
                  transition={detected ? { duration: 0.3, repeat: 1 } : { duration: 2, repeat: Infinity, ease: "linear" }}
                />
              </div>
            </div>

            {/* Dark overlay outside viewfinder */}
            <div className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse 270px 170px at center, transparent 95%, rgba(0,0,0,0.7) 100%)",
              }}
            />

            {/* Error message */}
            {error && (
              <div className="absolute inset-x-4 bottom-24 bg-black/80 text-white text-sm text-center rounded-xl p-4">
                {error}
              </div>
            )}

            {/* Switch camera */}
            {cameras.length > 1 && (
              <button
                onClick={switchCamera}
                className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
              >
                <SwitchCamera className="w-6 h-6 text-white" />
              </button>
            )}
          </div>

          <div className="text-center text-white/60 text-xs py-4">
            Inquadra il codice a barre del prodotto
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
