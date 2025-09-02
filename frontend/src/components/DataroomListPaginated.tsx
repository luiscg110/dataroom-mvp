import React, { useEffect, useState } from "react";
import type { Dataroom, ID } from "@/types";
import { createDataroom, listDataroomsPage } from "@/api";

type Props = {
  onOpen: (id: ID) => void;
};

export default function DataroomListPaginated({ onOpen }: Props) {
  const [items, setItems] = useState<Dataroom[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyCreate, setBusyCreate] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");

  async function load(first: boolean) {
    if (loading) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await listDataroomsPage({
        limit: 10,
        cursor: first ? undefined : cursor ?? undefined,
      });
      setItems((prev) => (first ? res.items : [...prev, ...res.items]));
      setCursor(res.next_cursor);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load datarooms");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busyCreate) return;
    setBusyCreate(true);
    setErr(null);
    try {
      const d = await createDataroom(name.trim());
      setItems((prev) => [d, ...prev]); // prepend como en la versión anterior
      setName("");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create");
    } finally {
      setBusyCreate(false);
    }
  };

  return (
    <div className="container-app py-6 grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Datarooms</h2>
      </div>

      <form onSubmit={submit} className="card p-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          className="flex-1 rounded-xl border px-3 py-2 outline-none focus:ring-2 ring-blue-500"
          placeholder="Create new dataroom…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busyCreate}
        />
        <button
          type="submit"
          disabled={busyCreate || !name.trim()}
          className="mt-2 sm:mt-0 inline-flex items-center justify-center rounded-xl px-3 py-2 bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {busyCreate ? "Creating…" : "Create"}
        </button>
        {err && <div className="text-sm text-red-600 sm:ml-3">{err}</div>}
      </form>

      <div className="grid md:grid-cols-2 gap-3">
        {items.map((d) => (
          <button
            key={d.id}
            onClick={() => onOpen(d.id)}
            className="card p-4 text-left hover:shadow transition"
          >
            <div className="font-medium">{d.name}</div>
            <div className="text-xs text-slate-500 mt-1">
              id: {d.id} {d.root_folder_id ? `• root: ${d.root_folder_id}` : ""}
            </div>
          </button>
        ))}
      </div>

      {items.length === 0 && !loading && (
        <div className="text-sm text-slate-500">
          No datarooms yet. Create one above to get started.
        </div>
      )}

      <div className="flex items-center gap-3">
        {cursor ? (
          <button
            onClick={() => load(false)}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl px-3 py-2 bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : (
          <div className="text-sm text-slate-500">No more results</div>
        )}
      </div>
    </div>
  );
}
