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
"""Stamp do-not-translate msgids in a .pot with an extracted-comment marker.

For every msgid listed in ``superset/translations/do-not-translate.txt`` that is
present in the target .pot, add a ``#. do-not-translate`` extracted
comment. gettext extracted comments (``#.``) propagate from the .pot into every
language .po on ``pybabel update``, so the do-not-translate status stays
consistent across all catalogs from a single registry.

Run from ``babel_update.sh`` after the .pot is extracted and normalized (and
before ``pybabel update``). Idempotent: re-running makes no further changes.

Usage:
  python scripts/translations/apply_do_not_translate.py [POT_PATH]
  # POT_PATH defaults to superset/translations/messages.pot
"""

from __future__ import annotations

import sys
from pathlib import Path

# The standardized extracted-comment marker. Kept in sync with backfill_po.py.
MARKER: str = "do-not-translate"
_MARKER_LINE: str = f"#. {MARKER}"

TRANSLATIONS_DIR: Path = (
    Path(__file__).parent.parent.parent / "superset" / "translations"
)
DEFAULT_POT: Path = TRANSLATIONS_DIR / "messages.pot"
REGISTRY: Path = TRANSLATIONS_DIR / "do-not-translate.txt"


def load_registry(path: Path = REGISTRY) -> set[str]:
    """Return the set of do-not-translate msgids (skips comments/blank lines).

    Each line is stripped before the blank/comment check, so trailing
    whitespace or an indented comment never yields a msgid that fails to match
    the .pot.
    """
    if not path.exists():
        return set()
    entries: set[str] = set()
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line: str = raw_line.strip()
        if line and not line.startswith("#"):
            entries.add(line)
    return entries


def _escape(msgid: str) -> str:
    """Escape a msgid the way gettext writes it on a `msgid "..."` line."""
    return msgid.replace("\\", "\\\\").replace('"', '\\"')


def apply_markers(pot_path: Path, registry: set[str]) -> int:
    """Insert the marker comment above each registry msgid via text edit.

    Text manipulation (rather than a polib round-trip) preserves the .pot's
    exact wrapping/layout, so the only change is the added marker lines.
    Idempotent. Returns the number of entries newly marked.
    """
    lines: list[str] = pot_path.read_text(encoding="utf-8").split("\n")
    targets: set[str] = {f'msgid "{_escape(m)}"' for m in registry}
    out: list[str] = []
    changed: int = 0
    for line in lines:
        if line in targets and (not out or out[-1] != _MARKER_LINE):
            # `#.` extracted comments precede `msgid`; these registry entries are
            # bare single-line msgids, so inserting directly above is correct.
            out.append(_MARKER_LINE)
            changed += 1
        out.append(line)
    if changed:
        pot_path.write_text("\n".join(out), encoding="utf-8")
    return changed


def main() -> None:
    """Stamp the marker onto the target .pot from the registry."""
    pot_path: Path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_POT
    if not pot_path.exists():
        print(f"POT file not found: {pot_path}", file=sys.stderr)
        sys.exit(1)
    # Fail fast if the registry file is absent: babel_update.sh depends on this
    # step to stamp the .pot, and continuing would silently publish catalogs
    # without any do-not-translate markers. An existing-but-empty registry is a
    # valid state (nothing to mark), so only a missing file is an error.
    if not REGISTRY.exists():
        print(
            f"do-not-translate registry not found at {REGISTRY}; refusing to "
            "produce unmarked translation artifacts.",
            file=sys.stderr,
        )
        sys.exit(1)
    registry: set[str] = load_registry()
    if not registry:
        print(
            f"do-not-translate registry {REGISTRY} is empty; nothing to mark.",
            file=sys.stderr,
        )
        return
    changed: int = apply_markers(pot_path, registry)
    print(
        f"do-not-translate: marked {changed} new entr(y/ies) with {MARKER} "
        f"in {pot_path.name} ({len(registry)} msgids in registry).",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
