export type ID = number;

export interface Dataroom {
  id: ID;
  name: string;
  created_at?: string;
  root_folder_id?: ID;
}

export interface Folder {
  id: ID;
  name: string;
  dataroom_id: ID;
  parent_id: ID | null;
}

export interface FileItem {
  id: ID;
  name: string;
  folder_id: ID;
  size_bytes: number;
  mime_type: string;
}

export interface FolderChildren {
  folders: Array<Pick<Folder, "id" | "name" | "parent_id">>;
  files: Array<Pick<FileItem, "id" | "name" | "size_bytes" | "mime_type">>;
}
