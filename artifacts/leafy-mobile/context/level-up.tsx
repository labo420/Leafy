import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useSegments } from "expo-router";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth";
import type { Profile } from "@workspace/api-client-react";
import LevelUpBanner from "@/components/LevelUpBanner";

const PREV_LEVEL_KEY_PREFIX = "leafy_prev_level:";

// When user is on Home, the ring cinematic runs for ~5s before the banner appears.
// When on any other tab, skip the ring and show the banner almost immediately.
const HOME_TAB_DELAY_MS = 5500;
const OTHER_TAB_DELAY_MS = 600;

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

  // segments[0] = "(tabs)", segments[1] = tab name; Home tab has no segments[1]
  const segments = useSegments();
  const isOnHome = segments[0] === "(tabs)" && segments[1] === undefined;

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
      const delay = isOnHome ? HOME_TAB_DELAY_MS : OTHER_TAB_DELAY_MS;
      if (levelUpTimeoutRef.current) clearTimeout(levelUpTimeoutRef.current);
      levelUpTimeoutRef.current = setTimeout(() => {
        setFromLevel(from);
        setToLevel(currentLevel);
        setVisible(true);
        levelUpTimeoutRef.current = null;
      }, delay);
    }

    prevLevelRef.current = currentLevel;
    AsyncStorage.setItem(storageKey, currentLevel);
  }, [profile?.level, visible, storageKey, storageReady, isOnHome]);

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
      <LevelUpBanner
        visible={visible}
        fromLevel={fromLevel}
        toLevel={toLevel}
        onClose={() => setVisible(false)}
      />
    </LevelUpContext.Provider>
  );
}
