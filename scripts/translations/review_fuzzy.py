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
"""Interactive row-by-row review of ``#, fuzzy`` translations.

Walks every fuzzy entry in a catalog and lets you accept, edit or skip it. The
catalog is saved after each decision, so you can quit any time and resume later
(re-running only shows the entries still marked fuzzy).

Run it in YOUR terminal (it needs keyboard input):

  # Windows PowerShell:
  $env:PYTHONUTF8=1; python scripts/translations/review_fuzzy.py --lang sr

  # macOS / Linux:
  PYTHONUTF8=1 python scripts/translations/review_fuzzy.py --lang sr

Keys at each entry:
  [Enter]  accept the current translation as-is (clears the fuzzy flag)
  e        edit — type a new translation (for plurals you are asked per form)
  s        skip — leave it fuzzy, move to the next one
  q        save and quit

Tip: do it in batches. After you finish the Cyrillic ``sr`` catalog, regenerate
the Latin one with cyrillic_to_latin_sr.py — never edit sr_Latn by hand.
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
_ATTRIBUTION = "Machine-translated via backfill_po.py"

# ANSI colors (fall back to plain text if the terminal can't render them).
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
except Exception:  # noqa: BLE001 - best effort on older/odd terminals
    pass
_C = {"en": "\033[36m", "sr": "\033[33m", "dim": "\033[2m", "ok": "\033[32m", "r": "\033[0m"}


def _clear_attribution(entry: polib.POEntry) -> None:
    """Drop the machine-translation attribution / review-note comment."""
    if not entry.tcomment:
        return
    kept = [
        ln
        for ln in entry.tcomment.splitlines()
        if not ln.startswith(_ATTRIBUTION) and not ln.startswith("Needs review")
    ]
    entry.tcomment = "\n".join(kept)


def _accept(entry: polib.POEntry) -> None:
    """Mark an entry reviewed: clear the fuzzy flag and the attribution note."""
    entry.flags = [f for f in entry.flags if f != "fuzzy"]
    _clear_attribution(entry)


def _edit(entry: polib.POEntry) -> None:
    """Prompt for a new translation (handles plural forms) and accept it."""
    if entry.msgid_plural:
        print(f"  {_C['dim']}plural — enter each form (blank keeps current){_C['r']}")
        for k in sorted(entry.msgstr_plural):
            cur = entry.msgstr_plural[k]
            new = input(f"  [{k}] ({cur}) > ").strip()
            if new:
                entry.msgstr_plural[k] = new
    else:
        new = input(f"  new ({entry.msgstr}) > ").strip()
        if new:
            entry.msgstr = new
    _accept(entry)


def review(po_path: Path) -> None:
    """Run the interactive review loop over a catalog's fuzzy entries."""
    cat = polib.pofile(str(po_path))
    fuzzy = [e for e in cat if e.msgid and "fuzzy" in e.flags]
    if not fuzzy:
        print(f"{_C['ok']}No fuzzy entries left in {po_path.name}. All reviewed!{_C['r']}")
        return

    print(f"{len(fuzzy)} fuzzy entries to review in {po_path}.")
    print(f"{_C['dim']}[Enter]=accept  e=edit  s=skip  q=save&quit{_C['r']}\n")

    reviewed = 0
    for i, entry in enumerate(fuzzy, 1):
        print(f"{_C['dim']}── {i}/{len(fuzzy)} ──{_C['r']}")
        print(f"  {_C['en']}EN:{_C['r']} {entry.msgid}")
        if entry.msgid_plural:
            print(f"  {_C['en']}EN(pl):{_C['r']} {entry.msgid_plural}")
            for k in sorted(entry.msgstr_plural):
                print(f"  {_C['sr']}SR[{k}]:{_C['r']} {entry.msgstr_plural[k]}")
        else:
            print(f"  {_C['sr']}SR:{_C['r']} {entry.msgstr}")

        while True:
            choice = input("  > ").strip().lower()
            if choice == "":
                _accept(entry)
                reviewed += 1
                break
            if choice == "e":
                _edit(entry)
                reviewed += 1
                break
            if choice == "s":
                break
            if choice == "q":
                cat.save(str(po_path))
                print(f"\n{_C['ok']}Saved. Reviewed {reviewed} this session; "
                      f"{len(fuzzy) - i + (1 if choice=='q' else 0)} still pending.{_C['r']}")
                return
            print(f"  {_C['dim']}keys: Enter / e / s / q{_C['r']}")
        cat.save(str(po_path))  # save after every decision so progress is safe
        print()

    print(f"{_C['ok']}Done. Reviewed {reviewed} entries. "
          f"{len([e for e in cat if e.msgid and 'fuzzy' in e.flags])} still fuzzy.{_C['r']}")


def main() -> None:
    """Parse arguments and start the interactive reviewer."""
    parser = argparse.ArgumentParser(description="Interactive fuzzy-translation review")
    parser.add_argument("--lang", required=True, help="ISO language code (e.g. sr)")
    args = parser.parse_args()
    po_path = TRANSLATIONS_DIR / args.lang / "LC_MESSAGES" / "messages.po"
    if not po_path.exists():
        print(f"No .po file for '{args.lang}': {po_path}", file=sys.stderr)
        sys.exit(1)
    try:
        review(po_path)
    except (KeyboardInterrupt, EOFError):
        print("\nInterrupted — progress up to the last entry was saved.")


if __name__ == "__main__":
    main()
