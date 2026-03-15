import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "@workspace/api-client-react";

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  refetch: () => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  refetch: () => {},
  setUser: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      // Ignore errors
    } finally {
      setUser(null);
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
    <AuthContext.Provider value={{ user, isLoading, refetch: fetchUser, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
