import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { registerPushToken } from "@/lib/notifications";

const STORAGE_KEY = "leafy_push_notifications_enabled";

interface NotificationsContextValue {
  pushEnabled: boolean;
  setPushEnabled: (value: boolean) => void;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  pushEnabled: true,
  setPushEnabled: () => {},
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [pushEnabled, setPushEnabledState] = useState(true);
  const tokenRegisteredRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val !== null) {
        setPushEnabledState(val === "true");
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (pushEnabled && !tokenRegisteredRef.current) {
      tokenRegisteredRef.current = true;
      registerPushToken().catch(() => {});
    }
  }, [pushEnabled]);

  const setPushEnabled = useCallback((value: boolean) => {
    setPushEnabledState(value);
    AsyncStorage.setItem(STORAGE_KEY, value ? "true" : "false").catch(() => {});
  }, []);

  return (
    <NotificationsContext.Provider value={{ pushEnabled, setPushEnabled }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
