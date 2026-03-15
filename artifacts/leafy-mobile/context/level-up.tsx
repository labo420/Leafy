import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth";
import type { Profile } from "@workspace/api-client-react";
import LevelUpModal from "@/components/LevelUpModal";

const PREV_LEVEL_KEY = "leafy_prev_level";

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
  const initializedRef = useRef(false);

  const { data: profile, refetch } = useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: () => apiFetch("/profile"),
    enabled: !!user,
  });

  useEffect(() => {
    AsyncStorage.getItem(PREV_LEVEL_KEY).then((stored) => {
      if (stored) prevLevelRef.current = stored;
      initializedRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (!profile?.level || !initializedRef.current) return;

    const currentLevel = profile.level;

    if (prevLevelRef.current && prevLevelRef.current !== currentLevel && !visible) {
      setFromLevel(prevLevelRef.current);
      setToLevel(currentLevel);
      setVisible(true);
    }

    prevLevelRef.current = currentLevel;
    AsyncStorage.setItem(PREV_LEVEL_KEY, currentLevel);
  }, [profile?.level, visible]);

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
