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

Optionally write a markdown report to a file (used by CI to post a PR comment):

    python check_translation_regression.py --compare before.json --report report.md

Typical CI workflow
-------------------
1. Restore base-branch translations (git checkout origin/base -- superset/translations/)
2. Record baseline:  python ... --count > before.json
3. Run pybabel extract+update (babel_update.sh) against PR source files
4. Check for regression:  python ... --compare before.json [--report report.md]
"""

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

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


def build_regression_report(regressions: list[tuple[str, int, int]]) -> str:
    """Build a markdown report for posting as a PR comment."""
    rows = "\n".join(
        f"| `{lang}` | {b} | {a} | -{b - a} |" for lang, b, a in regressions
    )
    affected = ", ".join(f"`{lang}`" for lang, _, _ in regressions)
    return (
        "## ⚠️ Translation Regression Detected\n\n"
        f"This PR causes existing translations to become fuzzy or be removed "
        f"in {affected}. Please fix the affected `.po` files before merging.\n\n"
        "| Language | Before | After | Lost |\n"
        "|----------|-------:|------:|-----:|\n"
        f"{rows}\n\n"
        "### How to fix\n\n"
        "**1. Install dependencies** (if not already set up):\n\n"
        "```bash\n"
        "pip install -r superset/translations/requirements.txt\n"
        "sudo apt-get install gettext   # or: brew install gettext\n"
        "```\n\n"
        "**2. Re-extract strings and sync `.po` files:**\n\n"
        "```bash\n"
        "./scripts/translations/babel_update.sh\n"
        "```\n\n"
        "This rewrites `superset/translations/messages.pot` from the current "
        "source files and merges the changes into every `.po` file. Strings "
        "whose `msgid` changed will be marked `#, fuzzy`.\n\n"
        f"**3. Resolve the fuzzy entries** in the affected language files "
        f"({affected}):\n\n"
        "```bash\n"
        "grep -n '#, fuzzy' superset/translations/<lang>/LC_MESSAGES/messages.po\n"
        "```\n\n"
        "For each fuzzy entry, either rewrite the `msgstr` to match the new "
        "string and remove the `#, fuzzy` line, or clear the `msgstr` to "
        '`""` if you cannot provide a translation.\n\n'
        "**4. Commit your changes to the `.po` files.**\n"
    )


def cmd_count() -> None:
    counts = get_counts()
    print(json.dumps(counts, indent=2))


def cmd_compare(before_path: str, report_path: Optional[str] = None) -> None:
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
        if report_path:
            Path(report_path).write_text(
                build_regression_report(regressions), encoding="utf-8"
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
        # Optional: --report path.md after the before.json argument
        report_path: Optional[str] = None
        if len(sys.argv) >= 5 and sys.argv[3] == "--report":
            report_path = sys.argv[4]
        cmd_compare(sys.argv[2], report_path)


if __name__ == "__main__":
    main()
