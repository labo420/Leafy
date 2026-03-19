import { useCallback, useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "@/lib/api";
import { scheduleLocalNotification, sendWalkinRewardNotification } from "@/lib/notifications";
import type { NearbyLocation } from "./useNearbyLocations";

const DWELL_SECONDS = 120;
const ENTER_RADIUS_M = 50;
const NEAR_MISS_MIN_SECONDS = 90;

function todayTypeKey(type: "oasi" | "standard"): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `leafy_walkin_type_cap_${type}_${ymd}`;
}

async function getDailyTypeCompletionCount(type: "oasi" | "standard"): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(todayTypeKey(type));
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

async function incrementDailyTypeCompletionCount(type: "oasi" | "standard"): Promise<void> {
  try {
    const current = await getDailyTypeCompletionCount(type);
    await AsyncStorage.setItem(todayTypeKey(type), String(current + 1));
  } catch {}
}

async function isDailyTypeCapReached(type: "oasi" | "standard", maxPerDay: number): Promise<boolean> {
  const count = await getDailyTypeCompletionCount(type);
  return count >= maxPerDay;
}

function haversineDistanceM(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

export function useWalkin(
  locations: NearbyLocation[],
  notificationsEnabled: boolean,
) {
  const [phase, setPhase] = useState<WalkinPhase>("idle");
  const [activeLocation, setActiveLocation] = useState<NearbyLocation | null>(null);
  const [dwellRemaining, setDwellRemaining] = useState(DWELL_SECONDS);
  const [result, setResult] = useState<WalkinResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const activeLocationRef = useRef<NearbyLocation | null>(null);
  const phaseRef = useRef<WalkinPhase>("idle");
  const dwellStartRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const locationsRef = useRef<NearbyLocation[]>([]);
  const notificationsEnabledRef = useRef(notificationsEnabled);

  useEffect(() => { locationsRef.current = locations; }, [locations]);
  useEffect(() => { notificationsEnabledRef.current = notificationsEnabled; }, [notificationsEnabled]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
    };
  }, []);

  const setPhaseSync = useCallback((p: WalkinPhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const submitWalkin = useCallback(async () => {
    if (!mountedRef.current) return;
    const sessionId = sessionIdRef.current;
    const location = activeLocationRef.current;
    if (!sessionId) {
      setPhaseSync("error");
      setErrorMsg("Sessione non trovata.");
      return;
    }
    setPhaseSync("submitting");
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
        setPhaseSync("already_done");
        setResult({ xpAwarded: 0, locationName: location?.name ?? "", locationId: location?.id ?? 0 });
      } else {
        setPhaseSync("rewarded");
        const xp = data.xpAwarded ?? 0;
        const name = data.locationName ?? location?.name ?? "";
        setResult({ xpAwarded: xp, locationName: name, locationId: location?.id ?? 0 });
        if (location?.type) {
          await incrementDailyTypeCompletionCount(location.type);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (notificationsEnabledRef.current) {
          await sendWalkinRewardNotification(name, xp);
        }
      }
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setPhaseSync("error");
      setErrorMsg(e instanceof Error ? e.message : "Errore walk-in");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [setPhaseSync]);

  const startDwellTimer = useCallback((location: NearbyLocation) => {
    if (timerRef.current) clearInterval(timerRef.current);
    dwellStartRef.current = Date.now();
    setDwellRemaining(DWELL_SECONDS);
    setPhaseSync("dwelling");

    timerRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      const elapsed = Math.floor((Date.now() - (dwellStartRef.current ?? Date.now())) / 1000);
      const remaining = Math.max(0, DWELL_SECONDS - elapsed);
      setDwellRemaining(remaining);
      if (remaining === 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        submitWalkin();
      }
    }, 500);
  }, [setPhaseSync, submitWalkin]);

  const handleGeofenceExit = useCallback(async () => {
    if (!mountedRef.current) return;
    const currentPhase = phaseRef.current;
    if (currentPhase !== "dwelling") return;

    const elapsed = dwellStartRef.current
      ? Math.floor((Date.now() - dwellStartRef.current) / 1000)
      : 0;

    if (timerRef.current) clearInterval(timerRef.current);
    sessionIdRef.current = null;

    const locationName = activeLocationRef.current?.name ?? "";
    activeLocationRef.current = null;
    setPhaseSync("idle");
    setActiveLocation(null);
    setDwellRemaining(DWELL_SECONDS);
    dwellStartRef.current = null;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    if (elapsed >= NEAR_MISS_MIN_SECONDS && elapsed < DWELL_SECONDS && notificationsEnabledRef.current) {
      await scheduleLocalNotification(
        "Ti mancava pochissimo!",
        `Eri in negozio da ${elapsed}s su ${DWELL_SECONDS}. Riprova la prossima volta per guadagnare XP in ${locationName}!`,
        { silent: true },
      );
    }
  }, [setPhaseSync]);

  const stopGeofenceWatch = useCallback(() => {
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
  }, []);

  const startGeofenceWatch = useCallback(async () => {
    stopGeofenceWatch();

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted" || !mountedRef.current) return;

    locationSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10,
        timeInterval: 5_000,
      },
      (pos) => {
        if (!mountedRef.current) return;
        const { latitude, longitude } = pos.coords;
        const currentPhase = phaseRef.current;
        const activeStore = activeLocationRef.current;
        const allLocations = locationsRef.current;

        if (currentPhase === "dwelling" && activeStore) {
          const dist = haversineDistanceM(latitude, longitude, activeStore.lat, activeStore.lng);
          if (dist > ENTER_RADIUS_M) {
            handleGeofenceExit();
          }
          return;
        }

        if (currentPhase === "idle" && allLocations.length > 0) {
          for (const loc of allLocations) {
            const dist = haversineDistanceM(latitude, longitude, loc.lat, loc.lng);
            if (dist <= ENTER_RADIUS_M) {
              autoEnterStore(loc);
              break;
            }
          }
        }
      },
    );
  }, [handleGeofenceExit, stopGeofenceWatch]);

  const autoEnterStore = useCallback(async (location: NearbyLocation) => {
    if (phaseRef.current !== "idle") return;

    const capReached = await isDailyTypeCapReached(location.type, location.walkinMaxPerDay);
    if (!mountedRef.current) return;
    if (capReached) {
      setPhaseSync("already_done");
      setActiveLocation(location);
      activeLocationRef.current = location;
      setResult({ xpAwarded: 0, locationName: location.name, locationId: location.id });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhaseSync("starting");
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
        setPhaseSync("already_done");
        setResult({ xpAwarded: 0, locationName: location.name, locationId: location.id });
        return;
      }
      sessionIdRef.current = data.sessionId;
      startDwellTimer(location);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setPhaseSync("error");
      setErrorMsg(e instanceof Error ? e.message : "Impossibile avviare il walk-in");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [setPhaseSync, startDwellTimer]);

  const enterStore = useCallback(async (location: NearbyLocation) => {
    await autoEnterStore(location);
  }, [autoEnterStore]);

  const cancelDwell = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    sessionIdRef.current = null;
    activeLocationRef.current = null;
    dwellStartRef.current = null;
    setPhaseSync("idle");
    setActiveLocation(null);
    setDwellRemaining(DWELL_SECONDS);
  }, [setPhaseSync]);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    sessionIdRef.current = null;
    activeLocationRef.current = null;
    dwellStartRef.current = null;
    setPhaseSync("idle");
    setActiveLocation(null);
    setDwellRemaining(DWELL_SECONDS);
    setResult(null);
    setErrorMsg(null);
  }, [setPhaseSync]);

  const checkDailyCapForLocation = useCallback(async (locationId: number, maxPerDay: number, type: "oasi" | "standard" = "standard"): Promise<boolean> => {
    return isDailyTypeCapReached(type, maxPerDay);
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
    startGeofenceWatch,
    stopGeofenceWatch,
    checkDailyCapForLocation,
  };
}
