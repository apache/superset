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
"""Backfill missing translations in a .po file using Claude AI.

For each untranslated (empty msgstr) entry in the target language, the script
sends the English source string along with all available translations in other
languages to Claude as context, then writes the AI-generated translation back
into the .po file marked as #, fuzzy for human review.

Usage:
  # Build the translation index first (one-time or when .po files change)
  python scripts/translations/build_translation_index.py

  # Backfill French translations
  python scripts/translations/backfill_po.py --lang fr

  # Dry run (print what would be translated without writing)
  python scripts/translations/backfill_po.py --lang de --dry-run

  # Limit to 100 entries and use a specific model
  python scripts/translations/backfill_po.py --lang es --limit 100 \
    --model claude-opus-4-6

Options:
  --lang LANG        ISO language code to backfill (required)
  --batch-size N     Number of strings per Claude request (default: 50)
  --limit N          Stop after translating N entries (default: unlimited)
  --model MODEL      Claude model ID (default: claude-sonnet-4-6)
  --index PATH       Path to translation_index.json (default: auto-detect)
  --dry-run          Print translations without writing to .po file
  --fuzzy/--no-fuzzy Mark generated translations as fuzzy (default: fuzzy)
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

try:
    import polib  # type: ignore[import-untyped]
except ImportError:
    print("polib is required. Run: pip install polib", file=sys.stderr)
    sys.exit(1)

TRANSLATIONS_DIR = Path(__file__).parent.parent.parent / "superset" / "translations"
DEFAULT_INDEX = TRANSLATIONS_DIR / "translation_index.json"
DEFAULT_MODEL = "claude-sonnet-4-6"
DEFAULT_BATCH_SIZE = 50

# Language names for the prompt, keyed by ISO code
LANGUAGE_NAMES: dict[str, str] = {
    "ar": "Arabic",
    "ca": "Catalan",
    "de": "German",
    "es": "Spanish",
    "fa": "Persian (Farsi)",
    "fr": "French",
    "it": "Italian",
    "ja": "Japanese",
    "ko": "Korean",
    "mi": "Māori",
    "nl": "Dutch",
    "pl": "Polish",
    "pt": "Portuguese",
    "pt_BR": "Brazilian Portuguese",
    "ru": "Russian",
    "sk": "Slovak",
    "sl": "Slovenian",
    "tr": "Turkish",
    "uk": "Ukrainian",
    "zh": "Chinese (Simplified)",
    "zh_TW": "Chinese (Traditional)",
}


def _lang_name(code: str) -> str:
    """Return a human-readable language name for an ISO language code."""
    return LANGUAGE_NAMES.get(code, code)


def _plural_key(msgid: str, msgid_plural: str) -> str:
    """Build the translation index key used for pluralized entries."""
    return f"{msgid}\x00{msgid_plural}"


def _is_missing(entry: polib.POEntry) -> bool:
    """Return True for entries that need a translation."""
    if entry.obsolete:
        return False
    if entry.msgid_plural:
        return not any(v for v in entry.msgstr_plural.values())
    return not entry.msgstr


def _context_langs(
    item: dict[str, Any], index: dict[str, Any], target_lang: str
) -> list[str]:
    """Return sorted list of language codes that have translations for this entry."""
    key = item["index_key"]
    if key not in index:
        return []
    return sorted(
        lang for lang, val in index[key].items() if lang != target_lang and val
    )


def _context_count(
    item: dict[str, Any], index: dict[str, Any], target_lang: str
) -> int:
    """Return the number of other-language translations available for this entry."""
    return len(_context_langs(item, index, target_lang))


def _render_item(
    i: int,
    item: dict[str, Any],
    index: dict[str, Any],
    target_lang: str,
    reference_langs_sorted: list[str],
) -> list[str]:
    """Render one batch entry as prompt lines."""
    lines: list[str] = []
    ctx = _context_count(item, index, target_lang)
    if ctx == 0:
        lines.append(
            f"--- [{i}] (no reference translations — translate conservatively) ---"
        )
    else:
        plural = "s" if ctx != 1 else ""
        lines.append(f"--- [{i}] ({ctx} reference translation{plural}) ---")
    lines.append(f"English: {json.dumps(item['msgid'], ensure_ascii=False)}")
    if item.get("msgid_plural"):
        plural_json = json.dumps(item["msgid_plural"], ensure_ascii=False)
        lines.append(f"English plural: {plural_json}")
    key = item["index_key"]
    if key in index and reference_langs_sorted:
        for lang in reference_langs_sorted:
            val = index[key].get(lang)
            if val is None:
                continue
            if isinstance(val, dict):
                forms = "; ".join(
                    f"[{k}] {json.dumps(v, ensure_ascii=False)}" for k, v in val.items()
                )
                lines.append(f"{_lang_name(lang)}: {forms}")
            else:
                lines.append(
                    f"{_lang_name(lang)}: {json.dumps(val, ensure_ascii=False)}"
                )
    lines.append("")
    return lines


def build_prompt(
    target_lang: str,
    batch: list[dict[str, Any]],
    index: dict[str, Any],
) -> str:
    """Build the Claude prompt for a batch of entries."""
    lang_name = _lang_name(target_lang)

    # Collect which other languages actually have translations for this batch
    reference_langs: set[str] = set()
    for item in batch:
        key = item["index_key"]
        if key in index:
            reference_langs.update(
                lang for lang, val in index[key].items() if lang != target_lang and val
            )
    reference_langs_sorted = sorted(reference_langs)

    lines: list[str] = [
        "You are a professional translator specializing in software UI strings.",
        f"Translate the following English strings into {lang_name} ({target_lang}).",
        "",
        "Rules:",
        "- Preserve all format placeholders exactly: %(name)s, {name}, %s, %d, etc.",
        "- Preserve HTML tags if present.",
        "- Keep the same tone and register as the reference translations.",
        "- For plural forms, provide translations for all plural forms"
        " required by the language.",
        "- Return ONLY a JSON object mapping each numeric index (as a string)"
        " to its translation.",
        "- Do not add any explanation, preamble, or markdown fences.",
        "",
        "Important: Many strings are short fragments or single words that are"
        " ambiguous in English (e.g. 'Scale' could mean a measurement scale,"
        " to scale an image, or fish scales). Use the translations in other"
        " languages as your primary signal for which meaning is intended —"
        " they collectively disambiguate the intended sense. When no"
        " other-language translations are available for an entry, translate"
        " conservatively based on the most common meaning in a data"
        " visualization UI context.",
        "",
    ]

    if reference_langs_sorted:
        lines.append(
            f"Reference translations are provided per string where available "
            f"({', '.join(_lang_name(lc) for lc in reference_langs_sorted)})."
        )
        lines.append("")

    lines.append("Strings to translate:")
    lines.append("")

    for i, item in enumerate(batch):
        lines.extend(_render_item(i, item, index, target_lang, reference_langs_sorted))

    if batch and batch[0].get("msgid_plural"):
        # Add guidance on plural form counts per language
        lines.append(
            "Note: provide ALL plural forms required by the target language "
            "(e.g. French needs 2, Russian needs 3, Arabic needs 6)."
        )
        lines.append("")

    lines.append(
        'Expected output format: {"0": "<translation>", "1": "<translation>", ...}'
    )
    lines.append("(keys are the numeric indices of the strings above)")

    return "\n".join(lines)


def parse_response(text: str, batch_size: int) -> dict[int, str]:
    """Parse the JSON object from Claude's response."""
    # Strip any accidental markdown fences
    text = re.sub(r"^```[^\n]*\n", "", text.strip())
    text = re.sub(r"\n```$", "", text)
    try:
        raw = json.loads(text)
        # Preserve dict/list values as JSON strings so plural responses
        # (where v is a dict of plural forms) can be re-parsed downstream
        # by _apply_translation's json.loads. str(v) on a dict produces
        # Python repr ({'0': 'x'}) which is not valid JSON.
        return {
            int(k): (
                json.dumps(v, ensure_ascii=False)
                if isinstance(v, (dict, list))
                else str(v)
            )
            for k, v in raw.items()
            if str(k).isdigit()
        }
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Could not parse response as JSON: {exc}\n\nResponse:\n{text}"
        ) from exc


def translate_batch(
    model: str,
    target_lang: str,
    batch: list[dict[str, Any]],
    index: dict[str, Any],
) -> dict[int, str]:
    """Send a batch of strings to Claude via `claude -p`.

    Returns a dict mapping batch index to translated string.
    """
    claude_bin = shutil.which("claude")
    if not claude_bin:
        raise RuntimeError(
            "claude CLI not found. Install Claude Code or add it to PATH."
        )
    prompt = build_prompt(target_lang, batch, index)
    # claude_bin is resolved via shutil.which — not user-controlled input
    result = subprocess.run(  # noqa: S603
        [claude_bin, "--model", model, "-p", prompt],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"claude exited with code {result.returncode}:\n{result.stderr}"
        )
    return parse_response(result.stdout.strip(), len(batch))


def _apply_translation(
    entry: polib.POEntry,
    translation: str,
    item: dict[str, Any],
    model: str,
    mark_fuzzy: bool,
) -> None:
    """Write a translation string into a POEntry and add attribution."""
    if entry.msgid_plural:
        # Model may return a JSON dict of plural forms or a plain string
        try:
            plural_dict = json.loads(translation)
            if isinstance(plural_dict, dict):
                entry.msgstr_plural = {int(k): str(v) for k, v in plural_dict.items()}
            else:
                for k in entry.msgstr_plural:
                    entry.msgstr_plural[k] = str(plural_dict)
        except (json.JSONDecodeError, ValueError):
            for k in entry.msgstr_plural:
                entry.msgstr_plural[k] = translation
    else:
        entry.msgstr = translation

    if mark_fuzzy and "fuzzy" not in entry.flags:
        entry.flags.append("fuzzy")

    refs = item["context_langs"]
    refs_tag = f" [refs: {', '.join(refs)}]" if refs else " [no refs]"
    attribution = f"Machine-translated via backfill_po.py ({model}){refs_tag}"
    if entry.tcomment:
        if attribution not in entry.tcomment:
            entry.tcomment = f"{entry.tcomment}\n{attribution}"
    else:
        entry.tcomment = attribution


def _build_batch_items(
    entries: list[polib.POEntry],
    index: dict[str, Any],
    lang: str,
) -> list[dict[str, Any]]:
    """Convert a list of POEntries into the dict format used by translate_batch."""
    items: list[dict[str, Any]] = []
    for entry in entries:
        if entry.msgid_plural:
            item: dict[str, Any] = {
                "msgid": entry.msgid,
                "msgid_plural": entry.msgid_plural,
                "index_key": _plural_key(entry.msgid, entry.msgid_plural),
                "is_plural": True,
            }
        else:
            item = {
                "msgid": entry.msgid,
                "index_key": entry.msgid,
                "is_plural": False,
            }
        item["context_langs"] = _context_langs(item, index, lang)
        item["context_count"] = len(item["context_langs"])
        items.append(item)
    return items


def _process_batches(
    missing: list[polib.POEntry],
    index: dict[str, Any],
    lang: str,
    batch_size: int,
    model: str,
    dry_run: bool,
    mark_fuzzy: bool,
) -> tuple[int, int]:
    """Translate missing entries in batches. Returns (translated, failed) counts."""
    translated_count = 0
    failed_count = 0
    for batch_start in range(0, len(missing), batch_size):
        batch_entries = missing[batch_start : batch_start + batch_size]
        batch_items = _build_batch_items(batch_entries, index, lang)
        end = min(batch_start + batch_size, len(missing))
        print(
            f"  Translating entries {batch_start + 1}–{end} of {len(missing)} …",
            file=sys.stderr,
        )
        try:
            translations = translate_batch(model, lang, batch_items, index)
        except (ValueError, RuntimeError) as exc:
            print(f"  ERROR in batch starting at {batch_start}: {exc}", file=sys.stderr)
            failed_count += len(batch_entries)
            continue
        for i, entry in enumerate(batch_entries):
            translation = translations.get(i)
            if translation is None:
                print(
                    f"  WARNING: no translation returned for index {i} "
                    f"(msgid: {entry.msgid[:60]!r})",
                    file=sys.stderr,
                )
                failed_count += 1
                continue
            if dry_run:
                ctx = batch_items[i]["context_count"]
                ctx_tag = f" [ctx:{ctx}]" if ctx < 3 else ""
                print(
                    f"  [{lang}]{ctx_tag} {entry.msgid[:60]!r} → {translation[:60]!r}"
                )
            else:
                _apply_translation(
                    entry, translation, batch_items[i], model, mark_fuzzy
                )
            translated_count += 1
    return translated_count, failed_count


def backfill(
    lang: str,
    *,
    batch_size: int = DEFAULT_BATCH_SIZE,
    limit: int | None = None,
    min_context: int = 0,
    model: str = DEFAULT_MODEL,
    index_path: Path = DEFAULT_INDEX,
    dry_run: bool = False,
    mark_fuzzy: bool = True,
) -> None:
    po_path = TRANSLATIONS_DIR / lang / "LC_MESSAGES" / "messages.po"
    if not po_path.exists():
        print(f"No .po file found for language '{lang}': {po_path}", file=sys.stderr)
        sys.exit(1)
    if not index_path.exists():
        print(
            f"Translation index not found at {index_path}.\n"
            "Run: python scripts/translations/build_translation_index.py",
            file=sys.stderr,
        )
        sys.exit(1)

    print("Loading translation index …", file=sys.stderr)
    with open(index_path, encoding="utf-8") as f:
        index: dict[str, Any] = json.load(f)

    print(f"Loading {po_path} …", file=sys.stderr)
    cat = polib.pofile(str(po_path))

    missing: list[polib.POEntry] = [e for e in cat if e.msgid and _is_missing(e)]
    print(f"Found {len(missing)} untranslated entries for '{lang}'.", file=sys.stderr)

    if min_context > 0:
        before = len(missing)
        missing = [
            e
            for e in missing
            if _context_count(
                {
                    "index_key": (
                        _plural_key(e.msgid, e.msgid_plural)
                        if e.msgid_plural
                        else e.msgid
                    )
                },
                index,
                lang,
            )
            >= min_context
        ]
        skipped = before - len(missing)
        print(
            f"Skipping {skipped} entries with fewer than {min_context} reference "
            f"translation(s) (use --min-context 0 to include them).",
            file=sys.stderr,
        )

    if limit is not None:
        missing = missing[:limit]
        print(f"Limiting to {limit} entries.", file=sys.stderr)

    if not missing:
        print("Nothing to do.", file=sys.stderr)
        return

    translated_count, failed_count = _process_batches(
        missing, index, lang, batch_size, model, dry_run, mark_fuzzy
    )

    if not dry_run and translated_count > 0:
        print(f"\nSaving {po_path} …", file=sys.stderr)
        cat.save()

    print(
        f"\nDone. Translated: {translated_count}, Failed/skipped: {failed_count}.",
        file=sys.stderr,
    )
    if not dry_run and translated_count > 0:
        print(
            f"Translations written to {po_path} (marked #, fuzzy for review).",
            file=sys.stderr,
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill missing .po translations using Claude AI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--lang", required=True, help="ISO language code (e.g. fr, de, ja)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f"Strings per Claude request (default: {DEFAULT_BATCH_SIZE})",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of entries to translate (default: unlimited)",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Claude model ID (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--index",
        type=Path,
        default=DEFAULT_INDEX,
        help=f"Path to translation_index.json (default: {DEFAULT_INDEX})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print translations without modifying the .po file",
    )
    parser.add_argument(
        "--min-context",
        type=int,
        default=0,
        metavar="N",
        help=(
            "Skip entries with fewer than N reference translations in other languages "
            "(default: 0 = translate everything). Strings with low context are more "
            "likely to be ambiguous single words or fragments — set to e.g. 2 to only "
            "translate strings that have been confirmed in at least 2 other languages."
        ),
    )
    parser.add_argument(
        "--no-fuzzy",
        dest="mark_fuzzy",
        action="store_false",
        default=True,
        help="Do not mark generated translations as #, fuzzy",
    )
    args = parser.parse_args()

    backfill(
        lang=args.lang,
        batch_size=args.batch_size,
        limit=args.limit,
        min_context=args.min_context,
        model=args.model,
        index_path=args.index,
        dry_run=args.dry_run,
        mark_fuzzy=args.mark_fuzzy,
    )


if __name__ == "__main__":
    main()
