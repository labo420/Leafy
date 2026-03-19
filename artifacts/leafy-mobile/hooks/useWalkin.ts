import { useCallback, useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { apiFetch } from "@/lib/api";
import type { NearbyLocation } from "./useNearbyLocations";

const DWELL_SECONDS = 120;

export type WalkinPhase =
  | "idle"
  | "starting"
  | "dwelling"
  | "submitting"
  | "rewarded"
  | "already_done"
  | "error";

export interface WalkinResult {
  xpAwarded: number;
  locationName: string;
  locationId: number;
}

export function useWalkin() {
  const [phase, setPhase] = useState<WalkinPhase>("idle");
  const [activeLocation, setActiveLocation] = useState<NearbyLocation | null>(null);
  const [dwellRemaining, setDwellRemaining] = useState(DWELL_SECONDS);
  const [result, setResult] = useState<WalkinResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const activeLocationRef = useRef<NearbyLocation | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const submitWalkin = useCallback(async () => {
    if (!mountedRef.current) return;
    const sessionId = sessionIdRef.current;
    const location = activeLocationRef.current;
    if (!sessionId) {
      setPhase("error");
      setErrorMsg("Sessione non trovata.");
      return;
    }
    setPhase("submitting");
    try {
      const data = await apiFetch<{
        success?: boolean;
        xpAwarded?: number;
        locationName?: string;
        alreadyCompleted?: boolean;
        message?: string;
      }>("/walkin/complete", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
      if (!mountedRef.current) return;
      if (data.alreadyCompleted) {
        setPhase("already_done");
        setResult({ xpAwarded: 0, locationName: location?.name ?? "", locationId: location?.id ?? 0 });
      } else {
        setPhase("rewarded");
        setResult({
          xpAwarded: data.xpAwarded ?? 0,
          locationName: data.locationName ?? location?.name ?? "",
          locationId: location?.id ?? 0,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setPhase("error");
      setErrorMsg(e instanceof Error ? e.message : "Errore walk-in");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, []);

  const startDwellTimer = useCallback((location: NearbyLocation) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const startedAt = Date.now();
    setDwellRemaining(DWELL_SECONDS);
    setPhase("dwelling");

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, DWELL_SECONDS - elapsed);
      if (!mountedRef.current) return;
      setDwellRemaining(remaining);
      if (remaining === 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        submitWalkin();
      }
    }, 500);
  }, [submitWalkin]);

  const enterStore = useCallback(async (location: NearbyLocation) => {
    if (phase !== "idle") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("starting");
    setActiveLocation(location);
    activeLocationRef.current = location;
    try {
      const data = await apiFetch<{
        sessionId: number | null;
        alreadyCompleted: boolean;
        message?: string;
      }>("/walkin/start", {
        method: "POST",
        body: JSON.stringify({ locationId: location.id }),
      });
      if (!mountedRef.current) return;
      if (data.alreadyCompleted || !data.sessionId) {
        setPhase("already_done");
        setResult({ xpAwarded: 0, locationName: location.name, locationId: location.id });
        return;
      }
      sessionIdRef.current = data.sessionId;
      startDwellTimer(location);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setPhase("error");
      setErrorMsg(e instanceof Error ? e.message : "Impossibile avviare il walk-in");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [phase, startDwellTimer]);

  const cancelDwell = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    sessionIdRef.current = null;
    activeLocationRef.current = null;
    setPhase("idle");
    setActiveLocation(null);
    setDwellRemaining(DWELL_SECONDS);
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    sessionIdRef.current = null;
    activeLocationRef.current = null;
    setPhase("idle");
    setActiveLocation(null);
    setDwellRemaining(DWELL_SECONDS);
    setResult(null);
    setErrorMsg(null);
  }, []);

  return {
    phase,
    activeLocation,
    dwellRemaining,
    dwellTotal: DWELL_SECONDS,
    result,
    errorMsg,
    enterStore,
    cancelDwell,
    reset,
  };
}
