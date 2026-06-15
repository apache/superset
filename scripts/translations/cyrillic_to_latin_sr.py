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
"""Generate the Serbian Latin (sr_Latn) catalog from the Cyrillic (sr) one.

Serbian Cyrillic -> Latin transliteration is a deterministic, lossless 1:1
mapping (Gaj's Latin alphabet), so the Latin catalog can be produced mechanically
from the reviewed Cyrillic catalog instead of running a second AI translation
pass. Only the translated text (msgstr / plural forms) is transliterated — the
English msgid, format placeholders like %(name)s and {name}, and HTML tags
contain no Cyrillic characters and therefore pass through untouched.

Usage:
  python scripts/translations/cyrillic_to_latin_sr.py
  python scripts/translations/cyrillic_to_latin_sr.py \
    --src superset/translations/sr/LC_MESSAGES/messages.po \
    --dest superset/translations/sr_Latn/LC_MESSAGES/messages.po
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import polib  # type: ignore[import-untyped]
except ImportError:
    print("polib is required. Run: pip install polib", file=sys.stderr)
    sys.exit(1)

TRANSLATIONS_DIR = Path(__file__).parent.parent.parent / "superset" / "translations"

# Single-character Cyrillic -> Latin map. The digraph letters (љ њ џ) are handled
# separately so their case can follow the surrounding context.
_SINGLE: dict[str, str] = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "ђ": "đ", "е": "e",
    "ж": "ž", "з": "z", "и": "i", "ј": "j", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "ћ": "ć",
    "у": "u", "ф": "f", "х": "h", "ц": "c", "ч": "č", "ш": "š",
    "А": "A", "Б": "B", "В": "V", "Г": "G", "Д": "D", "Ђ": "Đ", "Е": "E",
    "Ж": "Ž", "З": "Z", "И": "I", "Ј": "J", "К": "K", "Л": "L", "М": "M",
    "Н": "N", "О": "O", "П": "P", "Р": "R", "С": "S", "Т": "T", "Ћ": "Ć",
    "У": "U", "Ф": "F", "Х": "H", "Ц": "C", "Ч": "Č", "Ш": "Š",
}

# Lowercase digraphs are unambiguous.
_DIGRAPH_LOWER: dict[str, str] = {"љ": "lj", "њ": "nj", "џ": "dž"}

# Uppercase digraphs map to a title-case or all-caps Latin form depending on the
# following character: Љуба -> Ljuba, but ЉУБА -> LJUBA.
_DIGRAPH_UPPER_TITLE: dict[str, str] = {"Љ": "Lj", "Њ": "Nj", "Џ": "Dž"}
_DIGRAPH_UPPER_ALL: dict[str, str] = {"Љ": "LJ", "Њ": "NJ", "Џ": "DŽ"}

_CYRILLIC_UPPER = set(_SINGLE) | set(_DIGRAPH_UPPER_TITLE)
_CYRILLIC_UPPER = {c for c in _CYRILLIC_UPPER if c.isupper()}


def transliterate(text: str) -> str:
    """Transliterate a Serbian Cyrillic string into Gaj's Latin alphabet."""
    out: list[str] = []
    for i, ch in enumerate(text):
        if ch in _DIGRAPH_LOWER:
            out.append(_DIGRAPH_LOWER[ch])
        elif ch in _DIGRAPH_UPPER_TITLE:
            nxt = text[i + 1] if i + 1 < len(text) else ""
            if nxt and nxt in _CYRILLIC_UPPER:
                out.append(_DIGRAPH_UPPER_ALL[ch])
            else:
                out.append(_DIGRAPH_UPPER_TITLE[ch])
        else:
            out.append(_SINGLE.get(ch, ch))
    return "".join(out)


def transliterate_catalog(src: Path, dest: Path) -> int:
    """Read the Cyrillic .po at ``src`` and write a Latin .po at ``dest``.

    Returns the number of entries whose translation was transliterated.
    """
    cat = polib.pofile(str(src))

    # Retarget the catalog metadata to the Latin locale.
    cat.metadata["Language"] = "sr_Latn"
    if "Language-Team" in cat.metadata:
        cat.metadata["Language-Team"] = "sr_Latn <LL@li.org>"

    changed = 0
    for entry in cat:
        if entry.msgid_plural:
            new_plural = {
                k: transliterate(v) for k, v in entry.msgstr_plural.items()
            }
            if new_plural != entry.msgstr_plural:
                entry.msgstr_plural = new_plural
                changed += 1
        elif entry.msgstr:
            new_msgstr = transliterate(entry.msgstr)
            if new_msgstr != entry.msgstr:
                entry.msgstr = new_msgstr
                changed += 1

    dest.parent.mkdir(parents=True, exist_ok=True)
    cat.save(str(dest))
    return changed


def main() -> None:
    """Parse arguments and transliterate the Serbian catalog."""
    parser = argparse.ArgumentParser(
        description="Generate sr_Latn catalog from sr via transliteration"
    )
    parser.add_argument(
        "--src",
        type=Path,
        default=TRANSLATIONS_DIR / "sr" / "LC_MESSAGES" / "messages.po",
        help="Source Cyrillic .po (default: superset/translations/sr/.../messages.po)",
    )
    parser.add_argument(
        "--dest",
        type=Path,
        default=TRANSLATIONS_DIR / "sr_Latn" / "LC_MESSAGES" / "messages.po",
        help="Destination Latin .po (default: superset/translations/sr_Latn/...)",
    )
    args = parser.parse_args()

    if not args.src.exists():
        print(f"Source catalog not found: {args.src}", file=sys.stderr)
        sys.exit(1)

    changed = transliterate_catalog(args.src, args.dest)
    print(f"Transliterated {changed} entries -> {args.dest}", file=sys.stderr)


if __name__ == "__main__":
    main()
