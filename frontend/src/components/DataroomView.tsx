import React, { useEffect, useMemo, useState } from "react";
import type { Dataroom, Folder, FolderChildren, FileItem, ID } from "@/types";
import {
  getFolder,
  listChildrenPaged,
  uploadFile,
  createFolder,
  searchFilesContent,
  searchFilesMeta,
} from "@/api";
import Breadcrumbs, { Crumb } from "./Breadcrumbs";
import UploadButton from "./UploadButton";
import FolderChildrenComp from "./FolderChildren";
import CreateFolderModal from "./CreateFolderModal";
import PdfViewer from "./PdfViewer";

type Props = {
  dataroom: Dataroom;
  onBack: () => void;
};

type SearchCriterion = "name" | "date" | "size" | "content";

type UIFile = Pick<FileItem, "id" | "name" | "size_bytes" | "mime_type"> & {
  created_at?: string;
  folder_id?: ID;
};

export default function DataroomView({ dataroom, onBack }: Props) {
  const rootId = dataroom.root_folder_id!;
  const [currentId, setCurrentId] = useState<ID>(rootId);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [children, setChildren] = useState<FolderChildren | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [cursorFolders, setCursorFolders] = useState<string | null>(null);
  const [cursorFiles, setCursorFiles] = useState<string | null>(null);
  const [loadingMoreFolders, setLoadingMoreFolders] = useState(false);
  const [loadingMoreFiles, setLoadingMoreFiles] = useState(false);

  const [searchMode, setSearchMode] = useState(false);
  const [criterion, setCriterion] = useState<SearchCriterion>("name");
  const [qName, setQName] = useState("");
  const [qDateFrom, setQDateFrom] = useState<string>("");
  const [qDateTo, setQDateTo] = useState<string>("");
  const [qSizeMinMB, setQSizeMinMB] = useState<string>("");
  const [qSizeMaxMB, setQSizeMaxMB] = useState<string>("");

  const [qContent, setQContent] = useState("");
  const [contentResults, setContentResults] = useState<FileItem[]>([]);
  const [contentCursor, setContentCursor] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingMoreContent, setLoadingMoreContent] = useState(false);
  const [errContent, setErrContent] = useState<string | null>(null);

  const [metaResults, setMetaResults] = useState<UIFile[]>([]);
  const [metaCursor, setMetaCursor] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingMoreMeta, setLoadingMoreMeta] = useState(false);
  const [errMeta, setErrMeta] = useState<string | null>(null);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [viewer, setViewer] = useState<{ id: ID; name: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadInitial = async (id: ID) => {
    setLoading(true);
    setErr(null);
    try {
      const [f, ch] = await Promise.all([
        getFolder(id),
        listChildrenPaged(id, { limitFolders: 10, limitFiles: 10 }),
      ]);
      setFolder(f);
      setChildren({ folders: ch.folders, files: ch.files });
      setCursorFolders(ch.next_cursor_folders);
      setCursorFiles(ch.next_cursor_files);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load folder");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async (id = currentId) => {
    await loadInitial(id);
  };

  useEffect(() => {
    setChildren(null);
    setCursorFolders(null);
    setCursorFiles(null);
    setSearchMode(false);
    setContentResults([]);
    setContentCursor(null);
    setErrContent(null);
    setMetaResults([]);
    setMetaCursor(null);
    setErrMeta(null);
    loadInitial(currentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  useEffect(() => {
    let alive = true;
    const build = async (startId: ID) => {
      try {
        const path: Crumb[] = [{ id: rootId, label: dataroom.name }];
        let cur: Folder | null = await getFolder(startId);
        const chain: Crumb[] = [];
        while (cur) {
          chain.push({ id: cur.id, label: cur.name });
          if (!cur.parent_id) break;
          cur = await getFolder(cur.parent_id);
        }
        const items = path.concat(chain.reverse());
        if (alive) setCrumbs(items);
      } catch {}
    };
    build(currentId);
    return () => {
      alive = false;
    };
  }, [currentId, dataroom.name, rootId]);

  const onCrumbClick = (id?: ID) => id && setCurrentId(id);

  const onPickFile = async (file: File) => {
    const res = await uploadFile(currentId, file);
    await refresh();
    if (res.renamed) {
      setNotice(`Renamed "${res.original_name}" to "${res.name}" because a file with that name already exists in this folder.`);
      setTimeout(() => setNotice(null), 6000);
    }
  };

  const onCreateFolder = async (name: string) => {
    await createFolder(dataroom.id, currentId, name);
    await refresh();
  };

  const files = useMemo(() => children?.files ?? [], [children]);
  const folders = useMemo(() => children?.folders ?? [], [children]);

  const loadMoreFolders = async () => {
    if (!cursorFolders) return;
    setLoadingMoreFolders(true);
    setErr(null);
    try {
      const ch = await listChildrenPaged(currentId, {
        limitFolders: 10,
        cursorFolders,
        limitFiles: 1,
        cursorFiles: cursorFiles ?? undefined,
      });
      setChildren((prev) => ({
        folders: [...(prev?.folders ?? []), ...ch.folders],
        files: prev?.files ?? [],
      }));
      setCursorFolders(ch.next_cursor_folders);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load more folders");
    } finally {
      setLoadingMoreFolders(false);
    }
  };

  const loadMoreFiles = async () => {
    if (!cursorFiles) return;
    setLoadingMoreFiles(true);
    setErr(null);
    try {
      const ch = await listChildrenPaged(currentId, {
        limitFiles: 10,
        cursorFiles,
        limitFolders: 1,
        cursorFolders: cursorFolders ?? undefined,
      });
      setChildren((prev) => ({
        folders: prev?.folders ?? [],
        files: [...(prev?.files ?? []), ...ch.files],
      }));
      setCursorFiles(ch.next_cursor_files);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load more files");
    } finally {
      setLoadingMoreFiles(false);
    }
  };

  const startSearch = async () => {
    setSearchMode(true);
    if (criterion === "content") {
      setContentResults([]);
      setContentCursor(null);
      setErrContent(null);
      setLoadingContent(true);
      try {
        const res = await searchFilesContent(qContent.trim(), { limit: 10 }); // GLOBAL
        setContentResults(res.items as any);
        setContentCursor(res.next_cursor);
      } catch (e: any) {
        setErrContent(e?.message ?? "Search failed");
      } finally {
        setLoadingContent(false);
      }
    } else {
      setMetaResults([]);
      setMetaCursor(null);
      setErrMeta(null);
      setLoadingMeta(true);
      try {
        const res = await searchFilesMeta({
          name: criterion === "name" ? qName.trim() : undefined,
          dateFrom: criterion === "date" ? (qDateFrom || undefined) : undefined,
          dateTo: criterion === "date" ? (qDateTo || undefined) : undefined,
          sizeMinMB: criterion === "size" && qSizeMinMB ? Number(qSizeMinMB) : undefined,
          sizeMaxMB: criterion === "size" && qSizeMaxMB ? Number(qSizeMaxMB) : undefined,
          limit: 10, // GLOBAL
        });
        setMetaResults(res.items as any);
        setMetaCursor(res.next_cursor);
      } catch (e: any) {
        setErrMeta(e?.message ?? "Search failed");
      } finally {
        setLoadingMeta(false);
      }
    }
  };

  const loadMoreContent = async () => {
    if (!contentCursor) return;
    setLoadingMoreContent(true);
    setErrContent(null);
    try {
      const res = await searchFilesContent(qContent.trim(), { limit: 10, cursor: contentCursor });
      setContentResults((prev) => [...prev, ...(res.items as any)]);
      setContentCursor(res.next_cursor);
    } catch (e: any) {
      setErrContent(e?.message ?? "Search failed");
    } finally {
      setLoadingMoreContent(false);
    }
  };

  const loadMoreMeta = async () => {
    if (!metaCursor) return;
    setLoadingMoreMeta(true);
    setErrMeta(null);
    try {
      const res = await searchFilesMeta({
        name: criterion === "name" ? qName.trim() : undefined,
        dateFrom: criterion === "date" ? (qDateFrom || undefined) : undefined,
        dateTo: criterion === "date" ? (qDateTo || undefined) : undefined,
        sizeMinMB: criterion === "size" && qSizeMinMB ? Number(qSizeMinMB) : undefined,
        sizeMaxMB: criterion === "size" && qSizeMaxMB ? Number(qSizeMaxMB) : undefined,
        limit: 10,
        cursor: metaCursor,
      });
      setMetaResults((prev) => [...prev, ...(res.items as any)]);
      setMetaCursor(res.next_cursor);
    } catch (e: any) {
      setErrMeta(e?.message ?? "Search failed");
    } finally {
      setLoadingMoreMeta(false);
    }
  };

  const clearSearch = () => {
    setSearchMode(false);
    setErrContent(null);
    setContentResults([]);
    setContentCursor(null);
    setErrMeta(null);
    setMetaResults([]);
    setMetaCursor(null);
  };

  return (
    <div className="container-app py-6 grid gap-4">
      <div className="flex items-center justify-between">
        <button className="text-sm text-blue-600 hover:underline" onClick={onBack}>
          ← Back
        </button>
        <div className="text-xs text-slate-500">Room ID: {dataroom.id}</div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Breadcrumbs items={crumbs} onClick={onCrumbClick} />
          <div className="flex items-center gap-2">
            <UploadButton onSelected={onPickFile} />
            <button
              className="rounded-xl px-3 py-2 bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => setShowNewFolder(true)}
            >
              New folder
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="mt-3 grid gap-2 sm:grid-cols-[160px,1fr,auto,auto]">
          <select
            value={criterion}
            onChange={(e) => setCriterion(e.target.value as any)}
            className="rounded-xl border px-3 py-2 outline-none focus:ring-2 ring-blue-500"
          >
            <option value="name">Name</option>
            <option value="date">Created date</option>
            <option value="size">Size (MB)</option>
            <option value="content">Content</option>
          </select>

          {criterion === "name" && (
            <input
              value={qName}
              onChange={(e) => setQName(e.target.value)}
              placeholder="Search by name…"
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 ring-blue-500"
            />
          )}

          {criterion === "date" && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={qDateFrom}
                onChange={(e) => setQDateFrom(e.target.value)}
                className="rounded-xl border px-3 py-2 outline-none focus:ring-2 ring-blue-500"
              />
              <input
                type="date"
                value={qDateTo}
                onChange={(e) => setQDateTo(e.target.value)}
                className="rounded-xl border px-3 py-2 outline-none focus:ring-2 ring-blue-500"
              />
            </div>
          )}

          {criterion === "size" && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={0}
                placeholder="Min MB"
                value={qSizeMinMB}
                onChange={(e) => setQSizeMinMB(e.target.value)}
                className="rounded-xl border px-3 py-2 outline-none focus:ring-2 ring-blue-500"
              />
              <input
                type="number"
                min={0}
                placeholder="Max MB"
                value={qSizeMaxMB}
                onChange={(e) => setQSizeMaxMB(e.target.value)}
                className="rounded-xl border px-3 py-2 outline-none focus:ring-2 ring-blue-500"
              />
            </div>
          )}

          {criterion === "content" && (
            <input
              value={qContent}
              onChange={(e) => setQContent(e.target.value)}
              placeholder="Find words inside PDFs…"
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 ring-blue-500"
            />
          )}

          <button
            onClick={startSearch}
            className="rounded-xl px-3 py-2 bg-brand-600 text-white hover:bg-brand-500"
          >
            Search
          </button>

          {searchMode && (
            <button
              onClick={clearSearch}
              className="rounded-xl px-3 py-2 bg-blue-600 text-white hover:bg-blue-700"
            >
              Clear
            </button>
          )}
        </div>

        {(err || errContent || errMeta) && (
          <div className="mt-3 text-sm text-red-600">{err || errContent || errMeta}</div>
        )}
      </div>

      {notice && (
        <div className="card p-3 border-amber-200 bg-amber-50 text-amber-800 mt-2 flex items-start justify-between">
          <div className="pr-3">
            <span className="font-medium">Heads up:</span> {notice}
          </div>
          <button
            onClick={() => setNotice(null)}
            className="ml-3 text-amber-800/70 hover:text-amber-900 font-medium"
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>
      )}


      {/* Resultados: content / meta / vista normal */}
      {searchMode && criterion === "content" ? (
        <div className="card p-4">
          {loadingContent ? (
            <div className="text-sm text-slate-500">Searching…</div>
          ) : contentResults.length === 0 ? (
            <div className="text-sm text-slate-500">No results</div>
          ) : (
            <ul className="grid md:grid-cols-2 gap-3">
              {contentResults.map((f: any) => (
                <li key={f.id} className="card p-4 hover:shadow transition">
                  <div className="flex items-center justify-between">
                    <button
                      className="text-left font-medium hover:underline"
                      onClick={() => setViewer({ id: f.id, name: f.name })}
                    >
                      {f.name}
                    </button>
                    <div className="text-xs text-slate-500">
                      {f.size_bytes != null ? `${(f.size_bytes / (1024 * 1024)).toFixed(2)} MB` : ""}
                    </div>
                  </div>
                  {f.snippet && (
                    <div
                      className="mt-2 text-xs text-slate-600 line-clamp-3"
                      dangerouslySetInnerHTML={{ __html: f.snippet }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3">
            {contentCursor ? (
              <button
                onClick={loadMoreContent}
                disabled={loadingMoreContent}
                className="inline-flex items-center justify-center rounded-xl px-3 py-2 bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {loadingMoreContent ? "Loading…" : "View more"}
              </button>
            ) : (
              contentResults.length > 0 && (
                <div className="text-xs text-slate-500">No more results</div>
              )
            )}
          </div>
        </div>
      ) : searchMode ? (
        <div className="card p-4">
          {loadingMeta ? (
            <div className="text-sm text-slate-500">Searching…</div>
          ) : metaResults.length === 0 ? (
            <div className="text-sm text-slate-500">No results</div>
          ) : (
            <ul className="grid md:grid-cols-2 gap-3">
              {metaResults.map((f: any) => (
                <li
                  key={f.id}
                  className="card p-4 hover:shadow transition flex items-center justify-between"
                >
                  <button
                    className="text-left font-medium hover:underline"
                    onClick={() => setViewer({ id: f.id, name: f.name })}
                  >
                    {f.name}
                  </button>
                  <div className="text-xs text-slate-500">
                    {f.size_bytes != null ? `${(f.size_bytes / (1024 * 1024)).toFixed(2)} MB` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3">
            {metaCursor ? (
              <button
                onClick={loadMoreMeta}
                disabled={loadingMoreMeta}
                className="inline-flex items-center justify-center rounded-xl px-3 py-2 bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {loadingMoreMeta ? "Loading…" : "View more"}
              </button>
            ) : (
              metaResults.length > 0 && (
                <div className="text-xs text-slate-500">No more results</div>
              )
            )}
          </div>
        </div>
      ) : loading || !children ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <>
          <FolderChildrenComp
            folderId={currentId}
            data={{ files, folders }}
            onOpenFolder={(id) => setCurrentId(id)}
            onOpenFile={(f: FileItem) => setViewer({ id: f.id, name: f.name })}
            onRefresh={() => refresh()}
          />

          <div className="grid md:grid-cols-2 gap-3">
            <div className="flex">
              {cursorFolders ? (
                <button
                  onClick={loadMoreFolders}
                  disabled={loadingMoreFolders}
                  className="mt-2 inline-flex items-center justify-center rounded-xl px-3 py-2 bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-50"
                >
                  {loadingMoreFolders ? "Loading…" : "View more"}
                </button>
              ) : (
                <div className="mt-3 text-xs text-slate-500">No more folders</div>
              )}
            </div>
            <div className="flex">
              {cursorFiles ? (
                <button
                  onClick={loadMoreFiles}
                  disabled={loadingMoreFiles}
                  className="mt-2 inline-flex items-center justify-center rounded-xl px-3 py-2 bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-50"
                >
                  {loadingMoreFiles ? "Loading…" : "View more"}
                </button>
              ) : (
                <div className="mt-3 text-xs text-slate-500">No more files</div>
              )}
            </div>
          </div>
        </>
      )}

      <CreateFolderModal
        open={showNewFolder}
        onClose={() => setShowNewFolder(false)}
        onCreate={onCreateFolder}
      />

      {viewer && (
        <PdfViewer
          open={true}
          fileId={viewer.id}
          name={viewer.name}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
