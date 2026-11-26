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
"""Drop the python-format flag from strings that only look like format strings.

Some UI labels ("% of total", "% calculation", help text mentioning
"% of column" ...) parse as accidentally valid %-format directives: a space
flag plus a conversion character, so "% of" reads as "% o". Babel flags them
python-format whenever it writes a catalog, and ``msgfmt --check`` then fatals
on any translation whose word after "%" is not a conversion character
("% von" reads as "% v"). The app never %-formats these strings.

An entry is unflagged when every directive Babel finds in its msgid (and
msgid_plural) carries the space flag. Real placeholders never do (``%s``,
``%d``, ``%(name)s``), and requiring *all* directives to qualify leaves a
string that mixes both kinds flagged. The flag becomes ``no-python-format``.

Two writers need this, so both share :func:`is_pseudo_format`:

* ``babel_update.sh`` runs this script after ``pybabel update``, which re-adds
  the flag. Only ``#,`` lines are rewritten, so the canonical wrapping of the
  template and catalogs is untouched.
* ``backfill_po.py`` applies the same check when it re-serializes a catalog.

Idempotent: re-running makes no further changes.

Usage:
  python scripts/translations/unflag_pseudo_format.py [PATH ...]
  # PATHs default to messages.pot and every catalog under superset/translations
"""

from __future__ import annotations

import sys
from collections.abc import Iterable
from pathlib import Path

from babel.messages.catalog import PYTHON_FORMAT

TRANSLATIONS_DIR: Path = (
    Path(__file__).resolve().parent.parent.parent / "superset" / "translations"
)


def is_pseudo_format(ids: Iterable[str]) -> bool:
    """Whether every %-directive Babel finds in ``ids`` carries the space flag.

    ``ids`` holds the msgid and, for a plural entry, the msgid_plural. A
    ``%%`` counts as a directive without the space flag: a percent sign is
    only escaped in a string that is %-formatted, so it keeps the flag.
    """
    directives = [match for text in ids for match in PYTHON_FORMAT.finditer(text)]
    return bool(directives) and all(m.group(2).startswith(" ") for m in directives)


def _entry_ids(block: list[str]) -> list[str]:
    """Return the msgid and msgid_plural texts of one entry's lines."""
    ids: list[list[str]] = []
    current: list[str] | None = None
    for line in block:
        if line.startswith(("msgid ", "msgid_plural ")):
            current = [line.split(" ", 1)[1].strip()[1:-1]]
            ids.append(current)
        elif line.startswith('"') and current is not None:
            current.append(line.strip()[1:-1])
        else:
            current = None
    return ["".join(parts) for parts in ids]


def unflag_file(path: Path) -> int:
    """Rewrite the ``#,`` line of each pseudo-format entry in ``path``.

    Entries are the blank-line separated blocks gettext and Babel write.
    Returns the number of entries changed.
    """
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    changed = 0
    start = 0
    for end in range(len(lines) + 1):
        if end < len(lines) and lines[end].strip():
            continue
        block = lines[start:end]
        flag_index = next(
            (start + i for i, line in enumerate(block) if line.startswith("#,")),
            None,
        )
        if flag_index is not None and is_pseudo_format(_entry_ids(block)):
            tokens = [t.strip() for t in lines[flag_index][2:].split(",")]
            if "python-format" in tokens:
                tokens = [t for t in tokens if t != "python-format"]
                if "no-python-format" not in tokens:
                    tokens.append("no-python-format")
                lines[flag_index] = "#, " + ", ".join(tokens) + "\n"
                changed += 1
        start = end + 1
    if changed:
        path.write_text("".join(lines), encoding="utf-8")
    return changed


def default_paths() -> list[Path]:
    """The template followed by every language catalog, in a stable order."""
    return [TRANSLATIONS_DIR / "messages.pot"] + sorted(
        TRANSLATIONS_DIR.glob("*/LC_MESSAGES/messages.po")
    )


def main(argv: list[str]) -> None:
    paths = [Path(arg) for arg in argv] or default_paths()
    total = sum(unflag_file(path) for path in paths)
    print(f"Unflagged {total} pseudo-format entries across {len(paths)} files.")


if __name__ == "__main__":
    main(sys.argv[1:])
