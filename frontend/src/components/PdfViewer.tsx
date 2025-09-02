import React, { useEffect, useState } from "react";
import { fetchFileBlobUrl } from "@/api";
import type { ID } from "@/types";

type Props = {
  fileId: ID;
  name: string;
  open: boolean;
  onClose: () => void;
};

export default function PdfViewer({ fileId, name, open, onClose }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let blobUrl: string | null = null;

    if (!open) {
      setSrc(null);
      setErr(null);
      return;
    }

    setLoading(true);
    setErr(null);

    (async () => {
      try {
        const url = await fetchFileBlobUrl(fileId);
        blobUrl = url;
        setSrc(url);
      } catch (e: any) {
        setErr(e?.message ?? "Error al cargar el PDF");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setSrc(null);
    };
  }, [open, fileId]);

  const openInNewTab = () => {
    if (src) window.open(src, "_blank", "noopener,noreferrer");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col">
      <div className="p-3 flex items-center justify-between text-white">
        <div className="truncate pr-4">📄 {name}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={openInNewTab}
            disabled={!src}
            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50"
          >
            Open in new tab
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20"
          >
            Close
          </button>
        </div>
      </div>
      <div className="flex-1 bg-white">
        {err ? (
          <div className="p-4 text-red-600 text-sm">{err}</div>
        ) : loading || !src ? (
          <div className="p-4 text-slate-600 text-sm">Cargando…</div>
        ) : (
          <iframe title={name} src={src} className="w-full h-full" />
        )}
      </div>
    </div>
  );
}
