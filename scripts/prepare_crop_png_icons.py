"""
Safely prepare PNG crop icons and update crop_requirements.icon_filename.

Default mode is dry-run. The script only changes crops listed in a manifest,
so existing intentional emoji values are left untouched.

Examples:
  python scripts/prepare_crop_png_icons.py --manifest scripts/crop_icon_manifest.json
  python scripts/prepare_crop_png_icons.py --manifest scripts/crop_icon_manifest.json --download --apply
  python scripts/prepare_crop_png_icons.py --make-local-copy local_crop_requirements.sqlite
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sqlite3
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.parse import quote
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from sqlalchemy import create_engine, text


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "Backend" / "static" / "crop-icons"
DEFAULT_BACKUP = ROOT / "scripts" / "crop_icon_backup.csv"
DEFAULT_AUTO_MANIFEST = ROOT / "scripts" / "crop_icon_manifest.auto.json"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".svg"}
WIKIMEDIA_API = "https://commons.wikimedia.org/w/api.php"
WIKIPEDIA_SUMMARY_API = "https://en.wikipedia.org/api/rest_v1/page/summary"
TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72"
TWEMOJI_CODES = {
    "🌾": "1f33e",
    "🫘": "1fad8",
    "🌿": "1f33f",
    "🌽": "1f33d",
    "🍑": "1f351",
    "🥒": "1f952",
    "🍋": "1f34b",
}
WIKIPEDIA_CROP_PAGES = {
    "Zucchini": "Zucchini",
    "Turnip": "Turnip",
    "Date Palm": "Date_palm",
    "Mandarin Tree": "Mandarin_orange",
    "Fig Tree": "Common_fig",
    "Pomegranate Tree": "Pomegranate",
    "Plum Tree": "Plum",
    "Nectarine Tree": "Nectarine",
    "Quince Tree": "Quince",
    "Pistachio Tree": "Pistachio",
    "Walnut Tree": "Walnut",
    "Common Wheat": "Common_wheat",
    "Barley": "Barley",
    "Oats": "Oat",
    "Sorghum": "Sorghum",
    "Triticale": "Triticale",
    "Rye": "Rye",
    "Millet": "Millet",
    "Quinoa": "Quinoa",
    "Forage Maize": "Maize",
    "Apricot Tree": "Apricot",
    "Broad Bean": "Vicia_faba",
    "Lentil": "Lentil",
    "Chickpea": "Chickpea",
    "Faba Bean": "Vicia_faba",
    "Vetch": "Vicia_sativa",
    "Alfalfa": "Alfalfa",
    "Fenugreek": "Fenugreek",
}


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "crop"


def safe_console(value: object) -> str:
    return str(value).encode("ascii", "backslashreplace").decode("ascii")


def load_manifest(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("Manifest must be a JSON array")
    return data


def row_key(row: dict) -> tuple[str, str, str]:
    return (
        str(row.get("id") or ""),
        str(row.get("crop_slug") or "").lower(),
        str(row.get("crop_name") or "").lower(),
    )


def manifest_keys(item: dict) -> set[str]:
    keys = set()
    if item.get("id") is not None:
        keys.add(f"id:{item['id']}")
    if item.get("crop_slug"):
        keys.add(f"slug:{str(item['crop_slug']).lower()}")
    if item.get("crop_name"):
        keys.add(f"name:{str(item['crop_name']).lower()}")
    return keys


def row_matches_manifest(row: dict, item: dict) -> bool:
    row_id, row_slug, row_name = row_key(row)
    keys = manifest_keys(item)
    return (
        f"id:{row_id}" in keys
        or (row_slug and f"slug:{row_slug}" in keys)
        or f"name:{row_name}" in keys
    )


def safe_filename(item: dict, row: dict) -> str:
    raw = item.get("filename")
    if raw:
        name = Path(str(raw).replace("\\", "/")).name
    else:
        base = item.get("crop_slug") or row.get("crop_slug") or item.get("crop_name") or row["crop_name"]
        name = f"{slugify(str(base))}.png"

    ext = Path(name).suffix.lower()
    if ext not in IMAGE_EXTENSIONS:
        name = f"{Path(name).stem}.png"
    return name


def download_icon(url: str, dest: Path) -> None:
    request = Request(url, headers={"User-Agent": "crop-icon-preparer/1.0"})
    with urlopen(request, timeout=30) as response:
        content_type = response.headers.get("Content-Type", "")
        body = response.read()

    if not body:
        raise RuntimeError(f"Downloaded empty file from {url}")
    if "image" not in content_type and dest.suffix.lower() != ".svg":
        raise RuntimeError(f"URL did not return an image Content-Type: {content_type}")

    dest.write_bytes(body)


def download_bytes(url: str) -> tuple[bytes, str]:
    request = Request(url, headers={"User-Agent": "crop-icon-preparer/1.0"})
    for attempt in range(4):
        try:
            with urlopen(request, timeout=30) as response:
                return response.read(), response.headers.get("Content-Type", "")
        except HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))
        except URLError:
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"Could not download {url}")


def convert_image_to_png(source: Path, dest: Path) -> None:
    script = (
        "$ErrorActionPreference='Stop'; "
        "Add-Type -AssemblyName System.Drawing; "
        f"$img=[System.Drawing.Image]::FromFile('{source}'); "
        f"$img.Save('{dest}', [System.Drawing.Imaging.ImageFormat]::Png); "
        "$img.Dispose()"
    )
    subprocess.run(["powershell", "-NoProfile", "-Command", script], check=True, capture_output=True, text=True)


def wikimedia_search_terms(crop_name: str) -> list[str]:
    clean = crop_name.replace("Tree", "").replace("tree", "").strip()
    terms = [crop_name, f"{clean} fruit", f"{clean} plant", f"{clean} crop", clean]
    seen = set()
    unique = []
    for term in terms:
        key = term.lower()
        if key and key not in seen:
            seen.add(key)
            unique.append(term)
    return unique


def find_wikimedia_image(crop_name: str) -> dict | None:
    for term in wikimedia_search_terms(crop_name):
        query = (
            f"{WIKIMEDIA_API}?action=query&generator=search&gsrnamespace=6"
            f"&gsrlimit=10&gsrsearch={quote(term)}"
            "&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=256&format=json"
        )
        data = json.loads(download_bytes(query)[0].decode("utf-8"))
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            info = (page.get("imageinfo") or [{}])[0]
            mime = info.get("mime") or ""
            source_url = info.get("thumburl") or info.get("url")
            if source_url and mime in {"image/jpeg", "image/png"}:
                return {
                    "search_term": term,
                    "title": page.get("title"),
                    "url": source_url,
                    "mime": mime,
                    "description_url": info.get("descriptionurl"),
                }
    return None


def find_wikipedia_thumbnail(crop_name: str) -> dict | None:
    page = WIKIPEDIA_CROP_PAGES.get(crop_name)
    if not page:
        return None
    url = f"{WIKIPEDIA_SUMMARY_API}/{quote(page)}"
    data = json.loads(download_bytes(url)[0].decode("utf-8"))
    thumbnail = data.get("thumbnail") or {}
    source_url = thumbnail.get("source")
    if not source_url:
        original = data.get("originalimage") or {}
        source_url = original.get("source")
    if not source_url:
        return None
    return {
        "search_term": page,
        "title": data.get("title") or page,
        "url": source_url,
        "mime": "image/png" if ".png" in source_url.lower() else "image/jpeg",
        "description_url": data.get("content_urls", {}).get("desktop", {}).get("page"),
    }


def fetch_crop_rows(engine) -> list[dict]:
    query = text("""
        SELECT id, crop_name, crop_slug, icon_filename
        FROM crop_requirements
        ORDER BY id
    """)
    with engine.connect() as conn:
        return [dict(row) for row in conn.execute(query).mappings().all()]


def fetch_full_crop_rows(engine) -> list[dict]:
    with engine.connect() as conn:
        return [dict(row) for row in conn.execute(text("SELECT * FROM crop_requirements ORDER BY id")).mappings().all()]


def backup_rows(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["id", "crop_name", "crop_slug", "icon_filename"])
        writer.writeheader()
        writer.writerows(rows)


def sqlite_type(value: object) -> str:
    if isinstance(value, int):
        return "INTEGER"
    if isinstance(value, float):
        return "REAL"
    return "TEXT"


def make_local_copy(rows: list[dict], sqlite_path: Path) -> None:
    if not rows:
        raise ValueError("No crop rows available to copy")

    columns = list(rows[0].keys())
    type_by_column = {}
    for column in columns:
        sample = next((row[column] for row in rows if row.get(column) is not None), None)
        type_by_column[column] = sqlite_type(sample)

    sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(sqlite_path) as conn:
        conn.execute("DROP TABLE IF EXISTS crop_requirements")
        column_defs = []
        for column in columns:
            if column == "id":
                column_defs.append('"id" INTEGER PRIMARY KEY')
            else:
                column_defs.append(f'"{column}" {type_by_column[column]}')
        conn.execute(f"CREATE TABLE crop_requirements ({', '.join(column_defs)})")
        placeholders = ", ".join("?" for _ in columns)
        column_sql = ", ".join(f'"{column}"' for column in columns)
        conn.executemany(
            f"INSERT INTO crop_requirements ({column_sql}) VALUES ({placeholders})",
            [tuple(None if row.get(column) is None else str(row[column]) for column in columns) for row in rows],
        )


def audit_rows(rows: list[dict]) -> None:
    by_icon: dict[str, list[dict]] = {}
    for row in rows:
        key = row.get("icon_filename") or ""
        by_icon.setdefault(key, []).append(row)

    empty_rows = by_icon.get("", [])
    print(f"Total crops: {len(rows)}")
    print(f"Empty icon_filename rows: {len(empty_rows)}")
    for row in empty_rows:
        print(f"  EMPTY id={row['id']} slug={row['crop_slug']} name={row['crop_name']}")

    print("Duplicate non-empty icon_filename groups:")
    found_duplicate = False
    for icon, grouped in sorted(by_icon.items(), key=lambda item: (-len(item[1]), item[0])):
        if icon and len(grouped) > 1:
            found_duplicate = True
            names = ", ".join(f"{row['id']}:{row['crop_name']}" for row in grouped)
            print(f"  {safe_console(repr(icon))} x{len(grouped)} -> {safe_console(names)}")
    if not found_duplicate:
        print("  none")


def duplicate_png_plan(rows: list[dict]) -> list[dict]:
    by_icon: dict[str, list[dict]] = {}
    for row in rows:
        icon = row.get("icon_filename") or ""
        if icon:
            by_icon.setdefault(icon, []).append(row)

    planned = []
    for icon, grouped in by_icon.items():
        if len(grouped) <= 1:
            continue

        keeper = grouped[0]
        for row in grouped:
            name = row["crop_name"].lower()
            if icon == "🍋" and "lemon" in name:
                keeper = row
            elif icon == "🌽" and row["crop_name"] == "Grain Maize":
                keeper = row
            elif icon == "🍑" and "peach" in name:
                keeper = row
            elif icon == "🥒" and "cucumber" in name:
                keeper = row

        for row in grouped:
            if row["id"] == keeper["id"]:
                continue
            base = row.get("crop_slug") or row["crop_name"]
            planned.append({
                "id": row["id"],
                "crop_slug": row.get("crop_slug"),
                "crop_name": row["crop_name"],
                "old_icon": row.get("icon_filename"),
                "filename": f"{slugify(str(base))}.png",
                "kept_duplicate_for": keeper["crop_name"],
            })
    return planned


def download_wikimedia_pngs(
    plan: list[dict],
    manifest_path: Path,
    skip_wikimedia: bool = False,
    replace_existing: bool = False,
) -> list[dict]:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    completed = []
    for item in plan:
        time.sleep(1.2)
        dest = ICON_DIR / item["filename"]
        if dest.exists() and not replace_existing:
            completed.append({
                **item,
                "url": None,
                "source_title": "existing local PNG",
                "source_page": None,
                "source_search_term": None,
            })
            print(f"READY {item['crop_name']} -> {dest.name}")
            continue

        source = None
        try:
            source = find_wikipedia_thumbnail(item["crop_name"])
            if source:
                with tempfile.TemporaryDirectory() as tmp:
                    suffix = ".png" if source["mime"] == "image/png" else ".jpg"
                    tmp_path = Path(tmp) / f"source{suffix}"
                    tmp_path.write_bytes(download_bytes(source["url"])[0])
                    convert_image_to_png(tmp_path, dest)
        except Exception as error:
            print(f"WIKIPEDIA FALLBACK {item['crop_name']}: {error}")
            source = None

        if not skip_wikimedia:
            try:
                source = source or find_wikimedia_image(item["crop_name"])
                if source:
                    with tempfile.TemporaryDirectory() as tmp:
                        suffix = ".png" if source["mime"] == "image/png" else ".jpg"
                        tmp_path = Path(tmp) / f"source{suffix}"
                        tmp_path.write_bytes(download_bytes(source["url"])[0])
                        convert_image_to_png(tmp_path, dest)
            except Exception as error:
                print(f"WIKIMEDIA FALLBACK {item['crop_name']}: {error}")
                source = None

        if not source:
            code = TWEMOJI_CODES.get(item.get("old_icon"))
            if not code:
                print(f"SKIP {item['crop_name']}: no Wikimedia result and no Twemoji fallback")
                continue
            source = {
                "search_term": "twemoji fallback",
                "title": f"Twemoji {item['old_icon']}",
                "url": f"{TWEMOJI_BASE}/{code}.png",
                "mime": "image/png",
                "description_url": "https://github.com/twitter/twemoji",
            }
            dest.write_bytes(download_bytes(source["url"])[0])

        completed_item = {
            **item,
            "url": source["url"],
            "source_title": source["title"],
            "source_page": source["description_url"],
            "source_search_term": source["search_term"],
        }
        completed.append(completed_item)
        print(safe_console(f"DOWNLOADED {item['crop_name']} -> {dest.name} from {source['title']}"))

    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(completed, ensure_ascii=False, indent=2), encoding="utf-8")
    return completed


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare mixed emoji/PNG crop icons safely.")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"), help="SQLAlchemy database URL")
    parser.add_argument("--manifest", type=Path, help="JSON manifest of crops to convert to PNG")
    parser.add_argument("--download", action="store_true", help="Download PNGs from manifest URLs")
    parser.add_argument("--apply", action="store_true", help="Actually update icon_filename; otherwise dry-run")
    parser.add_argument("--backup", type=Path, default=DEFAULT_BACKUP, help="CSV backup path for affected rows")
    parser.add_argument("--make-local-copy", type=Path, help="Write a local SQLite copy of crop id/name/icon rows and exit")
    parser.add_argument("--audit", action="store_true", help="Print empty and duplicate icon_filename values and exit")
    parser.add_argument("--auto-duplicate-pngs", action="store_true", help="Download PNGs for duplicate emoji rows, keeping one emoji per duplicate group")
    parser.add_argument("--auto-manifest", type=Path, default=DEFAULT_AUTO_MANIFEST, help="Manifest written by --auto-duplicate-pngs")
    parser.add_argument("--skip-wikimedia", action="store_true", help="Use local existing files or Twemoji fallback without querying Wikimedia")
    parser.add_argument("--replace-existing", action="store_true", help="Replace already downloaded local PNGs")
    args = parser.parse_args()

    if not args.database_url:
        raise SystemExit("Set DATABASE_URL or pass --database-url. Refusing to use the hard-coded app fallback.")

    engine = create_engine(args.database_url, pool_pre_ping=True)
    rows = fetch_crop_rows(engine)

    if args.audit:
        audit_rows(rows)
        return 0

    if args.make_local_copy:
        make_local_copy(fetch_full_crop_rows(engine), args.make_local_copy)
        print(f"Created local crop icon copy: {args.make_local_copy}")
        return 0

    if args.auto_duplicate_pngs:
        plan = duplicate_png_plan(rows)
        if not plan:
            print("No duplicate emoji rows need PNG icons.")
            return 0

        backup_rows([row for row in rows if any(item["id"] == row["id"] for item in plan)], args.backup)
        completed = download_wikimedia_pngs(
            plan,
            args.auto_manifest,
            skip_wikimedia=args.skip_wikimedia,
            replace_existing=args.replace_existing,
        )
        if len(completed) != len(plan):
            missing = {item["crop_name"] for item in plan} - {item["crop_name"] for item in completed}
            print(f"Only downloaded {len(completed)} of {len(plan)} planned icons. Missing: {', '.join(sorted(missing))}")
            if args.apply:
                raise SystemExit("Refusing to update DB until every planned PNG has been downloaded.")

        for item in completed:
            print(safe_console(f"{'UPDATE' if args.apply else 'DRY-RUN'} id={item['id']} {item['crop_name']}: {item['old_icon']!r} -> {item['filename']!r}"))

        if args.apply:
            with engine.begin() as conn:
                for item in completed:
                    conn.execute(
                        text("UPDATE crop_requirements SET icon_filename = :filename WHERE id = :id"),
                        {"filename": item["filename"], "id": item["id"]},
                    )
            print(f"Updated {len(completed)} duplicate emoji rows. Backup saved to {args.backup}")
        return 0

    if not args.manifest:
        raise SystemExit("Pass --manifest, or use --make-local-copy for a safe local copy.")

    manifest = load_manifest(args.manifest)
    planned = []
    for item in manifest:
        matches = [row for row in rows if row_matches_manifest(row, item)]
        if len(matches) != 1:
            print(f"SKIP manifest item {item}: expected 1 DB row, found {len(matches)}")
            continue
        row = matches[0]
        filename = safe_filename(item, row)
        planned.append((row, item, filename))

    if not planned:
        print("No matching crops to update.")
        return 0

    backup_rows([row for row, _, _ in planned], args.backup)
    ICON_DIR.mkdir(parents=True, exist_ok=True)

    for row, item, filename in planned:
        target = ICON_DIR / filename
        if args.download and item.get("url") and not target.exists():
            print(f"Downloading {row['crop_name']} -> {target}")
            download_icon(item["url"], target)

        status = "ready" if target.exists() else "missing file"
        print(f"{'UPDATE' if args.apply else 'DRY-RUN'} id={row['id']} {row['crop_name']}: {row['icon_filename']!r} -> {filename!r} ({status})")

    if args.apply:
        missing = [filename for _, _, filename in planned if not (ICON_DIR / filename).exists()]
        if missing:
            raise SystemExit(f"Refusing to update DB because icon files are missing: {', '.join(missing)}")

        with engine.begin() as conn:
            for row, _, filename in planned:
                conn.execute(
                    text("UPDATE crop_requirements SET icon_filename = :filename WHERE id = :id"),
                    {"filename": filename, "id": row["id"]},
                )
        print(f"Updated {len(planned)} rows. Backup saved to {args.backup}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
