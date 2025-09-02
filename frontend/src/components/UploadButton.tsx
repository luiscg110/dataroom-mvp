import React, { useCallback, useRef, useState } from "react";

type Props = {
  accept?: string;
  label?: string;
  onSelected: (file: File) => Promise<void> | void;
};

export default function UploadButton({
  accept = "application/pdf",
  label = "Upload PDF",
  onSelected,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = useCallback(() => {
    const inp = inputRef.current;
    if (!inp) return;
    inp.value = "";
    inp.click();
  }, []);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr(null);
    setBusy(true);
    try {
      await onSelected(f);
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-start">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onChange}
      />
      <button
        onClick={pick}
        disabled={busy}
        className="rounded-xl px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Uploading…" : label}
      </button>
      {err && <div className="text-xs text-red-600 mt-2">{err}</div>}
    </div>
  );
}
