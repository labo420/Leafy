import { useEffect, useRef, useState, useCallback } from "react";
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

const DEFAULT_RADIUS_KM = 0.3;
const MOVEMENT_THRESHOLD_M = 500;

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

export function useNearbyLocations(enabled: boolean) {
  const [locations, setLocations] = useState<NearbyLocation[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<"undetermined" | "granted" | "denied">("undetermined");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const lastFetchPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchLocations = useCallback(async (lat: number, lng: number) => {
    if (!mountedRef.current || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ locations: RawLocation[]; count: number }>(
        `/locations/nearby?lat=${lat}&lng=${lng}&radius=${DEFAULT_RADIUS_KM}`,
      );
      if (!mountedRef.current) return;
      lastFetchPosRef.current = { lat, lng };
      setLocations((data.locations ?? []).map(mapLocation));
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "Errore di posizione");
    } finally {
      fetchingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const manualRefresh = useCallback(async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!mountedRef.current) return;
      const { latitude, longitude } = pos.coords;
      lastFetchPosRef.current = null;
      await fetchLocations(latitude, longitude);
    } catch {
      if (mountedRef.current) setError("Impossibile ottenere la posizione");
    }
  }, [fetchLocations]);

  useEffect(() => {
    if (!enabled) {
      setLocations([]);
      setError(null);
      lastFetchPosRef.current = null;
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
      return;
    }

    let cancelled = false;

    async function startWatching() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || !mountedRef.current) return;
      if (status !== "granted") {
        setPermissionStatus("denied");
        return;
      }
      setPermissionStatus("granted");

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (cancelled || !mountedRef.current) return;
      const { latitude, longitude } = pos.coords;
      await fetchLocations(latitude, longitude);

      if (cancelled || !mountedRef.current) return;

      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: MOVEMENT_THRESHOLD_M,
          timeInterval: 30_000,
        },
        (newPos) => {
          if (!mountedRef.current) return;
          const { latitude: newLat, longitude: newLng } = newPos.coords;
          const last = lastFetchPosRef.current;
          if (!last) {
            fetchLocations(newLat, newLng);
            return;
          }
          const dist = haversineDistanceM(last.lat, last.lng, newLat, newLng);
          if (dist >= MOVEMENT_THRESHOLD_M) {
            fetchLocations(newLat, newLng);
          }
        },
      );
    }

    startWatching();

    return () => {
      cancelled = true;
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
    };
  }, [enabled, fetchLocations]);

  return { locations, permissionStatus, loading, error, refresh: manualRefresh };
}
