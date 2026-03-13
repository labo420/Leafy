import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { AuthUser } from "@workspace/api-client-react";
import { apiFetch, setToken, clearToken } from "@/lib/api";

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  refetch: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  handleOAuthToken: (sid: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  refetch: () => {},
  login: async () => {},
  register: async () => {},
  handleOAuthToken: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: AuthUser | null }>("/auth/me");
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ user: AuthUser; sid: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (data.sid) await setToken(data.sid);
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, password: string, username: string) => {
    const data = await apiFetch<{ user: AuthUser; sid: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, username }),
    });
    if (data.sid) await setToken(data.sid);
    setUser(data.user);
  }, []);

  const handleOAuthToken = useCallback(async (sid: string) => {
    await setToken(sid);
    await fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/logout");
    } catch {}
    await clearToken();
    setUser(null);
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <AuthContext.Provider value={{ user, isLoading, refetch: fetchUser, login, register, handleOAuthToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
