import React, { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void> | void;
};

export default function CreateFolderModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setErr(null);
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await onCreate(name.trim());
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create folder");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <form onSubmit={submit} className="w-full max-w-md card p-5 bg-white">
        <div className="text-lg font-semibold text-slate-800 mb-3">
          New folder
        </div>
        <input
          ref={inputRef}
          className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 ring-blue-500"
          value={name}
          placeholder="Folder name"
          onChange={(e) => setName(e.target.value)}
        />
        {err && <div className="text-sm text-red-600 mt-2">{err}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="px-3 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
