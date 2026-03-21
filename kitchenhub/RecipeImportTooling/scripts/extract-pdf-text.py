"""Extract plain text from all PDFs in Recipe/PDF -> Recipe/Text/PDF/*.txt"""
import re
import sys
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    print("pip install pypdf", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "Recipe" / "PDF"
OUT_DIR = ROOT / "Recipe" / "Text" / "PDF"


def safe_name(stem: str) -> str:
    s = re.sub(r'[<>:"/\\|?*]', "_", stem)
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > 120:
        s = s[:120]
    return s + ".txt"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    if not pdfs:
        print("No PDFs in", PDF_DIR, file=sys.stderr)
        sys.exit(1)
    for pdf_path in pdfs:
        out_name = safe_name(pdf_path.stem)
        out_path = OUT_DIR / out_name
        try:
            reader = PdfReader(str(pdf_path))
            parts = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    parts.append(t)
            text = "\n\n".join(parts).strip()
            # PDF extractors sometimes emit NULs; PG rejects them in text.
            text = text.replace("\x00", "")
        except Exception as e:
            text = f"[extract error: {e}]"
        out_path.write_text(text, encoding="utf-8", newline="\n")
        safe = out_path.name.encode("ascii", "replace").decode("ascii")
        print(safe, len(text), "chars")
    print("Wrote", len(pdfs), "files to", OUT_DIR)


if __name__ == "__main__":
    main()
