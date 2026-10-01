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
import tarfile
import tempfile
from pathlib import Path

from babel.messages.pofile import read_po

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
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


def _archive_ref() -> str:
    """Return a tree-ish for ``git archive`` that matches the tracked working tree.

    ``git stash create`` builds a commit object for the current index and
    tracked-file modifications without touching the working tree, any ref,
    or the actual stash, so it is safe to call while other processes are
    using this checkout. It prints nothing when there is nothing to stash,
    so fall back to ``HEAD``. Because it only knows about tracked files, a
    new source file with a translatable string that has not yet been
    ``git add``-ed is not included; that only affects local/pre-commit runs,
    since CI always operates on a clean, fully-tracked checkout.

    Deliberately uses ``Popen`` rather than ``run``: this module's tests
    patch ``subprocess.run`` to fake the single "run pybabel" call, and a
    second real ``run`` call here would be caught by that same patch.
    """
    proc = subprocess.Popen(  # noqa: S603
        ["git", "stash", "create"],  # noqa: S607
        cwd=ROOT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    stash_sha, stash_stderr = proc.communicate()
    if proc.returncode != 0:
        raise subprocess.CalledProcessError(
            proc.returncode, proc.args, stderr=stash_stderr
        )
    return stash_sha.strip() or "HEAD"


def extract_fresh(output_path: Path) -> None:
    """Run the project's extraction command into ``output_path``.

    Extracts from a ``git archive`` snapshot rather than the live checkout.
    The Python-Unit job runs ``pytest -n auto --dist loadfile``, so many
    worker processes share this checkout while this test runs; ``pybabel
    extract`` walks everything under ``cwd``, so scanning the working
    directory directly makes the msgid set depend on whatever transient
    files another worker's test happens to write into the tree at that
    instant.
    """
    with tempfile.TemporaryDirectory() as snapshot_dir_str:
        snapshot_dir = Path(snapshot_dir_str)
        archive = subprocess.Popen(  # noqa: S603
            ["git", "archive", _archive_ref()],  # noqa: S607
            cwd=ROOT_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if archive.stdout is None:
            raise RuntimeError("git archive did not open a stdout pipe")
        try:
            with tarfile.open(fileobj=archive.stdout, mode="r|") as tar:
                # Use the safe extraction filter (PEP 706) where available; older
                # Python patch releases without the backport still work, just
                # without that defense-in-depth (this is our own trusted `git
                # archive` output, not attacker-controlled).
                data_filter = getattr(tarfile, "data_filter", None)
                if data_filter is not None:
                    tar.extraction_filter = data_filter
                tar.extractall(snapshot_dir)  # noqa: S202 (own trusted `git archive` output)
        finally:
            # A failed `git archive` closes stdout early, so `tarfile` raises
            # its own opaque `ReadError`/`EOFError` before we get a chance to
            # look at git's actual error; draining stderr and the return code
            # here, and raising from `finally`, surfaces that real cause
            # instead of (and in place of) the tarfile exception.
            _, archive_stderr = archive.communicate()
            if archive.returncode != 0:
                raise subprocess.CalledProcessError(
                    archive.returncode, archive.args, stderr=archive_stderr
                )

        subprocess.run(  # noqa: S603
            [
                "pybabel",
                "extract",
                "-F",
                str(snapshot_dir / "superset" / "translations" / "babel.cfg"),
                "-o",
                str(output_path.resolve()),
            ]
            + EXTRACT_FLAGS,
            cwd=snapshot_dir,
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
