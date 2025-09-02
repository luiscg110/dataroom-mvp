import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import DataroomView from "@/components/DataroomView";
import Login from "@/components/Login";
import type { Dataroom, ID } from "@/types";
import { listDatarooms, getDataroom, setApiToken } from "@/api";
import DataroomListPaginated from "@/components/DataroomListPaginated";
import { useAuth } from "@/auth";

type View =
  | { kind: "list" }
  | { kind: "room"; dataroom: Dataroom };

export default function App() {
  const { token } = useAuth();

  const [view, setView] = useState<View>({ kind: "list" });
  const [rooms, setRooms] = useState<Dataroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setApiToken(token);
  }, [token]);

  const loadRooms = async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await listDatarooms();
      setRooms(data);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load datarooms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setView({ kind: "list" });
    setRooms([]);
    setErr(null);
    if (token) {
      loadRooms();
    } else {
      setLoading(false);
    }
  }, [token]);

  const openRoom = async (id: ID) => {
    try {
      const d = await getDataroom(id);
      setView({ kind: "room", dataroom: d });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (/HTTP\s+401/.test(msg) || /HTTP\s+404/.test(msg)) {
        setView({ kind: "list" });
        await loadRooms();
        setErr("This dataroom is not available for the current user.");
      } else {
        setErr(e?.message ?? "Failed to open dataroom");
      }
    }
  };

  if (!token) {
    return <Login onDone={() => {}} />;
  }

  return (
    <div className="min-h-full">
      <Topbar />

      {view.kind === "list" && (
        <div className="container-app py-10">
          {err && <div className="text-red-600 text-sm mb-3">{err}</div>}
          <DataroomListPaginated onOpen={openRoom} />
        </div>
      )}

      {view.kind === "room" && (
        <DataroomView
          dataroom={view.dataroom}
          onBack={() => {
            setView({ kind: "list" });
            loadRooms();
          }}
        />
      )}
    </div>
  );
}
