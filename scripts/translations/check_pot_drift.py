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
Fail when the committed ``.pot`` template has drifted from source.

What this checks, and what it does not
----------------------------------------
``superset/translations/messages.pot`` is the extraction template every
language catalog is generated from. A translatable string only reaches the
``.po`` catalogs — and therefore only becomes translatable in any language —
via this template. If a PR adds or renames a translatable string without
re-running the extraction, the template silently falls behind source and
those strings are invisible to translators and to the AI backfill alike.

This script re-extracts messages from source with the same ``pybabel
extract`` invocation as ``scripts/translations/babel_update.sh`` and compares
the resulting msgid set against the committed template. It fails when the
two sets differ.

This is a different question from ``check_translation_regression.py``, which
compares *translated/fuzzy counts in the .po catalogs* between a base and a
PR revision to catch a source reword that stranded an existing translation.
That check re-extracts on both sides of the comparison and never looks at
whether the *committed* template matches source, so it cannot catch this
drift — hence this script, rather than folding the check into it.

Usage:
    python scripts/translations/check_pot_drift.py
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

from babel.messages.pofile import read_po

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
BABEL_CFG = ROOT_DIR / "superset" / "translations" / "babel.cfg"
DEFAULT_POT = ROOT_DIR / "superset" / "translations" / "messages.pot"

# Kept in sync with the `pybabel extract` invocation in babel_update.sh.
EXTRACT_FLAGS = [
    "--no-location",
    "--sort-output",
    "--copyright-holder=Superset",
    "--project=Superset",
    "-k",
    "_",
    "-k",
    "__",
    "-k",
    "t",
    "-k",
    "tn:1,2",
    "-k",
    "tct",
    ".",
]

# A pluralized entry parses as a list of its singular/plural forms; make it
# hashable so both kinds of msgid can live in one set.
MsgId = str | tuple[str, ...]


def _msgid_set(pot_path: Path) -> set[MsgId]:
    """Read the msgids out of a ``.pot``.

    Line wrapping is deliberately not normalized away: gettext continuation
    lines concatenate back to the exact original string, so ``read_po``
    already yields identical msgids for a wrapped and an unwrapped copy of
    the same message. Any whitespace difference that survives parsing is a
    real source reword, which leaves the template — and therefore every
    catalog — stale and must be reported.
    """
    with open(pot_path, "rb") as f:
        catalog = read_po(f)
    return {
        tuple(message.id) if isinstance(message.id, list) else message.id
        for message in catalog
        if message.id
    }


def extract_fresh(output_path: Path) -> None:
    """Run the project's extraction command into ``output_path``."""
    subprocess.run(  # noqa: S603
        ["pybabel", "extract", "-F", str(BABEL_CFG), "-o", str(output_path)]
        + EXTRACT_FLAGS,
        cwd=ROOT_DIR,
        check=True,
        capture_output=True,
        text=True,
    )


def diff(committed_pot: Path = DEFAULT_POT) -> tuple[set[MsgId], set[MsgId]]:
    """Return ``(missing, stale)`` msgid sets between source and the template.

    ``missing`` is present in a fresh extraction but absent from
    ``committed_pot`` — translatable strings no translator can reach.
    ``stale`` is the reverse — template entries no longer extractable from
    source.
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        fresh_path = Path(tmp_dir) / "fresh.pot"
        extract_fresh(fresh_path)
        fresh_ids = _msgid_set(fresh_path)
    committed_ids = _msgid_set(committed_pot)
    return fresh_ids - committed_ids, committed_ids - fresh_ids


def main() -> int:
    missing, stale = diff()
    if not missing and not stale:
        print("superset/translations/messages.pot matches a fresh extraction.")
        return 0

    print(
        "superset/translations/messages.pot is out of sync with source: "
        f"{len(missing)} string(s) in source are missing from the template, "
        f"{len(stale)} string(s) in the template no longer exist in source.\n"
    )
    if missing:
        print(f"In source, not in the template ({len(missing)}):")
        for msgid in sorted(missing, key=str):
            print(f"  + {msgid!r}")
    if stale:
        print(f"\nIn the template, not in source ({len(stale)}):")
        for msgid in sorted(stale, key=str):
            print(f"  - {msgid!r}")
    print(
        "\nRun ./scripts/translations/babel_update.sh and commit the "
        "regenerated messages.pot (and any changed .po catalogs)."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
