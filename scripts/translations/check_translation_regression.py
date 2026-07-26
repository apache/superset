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
A regression is an *existing translation that a source change invalidated*:
a message that was a **confirmed, non-fuzzy translation** in the baseline and
is **fuzzy** after the PR. The check keys on this per-``msgid`` transition
rather than on the aggregate count of fuzzy entries, because a bare count
cannot tell apart two changes that move the fuzzy total by the same amount:

* ``translated -> fuzzy`` — a reworded source string stranded a real
  translation. **This is the regression.**
* ``untranslated -> fuzzy`` — an empty ``msgstr`` was filled with a fuzzy
  (unconfirmed) guess, e.g. an AI backfill committed as ``#, fuzzy``. No
  existing translation was lost, so this is **not** a regression and must
  pass.

Keying on the per-entry transition lets a backfill PR commit fuzzy guesses for
previously-untranslated strings (the ja/fi catalog backfills) without tripping
the check, while still catching a genuine invalidation even when the same PR
also adds new strings (which a count-delta heuristic would let mask it).

Note ``babel_update.sh`` runs ``pybabel update`` with ``--no-fuzzy-matching``,
so *adding* (or renaming) a source string does **not** auto-generate a fuzzy
guess against an unrelated existing translation — new strings land as cleanly
untranslated (empty ``msgstr``). The fuzzies this check sees therefore arrive
another way — typically a committed ``.po`` edit. *Deleting* a string is still
not a regression: with ``--ignore-obsolete`` it is simply dropped and no fuzzy
is created.

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


def entry_keys(po_file: Path) -> dict[str, list[str]]:
    """Return per-``msgid`` key sets for a .po file.

    ``translated_keys`` lists the non-fuzzy, non-obsolete entries with a
    populated ``msgstr`` — confirmed translations a source reword could strand.
    ``fuzzy_keys`` lists the non-obsolete entries carrying the ``fuzzy`` flag
    (however they arrived — a committed backfill guess or a real invalidation).

    A key combines ``msgctxt`` and ``msgid`` (gettext's own identity rule) so
    context-disambiguated entries stay distinct. The header entry (empty
    ``msgid``) is ignored. The regression check compares the baseline's
    ``translated_keys`` against the PR's ``fuzzy_keys``: their intersection is
    exactly the set of confirmed translations the PR turned fuzzy.

    Raises:
        OSError: if ``polib`` cannot read or parse the file. As with a msgfmt
            failure, a catalog we cannot parse is surfaced rather than silently
            counted as empty.
    """
    import polib  # type: ignore[import-untyped]  # noqa: PLC0415

    translated_keys: list[str] = []
    fuzzy_keys: list[str] = []
    for entry in polib.pofile(str(po_file)):
        if entry.obsolete or not entry.msgid:
            continue
        key = f"{entry.msgctxt}\x04{entry.msgid}" if entry.msgctxt else entry.msgid
        if "fuzzy" in entry.flags:
            fuzzy_keys.append(key)
        elif (
            all(entry.msgstr_plural.values())
            if entry.msgid_plural
            else bool(entry.msgstr)
        ):
            translated_keys.append(key)
    return {"translated_keys": translated_keys, "fuzzy_keys": fuzzy_keys}


def get_counts(
    translations_dir: Path,
    failures: Optional[set[str]] = None,
) -> dict[str, dict[str, object]]:
    """Count translated/fuzzy entries for every ``.po`` file in a directory.

    Each language maps to ``{"translated", "fuzzy", "translated_keys",
    "fuzzy_keys"}`` — aggregate counts (for the human-readable summary) plus the
    per-``msgid`` key sets the regression check actually keys on.

    If ``failures`` is provided, the name of each language whose ``.po`` file
    is present on disk but could not be counted (msgfmt non-zero exit,
    unparseable output, or a polib parse error) is added to it. Such a language
    is deliberately absent from the returned mapping — but, unlike a language
    whose catalog was simply deleted, it must not be mistaken for an intentional
    removal: a caller that cares about the distinction (see :func:`cmd_compare`)
    can inspect ``failures`` and treat it as a hard error.
    """
    counts: dict[str, dict[str, object]] = {}
    for po_file in sorted(translations_dir.glob("*/LC_MESSAGES/messages.po")):
        lang = po_file.parent.parent.name
        if lang in SKIP_LANGS:
            continue
        try:
            stats: dict[str, object] = dict(count_stats(po_file))
            stats.update(entry_keys(po_file))
            counts[lang] = stats
        except (subprocess.CalledProcessError, RuntimeError, OSError) as exc:
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


def _normalize(entry: object) -> dict[str, object]:
    """Coerce a baseline entry into ``{"translated", "fuzzy", *_keys}``.

    ``translated_keys``/``fuzzy_keys`` are the per-``msgid`` sets the check
    keys on. They are ``None`` (not ``[]``) when the baseline predates the
    per-entry format — an absent set means "unknown", which routes
    :func:`cmd_compare` to the coarse aggregate fallback, whereas an empty list
    is a known-empty set. Legacy formats — a ``{"translated", "fuzzy"}`` dict
    with no key sets, or a bare integer translated count — are both tolerated.
    """
    if isinstance(entry, dict):
        return {
            "translated": int(entry.get("translated", 0)),
            "fuzzy": int(entry.get("fuzzy", 0)),
            "translated_keys": (
                list(entry["translated_keys"]) if "translated_keys" in entry else None
            ),
            "fuzzy_keys": (
                list(entry["fuzzy_keys"]) if "fuzzy_keys" in entry else None
            ),
        }
    if isinstance(entry, int):
        return {
            "translated": entry,
            "fuzzy": 0,
            "translated_keys": None,
            "fuzzy_keys": None,
        }
    raise TypeError(f"Unsupported baseline entry: {entry!r}")


def _key_list(stats: dict[str, object], field: str) -> Optional[list[str]]:
    """Return ``stats[field]`` as a list of keys, or ``None`` if unavailable.

    A missing or non-list value reads as "unknown" so the caller can fall back
    to the aggregate comparison instead of treating it as an empty key set.
    """
    value = stats.get(field)
    return list(value) if isinstance(value, list) else None


def _count(stats: dict[str, object], field: str) -> int:
    """Return ``stats[field]`` as an int count, defaulting to 0."""
    value = stats.get(field, 0)
    return value if isinstance(value, int) else 0


def build_regression_report(regressions: list[tuple[str, int, int, int]]) -> str:
    """Build a markdown report for posting as a PR comment.

    Each regression tuple is ``(lang, before_fuzzy, after_fuzzy, invalidated)``
    where ``invalidated`` is the number of confirmed translations the PR turned
    fuzzy.
    """
    rows = "\n".join(f"| `{lang}` | {n} |" for lang, _b, _a, n in regressions)
    affected = ", ".join(f"`{lang}`" for lang, *_ in regressions)
    return (
        "## ⚠️ Translation Regression Detected\n\n"
        f"A source change in this PR renamed or reworded strings, invalidating "
        f"existing translations (they are now `#, fuzzy`) in {affected}. Please "
        f"resolve the affected `.po` files before merging.\n\n"
        "_Note: neither intentionally **deleting** a translatable string nor "
        "filling a previously-**untranslated** entry with a fuzzy guess (e.g. an "
        "AI backfill) is a regression — only a confirmed translation that a "
        "renamed/reworded source string turned fuzzy is flagged here._\n\n"
        "| Language | Invalidated translations |\n"
        "|----------|-------------------------:|\n"
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


def _detect_regressions(
    before: dict[str, dict[str, object]],
    after: dict[str, dict[str, object]],
) -> list[tuple[str, int, int, int]]:
    """Return ``(lang, before_fuzzy, after_fuzzy, invalidated)`` per regressed lang.

    A regression is a key in the baseline's ``translated_keys`` that is fuzzy
    after the PR — a confirmed translation a source reword stranded. Filling a
    previously-untranslated entry with a fuzzy guess (backfill) is therefore not
    flagged (its key was absent from the baseline's translated set), and neither
    is deleting a string (with ``--ignore-obsolete`` it drops, creating no
    fuzzy). When per-entry key data is unavailable (a legacy baseline, or a
    catalog whose key set could not be read), fall back to the coarse rule: any
    net increase in the aggregate fuzzy count.
    """
    regressions: list[tuple[str, int, int, int]] = []
    for lang, before_stats in sorted(before.items()):
        after_stats = after.get(lang)
        if after_stats is None:
            # Catalog absent from `after`: an intentional deletion (a
            # present-but-uncountable catalog was already caught by the caller).
            continue
        b_fuzzy = _count(before_stats, "fuzzy")
        a_fuzzy = _count(after_stats, "fuzzy")
        before_translated = before_stats.get("translated_keys")
        after_fuzzy = _key_list(after_stats, "fuzzy_keys")
        if isinstance(before_translated, list) and after_fuzzy is not None:
            invalidated = set(after_fuzzy) & set(before_translated)
            if invalidated:
                regressions.append((lang, b_fuzzy, a_fuzzy, len(invalidated)))
        elif a_fuzzy > b_fuzzy:
            regressions.append((lang, b_fuzzy, a_fuzzy, a_fuzzy - b_fuzzy))
    return regressions


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

    if regressions := _detect_regressions(before, after):
        print("Translation regression detected!\n")
        for lang, _b, _a, n in regressions:
            print(
                f"  {lang}: {n} confirmed translation(s) invalidated "
                f"(now fuzzy) by a renamed/reworded source string"
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
        before_stats: dict[str, object] = before.get(lang, {})
        after_stats = after[lang]
        b_translated = _count(before_stats, "translated")
        a_translated = _count(after_stats, "translated")
        b_fuzzy = _count(before_stats, "fuzzy")
        a_fuzzy = _count(after_stats, "fuzzy")
        print(
            f"  {lang}: translated {b_translated} -> {a_translated} "
            f"({a_translated - b_translated:+d}), fuzzy "
            f"{b_fuzzy} -> {a_fuzzy} ({a_fuzzy - b_fuzzy:+d})"
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
