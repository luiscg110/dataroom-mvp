import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/auth";
import { setApiToken } from "@/api";

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:5001";

export default function Login({ onDone }: { onDone: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus(); // autofocus on first field
  }, []);

  const validateEmail = (value: string) => {
    if (!value) return "Email is required";
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(value)) return "Invalid email format";
    return null;
  };

  const validatePassword = (value: string) => {
    if (!value) return "Password is required";
    if (value.length < 6) return "Password must be at least 6 characters";
    return null;
  };

  const post = async (path: string, body: any) => {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const doRegister = async () => {
    setBusy(true);
    setErr(null);
    try {
      await post("/api/auth/register", { email, password });
      await doLogin(); // auto-login after registration
    } catch {
      setErr("Registration failed");
    } finally {
      setBusy(false);
    }
  };

  const doLogin = async () => {
    setBusy(true);
    setErr(null);
    try {
      const j = await post("/api/auth/login", { email, password });
      login(j.access_token);
      setApiToken(j.access_token);
      onDone();
    } catch {
      setErr("Invalid username or password");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailError && !passwordError) {
      doLogin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="card w-full max-w-md p-6">
        <div className="text-xl font-semibold mb-4">Login</div>
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <input
            ref={emailRef}
            className="rounded-xl border px-3 py-2"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(validateEmail(e.target.value));
            }}
            onBlur={(e) => setEmailError(validateEmail(e.target.value))}
          />
          {emailError && <div className="text-sm text-red-600">{emailError}</div>}

          <input
            className="rounded-xl border px-3 py-2"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError(validatePassword(e.target.value));
            }}
            onBlur={(e) => setPasswordError(validatePassword(e.target.value))}
          />
          {passwordError && (
            <div className="text-sm text-red-600">{passwordError}</div>
          )}

          {err && <div className="text-sm text-red-600">{err}</div>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !!emailError || !!passwordError || !email || !password}
              className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Loading…" : "Login"}
            </button>
            <button
              type="button"
              onClick={doRegister}
              disabled={busy || !!emailError || !!passwordError || !email || !password}
              className="px-3 py-2 rounded-xl border"
            >
              Register
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
