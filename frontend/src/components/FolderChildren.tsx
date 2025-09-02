import React, { useState } from "react";
import type { FolderChildren, ID, FileItem } from "@/types";
import { deleteFile, deleteFolder, renameFile, renameFolder, streamUrl } from "@/api";
import RenameModal from "./RenameModal";

type Props = {
  folderId: ID;
  data: FolderChildren;
  onOpenFolder: (id: ID) => void;
  onOpenFile?: (f: FileItem) => void;
  onRefresh: () => void;
};

type Target =
  | { kind: "file"; id: ID; name: string }
  | { kind: "folder"; id: ID; name: string };

export default function FolderChildren({
  folderId,
  data,
  onOpenFolder,
  onOpenFile,
  onRefresh,
}: Props) {
  const [ren, setRen] = useState<Target | null>(null);
  const [busy, setBusy] = useState<ID | null>(null);
  const files = data.files;
  const folders = data.folders;

  const doRename = async (newName: string) => {
    if (!ren) return;
    if (ren.kind === "file") await renameFile(ren.id, newName);
    else await renameFolder(ren.id, newName);
    setRen(null);
    onRefresh();
  };

  const doDelete = async (t: Target) => {
    if (!confirm(`Delete ${t.kind} "${t.name}"? This cannot be undone.`)) return;
    setBusy(t.id);
    try {
      if (t.kind === "file") await deleteFile(t.id);
      else await deleteFolder(t.id);
      onRefresh();
    } finally {
      setBusy(null);
    }
  };

  const fileSize = (n: number) =>
    n < 1024
      ? `${n} B`
      : n < 1024 * 1024
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Folders */}
      <div className="card p-4">
        <div className="text-sm font-semibold text-slate-700 mb-2">Folders</div>
        {folders.length === 0 ? (
          <div className="text-sm text-slate-500">No subfolders.</div>
        ) : (
          <ul className="space-y-1">
            {folders.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2">
                <button
                  className="flex-1 text-left px-2 py-1 rounded hover:bg-slate-50"
                  onClick={() => onOpenFolder(f.id)}
                >
                  📁 {f.name}
                </button>
                <div className="shrink-0 flex items-center gap-1">
                  <button
                    className="text-xs px-2 py-1 rounded border hover:bg-slate-50"
                    onClick={() => setRen({ kind: "folder", id: f.id, name: f.name })}
                  >
                    Rename
                  </button>
                  <button
                    disabled={busy === f.id}
                    className="text-xs px-2 py-1 rounded border hover:bg-red-50 disabled:opacity-50"
                    onClick={() => doDelete({ kind: "folder", id: f.id, name: f.name })}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Files */}
      <div className="card p-4">
        <div className="text-sm font-semibold text-slate-700 mb-2">Files</div>
        {files.length === 0 ? (
          <div className="text-sm text-slate-500">No files here.</div>
        ) : (
          <ul className="space-y-1">
            {files.map((fl) => (
              <li key={fl.id} className="flex items-center justify-between gap-2">
                <button
                  className="flex-1 text-left px-2 py-1 rounded hover:bg-slate-50"
                  onClick={() =>
                    onOpenFile
                      ? onOpenFile(fl as FileItem)
                      : window.open(streamUrl(fl.id), "_blank")
                  }
                  title="Open"
                >
                  📄 {fl.name}{" "}
                  <span className="text-xs text-slate-500">
                    ({fileSize(fl.size_bytes)})
                  </span>
                </button>
                <div className="shrink-0 flex items-center gap-1">
                  <button
                    className="text-xs px-2 py-1 rounded border hover:bg-slate-50"
                onClick={() =>
                    onOpenFile
                      ? onOpenFile(fl as FileItem)
                      : window.open(streamUrl(fl.id), "_blank")
                  }
                  >
                    Open
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded border hover:bg-slate-50"
                    onClick={() => setRen({ kind: "file", id: fl.id, name: fl.name })}
                  >
                    Rename
                  </button>
                  <button
                    disabled={busy === fl.id}
                    className="text-xs px-2 py-1 rounded border hover:bg-red-50 disabled:opacity-50"
                    onClick={() => doDelete({ kind: "file", id: fl.id, name: fl.name })}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Rename modal */}
      {ren && (
        <RenameModal
          open={true}
          initial={ren.name}
          title={`Rename ${ren.kind}`}
          onClose={() => setRen(null)}
          onSubmit={doRename}
        />
      )}
    </div>
  );
}
