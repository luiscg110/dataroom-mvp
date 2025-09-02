import os, re, hashlib
from werkzeug.utils import secure_filename


PDF_MAGIC = b"%PDF"


def is_pdf(file_storage) -> bool:
    # quick & simple: sniff first 4 bytes
    head = file_storage.stream.read(4)
    file_storage.stream.seek(0)
    return head.startswith(PDF_MAGIC)


_name_suffix_re = re.compile(r"^(.*?)( \((\d+)\))?(\.[^.]*)?$")


def next_collision_name(name: str, taken: set[str]) -> str:
    base, num, ext = None, None, None
    m = _name_suffix_re.match(name)
    if m:
        base = (m.group(1) or "").strip()
        num = int(m.group(3) or 0)
        ext = m.group(4) or ""
    else:
        base, ext, num = name, "", 0
    candidate = name
    while candidate in taken:
        num += 1
        candidate = f"{base} ({num}){ext}"
    return candidate


def safe_original_name(filename: str) -> str:
    s = secure_filename(filename)
    return s if s else "file.pdf"


def sha256_of_file(f) -> str:
    h = hashlib.sha256()
    for chunk in iter(lambda: f.read(8192), b""):
        h.update(chunk)
    f.seek(0)
    return h.hexdigest()