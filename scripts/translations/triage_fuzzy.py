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
"""Triage AI-backfilled ``#, fuzzy`` entries by confidence.

``backfill_po.py`` marks every machine translation ``#, fuzzy`` so a human can
review it before it is compiled into a ``.mo``. Reviewing thousands of entries
by hand is impractical, so this script keeps only the *low-confidence* entries
fuzzy (the ones genuinely worth a human's attention) and clears the fuzzy flag
+ machine-translation attribution comment on the *high-confidence* ones.

Confidence is derived from signals the backfill already recorded:

* **Reference count** — the attribution comment records ``[refs: …]``, the other
  languages that already had this string. More references = stronger
  cross-language consensus on meaning. ``backfill_po.py``'s own ``--min-context``
  flag uses the same signal. Entries with very few references are ambiguous.
* **Short fragments** — single words / two-word labels ("Scale", "Order", "Key")
  are the classic machine-translation failure: homonyms whose sense depends on
  UI context. Kept fuzzy unless many languages agree.
* **Plurals** — Serbian (and other Slavic langs) need three plural forms with
  correct case; these are error-prone, so weakly-supported plurals stay fuzzy.
* **Placeholder mismatch** — if the ``%(x)s`` / ``{x}`` / ``%s`` set differs
  between source and translation the entry is suspect and stays fuzzy.

IMPORTANT: clearing ``fuzzy`` here marks an entry as *accepted*, not
*human-reviewed*. It is a pragmatic triage for a single contributor's catalog,
not a substitute for native-speaker review. The entries left fuzzy are the ones
the maintainer still needs to read.

Usage:
  python scripts/translations/triage_fuzzy.py --lang sr
  python scripts/translations/triage_fuzzy.py --lang sr --dry-run
  python scripts/translations/triage_fuzzy.py --lang sr \
      --short-max-refs 9 --plural-max-refs 9 --min-refs 4
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

_ATTRIBUTION = "Machine-translated via backfill_po.py"
_REFS_RE = re.compile(r"\[refs: ([^\]]+)\]")
_PLACEHOLDER_RE = re.compile(
    r"%\([^)]*\)[#0\- +]?\d*(?:\.\d+)?[a-zA-Z]"  # %(name)s, %(v).2f
    r"|%[#0\- +]?\d*(?:\.\d+)?[a-zA-Z%]"  # %s, %d, %%
    r"|\{[^{}]*\}"  # {name}, {0}
)


def _ref_count(entry: polib.POEntry) -> int:
    """Number of reference languages recorded in the attribution comment."""
    m = _REFS_RE.search(entry.tcomment or "")
    if m:
        return len([x for x in m.group(1).split(",") if x.strip()])
    return 0  # "[no refs]" or no attribution


def _placeholder_mismatch(entry: polib.POEntry) -> bool:
    """True if the singular translation's placeholder set differs from source."""
    if entry.msgid_plural:
        return False  # plural forms handled via the plural-confidence rule
    return set(_PLACEHOLDER_RE.findall(entry.msgid)) != set(
        _PLACEHOLDER_RE.findall(entry.msgstr)
    )


def _is_short_fragment(entry: polib.POEntry) -> bool:
    """True for terse labels that are ambiguous without UI context."""
    return len(entry.msgid.split()) <= 2 and len(entry.msgid) <= 14


def is_low_confidence(
    entry: polib.POEntry,
    *,
    min_refs: int,
    short_max_refs: int,
    plural_max_refs: int,
) -> bool:
    """Decide whether an entry should stay ``#, fuzzy`` for human review."""
    refs = _ref_count(entry)
    if refs < min_refs:
        return True
    if _placeholder_mismatch(entry):
        return True
    if entry.msgid_plural and refs <= plural_max_refs:
        return True
    if _is_short_fragment(entry) and refs <= short_max_refs:
        return True
    return False


def _strip_attribution(entry: polib.POEntry) -> None:
    """Remove the machine-translation attribution line(s) from the comment."""
    if not entry.tcomment:
        return
    kept = [
        ln for ln in entry.tcomment.splitlines() if not ln.startswith(_ATTRIBUTION)
    ]
    entry.tcomment = "\n".join(kept)


def triage(
    po_path: Path,
    *,
    min_refs: int,
    short_max_refs: int,
    plural_max_refs: int,
    dry_run: bool,
) -> tuple[int, int]:
    """Clear fuzzy on high-confidence entries. Returns (accepted, kept_fuzzy)."""
    cat = polib.pofile(str(po_path))
    accepted = 0
    kept = 0
    for entry in cat:
        if not entry.msgid or "fuzzy" not in entry.flags:
            continue
        if is_low_confidence(
            entry,
            min_refs=min_refs,
            short_max_refs=short_max_refs,
            plural_max_refs=plural_max_refs,
        ):
            kept += 1
        else:
            if not dry_run:
                entry.flags = [f for f in entry.flags if f != "fuzzy"]
                _strip_attribution(entry)
            accepted += 1
    if not dry_run:
        cat.save(str(po_path))
    return accepted, kept


def main() -> None:
    """Parse arguments and triage the target catalog's fuzzy entries."""
    parser = argparse.ArgumentParser(description="Triage fuzzy AI translations")
    parser.add_argument("--lang", required=True, help="ISO language code (e.g. sr)")
    parser.add_argument(
        "--min-refs",
        type=int,
        default=4,
        help="Entries with fewer reference languages stay fuzzy (default: 4)",
    )
    parser.add_argument(
        "--short-max-refs",
        type=int,
        default=9,
        help="Short fragments at or below this ref count stay fuzzy (default: 9)",
    )
    parser.add_argument(
        "--plural-max-refs",
        type=int,
        default=9,
        help="Plural entries at or below this ref count stay fuzzy (default: 9)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Report without writing")
    args = parser.parse_args()

    po_path = TRANSLATIONS_DIR / args.lang / "LC_MESSAGES" / "messages.po"
    if not po_path.exists():
        print(f"No .po file for '{args.lang}': {po_path}", file=sys.stderr)
        sys.exit(1)

    accepted, kept = triage(
        po_path,
        min_refs=args.min_refs,
        short_max_refs=args.short_max_refs,
        plural_max_refs=args.plural_max_refs,
        dry_run=args.dry_run,
    )
    verb = "Would accept" if args.dry_run else "Accepted (un-fuzzied)"
    print(
        f"{verb} {accepted} high-confidence entries; "
        f"kept {kept} low-confidence entries fuzzy for review.\n"
        f"  -> {po_path}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
