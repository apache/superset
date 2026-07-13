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
"""Tests for ``scripts/translations/backfill_po.py``.

The script is not installed as a package, so it is loaded via importlib from
its filesystem path. The two units exercised here — ``parse_response`` and
``_apply_translation`` — have enough edge cases (dict/list/scalar responses,
plural vs singular entries, fuzzy flag, attribution comments) to be worth
pinning against regressions.
"""

import importlib.util
import json  # noqa: TID251 - testing a standalone script that uses stdlib json
from pathlib import Path

import polib  # type: ignore[import-untyped]
import pytest

_SCRIPT_PATH = (
    Path(__file__).resolve().parents[4] / "scripts" / "translations" / "backfill_po.py"
)
_spec = importlib.util.spec_from_file_location("backfill_po", _SCRIPT_PATH)
assert _spec is not None, f"Could not load {_SCRIPT_PATH}"
assert _spec.loader is not None, f"No loader on spec for {_SCRIPT_PATH}"
backfill_po = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(backfill_po)


def test_parse_response_singular_strings() -> None:
    """A flat object of int-keyed strings is returned as-is."""
    text = '{"0": "hola", "1": "mundo"}'
    assert backfill_po.parse_response(text, batch_size=2) == {
        0: "hola",
        1: "mundo",
    }


def test_parse_response_strips_markdown_fences() -> None:
    """Models sometimes wrap JSON in ```json fences; those must be stripped."""
    text = '```json\n{"0": "hola"}\n```'
    assert backfill_po.parse_response(text, batch_size=1) == {0: "hola"}


def test_parse_response_preserves_plural_dict_as_json() -> None:
    """
    Plural entries arrive as nested dicts and must round-trip through
    json.loads downstream — str(dict) would emit Python repr (single quotes)
    and break parsing in _apply_translation. The serialized form must be
    valid JSON.
    """
    text = '{"0": {"0": "manzana", "1": "manzanas"}}'
    parsed = backfill_po.parse_response(text, batch_size=1)
    assert set(parsed.keys()) == {0}
    # Must be valid JSON (double-quoted), not Python repr (single-quoted).
    assert json.loads(parsed[0]) == {"0": "manzana", "1": "manzanas"}


def test_parse_response_preserves_non_ascii() -> None:
    """ensure_ascii=False keeps non-ASCII characters readable in the .po file."""
    text = '{"0": {"0": "日本語", "1": "日本語s"}}'
    parsed = backfill_po.parse_response(text, batch_size=1)
    assert "日本語" in parsed[0]


def test_parse_response_skips_non_numeric_keys() -> None:
    """Keys that are not numeric strings are silently skipped."""
    text = '{"0": "ok", "comment": "ignored", "2": "kept"}'
    assert backfill_po.parse_response(text, batch_size=3) == {
        0: "ok",
        2: "kept",
    }


@pytest.mark.parametrize(
    "raw",
    ['["hola", "mundo"]', '"just a string"', "null", "42"],
)
def test_parse_response_rejects_non_object(raw: str) -> None:
    """
    Non-object JSON (list, string, null, number) must raise ValueError so
    _process_batches catches it instead of crashing on AttributeError from
    .items().
    """
    with pytest.raises(ValueError, match="Expected a JSON object"):
        backfill_po.parse_response(raw, batch_size=1)


def test_parse_response_rejects_invalid_json() -> None:
    """Garbage input surfaces as ValueError, not the underlying JSONDecodeError."""
    with pytest.raises(ValueError, match="Could not parse response as JSON"):
        backfill_po.parse_response("not even close to json", batch_size=1)


# ---------------------------------------------------------------------------
# _apply_translation
# ---------------------------------------------------------------------------


def _make_singular_entry(msgid: str = "Hello") -> polib.POEntry:
    return polib.POEntry(msgid=msgid, msgstr="")


def _make_plural_entry(
    msgid: str = "%(n)s apple",
    msgid_plural: str = "%(n)s apples",
) -> polib.POEntry:
    entry = polib.POEntry(msgid=msgid, msgid_plural=msgid_plural)
    entry.msgstr_plural = {0: "", 1: ""}
    return entry


def _item(refs: list[str] | None = None) -> dict[str, list[str]]:
    return {"context_langs": refs if refs is not None else ["fr", "de"]}


def test_apply_translation_singular_writes_msgstr_and_marks_fuzzy() -> None:
    entry = _make_singular_entry()
    backfill_po._apply_translation(
        entry, "Hola", _item(["fr", "de"]), model="claude-test", mark_fuzzy=True
    )
    assert entry.msgstr == "Hola"
    assert "fuzzy" in entry.flags


def test_apply_translation_singular_no_fuzzy_when_disabled() -> None:
    entry = _make_singular_entry()
    backfill_po._apply_translation(
        entry, "Hola", _item(), model="claude-test", mark_fuzzy=False
    )
    assert "fuzzy" not in entry.flags


def test_apply_translation_attribution_includes_refs() -> None:
    entry = _make_singular_entry()
    backfill_po._apply_translation(
        entry, "Hola", _item(["fr", "de"]), model="claude-test", mark_fuzzy=True
    )
    assert "Machine-translated via backfill_po.py (claude-test)" in entry.tcomment
    assert "[refs: fr, de]" in entry.tcomment


def test_apply_translation_attribution_marks_no_refs() -> None:
    entry = _make_singular_entry()
    backfill_po._apply_translation(
        entry, "Hola", _item([]), model="claude-test", mark_fuzzy=True
    )
    assert "[no refs]" in entry.tcomment


def test_apply_translation_attribution_appended_not_duplicated() -> None:
    """Re-running on an already-translated entry must not duplicate attribution."""
    entry = _make_singular_entry()
    entry.tcomment = "Existing maintainer note"
    backfill_po._apply_translation(
        entry, "Hola", _item(["fr"]), model="claude-test", mark_fuzzy=True
    )
    # Existing comment preserved, attribution appended.
    assert entry.tcomment.startswith("Existing maintainer note\n")
    assert "Machine-translated via backfill_po.py" in entry.tcomment

    # Apply again — attribution must not duplicate.
    backfill_po._apply_translation(
        entry, "Hola", _item(["fr"]), model="claude-test", mark_fuzzy=True
    )
    assert entry.tcomment.count("Machine-translated via backfill_po.py") == 1


def test_apply_translation_plural_dict_response() -> None:
    """A JSON-dict response writes each plural form to msgstr_plural."""
    entry = _make_plural_entry()
    translation = json.dumps({"0": "manzana", "1": "manzanas"})
    backfill_po._apply_translation(
        entry, translation, _item(), model="claude-test", mark_fuzzy=True
    )
    assert entry.msgstr_plural == {0: "manzana", 1: "manzanas"}
    assert "fuzzy" in entry.flags


def test_apply_translation_plural_scalar_json_fills_all_forms() -> None:
    """
    A JSON-scalar response (e.g. ``"hola"``) is broadcast to every plural form.
    This is the documented fallback when the model returns a single string for
    a plural entry.
    """
    entry = _make_plural_entry()
    backfill_po._apply_translation(
        entry, '"manzana"', _item(), model="claude-test", mark_fuzzy=True
    )
    assert entry.msgstr_plural == {0: "manzana", 1: "manzana"}


def test_apply_translation_plural_invalid_json_fills_all_forms() -> None:
    """
    A non-JSON string also broadcasts to every plural form (rather than
    crashing). This handles older models that ignore the JSON instruction.
    """
    entry = _make_plural_entry()
    backfill_po._apply_translation(
        entry, "manzana", _item(), model="claude-test", mark_fuzzy=True
    )
    assert entry.msgstr_plural == {0: "manzana", 1: "manzana"}


def test_apply_translation_plural_round_trip_from_parse_response() -> None:
    """
    End-to-end guard: the JSON string produced by parse_response for a plural
    entry must be consumable by _apply_translation without losing forms. This
    is the regression that #39448 fixed (str(dict) → Python repr broke the
    round-trip).
    """
    raw = '{"0": {"0": "manzana", "1": "manzanas"}}'
    parsed = backfill_po.parse_response(raw, batch_size=1)
    entry = _make_plural_entry()
    backfill_po._apply_translation(
        entry, parsed[0], _item(), model="claude-test", mark_fuzzy=True
    )
    assert entry.msgstr_plural == {0: "manzana", 1: "manzanas"}


def test_apply_translation_plural_list_response() -> None:
    """
    Models sometimes return a JSON array for plural forms (forms are ordered,
    so a list is a valid representation). Each element must map to the
    corresponding plural index. Without this branch, ``str(list)`` would emit
    Python list-repr and broadcast it to every form — observed in the wild
    on a fresh run for French.
    """
    entry = _make_plural_entry()
    translation = json.dumps(["manzana", "manzanas"])
    backfill_po._apply_translation(
        entry, translation, _item(), model="claude-test", mark_fuzzy=True
    )
    assert entry.msgstr_plural == {0: "manzana", 1: "manzanas"}


def test_apply_translation_plural_list_round_trip_from_parse_response() -> None:
    """
    The list-of-forms response must also survive parse_response → _apply
    round-trip. parse_response JSON-serializes lists; _apply_translation
    must json.loads them back into a list and distribute across forms.
    """
    raw = '{"0": ["manzana", "manzanas"]}'
    parsed = backfill_po.parse_response(raw, batch_size=1)
    entry = _make_plural_entry()
    backfill_po._apply_translation(
        entry, parsed[0], _item(), model="claude-test", mark_fuzzy=True
    )
    assert entry.msgstr_plural == {0: "manzana", 1: "manzanas"}


def test_apply_translation_plural_list_shorter_repeats_last_form() -> None:
    """
    If the model returns fewer forms than the language requires, repeat the
    last form rather than leaving slots empty (which would render as the
    literal English msgid via gettext fallback).
    """
    entry = polib.POEntry(msgid="apple", msgid_plural="apples")
    entry.msgstr_plural = {0: "", 1: "", 2: ""}
    backfill_po._apply_translation(
        entry,
        json.dumps(["uno", "dos"]),
        _item(),
        model="claude-test",
        mark_fuzzy=True,
    )
    assert entry.msgstr_plural == {0: "uno", 1: "dos", 2: "dos"}


def test_apply_translation_plural_empty_list_falls_back_to_string_broadcast() -> None:
    """An empty JSON list isn't usable; fall back to writing the raw string."""
    entry = _make_plural_entry()
    backfill_po._apply_translation(
        entry, "[]", _item(), model="claude-test", mark_fuzzy=True
    )
    # "[]" parses cleanly to an empty list, so the JSON branch matches but the
    # list-handling fork sees a falsy value and falls through to scalar
    # broadcast — the raw "[]" string ends up filling every plural slot.
    assert entry.msgstr_plural == {0: "[]", 1: "[]"}


def test_build_prompt_includes_plural_note_when_plural_is_not_first() -> None:
    """
    Regression: batches mix singular and plural entries in .po file order. If
    the plural-form guidance only fires when the first entry is plural, any
    batch where the plural lives after a singular would lose the guidance and
    the model would silently produce malformed plural responses.
    """
    batch = [
        {"msgid": "Save", "msgstr": "", "index_key": "Save"},
        {
            "msgid": "%(num)d row",
            "msgid_plural": "%(num)d rows",
            "msgstr_plural": {0: "", 1: ""},
            "index_key": "%(num)d row\x00%(num)d rows",
        },
    ]
    prompt = backfill_po.build_prompt("fr", batch, index={})
    assert "provide ALL plural forms" in prompt


# ---------------------------------------------------------------------------
# _ensure_license_header
# ---------------------------------------------------------------------------


def test_ensure_license_header_prepends_when_missing(tmp_path: Path) -> None:
    """Header is written when the file lacks the ASF copyright notice."""
    po = tmp_path / "messages.po"
    po.write_text('msgid ""\nmsgstr ""\n', encoding="utf-8")
    backfill_po._ensure_license_header(po)
    content = po.read_text(encoding="utf-8")
    assert "Licensed to the Apache Software Foundation" in content
    assert content.startswith("#")


def test_ensure_license_header_skips_when_present(tmp_path: Path) -> None:
    """Header is not duplicated when already present."""
    po = tmp_path / "messages.po"
    original = '# Licensed to the Apache Software Foundation\nmsgid ""\n'
    po.write_text(original, encoding="utf-8")
    backfill_po._ensure_license_header(po)
    assert po.read_text(encoding="utf-8") == original


def test_ensure_license_header_dry_run_does_not_write(tmp_path: Path) -> None:
    """Passing dry_run=True prints a notice but leaves the file unchanged."""
    po = tmp_path / "messages.po"
    original = 'msgid ""\nmsgstr ""\n'
    po.write_text(original, encoding="utf-8")
    backfill_po._ensure_license_header(po, dry_run=True)
    assert po.read_text(encoding="utf-8") == original


# --- _resilient_translate: batch bisection + plain-text fallback ---------------
#
# A source string containing a literal double-quote can make the model emit
# unescaped quotes, so the batch's JSON response fails to parse and the whole
# batch is lost. _resilient_translate isolates such entries by bisecting the
# batch and falls back to a plain-text prompt for a lone offender. The stub
# below simulates that failure mode: any batch containing a quoted msgid raises
# ValueError (as parse_response would), everything else maps positionally.


def _qitem(msgid: str) -> dict[str, str]:
    return {"msgid": msgid, "index_key": msgid}


def _fake_translate_batch(
    model: str,
    target_lang: str,
    batch: list[dict[str, str]],
    index: dict[str, object],
) -> dict[int, str]:
    if any('"' in it["msgid"] for it in batch):
        raise ValueError("simulated unparseable JSON")
    return {i: f"T:{it['msgid']}" for i, it in enumerate(batch)}


def test_resilient_translate_passthrough_when_batch_parses(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A cleanly-parsing batch is returned as-is, without bisection."""
    monkeypatch.setattr(backfill_po, "translate_batch", _fake_translate_batch)
    result = backfill_po._resilient_translate(
        "m", "fr", [_qitem("Alpha"), _qitem("Beta")], {}
    )
    assert result == {0: "T:Alpha", 1: "T:Beta"}


def test_resilient_translate_bisects_and_falls_back_on_poison(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The quote-bearing entry is isolated and filled via plain-text fallback,
    while every other entry keeps its original batch position."""
    monkeypatch.setattr(backfill_po, "translate_batch", _fake_translate_batch)
    monkeypatch.setattr(
        backfill_po,
        "_translate_single_plaintext",
        lambda model, lang, item, index: f"PT:{item['msgid']}",
    )
    batch = [_qitem("Alpha"), _qitem("Beta"), _qitem('Has "quote"'), _qitem("Delta")]
    result = backfill_po._resilient_translate("m", "fr", batch, {})
    assert result == {
        0: "T:Alpha",
        1: "T:Beta",
        2: 'PT:Has "quote"',
        3: "T:Delta",
    }


def test_resilient_translate_drops_entry_when_fallback_returns_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A lone entry that even the plain-text fallback can't render is dropped
    (absent key) rather than sinking the surviving entries."""
    monkeypatch.setattr(backfill_po, "translate_batch", _fake_translate_batch)
    monkeypatch.setattr(
        backfill_po,
        "_translate_single_plaintext",
        lambda model, lang, item, index: None,
    )
    result = backfill_po._resilient_translate(
        "m", "fr", [_qitem("Alpha"), _qitem('Bad "one"')], {}
    )
    assert result == {0: "T:Alpha"}


def test_resilient_translate_propagates_runtime_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A CLI failure (RuntimeError) is not a content problem, so it propagates
    to the caller's per-batch handler instead of triggering a bisect."""

    def _boom(
        model: str,
        target_lang: str,
        batch: list[dict[str, str]],
        index: dict[str, object],
    ) -> dict[int, str]:
        raise RuntimeError("claude CLI exploded")

    monkeypatch.setattr(backfill_po, "translate_batch", _boom)
    with pytest.raises(RuntimeError):
        backfill_po._resilient_translate("m", "fr", [_qitem("Alpha")], {})


# --- _is_do_not_translate: never machine-fill literal tokens -------------------


def test_is_do_not_translate_registry_msgid() -> None:
    """A msgid in the do-not-translate registry is protected (icon names,
    enum values, SQL keywords, API field names, placeholders)."""
    for msgid in ("bolt", "error_message", "step-after", "GROUP BY"):
        assert backfill_po._is_do_not_translate(polib.POEntry(msgid=msgid, msgstr=""))


def test_load_do_not_translate_strips_whitespace(tmp_path: Path) -> None:
    """Registry lines are stripped before the blank/comment checks (matching
    apply_do_not_translate.py), so trailing spaces or indented comments never
    yield msgids that fail to match catalog entries."""
    registry = tmp_path / "do-not-translate.txt"
    registry.write_text(
        "error_message \n  # indented comment\n\t\nbolt\n", encoding="utf-8"
    )
    assert backfill_po._load_do_not_translate(registry) == frozenset(
        {"error_message", "bolt"}
    )


def test_is_do_not_translate_honors_extracted_marker() -> None:
    """The standardized `#. do-not-translate` extracted comment
    (propagated from the .pot) is honored even for a msgid not in the registry."""
    entry = polib.POEntry(msgid="not-in-registry-token", msgstr="")
    entry.comment = "do-not-translate"  # polib .comment == `#.`
    assert backfill_po._is_do_not_translate(entry)


def test_is_do_not_translate_honors_translator_comment() -> None:
    """An explicit do-not-translate translator comment is honored, in any
    language (e.g. the ru catalog's Cyrillic marker) and phrasing."""
    for comment in ("Не переводить", "do not translate", "DO-NOT-TRANSLATE"):
        entry = polib.POEntry(msgid="Some label", msgstr="")
        entry.tcomment = comment
        assert backfill_po._is_do_not_translate(entry)


def test_is_do_not_translate_allows_normal_entry() -> None:
    """An ordinary translatable string is not flagged."""
    entry = polib.POEntry(msgid="Save dashboard", msgstr="")
    entry.tcomment = "Machine-translated via backfill_po.py (claude-x) [no refs]"
    assert not backfill_po._is_do_not_translate(entry)


def test_backfill_skips_do_not_translate_entries_end_to_end(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """End-to-end: ``backfill`` must never hand a do-not-translate entry to the
    translator, and must leave it untranslated in the written .po, while normal
    entries are filled. Guards against the filter being applied at the wrong
    stage or dropped entirely."""
    lang = "es"
    po_dir = tmp_path / lang / "LC_MESSAGES"
    po_dir.mkdir(parents=True)
    po_path = po_dir / "messages.po"
    # One curated DNT msgid, one translator-marked DNT entry, one normal entry.
    po_path.write_text(
        'msgid ""\nmsgstr ""\n\n'
        'msgid "bolt"\nmsgstr ""\n\n'
        '# Не переводить\nmsgid "Keep me literal"\nmsgstr ""\n\n'
        'msgid "Save dashboard"\nmsgstr ""\n',
        encoding="utf-8",
    )
    index_path = tmp_path / "translation_index.json"
    index_path.write_text("{}", encoding="utf-8")

    monkeypatch.setattr(backfill_po, "TRANSLATIONS_DIR", tmp_path)

    seen_msgids: list[str] = []

    def _fake_translate_batch(
        model: str,
        target_lang: str,
        batch: list[dict[str, str]],
        index: dict[str, object],
    ) -> dict[int, str]:
        seen_msgids.extend(it["msgid"] for it in batch)
        return {i: f"T:{it['msgid']}" for i, it in enumerate(batch)}

    monkeypatch.setattr(backfill_po, "translate_batch", _fake_translate_batch)

    backfill_po.backfill(lang, index_path=index_path, mark_fuzzy=False)

    # DNT entries never reached the translator …
    assert "bolt" not in seen_msgids
    assert "Keep me literal" not in seen_msgids
    assert seen_msgids == ["Save dashboard"]

    # … and stay untranslated in the written file, while the normal one is filled.
    written = polib.pofile(str(po_path))
    assert written.find("bolt").msgstr == ""
    assert written.find("Keep me literal").msgstr == ""
    assert written.find("Save dashboard").msgstr == "T:Save dashboard"
