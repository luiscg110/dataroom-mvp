// src/context/auth.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { authMe } from "@/api";

type User = { id: number; email: string; theme: "light" | "dark" };

type AuthCtx = {
  token: string | null;
  user: User | null;
  login: (t: string) => void;
  logout: () => void;
  setThemeLocal: (theme: "light" | "dark") => void;
};

const Ctx = createContext<AuthCtx>({
  token: null,
  user: null,
  login: () => {},
  logout: () => {},
  setThemeLocal: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);

  // aplica/remueve .dark en <html>
  const applyTheme = (theme: "light" | "dark") => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  };

  // al hacer login: guarda token y trae /me
  const login = async (t: string) => {
    setToken(t);
    localStorage.setItem("token", t);
    try {
      const me = await authMe();
      setUser(me);
      applyTheme(me.theme);
      localStorage.setItem("theme", me.theme);
    } catch {
      // ignore
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    const fallback = (localStorage.getItem("theme") as "light" | "dark") || "light";
    applyTheme(fallback);
  };

  // al cargar app con token, trae /me
  useEffect(() => {
    (async () => {
      if (!token) {
        const stored = (localStorage.getItem("theme") as "light" | "dark") || "light";
        applyTheme(stored);
        return;
      }
      try {
        const me = await authMe();
        setUser(me);
        applyTheme(me.theme);
        localStorage.setItem("theme", me.theme);
      } catch {
        // token inválido
        logout();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // cambia tema solo local (útil para respuesta optimista)
  const setThemeLocal = (theme: "light" | "dark") => {
    applyTheme(theme);
    localStorage.setItem("theme", theme);
    setUser((u) => (u ? { ...u, theme } : u));
  };

  return (
    <Ctx.Provider value={{ token, user, login, logout, setThemeLocal }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
