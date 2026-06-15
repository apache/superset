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
"""Normalize Latin-script entries in the Serbian (sr) catalog to Cyrillic.

The AI backfill produced a mix of scripts: most entries are Serbian Cyrillic,
but a sizeable fraction came back in Serbian Latin (Gajica). The ``sr`` catalog
is meant to be Cyrillic (``sr_Latn`` is generated separately by transliterating
it), so this script rewrites any Latin-script translation into Cyrillic.

Serbian Latin -> Cyrillic is a deterministic 1:1 mapping *except* that Latin
tokens which are not Serbian words — format placeholders (%(name)s, {x}, %s),
HTML tags, URLs, and brand/technical terms borrowed verbatim from the English
source (SQL, Superset, CSV, GeoJSON, epoch …) — must stay in Latin. The reliable
signal for "leave this alone" is: the token appears verbatim in the English
msgid. That mirrors the convention the AI already followed in the entries it
translated directly into Cyrillic (e.g. "да отворите SQL Lab", "Superset-овог").

Only entries whose translation contains no Cyrillic at all are converted, so the
already-correct Cyrillic majority is left untouched.

Usage:
  python scripts/translations/latin_to_cyrillic_sr.py            # in place
  python scripts/translations/latin_to_cyrillic_sr.py --dry-run  # report only
  python scripts/translations/latin_to_cyrillic_sr.py \
    --src superset/translations/sr/LC_MESSAGES/messages.po --dest /tmp/out.po
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    import polib  # type: ignore[import-untyped]
except ImportError:
    print("polib is required. Run: pip install polib", file=sys.stderr)
    sys.exit(1)

TRANSLATIONS_DIR = Path(__file__).parent.parent.parent / "superset" / "translations"
DEFAULT_PO = TRANSLATIONS_DIR / "sr" / "LC_MESSAGES" / "messages.po"

_CYRILLIC = re.compile(r"[Ѐ-ӿ]")
_LATIN = re.compile(r"[A-Za-zČĆŽŠĐčćžšđ]")

# Spans that must never be transliterated: %-placeholders, brace placeholders,
# HTML tags, HTML entities, and URLs. Matched in priority order.
_PROTECT = re.compile(
    r"""
    %\([^)]*\)[#0\- +]?\d*(?:\.\d+)?[a-zA-Z]   # %(name)s, %(line)d, %(v).2f
    | %[#0\- +]?\d*(?:\.\d+)?[a-zA-Z%]          # %s, %d, %.2f, %%
    | \{[^{}]*\}                                # {name}, {0}
    | </?[A-Za-z][^>]*>                         # HTML tags
    | &[A-Za-z#0-9]+;                           # HTML entities
    | https?://\S+ | www\.\S+                   # URLs
    """,
    re.VERBOSE,
)

# Serbian Latin -> Cyrillic. Digraphs first so dž/lj/nj are not split.
_DIGRAPHS: list[tuple[str, str]] = [
    ("dž", "џ"), ("Dž", "Џ"), ("DŽ", "Џ"),
    ("lj", "љ"), ("Lj", "Љ"), ("LJ", "Љ"),
    ("nj", "њ"), ("Nj", "Њ"), ("NJ", "Њ"),
]
_SINGLE: dict[str, str] = {
    "a": "а", "b": "б", "c": "ц", "č": "ч", "ć": "ћ", "d": "д", "đ": "ђ",
    "e": "е", "f": "ф", "g": "г", "h": "х", "i": "и", "j": "ј", "k": "к",
    "l": "л", "m": "м", "n": "н", "o": "о", "p": "п", "r": "р", "s": "с",
    "š": "ш", "t": "т", "u": "у", "v": "в", "z": "з", "ž": "ж",
    "A": "А", "B": "Б", "C": "Ц", "Č": "Ч", "Ć": "Ћ", "D": "Д", "Đ": "Ђ",
    "E": "Е", "F": "Ф", "G": "Г", "H": "Х", "I": "И", "J": "Ј", "K": "К",
    "L": "Л", "M": "М", "N": "Н", "O": "О", "P": "П", "R": "Р", "S": "С",
    "Š": "Ш", "T": "Т", "U": "У", "V": "В", "Z": "З", "Ž": "Ж",
}


def _transliterate_word(word: str) -> str:
    """Transliterate a run of Latin letters into Cyrillic, honoring digraphs."""
    out: list[str] = []
    i = 0
    n = len(word)
    while i < n:
        two = word[i : i + 2]
        # Match a digraph only when the second letter's case is consistent with
        # a single letter (so "Ljiljana" -> "Љиљана", "LJUBA" -> "ЉУБА").
        matched = False
        for src, dst in _DIGRAPHS:
            if two == src:
                out.append(dst)
                i += 2
                matched = True
                break
        if matched:
            continue
        out.append(_SINGLE.get(word[i], word[i]))
        i += 1
    return "".join(out)


def transliterate(text: str, keep: set[str]) -> str:
    """Transliterate ``text`` to Cyrillic, leaving protected tokens in Latin.

    ``keep`` is the set of whitespace-delimited tokens (case-sensitive) that were
    borrowed verbatim from the English source and must remain in Latin.
    """
    # Carve out the spans that must stay verbatim (placeholders, tags, URLs).
    out: list[str] = []
    pos = 0
    for m in _PROTECT.finditer(text):
        out.append(_transliterate_outside(text[pos : m.start()], keep))
        out.append(m.group(0))
        pos = m.end()
    out.append(_transliterate_outside(text[pos:], keep))
    return "".join(out)


def _transliterate_outside(text: str, keep: set[str]) -> str:
    """Transliterate a placeholder-free span, skipping ``keep`` tokens."""
    # Split on Latin word boundaries so brand/tech tokens can be checked whole.
    parts = re.split(r"([A-Za-zČĆŽŠĐčćžšđ]+)", text)
    result: list[str] = []
    for part in parts:
        if part and _LATIN.match(part):
            if part in keep:
                result.append(part)  # verbatim brand/tech term
            else:
                result.append(_transliterate_word(part))
        else:
            result.append(part)
    return "".join(result)


def _keep_tokens(msgid: str) -> set[str]:
    """Latin tokens borrowed verbatim from the English source stay in Latin."""
    # Single letters are too collision-prone to protect (e.g. English "a"/"A").
    return {t for t in re.findall(r"[A-Za-z][A-Za-z0-9_]+", msgid)}


def _convert_value(value: str, keep: set[str]) -> str:
    """Convert one msgstr value if it is Latin-script, else return unchanged."""
    if not value or _CYRILLIC.search(value):
        return value  # empty or already (partly) Cyrillic — leave as-is
    return transliterate(value, keep)


def normalize_catalog(src: Path, dest: Path, *, dry_run: bool = False) -> int:
    """Rewrite Latin-script translations in ``src`` to Cyrillic, save to ``dest``.

    Returns the number of entries changed.
    """
    cat = polib.pofile(str(src))
    changed = 0
    for entry in cat:
        if not entry.msgid:
            continue
        keep = _keep_tokens(entry.msgid) | _keep_tokens(entry.msgid_plural or "")
        if entry.msgid_plural:
            new = {k: _convert_value(v, keep) for k, v in entry.msgstr_plural.items()}
            if new != entry.msgstr_plural:
                if not dry_run:
                    entry.msgstr_plural = new
                changed += 1
        elif entry.msgstr:
            new_str = _convert_value(entry.msgstr, keep)
            if new_str != entry.msgstr:
                if not dry_run:
                    entry.msgstr = new_str
                changed += 1
    if not dry_run:
        dest.parent.mkdir(parents=True, exist_ok=True)
        cat.save(str(dest))
    return changed


def main() -> None:
    """Parse arguments and normalize the Serbian catalog to Cyrillic."""
    parser = argparse.ArgumentParser(
        description="Normalize Latin-script sr entries to Cyrillic"
    )
    parser.add_argument("--src", type=Path, default=DEFAULT_PO)
    parser.add_argument("--dest", type=Path, default=None)
    parser.add_argument(
        "--dry-run", action="store_true", help="Report count without writing"
    )
    args = parser.parse_args()
    dest = args.dest or args.src

    if not args.src.exists():
        print(f"Source catalog not found: {args.src}", file=sys.stderr)
        sys.exit(1)

    changed = normalize_catalog(args.src, dest, dry_run=args.dry_run)
    verb = "Would convert" if args.dry_run else "Converted"
    print(f"{verb} {changed} Latin-script entries -> {dest}", file=sys.stderr)


if __name__ == "__main__":
    main()
