import base64, json
from datetime import datetime

def _b64e(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")

def _b64d(s: str) -> bytes:
    pad = "=" * ((4 - len(s) % 4) % 4)
    return base64.urlsafe_b64decode((s + pad).encode())

def encode_cursor(dt: datetime, id_: int) -> str:
    return _b64e(json.dumps([dt.isoformat(), id_]).encode())

def decode_cursor(s: str) -> tuple[datetime, int]:
    try:
        iso, id_ = json.loads(_b64d(s).decode())
        return datetime.fromisoformat(iso), int(id_)
    except Exception as e:
        raise ValueError("bad cursor") from e
