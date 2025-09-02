// src/components/Topbar.tsx
import React, { useState } from "react";
import { useAuth } from "@/auth";
import { updateMyTheme } from "@/api";

export default function Topbar() {
  const { user, logout, setThemeLocal } = useAuth();
  const current = user?.theme || (localStorage.getItem("theme") as "light" | "dark") || "light";
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    const next: "light" | "dark" = current === "dark" ? "light" : "dark";
    // optimista
    setThemeLocal(next);
    setSaving(true);
    try {
      await updateMyTheme(next);
    } catch {
      // revertir si falla
      setThemeLocal(current);
    } finally {
      setSaving(false);
    }
  };

  return (
    <header className="topbar">
      <div className="container-app flex items-center justify-between py-3">
        <div className="font-semibold">Dataroom</div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className="rounded-xl border px-3 py-2 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
            disabled={saving}
            title="Toggle theme"
          >
            {saving ? "…" : current === "dark" ? "🌙 Dark" : "☀️ Light"}
          </button>
          {user && <div className="text-xs text-slate-600 dark:text-slate-300">{user.email}</div>}
          {user && (
            <button onClick={logout} className="text-xs text-blue-600 hover:underline">
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
