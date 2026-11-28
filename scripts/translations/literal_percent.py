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
"""Drop the python-format flag from messages whose ``%`` is literal text.

Babel flags a message ``python-format`` whenever its msgid contains something
that parses as a %-format directive. UI text such as "% of total" or
"% calculation" parses by accident: ``% o`` and ``% c`` read as a space flag
plus a conversion character. The app never %-formats these strings, and msgfmt
rejects any translation that does not repeat the accidental directive. This
swaps ``python-format`` for ``no-python-format`` on those entries.

Babel re-adds the flag every time it writes a catalog, so ``babel_update.sh``
runs this after its ``pybabel update`` pass, and ``backfill_po.py`` applies
``is_literal_percent`` when it re-serializes a catalog. Only ``#,`` flag lines
are rewritten, so the canonical wrapping of the files is untouched.

Usage:
  python scripts/translations/literal_percent.py [PATH ...]
  # PATH defaults to messages.pot and every language's messages.po
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from babel.messages.catalog import PYTHON_FORMAT
from babel.messages.pofile import unescape

TRANSLATIONS_DIR: Path = (
    Path(__file__).parent.parent.parent / "superset" / "translations"
)

# A percent sign followed by a space and a word, as in "% of" or "50% off".
# A real space-flag directive ("% d") is never followed by more letters, and
# the second "%" of a "%%" escape is part of a real format string.
_LITERAL_PERCENT = re.compile(r"(?<!%)% (?=[A-Za-z]{2})")


def is_literal_percent(*msgids: str) -> bool:
    """Return True if Babel sees %-format directives only in literal ``% word`` text.

    Pass the msgid and, for plural entries, the msgid_plural. A message that
    also has a real placeholder (``%(name)s``, ``%s``) keeps its flag.
    """
    return any(PYTHON_FORMAT.search(msgid) for msgid in msgids) and not any(
        PYTHON_FORMAT.search(_LITERAL_PERCENT.sub(" ", msgid)) for msgid in msgids
    )


def _read_field(lines: list[str], i: int, keyword: str) -> tuple[str | None, int]:
    """Read a possibly wrapped ``keyword "..."`` field starting at line ``i``.

    Returns the unescaped value (None if line ``i`` is not that field) and the
    index of the first line after it.
    """
    if i >= len(lines) or not lines[i].startswith(f'{keyword} "'):
        return None, i
    parts = [lines[i][len(keyword) :].strip()]
    i += 1
    while i < len(lines) and lines[i].startswith('"'):
        parts.append(lines[i].strip())
        i += 1
    return "".join(unescape(part) for part in parts), i


def fix_flags(path: Path) -> bool:
    """Rewrite the flags of literal-percent entries in ``path``.

    Returns True if the file changed.
    """
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    changed = False
    for i, line in enumerate(lines):
        if not line.startswith("#,"):
            continue
        flags = [flag.strip() for flag in line[2:].split(",")]
        if "python-format" not in flags:
            continue
        j = i + 1
        while j < len(lines) and lines[j].startswith("#|"):
            j += 1
        _, j = _read_field(lines, j, "msgctxt")
        msgid, j = _read_field(lines, j, "msgid")
        if msgid is None:
            continue
        msgids = [msgid]
        plural, j = _read_field(lines, j, "msgid_plural")
        if plural is not None:
            msgids.append(plural)
        if not is_literal_percent(*msgids):
            continue
        flags = [flag for flag in flags if flag != "python-format"]
        if "no-python-format" not in flags:
            flags.append("no-python-format")
        lines[i] = "#, " + ", ".join(flags) + "\n"
        changed = True
    if changed:
        path.write_text("".join(lines), encoding="utf-8", newline="\n")
    return changed


def main(argv: list[str]) -> int:
    paths = [Path(arg) for arg in argv[1:]] or [
        TRANSLATIONS_DIR / "messages.pot",
        *sorted(TRANSLATIONS_DIR.glob("*/LC_MESSAGES/messages.po")),
    ]
    for path in paths:
        if fix_flags(path):
            print(f"Cleared python-format on literal-percent entries in {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
