import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { apiFetch } from "@/lib/api";

export interface NearbyChallenge {
  id: number;
  name: string;
  description: string | null;
  barcode: string;
  xpReward: number;
}

export interface NearbyLocation {
  id: number;
  name: string;
  type: "oasi" | "standard";
  lat: number;
  lng: number;
  distanceM: number;
  walkinXp: number;
  walkinMaxPerDay: number;
  challenges: NearbyChallenge[];
}

interface RawChallenge {
  id: number;
  barcode: string;
  productName: string;
  productDescription: string | null;
  emoji: string | null;
  xpReward: number;
}

interface RawLocation {
  id: number;
  name: string;
  type: "oasi" | "standard";
  lat: number | string;
  lng: number | string;
  distance_km: number | string;
  challenges: RawChallenge[];
}

const WALKIN_XP: Record<string, number> = { oasi: 15, standard: 5 };
const WALKIN_MAX: Record<string, number> = { oasi: 2, standard: 1 };

function mapLocation(raw: RawLocation): NearbyLocation {
  const distKm = parseFloat(String(raw.distance_km)) || 0;
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    lat: parseFloat(String(raw.lat)),
    lng: parseFloat(String(raw.lng)),
    distanceM: Math.round(distKm * 1000),
    walkinXp: WALKIN_XP[raw.type] ?? 5,
    walkinMaxPerDay: WALKIN_MAX[raw.type] ?? 1,
    challenges: (raw.challenges ?? []).map((ch) => ({
      id: ch.id,
      name: ch.productName,
      description: ch.productDescription ?? null,
      barcode: ch.barcode,
      xpReward: ch.xpReward,
    })),
  };
}

const POLL_INTERVAL_MS = 30_000;
const DEFAULT_RADIUS_M = 300;

export function useNearbyLocations(enabled: boolean) {
  const [locations, setLocations] = useState<NearbyLocation[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<"undetermined" | "granted" | "denied">("undetermined");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchLocations = async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!mountedRef.current) return;
      const { latitude, longitude } = pos.coords;
      const data = await apiFetch<{ locations: RawLocation[]; count: number }>(
        `/locations/nearby?lat=${latitude}&lng=${longitude}&radius=${DEFAULT_RADIUS_M}`,
      );
      if (!mountedRef.current) return;
      setLocations((data.locations ?? []).map(mapLocation));
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "Errore di posizione");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const requestAndFetch = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (!mountedRef.current) return;
    if (status !== "granted") {
      setPermissionStatus("denied");
      return;
    }
    setPermissionStatus("granted");
    await fetchLocations();
  };

  useEffect(() => {
    if (!enabled) {
      setLocations([]);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    requestAndFetch();
    timerRef.current = setInterval(() => {
      fetchLocations();
    }, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled]);

  return { locations, permissionStatus, loading, error, refresh: fetchLocations };
}
