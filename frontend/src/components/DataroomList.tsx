import React, { useState } from "react";
import type { Dataroom, ID } from "@/types";
import { createDataroom } from "@/api";

type Props = {
  datarooms: Dataroom[];
  onOpen: (id: ID) => void;
  onCreated?: (d: Dataroom) => void;
};

export default function DataroomList({ datarooms, onOpen, onCreated }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const d = await createDataroom(name.trim());
      setName("");
      onCreated?.(d);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-app py-6 grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Datarooms</h2>
      </div>

      <form onSubmit={submit} className="card p-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          className="flex-1 rounded-xl border px-3 py-2 outline-none focus:ring-2 ring-blue-500"
          placeholder="Create new dataroom…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="mt-2 sm:mt-0 inline-flex items-center justify-center rounded-xl px-3 py-2 bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create"}
        </button>
        {err && <div className="text-sm text-red-600 sm:ml-3">{err}</div>}
      </form>

      <div className="grid md:grid-cols-2 gap-3">
        {datarooms.map((d) => (
          <button
            key={d.id}
            onClick={() => onOpen(d.id)}
            className="card p-4 text-left hover:shadow transition"
          >
            <div className="text-slate-800 font-medium">{d.name}</div>
            <div className="text-xs text-slate-500 mt-1">
              id: {d.id} {d.root_folder_id ? `• root: ${d.root_folder_id}` : ""}
            </div>
          </button>
        ))}
      </div>

      {datarooms.length === 0 && (
        <div className="text-sm text-slate-500">
          No datarooms yet. Create one above to get started.
        </div>
      )}
    </div>
  );
}
