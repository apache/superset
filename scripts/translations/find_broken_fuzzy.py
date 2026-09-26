#!/usr/bin/env python3
"""
Detect and clear fuzzy .po entries whose placeholders don't match their
English source. See apache/superset#44551.

Detection uses polib (read-only) since it's a reliable, well-tested .po
parser. Fixing does NOT use polib.save(), because polib re-serializes the
entire file (rewrapping lines, normalizing quoting) and turns a change to
~1,000 entries into a diff touching every line of every file. Instead,
`_clear_msgstrs_in_place` does a surgical text edit: for each entry that
needs clearing, it locates that entry's msgstr field(s) in the raw file
text and blanks only those lines, leaving every other byte of the file
untouched. This keeps the diff reviewable and scoped to the actual change.

Methodology mirrors apache/superset#44551:
  - Extract named (%(key)s) and positional (%s, %d, ...) placeholders from
    each source form (msgid / msgid_plural) and each translated form
    (msgstr / msgstr[n]).
  - A named placeholder in the translation that isn't in the source form's
    placeholder set is a hard break (KeyError at runtime).
  - A positional-placeholder COUNT mismatch is a hard break (TypeError:
    not enough / too many arguments).
  - A translation that drops one or more of the source's named
    placeholders entirely is flagged too (silently drops a value at
    runtime, per the issue's "drop a value" bucket), even though it
    doesn't raise.
  - Plural forms whose msgstr is a short literal containing no placeholder
    at all are treated as the documented "this form is only used for one
    specific number, and writes that number out" exception, and are not
    flagged (matches the Arabic zero/one/two carve-out in the issue).

Only entries currently marked fuzzy are in scope for THIS script, since
PR 2 in the issue's plan is specifically "clear the 1,190 broken fuzzy
entries" (confirmed/non-fuzzy broken entries are PR 3's 8 manual fixes).

Clearing sets msgstr to "" but leaves the `#, fuzzy` comment in place.
This is sufficient: msgfmt's own statistics classify an entry as "fuzzy"
only when it has content, so an emptied msgstr is counted as untranslated
regardless of the leftover flag, exactly matching the issue's "they
become untranslated" description.
"""

import argparse
import re
import sys
from pathlib import Path

import polib

NAMED_RE = re.compile(r"%\((\w+)\)[sdif]")
# bare positional specifiers not part of a %(name)s group
POSITIONAL_RE = re.compile(r"%(?!\()[sdif]")

# Documented exception from apache/superset#44551: this message embeds a
# literal example placeholder inside its own text ("%(suggestion)s instead
# of %(undefinedParameter)s?"). The issue author re-ran it with real
# arguments and confirmed it renders correctly, so it's excluded rather
# than cleared.
KNOWN_EXCEPTION_MSGIDS = {
    '%(suggestion)s instead of "%(undefinedParameter)s?"',
}


def extract_placeholders(text: str):
    named = set(NAMED_RE.findall(text))
    positional = len(POSITIONAL_RE.findall(text))
    return named, positional


def looks_like_literal_exception(msgstr: str) -> bool:
    """Heuristic for the documented 'single number written out literally'
    plural-form exception (e.g. a form only ever used for n==1)."""
    if "%" in msgstr:
        return False
    stripped = msgstr.strip()
    return bool(stripped) and len(stripped) <= 20 and any(c.isdigit() for c in stripped)


def check_entry(entry):
    """Return a list of (form_label, reason) tuples for broken forms."""
    if entry.msgid in KNOWN_EXCEPTION_MSGIDS:
        return []
    problems = []

    if entry.msgid_plural:
        src_named, src_pos = extract_placeholders(entry.msgid_plural)
        for idx, msgstr in entry.msgstr_plural.items():
            if not msgstr:
                continue
            if looks_like_literal_exception(msgstr):
                continue
            t_named, t_pos = extract_placeholders(msgstr)
            extra = t_named - src_named
            missing = src_named - t_named
            if extra:
                problems.append((f"msgstr[{idx}]", f"extra key(s) not in source: {sorted(extra)}"))
            elif src_pos and t_pos != src_pos:
                problems.append((f"msgstr[{idx}]", f"positional count {t_pos} != source {src_pos}"))
            elif missing and (src_named or src_pos):
                problems.append((f"msgstr[{idx}]", f"drops key(s): {sorted(missing)}"))
    else:
        if not entry.msgstr:
            return problems
        src_named, src_pos = extract_placeholders(entry.msgid)
        t_named, t_pos = extract_placeholders(entry.msgstr)
        extra = t_named - src_named
        missing = src_named - t_named
        if extra:
            problems.append(("msgstr", f"extra key(s) not in source: {sorted(extra)}"))
        elif src_pos and t_pos != src_pos:
            problems.append(("msgstr", f"positional count {t_pos} != source {src_pos}"))
        elif missing and (src_named or src_pos):
            problems.append(("msgstr", f"drops key(s): {sorted(missing)}"))

    return problems


def _split_entry_blocks(text: str):
    """Split raw .po text into (block_text, trailing_separator) pairs.

    Entries in a .po file are separated by one or more blank lines. We
    keep the exact separator (including the header block boundary) so
    reassembly is byte-identical apart from the fields we deliberately
    change.
    """
    # Split but keep the separators (runs of blank lines) as their own
    # tokens so we can rejoin exactly.
    parts = re.split(r"(\n\s*\n)", text)
    return parts  # alternating: block, sep, block, sep, ..., block


def _extract_msgid(block: str):
    """Pull the msgid string (joined, unescaped) out of a raw block, or
    None if this block has no msgid (e.g. it's the leading file header
    before the first entry, or a comment-only fragment)."""
    m = re.search(r'(?m)^msgid\s+((?:"(?:[^"\\]|\\.)*"\s*)+)', block)
    if not m:
        return None
    raw = m.group(1)
    pieces = re.findall(r'"((?:[^"\\]|\\.)*)"', raw)
    joined = "".join(pieces)
    return polib.unescape(joined)


def _clear_msgstr_in_block(block: str) -> str:
    """Blank the msgstr field(s) of a single entry block, in place,
    leaving every other line untouched.

    Note: `block` (as produced by `_split_entry_blocks`) never carries a
    trailing newline of its own -- the entry separator supplies the
    newline that terminates the block's last line. So the replacement
    text must NOT end with "\\n", or a spurious blank line appears
    between this entry and the next.
    """
    if re.search(r"(?m)^msgid_plural\s", block):
        # Plural entry: replace from the first msgstr[0] line to the end
        # of the block with one empty msgstr[N] line per index that
        # existed, preserving their order.
        indices = re.findall(r"(?m)^msgstr\[(\d+)\]", block)
        if not indices:
            return block
        start = re.search(r"(?m)^msgstr\[\d+\]", block)
        replacement = "\n".join(f'msgstr[{i}] ""' for i in indices)
        return block[: start.start()] + replacement
    else:
        start = re.search(r"(?m)^msgstr\s", block)
        if not start:
            return block
        return block[: start.start()] + 'msgstr ""'


def _clear_msgstrs_in_place(po_path: Path, broken_msgids: set) -> int:
    """Rewrite po_path, blanking msgstr fields for entries whose msgid is
    in broken_msgids. Returns the number of blocks actually changed.
    Every other byte of the file is left exactly as it was.
    """
    text = po_path.read_text(encoding="utf-8")
    parts = _split_entry_blocks(text)
    changed = 0
    for i in range(0, len(parts), 2):
        block = parts[i]
        msgid = _extract_msgid(block)
        if msgid is not None and msgid in broken_msgids:
            new_block = _clear_msgstr_in_block(block)
            if new_block != block:
                parts[i] = new_block
                changed += 1
    if changed:
        po_path.write_text("".join(parts), encoding="utf-8")
    return changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--translations-dir", default="superset/translations")
    ap.add_argument("--fix", action="store_true", help="Clear broken fuzzy entries in place")
    ap.add_argument("--report", default=None, help="Write a CSV report to this path")
    args = ap.parse_args()

    root = Path(args.translations_dir)
    po_files = sorted(root.glob("*/LC_MESSAGES/messages.po"))

    total_broken = 0
    total_cleared = 0
    per_lang = {}
    rows = []

    for po_path in po_files:
        lang = po_path.parts[-3]
        po = polib.pofile(str(po_path))
        broken_entries = []

        for entry in po:
            if "fuzzy" not in entry.flags:
                continue
            problems = check_entry(entry)
            if problems:
                broken_entries.append((entry, problems))

        if broken_entries:
            per_lang[lang] = len(broken_entries)
            total_broken += len(broken_entries)

        for entry, problems in broken_entries:
            for form_label, reason in problems:
                rows.append((lang, entry.msgid[:60].replace("\n", "\\n"), form_label, reason))

        if args.fix and broken_entries:
            broken_msgids = {entry.msgid for entry, _ in broken_entries}
            cleared = _clear_msgstrs_in_place(po_path, broken_msgids)
            total_cleared += cleared

    print(f"{'lang':8s} {'broken fuzzy entries':>22s}")
    for lang, count in sorted(per_lang.items(), key=lambda x: -x[1]):
        print(f"{lang:8s} {count:>22d}")
    print(f"{'TOTAL':8s} {total_broken:>22d}")

    if args.report:
        import csv
        with open(args.report, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["lang", "msgid_snippet", "form", "reason"])
            w.writerows(rows)
        print(f"\nWrote {len(rows)} row report to {args.report}")

    if args.fix:
        print(f"\nCleared {total_cleared} broken fuzzy entries across {len(per_lang)} catalogs (in place, minimal diff).")


if __name__ == "__main__":
    main()
