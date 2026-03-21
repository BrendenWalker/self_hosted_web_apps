"""Extract plain text from Recipe/ODT/*.odt -> Recipe/Text/ODT/*.txt"""
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ODT_DIR = ROOT / "Recipe" / "ODT"
OUT_DIR = ROOT / "Recipe" / "Text" / "ODT"

OFFICE_NS = "urn:oasis:names:tc:opendocument:xmlns:office:1.0"


def local(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def odt_to_text(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        xml = z.read("content.xml")
    root = ET.fromstring(xml)
    body = root.find(f".//{{{OFFICE_NS}}}body")
    if body is None:
        return "[no body in content.xml]"
    lines = []
    for el in body.iter():
        if local(el.tag) in ("p", "h", "list-item"):
            t = "".join(el.itertext()).strip()
            if t:
                lines.append(t)
    return "\n\n".join(lines)


def safe_name(stem: str) -> str:
    s = re.sub(r'[<>:"/\\|?*]', "_", stem)
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > 120:
        s = s[:120]
    return s + ".txt"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    odts = sorted(ODT_DIR.glob("*.odt"))
    if not odts:
        print("No .odt in", ODT_DIR, file=sys.stderr)
        sys.exit(1)
    for odt_path in odts:
        out_name = safe_name(odt_path.stem)
        out_path = OUT_DIR / out_name
        try:
            text = odt_to_text(odt_path)
        except Exception as e:
            text = f"[extract error: {e}]"
        text = text.replace("\x00", "")
        out_path.write_text(text, encoding="utf-8", newline="\n")
        safe = out_name.encode("ascii", "replace").decode("ascii")
        print(safe, len(text), "chars")
    print("Wrote", len(odts), "files to", OUT_DIR)


if __name__ == "__main__":
    main()
