import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "@workspace/api-client-react";

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  xp: number;
  leaBalance: number;
  hasBattlePass: boolean;
  refetch: () => void;
  refreshBalances: () => Promise<void>;
  activateBattlePass: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  xp: 0,
  leaBalance: 0,
  hasBattlePass: false,
  refetch: () => {},
  refreshBalances: async () => {},
  activateBattlePass: async () => {},
  setUser: () => {},
  logout: async () => {},
});

const STORAGE_KEYS = {
  user: "auth_user",
  token: "auth_session_token",
  xp: "auth_xp",
  leaBalance: "auth_lea",
  hasBattlePass: "auth_bp",
};

function getBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : "";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [xp, setXp] = useState(0);
  const [leaBalance, setLeaBalance] = useState(0);
  const [hasBattlePass, setHasBattlePass] = useState(false);

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

  const saveBalancesLocally = async (xpVal: number, leaVal: number, bpVal: boolean) => {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.xp, String(xpVal)],
        [STORAGE_KEYS.leaBalance, String(leaVal)],
        [STORAGE_KEYS.hasBattlePass, bpVal ? "1" : "0"],
      ]);
    } catch {}
  };

  const loadBalancesLocally = async () => {
    try {
      const vals = await AsyncStorage.multiGet([
        STORAGE_KEYS.xp,
        STORAGE_KEYS.leaBalance,
        STORAGE_KEYS.hasBattlePass,
      ]);
      setXp(parseFloat(vals[0][1] ?? "0") || 0);
      setLeaBalance(parseFloat(vals[1][1] ?? "0") || 0);
      setHasBattlePass(vals[2][1] === "1");
    } catch {}
  };

  const fetchBalances = useCallback(async () => {
    try {
      const base = getBase();
      const res = await apiFetch(`${base}/api/profile`);
      if (res.ok) {
        const data = await res.json();
        const xpVal = data.xp ?? 0;
        const leaVal = typeof data.leaBalance === "string"
          ? parseFloat(data.leaBalance)
          : (data.leaBalance ?? 0);
        const bpVal = data.hasBattlePass ?? false;
        setXp(xpVal);
        setLeaBalance(leaVal);
        setHasBattlePass(bpVal);
        await saveBalancesLocally(xpVal, leaVal, bpVal);
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

  const activateBattlePass = async () => {
    try {
      const base = getBase();
      const res = await apiFetch(`${base}/api/profile/battle-pass/activate`, {
        method: "POST",
      });
      if (res.ok) {
        setHasBattlePass(true);
        await fetchBalances();
      }
    } catch (e) {
      console.error("Failed to activate Battle Pass:", e);
    }
  };

  const logout = async () => {
    try {
      const base = getBase();
      await apiFetch(`${base}/api/auth/logout`, { method: "POST" });
    } catch {
    } finally {
      setUser(null);
      setXp(0);
      setLeaBalance(0);
      setHasBattlePass(false);
      await saveUserLocally(null);
      await saveToken(null);
      await saveBalancesLocally(0, 0, false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const [savedUser, savedToken] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.user),
          AsyncStorage.getItem(STORAGE_KEYS.token),
          loadBalancesLocally(),
        ]);

        if (savedToken) {
          sessionTokenRef.current = savedToken;
        }

        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      } catch (e) {
        console.error("Failed to load saved auth:", e);
      }

      await fetchUser();
    };
    initAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        xp,
        leaBalance,
        hasBattlePass,
        refetch: fetchUser,
        refreshBalances: fetchBalances,
        activateBattlePass,
        setUser,
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
