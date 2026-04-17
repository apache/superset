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
Check that source-code changes don't cause translation regressions.

Usage
-----
Count non-fuzzy translated entries in all .po files and write JSON to stdout:

    python check_translation_regression.py --count

Compare the current .po state against a previously-recorded baseline and fail
if any language lost translations:

    python check_translation_regression.py --compare /path/to/before.json

Typical CI workflow
-------------------
1. Restore base-branch translations (git checkout origin/base -- superset/translations/)
2. Record baseline:  python ... --count > before.json
3. Run pybabel extract+update (babel_update.sh) against PR source files
4. Check for regression:  python ... --compare before.json
"""

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
TRANSLATIONS_DIR = ROOT / "superset" / "translations"

# English .po files use empty msgstr by convention (source language == target),
# so they always show 0 translated entries and should not be checked.
SKIP_LANGS = {"en"}


def count_translated(po_file: Path) -> int:
    """Return the number of non-fuzzy translated messages in a .po file."""
    import shutil  # noqa: PLC0415

    msgfmt = shutil.which("msgfmt") or "msgfmt"
    result = subprocess.run(  # noqa: S603
        [msgfmt, "--statistics", "-o", "/dev/null", str(po_file)],
        capture_output=True,
        text=True,
    )
    # stderr: "123 translated messages, 4 fuzzy translations, 56 untranslated messages."
    match = re.search(r"(\d+) translated message", result.stderr)
    return int(match.group(1)) if match else 0


def get_counts() -> dict[str, int]:
    counts: dict[str, int] = {}
    for po_file in sorted(TRANSLATIONS_DIR.glob("*/LC_MESSAGES/messages.po")):
        lang = po_file.parent.parent.name
        if lang in SKIP_LANGS:
            continue
        counts[lang] = count_translated(po_file)
    return counts


def cmd_count() -> None:
    counts = get_counts()
    print(json.dumps(counts, indent=2))


def cmd_compare(before_path: str) -> None:
    with open(before_path) as f:
        before: dict[str, int] = json.load(f)

    after = get_counts()

    regressions: list[tuple[str, int, int]] = []
    for lang, before_count in sorted(before.items()):
        after_count = after.get(lang, 0)
        if after_count < before_count:
            regressions.append((lang, before_count, after_count))

    if regressions:
        print("Translation regression detected!\n")
        for lang, b, a in regressions:
            lost = b - a
            print(f"  {lang}: {b} -> {a}  (-{lost} string(s) became fuzzy or removed)")
        print(
            "\nStrings renamed or deleted by this PR invalidated existing translations."
        )
        print(
            "Update the affected .po files to restore the lost entries before merging."
        )
        sys.exit(1)

    # All good — print a summary so it's easy to read in CI logs.
    print("No translation regressions.\n")
    for lang in sorted(after):
        b = before.get(lang, 0)
        a = after[lang]
        if a > b:
            delta = f"+{a - b}"
        elif a == b:
            delta = "no change"
        else:
            delta = f"-{b - a}"
        print(f"  {lang}: {b} -> {a}  ({delta})")


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in ("--count", "--compare"):
        print(__doc__)
        sys.exit(1)

    if sys.argv[1] == "--count":
        cmd_count()
    else:
        if len(sys.argv) < 3:
            print("Usage: check_translation_regression.py --compare before.json")
            sys.exit(1)
        cmd_compare(sys.argv[2])


if __name__ == "__main__":
    main()
