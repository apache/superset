#!/usr/bin/env python3
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
"""
Fail when a catalog translates a msgid listed in the do-not-translate registry.

What this checks, and what it does not
--------------------------------------
``superset/translations/do-not-translate.txt`` lists msgids that must stay
identical to the source: icon names, enum and option values, SQL keywords, API
field names, code constants, example placeholders and product names.

Two existing pieces already consume that registry, but neither of them keeps a
catalog honest:

* ``apply_do_not_translate.py`` stamps a ``#. do-not-translate`` extracted
  comment on each entry. The comment is advisory — nothing rejects a
  translation that ignores it.
* ``backfill_po.py`` honours the registry when it *generates* a translation, so
  it never introduces a violation. Entries translated before a term was
  registered, or by hand, are untouched.

The result is that the registry silently drifts out of effect. This script
closes that gap: it reads the registry, walks every catalog and reports any
entry whose ``msgstr`` is both non-empty and different from its ``msgid``.

An empty ``msgstr`` is the correct state for these entries — gettext then falls
back to the source token — so emptying a translation is how a violation is
fixed, not by copying the English into ``msgstr``.

Usage
-----
Check the catalogs in the repo::

    python scripts/translations/check_do_not_translate.py

Check a different tree (used by CI against a worktree)::

    python scripts/translations/check_do_not_translate.py \\
        --translations-dir /tmp/base-worktree/superset/translations
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import polib  # type: ignore[import-untyped]

DEFAULT_TRANSLATIONS_DIR = (
    Path(__file__).resolve().parent.parent.parent / "superset" / "translations"
)

# The English catalog uses empty msgstrs by convention (source language ==
# target), so it can hold no violation.
SKIP_LANGS = {"en"}


def load_registry(path: Path) -> set[str]:
    """Return the registered msgids, skipping comments and blank lines."""
    entries: set[str] = set()
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if line and not line.startswith("#"):
            entries.add(line)
    return entries


def violations(po_file: Path, registry: set[str]) -> list[tuple[str, str]]:
    """Return ``(msgid, msgstr)`` for every registered entry that is translated."""
    found: list[tuple[str, str]] = []
    for entry in polib.pofile(str(po_file)):
        if entry.obsolete or entry.msgid not in registry:
            continue
        # Only an exactly empty msgstr makes gettext fall back to the source
        # token, which is what the registry asks for. A padded or
        # whitespace-only value is a translation like any other — " DELETE "
        # and "   " are both returned verbatim — so compare the raw msgstr.
        translated = entry.msgstr
        if translated and translated != entry.msgid:
            found.append((entry.msgid, translated))
    return found


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--translations-dir",
        type=Path,
        default=DEFAULT_TRANSLATIONS_DIR,
        help="directory holding the catalogs and do-not-translate.txt",
    )
    args = parser.parse_args()

    registry = load_registry(args.translations_dir / "do-not-translate.txt")
    if not registry:
        print("do-not-translate.txt is empty or missing; nothing to check.")
        return

    total = 0
    for po_file in sorted(args.translations_dir.glob("*/LC_MESSAGES/messages.po")):
        lang = po_file.parent.parent.name
        if lang in SKIP_LANGS:
            continue
        found = violations(po_file, registry)
        if found:
            total += len(found)
            print(f"\n{lang}: {len(found)} translated do-not-translate entries")
            for msgid, msgstr in found:
                print(f"  {msgid!r} -> {msgstr!r}")

    if total:
        print(
            f"\n{total} entries translate a msgid listed in "
            f"{args.translations_dir / 'do-not-translate.txt'}.\n"
            'These must stay identical to the source: set their msgstr to "" so '
            "gettext falls back to the source token.",
            file=sys.stderr,
        )
        sys.exit(1)

    print("No do-not-translate entries are translated.")


if __name__ == "__main__":
    main()
