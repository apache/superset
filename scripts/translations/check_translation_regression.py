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

What counts as a regression
---------------------------
A regression is an *existing translation that a source change invalidated*.
The check keys on the **increase in fuzzy entries** rather than a drop in the
translated count, because a count drop happens identically for a benign
*deletion* and a real *rename*, so it cannot distinguish the two — whereas a
``#, fuzzy`` marker unambiguously flags a stranded translation.

Note ``babel_update.sh`` runs ``pybabel update`` with ``--no-fuzzy-matching``,
so *adding* (or renaming) a source string does **not** auto-generate a fuzzy
guess against an unrelated existing translation — new strings land as cleanly
untranslated (empty ``msgstr``). This deliberately avoids the prior behaviour
where *every* PR that merely added a translatable string tripped this check on
spurious fuzzies. As a result the check now guards against ``#, fuzzy`` entries
that arrive another way — e.g. a committed ``.po`` edit — rather than ones the
update step synthesises. *Deleting* a string is still not a regression: with
``--ignore-obsolete`` it is simply dropped and no fuzzy is created.

Usage
-----
Count translated + fuzzy entries in all .po files and write JSON to stdout:

    python check_translation_regression.py --count

Compare the current .po state against a previously-recorded baseline and fail
if a source change invalidated existing translations (new fuzzies):

    python check_translation_regression.py --compare /path/to/before.json

Optionally write a markdown report to a file (used by CI to post a PR comment):

    python check_translation_regression.py --compare before.json --report report.md

Use a translations directory other than the repo default (used by CI to count
against a separate base-branch worktree):

    python check_translation_regression.py --count \\
        --translations-dir /tmp/base-worktree/superset/translations

Typical CI workflow
-------------------
1. Create a base-branch worktree alongside the PR worktree
2. Run babel_update.sh in the base worktree (extract from BASE source)
3. Record baseline:  python ... --count --translations-dir BASE_TREE > before.json
4. Run babel_update.sh in the PR worktree (extract from PR source and keep
   any committed PR .po updates)
5. Compare:  python ... --compare before.json [--report report.md]

Running babel_update on the base branch first isolates regressions caused by
the PR's source diff from any pre-existing drift on the base branch, while the
PR worktree run still allows committed .po updates to resolve the fuzzies (and
thus clear the regression) before merging.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

DEFAULT_TRANSLATIONS_DIR = (
    Path(__file__).resolve().parent.parent.parent / "superset" / "translations"
)

# English .po files use empty msgstr by convention (source language == target),
# so they always show 0 translated entries and should not be checked.
SKIP_LANGS = {"en"}


def count_stats(po_file: Path) -> dict[str, int]:
    """Return ``{"translated": int, "fuzzy": int}`` for a .po file.

    ``translated`` is the number of non-fuzzy translated messages; ``fuzzy`` is
    the number of fuzzy translations. The fuzzy count is what the regression
    check keys on — a source rename invalidates an existing translation by
    making it fuzzy, whereas a deletion simply drops it (``--ignore-obsolete``).

    Raises:
        subprocess.CalledProcessError: if ``msgfmt`` fails (e.g. malformed
            .po file). The regression check exists to surface translation
            problems, so a silent zero would defeat its purpose — let the
            caller see a malformed file as a hard failure.
    """
    import shutil  # noqa: PLC0415

    msgfmt = shutil.which("msgfmt") or "msgfmt"
    result = subprocess.run(  # noqa: S603
        [msgfmt, "--statistics", "-o", "/dev/null", str(po_file)],
        capture_output=True,
        text=True,
        check=True,
    )
    # stderr: "123 translated messages, 4 fuzzy translations, 56 untranslated messages."
    # The fuzzy and untranslated clauses are omitted by msgfmt when they are 0.
    translated_match = re.search(r"(\d+) translated message", result.stderr)
    if not translated_match:
        raise RuntimeError(
            f"Could not parse msgfmt --statistics output for {po_file}: "
            f"{result.stderr!r}"
        )
    fuzzy_match = re.search(r"(\d+) fuzzy translation", result.stderr)
    return {
        "translated": int(translated_match.group(1)),
        "fuzzy": int(fuzzy_match.group(1)) if fuzzy_match else 0,
    }


def get_counts(
    translations_dir: Path,
    failures: Optional[set[str]] = None,
) -> dict[str, dict[str, int]]:
    """Count translated/fuzzy entries for every ``.po`` file in a directory.

    If ``failures`` is provided, the name of each language whose ``.po`` file
    is present on disk but could not be counted (msgfmt non-zero exit, or
    unparseable output) is added to it. Such a language is deliberately absent
    from the returned mapping — but, unlike a language whose catalog was simply
    deleted, it must not be mistaken for an intentional removal: a caller that
    cares about the distinction (see :func:`cmd_compare`) can inspect
    ``failures`` and treat it as a hard error.
    """
    counts: dict[str, dict[str, int]] = {}
    for po_file in sorted(translations_dir.glob("*/LC_MESSAGES/messages.po")):
        lang = po_file.parent.parent.name
        if lang in SKIP_LANGS:
            continue
        try:
            counts[lang] = count_stats(po_file)
        except (subprocess.CalledProcessError, RuntimeError) as exc:
            # A malformed .po file (msgfmt non-zero exit, or stderr we
            # can't parse) is a real problem worth seeing, but it shouldn't
            # take the whole regression check down with it — that would
            # hide every other language's status. Skip and warn here; the
            # caller is told which langs failed via ``failures`` so it can
            # decide whether a present-but-uncountable catalog is fatal.
            if failures is not None:
                failures.add(lang)
            print(
                f"WARNING: skipping {lang} — {po_file} could not be counted: {exc}",
                file=sys.stderr,
            )
    return counts


def _normalize(entry: object) -> dict[str, int]:
    """Coerce a baseline entry into ``{"translated", "fuzzy"}``.

    Tolerates the legacy baseline format where each language mapped directly to
    an integer translated count (no fuzzy data); such entries contribute a
    fuzzy baseline of 0.
    """
    if isinstance(entry, dict):
        return {
            "translated": int(entry.get("translated", 0)),
            "fuzzy": int(entry.get("fuzzy", 0)),
        }
    if isinstance(entry, int):
        return {"translated": entry, "fuzzy": 0}
    raise TypeError(f"Unsupported baseline entry: {entry!r}")


def build_regression_report(regressions: list[tuple[str, int, int]]) -> str:
    """Build a markdown report for posting as a PR comment.

    Each regression tuple is ``(lang, before_fuzzy, after_fuzzy)``.
    """
    rows = "\n".join(
        f"| `{lang}` | {b} | {a} | +{a - b} |" for lang, b, a in regressions
    )
    affected = ", ".join(f"`{lang}`" for lang, _, _ in regressions)
    return (
        "## ⚠️ Translation Regression Detected\n\n"
        f"A source change in this PR renamed or reworded strings, invalidating "
        f"existing translations (they are now `#, fuzzy`) in {affected}. Please "
        f"resolve the affected `.po` files before merging.\n\n"
        "_Note: intentionally **deleting** a translatable string is not a "
        "regression and is not flagged here — only translations invalidated by "
        "a renamed/reworded source string are._\n\n"
        "| Language | Fuzzy before | Fuzzy after | New |\n"
        "|----------|-------------:|------------:|----:|\n"
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


def cmd_count(translations_dir: Path) -> None:
    counts = get_counts(translations_dir)
    print(json.dumps(counts, indent=2))


def cmd_compare(
    before_path: str,
    translations_dir: Path,
    report_path: Optional[str] = None,
) -> None:
    with open(before_path) as f:
        before_raw: dict[str, object] = json.load(f)
    before = {lang: _normalize(entry) for lang, entry in before_raw.items()}

    failures: set[str] = set()
    after = get_counts(translations_dir, failures=failures)

    # A baseline language whose catalog is *missing* from `after` is fine —
    # that's an intentional catalog deletion (handled below like any other
    # deletion). But a language whose .po file is still present yet could not
    # be counted (msgfmt failed / output unparseable) is a hard error: leaving
    # it out silently would let a corrupt catalog pass as "no regression".
    broken = sorted(lang for lang in failures if lang in before)
    if broken:
        print("Translation check failed!\n")
        for lang in broken:
            print(f"  {lang}: catalog present but could not be counted (msgfmt error)")
        print(
            "\nFix the malformed .po file(s) above before merging — a catalog "
            "that cannot be parsed must not be silently dropped."
        )
        sys.exit(1)

    # A regression is an *increase* in fuzzy entries: the PR's source diff
    # renamed/reworded strings, leaving their committed translations stranded.
    # A plain drop in the translated count is NOT used — deleting a string
    # lowers it identically to a rename but is a legitimate change, and with
    # `pybabel update --ignore-obsolete` a deletion creates no fuzzy entry.
    regressions: list[tuple[str, int, int]] = []
    for lang, before_stats in sorted(before.items()):
        after_stats = after.get(lang, {"translated": 0, "fuzzy": 0})
        if after_stats["fuzzy"] > before_stats["fuzzy"]:
            regressions.append((lang, before_stats["fuzzy"], after_stats["fuzzy"]))

    if regressions:
        print("Translation regression detected!\n")
        for lang, b, a in regressions:
            print(
                f"  {lang}: {a - b} translation(s) invalidated "
                f"(fuzzy {b} -> {a}) by a renamed/reworded source string"
            )
        print(
            "\nResolve the newly-fuzzy entries in the affected .po files "
            "before merging."
        )
        if report_path:
            Path(report_path).write_text(
                build_regression_report(regressions), encoding="utf-8"
            )
        sys.exit(1)

    # All good — print a summary so it's easy to read in CI logs.
    print("No translation regressions.\n")
    for lang in sorted(after):
        before_stats = before.get(lang, {"translated": 0, "fuzzy": 0})
        after_stats = after[lang]
        t_delta = after_stats["translated"] - before_stats["translated"]
        f_delta = after_stats["fuzzy"] - before_stats["fuzzy"]
        print(
            f"  {lang}: translated {before_stats['translated']} -> "
            f"{after_stats['translated']} ({t_delta:+d}), fuzzy "
            f"{before_stats['fuzzy']} -> {after_stats['fuzzy']} ({f_delta:+d})"
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Check for translation regressions in .po files."
    )
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument(
        "--count",
        action="store_true",
        help="Output translation counts per language as JSON.",
    )
    action.add_argument(
        "--compare",
        metavar="BEFORE_JSON",
        help="Compare current counts against a baseline JSON file.",
    )
    parser.add_argument(
        "--report",
        metavar="REPORT_MD",
        help="When --compare detects regressions, write a markdown report here.",
    )
    parser.add_argument(
        "--translations-dir",
        type=Path,
        default=DEFAULT_TRANSLATIONS_DIR,
        help=(
            "Path to the translations directory containing per-language "
            "LC_MESSAGES/messages.po files (default: <repo>/superset/translations)."
        ),
    )
    args = parser.parse_args()

    if args.count:
        cmd_count(args.translations_dir)
    else:
        cmd_compare(args.compare, args.translations_dir, args.report)


if __name__ == "__main__":
    main()
