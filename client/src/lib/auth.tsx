import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, tokenStore } from "./api";

export type Role = "SUPER_ADMIN" | "PG_OWNER" | "RESIDENT";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: string;
  avatarUrl: string | null;
  preferences?: {
    rentReminders: boolean;
    announcements: boolean;
    menuUpdates: boolean;
    complaintUpdates: boolean;
  } | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role: "PG_OWNER" | "RESIDENT";
  }) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ user: User }>("/auth/me");
      setUserState(data.user);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) tokenStore.clear();
      setUserState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
    tokenStore.set(data.token);
    setUserState(data.user);
    return data.user;
  }, []);

  const register = useCallback(
    async (input: { name: string; email: string; phone?: string; password: string; role: "PG_OWNER" | "RESIDENT" }) => {
      const data = await api.post<{ token: string; user: User }>("/auth/register", input);
      tokenStore.set(data.token);
      setUserState(data.user);
      return data.user;
    },
    []
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setUserState(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh: loadMe, setUser: setUserState }),
    [user, loading, login, register, logout, loadMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export const homeForRole = (role: Role) =>
  role === "SUPER_ADMIN" ? "/admin" : role === "PG_OWNER" ? "/owner" : "/resident";
