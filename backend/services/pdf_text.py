# backend/services/pdf_text.py
from pdfminer.high_level import extract_text

def extract_pdf_text(path: str, max_chars: int = 1_000_000) -> str:
    try:
        txt = extract_text(path) or ""
        if len(txt) > max_chars:
            return txt[:max_chars]
        return txt
    except Exception:
        return ""
