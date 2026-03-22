import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth";
import type { Profile } from "@workspace/api-client-react";
import LevelUpModal from "@/components/LevelUpModal";

const PREV_LEVEL_KEY_PREFIX = "leafy_prev_level:";
const WATERING_CAN_DURATION_MS = 3200;

interface LevelUpContextValue {
  checkForLevelUp: () => void;
}

const LevelUpContext = createContext<LevelUpContextValue>({ checkForLevelUp: () => {} });

export function useLevelUp() {
  return useContext(LevelUpContext);
}

export function LevelUpProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [fromLevel, setFromLevel] = useState("");
  const [toLevel, setToLevel] = useState("");
  const prevLevelRef = useRef<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const levelUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const storageKey = user?.id ? `${PREV_LEVEL_KEY_PREFIX}${user.id}` : null;

  const { data: profile, refetch } = useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: () => apiFetch("/profile"),
    enabled: !!user,
  });

  useEffect(() => {
    setStorageReady(false);
    prevLevelRef.current = null;

    if (!storageKey) return;

    AsyncStorage.getItem(storageKey).then((stored) => {
      if (stored) prevLevelRef.current = stored;
      setStorageReady(true);
    });
  }, [storageKey]);

  useEffect(() => {
    if (!profile?.level || !storageReady || !storageKey) return;

    const currentLevel = profile.level;

    if (prevLevelRef.current && prevLevelRef.current !== currentLevel && !visible) {
      const from = prevLevelRef.current;
      if (levelUpTimeoutRef.current) clearTimeout(levelUpTimeoutRef.current);
      levelUpTimeoutRef.current = setTimeout(() => {
        setFromLevel(from);
        setToLevel(currentLevel);
        setVisible(true);
        levelUpTimeoutRef.current = null;
      }, WATERING_CAN_DURATION_MS);
    }

    prevLevelRef.current = currentLevel;
    AsyncStorage.setItem(storageKey, currentLevel);
  }, [profile?.level, visible, storageKey, storageReady]);

  useEffect(() => {
    return () => {
      if (levelUpTimeoutRef.current) clearTimeout(levelUpTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") refetch();
    });
    return () => sub.remove();
  }, [user, refetch]);

  const checkForLevelUp = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <LevelUpContext.Provider value={{ checkForLevelUp }}>
      {children}
      <LevelUpModal
        visible={visible}
        fromLevel={fromLevel}
        toLevel={toLevel}
        onClose={() => setVisible(false)}
      />
    </LevelUpContext.Provider>
  );
}
