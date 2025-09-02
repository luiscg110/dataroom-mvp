import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import DataroomList from "@/components/DataroomList";
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
    if (token) loadRooms();
  }, [token]);

  const openRoom = async (id: ID) => {
    const d = await getDataroom(id);
    setView({ kind: "room", dataroom: d });
  };

  if (!token) {
    return <Login onDone={() => { /* el efecto de token cargará las salas */ }} />;
  }

  return (
    <div className="min-h-full">
      <Topbar />

      {view.kind === "list" && (
        <div className="container-app py-10">
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
