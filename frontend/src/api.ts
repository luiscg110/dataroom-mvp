import type { Dataroom, Folder, FolderChildren, FileItem, ID } from "./types";

const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:5001";

let _token: string | null =
  (typeof localStorage !== "undefined" && localStorage.getItem("token")) || null;

export type SearchFilesResp = {
  items: Array<{
    id: number;
    name: string;
    size_bytes?: number;
    mime_type?: string;
    folder_id: number;
    dataroom_id: number;
    snippet?: string | null;
  }>;
  next_cursor: string | null;
};

export const searchFilesMeta = (opts: {
  name?: string;
  dateFrom?: string;  // "YYYY-MM-DD"
  dateTo?: string;    // "YYYY-MM-DD"
  sizeMinMB?: number;
  sizeMaxMB?: number;
  dataroomId?: ID | null;
  limit?: number;
  cursor?: string;
}) => {
  const params = new URLSearchParams();
  if (opts.name) params.set("name", opts.name);
  if (opts.dateFrom) params.set("date_from", opts.dateFrom);
  if (opts.dateTo) params.set("date_to", opts.dateTo);
  if (opts.sizeMinMB != null) params.set("size_min_mb", String(opts.sizeMinMB));
  if (opts.sizeMaxMB != null) params.set("size_max_mb", String(opts.sizeMaxMB));
  if (opts.dataroomId) params.set("dataroom_id", String(opts.dataroomId));
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  return j<SearchFilesResp>(`${API_BASE}/api/search/meta?${params.toString()}`);
};


export function setApiToken(t: string | null) {
  _token = t;
  try {
    if (t) localStorage.setItem("token", t);
    else localStorage.removeItem("token");
  } catch {}
}

function authHeaders(extra?: HeadersInit): Record<string, string> {
  const base: Record<string, string> = {};
  if (_token) base["Authorization"] = `Bearer ${_token}`;
  return { ...base, ...(extra as Record<string, string> | undefined) };
}

async function j<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: authHeaders({ "Content-Type": "application/json", ...(init?.headers as any) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/* ---------- Auth ---------- */
export const authRegister = (email: string, password: string) =>
  j<{ id: number; email: string }>(`${API_BASE}/api/auth/register`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const authLogin = (email: string, password: string) =>
  j<{ access_token: string; token_type: string }>(`${API_BASE}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const authMe = () =>
  j<{ id: number; email: string; theme: "light" | "dark" }>(`${API_BASE}/api/auth/me`);

export const updateMyTheme = (theme: "light" | "dark") =>
  j<{ ok: true; theme: "light" | "dark" }>(`${API_BASE}/api/users/me/theme`, {
    method: "PUT",
    body: JSON.stringify({ theme }),
  });


/* ---------- Datarooms (paginado por cursor) ---------- */
export const listDataroomsPage = (opts?: { limit?: number; cursor?: string | null }) => {
  const p = new URLSearchParams();
  p.set("limit", String(opts?.limit ?? 10));
  if (opts?.cursor) p.set("cursor", opts.cursor);
  const qs = p.toString() ? `?${p.toString()}` : "";
  return j<{ items: Dataroom[]; next_cursor: string | null }>(`${API_BASE}/api/datarooms${qs}`);
};

export const listDatarooms = () => j<Dataroom[]>(`${API_BASE}/api/datarooms`);

export const createDataroom = (name: string) =>
  j<Dataroom>(`${API_BASE}/api/datarooms`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const getDataroom = (id: ID) => j<Dataroom>(`${API_BASE}/api/datarooms/${id}`);

export const renameDataroom = (id: ID, name: string) =>
  j<{ ok: true }>(`${API_BASE}/api/datarooms/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });

export const deleteDataroom = (id: ID) =>
  j<{ ok: true }>(`${API_BASE}/api/datarooms/${id}`, { method: "DELETE" });

/* ---------- Folders ---------- */
export const getFolder = (id: ID) => j<Folder>(`${API_BASE}/api/folders/${id}`);

export const listChildren = (folderId: ID) =>
  j<FolderChildren>(`${API_BASE}/api/folders/${folderId}/children`);

export const listChildrenPaged = (
  folderId: ID,
  opts?: {
    limitFolders?: number;
    cursorFolders?: string | null;
    limitFiles?: number;
    cursorFiles?: string | null;
  }
) => {
  const p = new URLSearchParams();
  p.set("limit_folders", String(opts?.limitFolders ?? 10));
  p.set("limit_files", String(opts?.limitFiles ?? 10));
  if (opts?.cursorFolders) p.set("cursor_folders", opts.cursorFolders);
  if (opts?.cursorFiles) p.set("cursor_files", opts.cursorFiles);
  const qs = p.toString() ? `?${p.toString()}` : "";
  return j<{
    folders: { id: ID; name: string; parent_id: ID | null }[];
    files: { id: ID; name: string; size_bytes: number; mime_type: string }[];
    next_cursor_folders: string | null;
    next_cursor_files: string | null;
  }>(`${API_BASE}/api/folders/${folderId}/children${qs}`);
};

export const createFolder = (dataroomId: ID, parent_id: ID, name: string) =>
  j<Folder>(`${API_BASE}/api/datarooms/${dataroomId}/folders`, {
    method: "POST",
    body: JSON.stringify({ name, parent_id }),
  });

export const renameFolder = (id: ID, name: string) =>
  j<{ ok: true; name: string }>(`${API_BASE}/api/folders/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });

export const deleteFolder = (id: ID) =>
  j<{ ok: true }>(`${API_BASE}/api/folders/${id}`, { method: "DELETE" });

/* ---------- Files ---------- */
export const uploadFile = async (folderId: ID, file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/folders/${folderId}/files`, {
    method: "POST",
    body: fd,
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as Pick<FileItem, "id" | "name" | "size_bytes"> & {
    renamed?: boolean;
    original_name?: string;
  };
};

export const getFile = (id: ID) => j<FileItem>(`${API_BASE}/api/files/${id}`);

export const streamUrl = (id: ID) => `${API_BASE}/api/files/${id}/stream`;

export const fetchFileBlobUrl = async (id: ID) => {
  const res = await fetch(`${API_BASE}/api/files/${id}/stream`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};

export const renameFile = (id: ID, name: string) =>
  j<{ ok: true; name: string }>(`${API_BASE}/api/files/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });

export const deleteFile = (id: ID) =>
  j<{ ok: true }>(`${API_BASE}/api/files/${id}`, { method: "DELETE" });

export const searchFilesContent = (
  q: string,
  opts?: { limit?: number; cursor?: string; dataroomId?: ID | null }
) => {
  const params = new URLSearchParams();
  params.set("q", q);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  if (opts?.dataroomId) params.set("dataroom_id", String(opts.dataroomId));
  return j<SearchFilesResp>(`${API_BASE}/api/search/files?${params.toString()}`);
};
