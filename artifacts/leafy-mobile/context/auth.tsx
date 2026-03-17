import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "@workspace/api-client-react";

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  xp: number;
  leaBalance: number;
  refetch: () => void;
  refreshBalances: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  xp: 0,
  leaBalance: 0,
  refetch: () => {},
  refreshBalances: async () => {},
  setUser: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [xp, setXp] = useState(0);
  const [leaBalance, setLeaBalance] = useState(0);

  const saveUserLocally = async (userData: AuthUser | null) => {
    try {
      if (userData) {
        await AsyncStorage.setItem("auth_user", JSON.stringify(userData));
      } else {
        await AsyncStorage.removeItem("auth_user");
      }
    } catch (e) {
      console.error("Failed to save auth user:", e);
    }
  };

  const fetchBalances = useCallback(async () => {
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const base = domain ? `https://${domain}` : "";
      const res = await fetch(`${base}/api/profile`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setXp(data.xp ?? 0);
        setLeaBalance(typeof data.leaBalance === "string" ? parseFloat(data.leaBalance) : (data.leaBalance ?? 0));
      }
    } catch {
    }
  }, []);

  const fetchUser = async () => {
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const base = domain ? `https://${domain}` : "";
      const res = await fetch(`${base}/api/auth/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const userData = data.user ?? null;
        setUser(userData);
        await saveUserLocally(userData);
        if (userData) {
          fetchBalances();
        }
      } else {
        setUser(null);
        await saveUserLocally(null);
      }
    } catch {
      setUser(null);
      await saveUserLocally(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const base = domain ? `https://${domain}` : "";
      await fetch(`${base}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
    } finally {
      setUser(null);
      setXp(0);
      setLeaBalance(0);
      await saveUserLocally(null);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedUser = await AsyncStorage.getItem("auth_user");
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      } catch (e) {
        console.error("Failed to load saved auth:", e);
      }
      fetchUser();
    };
    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, xp, leaBalance, refetch: fetchUser, refreshBalances: fetchBalances, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
