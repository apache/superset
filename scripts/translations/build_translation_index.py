# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Build a cross-language translation index from all .po files.

Outputs a JSON file structured as:
  {
    "<msgid>": {
      "<lang>": "<translated string or null>",
      ...
    },
    ...
  }

For plural entries the key is "<msgid>\x00<msgid_plural>" and the value
is a dict mapping lang -> {0: "...", 1: "..."} (or null if untranslated).

Usage:
  python scripts/translations/build_translation_index.py
  python scripts/translations/build_translation_index.py \
    --translations-dir superset/translations \
    --output /tmp/translation_index.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

try:
    import polib  # type: ignore[import-untyped]
except ImportError:
    print("polib is required. Install with: pip install polib", file=sys.stderr)
    sys.exit(1)

TRANSLATIONS_DIR = Path(__file__).parent.parent.parent / "superset" / "translations"
DEFAULT_OUTPUT = (
    Path(__file__).parent.parent.parent
    / "superset"
    / "translations"
    / "translation_index.json"
)


def _is_translated(entry: polib.POEntry) -> bool:
    """Return True if the entry has a non-empty, non-fuzzy translation."""
    if "fuzzy" in entry.flags:
        return False
    if entry.msgid_plural:
        return any(v for v in entry.msgstr_plural.values())
    return bool(entry.msgstr)


def _plural_key(entry: polib.POEntry) -> str:
    """Build the combined key used for plural translation entries."""


def build_index(translations_dir: Path) -> dict[str, Any]:
    """Read all .po files and build a combined translation index."""
    index: dict[str, dict[str, Any]] = {}

    langs = sorted(
        d
        for d in os.listdir(translations_dir)
        if (translations_dir / d / "LC_MESSAGES" / "messages.po").exists()
        and d != "en"  # en has empty msgstr by convention (source = target)
    )

    for lang in langs:
        po_path = translations_dir / lang / "LC_MESSAGES" / "messages.po"
        cat = polib.pofile(str(po_path))
        for entry in cat:
            if not entry.msgid:
                continue  # skip header entry

            if entry.msgid_plural:
                key = _plural_key(entry)
                if key not in index:
                    index[key] = {}
                translated = (
                    dict(entry.msgstr_plural)
                    if any(v for v in entry.msgstr_plural.values())
                    else None
                )
                index[key][lang] = translated
            else:
                key = entry.msgid
                if key not in index:
                    index[key] = {}
                index[key][lang] = entry.msgstr or None

    # Ensure every entry has a slot for every language (null if missing)
    for key in index:
        for lang in langs:
            index[key].setdefault(lang, None)

    return index


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build cross-language translation index"
    )
    parser.add_argument(
        "--translations-dir",
        type=Path,
        default=TRANSLATIONS_DIR,
        help="Path to the translations directory (default: superset/translations)",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=(
            "Output JSON file path"
            " (default: superset/translations/translation_index.json)"
        ),
    )
    args = parser.parse_args()

    print(f"Reading .po files from {args.translations_dir} …", file=sys.stderr)
    index = build_index(args.translations_dir)
    print(f"Indexed {len(index)} message IDs.", file=sys.stderr)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    print(f"Written to {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
