import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "@workspace/api-client-react";

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  drops: number;
  leaBalance: number;
  hasLeafyGold: boolean;
  refetch: () => void;
  refreshBalances: () => Promise<void>;
  activateLeafyGold: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  loginWithToken: (user: AuthUser, token: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  drops: 0,
  leaBalance: 0,
  hasLeafyGold: false,
  refetch: () => {},
  refreshBalances: async () => {},
  activateLeafyGold: async () => {},
  setUser: () => {},
  loginWithToken: async () => {},
  logout: async () => {},
});

const STORAGE_KEYS = {
  user: "auth_user",
  token: "auth_session_token",
  drops: "auth_drops",
  leaBalance: "auth_lea",
  hasLeafyGold: "auth_bp",
};

function getBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : "";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [drops, setDrops] = useState(0);
  const [leaBalance, setLeaBalance] = useState(0);
  const [hasLeafyGold, setHasLeafyGold] = useState(false);

  const sessionTokenRef = useRef<string | null>(null);

  const apiFetch = useCallback(
    (url: string, options: RequestInit = {}): Promise<Response> => {
      const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> | undefined),
      };
      if (sessionTokenRef.current) {
        headers["Authorization"] = `Bearer ${sessionTokenRef.current}`;
      }
      return fetch(url, { ...options, credentials: "include", headers });
    },
    [],
  );

  const saveToken = async (token: string | null) => {
    try {
      if (token) {
        sessionTokenRef.current = token;
        await AsyncStorage.setItem(STORAGE_KEYS.token, token);
      } else {
        sessionTokenRef.current = null;
        await AsyncStorage.removeItem(STORAGE_KEYS.token);
      }
    } catch {}
  };

  const fetchAndSaveToken = useCallback(async () => {
    try {
      const base = getBase();
      const res = await apiFetch(`${base}/api/auth/token`);
      if (res.ok) {
        const data = await res.json();
        if (data.token) await saveToken(data.token);
      }
    } catch {}
  }, [apiFetch]);

  const saveUserLocally = async (userData: AuthUser | null) => {
    try {
      if (userData) {
        await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userData));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.user);
      }
    } catch {}
  };

  const saveBalancesLocally = async (dropsVal: number, leaVal: number, lgVal: boolean) => {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.drops, String(dropsVal)],
        [STORAGE_KEYS.leaBalance, String(leaVal)],
        [STORAGE_KEYS.hasLeafyGold, lgVal ? "1" : "0"],
      ]);
    } catch {}
  };

  const loadBalancesLocally = async () => {
    try {
      const vals = await AsyncStorage.multiGet([
        STORAGE_KEYS.drops,
        STORAGE_KEYS.leaBalance,
        STORAGE_KEYS.hasLeafyGold,
      ]);
      setDrops(parseFloat(vals[0][1] ?? "0") || 0);
      setLeaBalance(Math.floor(parseFloat(vals[1][1] ?? "0") || 0));
      setHasLeafyGold(vals[2][1] === "1");
    } catch {}
  };

  const fetchBalances = useCallback(async () => {
    try {
      const base = getBase();
      const res = await apiFetch(`${base}/api/profile`);
      if (res.ok) {
        const data = await res.json();
        const dropsVal = data.drops ?? 0;
        const leaVal = Math.floor(typeof data.leaBalance === "string"
          ? parseFloat(data.leaBalance)
          : (data.leaBalance ?? 0));
        const lgVal = data.hasLeafyGold ?? false;
        setDrops(dropsVal);
        setLeaBalance(leaVal);
        setHasLeafyGold(lgVal);
        await saveBalancesLocally(dropsVal, leaVal, lgVal);
      }
    } catch {}
  }, [apiFetch]);

  const fetchUser = useCallback(async () => {
    try {
      const base = getBase();
      const res = await apiFetch(`${base}/api/auth/user`);
      if (res.ok) {
        const data = await res.json();
        const userData = data.user ?? null;
        setUser(userData);
        await saveUserLocally(userData);
        if (userData) {
          await fetchAndSaveToken();
          fetchBalances();
        }
      } else if (res.status === 401) {
        setUser(null);
        await saveUserLocally(null);
        await saveToken(null);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch, fetchBalances, fetchAndSaveToken]);

  const loginWithToken = async (userData: AuthUser, token: string) => {
    sessionTokenRef.current = token;
    await AsyncStorage.setItem(STORAGE_KEYS.token, token);
    setUser(userData);
    await saveUserLocally(userData);
    fetchBalances();
  };

  const activateLeafyGold = async () => {
    try {
      const base = getBase();
      const res = await apiFetch(`${base}/api/profile/leafy-gold/activate`, {
        method: "POST",
      });
      if (res.ok) {
        setHasLeafyGold(true);
        await fetchBalances();
      }
    } catch (e) {
      console.error("Failed to activate Leafy Gold:", e);
    }
  };

  const logout = async () => {
    try {
      const base = getBase();
      await apiFetch(`${base}/api/auth/logout`, { method: "POST" });
    } catch {
    } finally {
      setUser(null);
      setDrops(0);
      setLeaBalance(0);
      setHasLeafyGold(false);
      await saveUserLocally(null);
      await saveToken(null);
      await saveBalancesLocally(0, 0, false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      let savedUser: AuthUser | null = null;
      let savedToken: string | null = null;

      try {
        const [userStr, tokenStr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.user),
          AsyncStorage.getItem(STORAGE_KEYS.token),
          loadBalancesLocally(),
        ]);

        if (tokenStr) {
          sessionTokenRef.current = tokenStr;
          savedToken = tokenStr;
        }

        if (userStr) {
          savedUser = JSON.parse(userStr);
          setUser(savedUser);
        }
      } catch (e) {
        console.error("Failed to load saved auth:", e);
      }

      // Try to validate token with server, but keep local session as fallback
      try {
        const base = getBase();
        const res = await apiFetch(`${base}/api/auth/user`);
        if (res.ok) {
          const data = await res.json();
          const userData = data.user ?? null;
          setUser(userData);
          await saveUserLocally(userData);
          if (userData) {
            await fetchAndSaveToken();
            fetchBalances();
          }
        } else if (res.status === 401) {
          // Token is invalid, clear session
          setUser(null);
          await saveUserLocally(null);
          await saveToken(null);
        }
        // If other errors (5xx, network, etc), keep the local session
      } catch (e) {
        // Network error or fetch failed - keep local session if available
        console.error("Failed to validate with server, keeping local session:", e);
        if (!savedUser) {
          // No local session to fall back to
          setIsLoading(false);
          return;
        }
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, [apiFetch, fetchAndSaveToken, fetchBalances]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        drops,
        leaBalance,
        hasLeafyGold,
        refetch: fetchUser,
        refreshBalances: fetchBalances,
        activateLeafyGold,
        setUser,
        loginWithToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
