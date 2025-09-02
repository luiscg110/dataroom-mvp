from datetime import datetime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import Integer, String, ForeignKey, DateTime, func, UniqueConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    theme: Mapped[str] = mapped_column(String(10), nullable=False, default="light")
    created_at: Mapped["DateTime"] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Dataroom(Base):
    __tablename__ = "datarooms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    root_folder_id: Mapped[int | None] = mapped_column(ForeignKey("folders.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    folders: Mapped[list["Folder"]] = relationship(
        "Folder",
        back_populates="dataroom",
        cascade="all, delete-orphan",
        primaryjoin="Dataroom.id==Folder.dataroom_id",
        foreign_keys="Folder.dataroom_id",
    )
    root_folder: Mapped["Folder"] = relationship(
        "Folder",
        foreign_keys=[root_folder_id],
        post_update=True,
        lazy="joined",
    )

class Folder(Base):
    __tablename__ = "folders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    dataroom_id: Mapped[int] = mapped_column(ForeignKey("datarooms.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("folders.id", ondelete="CASCADE"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    dataroom: Mapped["Dataroom"] = relationship(
        "Dataroom",
        back_populates="folders",
        foreign_keys=[dataroom_id],
        primaryjoin="Folder.dataroom_id==Dataroom.id",
    )
    parent: Mapped["Folder"] = relationship(
        "Folder",
        remote_side="Folder.id",
        backref="children",
        foreign_keys=[parent_id],
    )

    files: Mapped[list["File"]] = relationship(
        "File",
        back_populates="folder",
        cascade="all, delete-orphan",
        foreign_keys="File.folder_id",
        primaryjoin="Folder.id==File.folder_id",
    )

    __table_args__ = (UniqueConstraint("dataroom_id", "parent_id", "name", name="uq_folder_siblings"),)

class File(Base):
    __tablename__ = "files"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    folder_id: Mapped[int] = mapped_column(ForeignKey("folders.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    folder: Mapped["Folder"] = relationship(
        "Folder",
        back_populates="files",
        foreign_keys=[folder_id],
        primaryjoin="File.folder_id==Folder.id",
    )

class FileText(Base):
    __tablename__ = "file_texts"
    file_id: Mapped[int] = mapped_column(ForeignKey("files.id", ondelete="CASCADE"), primary_key=True)
    content_plain: Mapped[str] = mapped_column(Text, default="")