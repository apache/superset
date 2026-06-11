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
"""Tests for ``scripts/translations/build_translation_index.py``.

The script is not installed as a package, so it is loaded via importlib
from its filesystem path. The units exercised here pin the cross-language
index shape that the AI backfill prompt depends on: fuzzy entries must be
excluded (so unreviewed drafts don't feed back as trusted context), every
entry must have a slot for every language (null when missing), and plural
entries must be keyed by the ``msgid\\x00msgid_plural`` composite.
"""

import importlib.util
from pathlib import Path

import polib  # type: ignore[import-untyped]
import pytest

_SCRIPT_PATH = (
    Path(__file__).resolve().parents[4]
    / "scripts"
    / "translations"
    / "build_translation_index.py"
)
_spec = importlib.util.spec_from_file_location("build_translation_index", _SCRIPT_PATH)
assert _spec is not None, f"Could not load {_SCRIPT_PATH}"
assert _spec.loader is not None, f"No loader on spec for {_SCRIPT_PATH}"
build_translation_index = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(build_translation_index)


# ---------------------------------------------------------------------------
# _is_translated
# ---------------------------------------------------------------------------


def test_is_translated_empty_singular() -> None:
    entry = polib.POEntry(msgid="Hello", msgstr="")
    assert build_translation_index._is_translated(entry) is False


def test_is_translated_populated_singular() -> None:
    entry = polib.POEntry(msgid="Hello", msgstr="Hola")
    assert build_translation_index._is_translated(entry) is True


def test_is_translated_fuzzy_entry_is_not_trusted() -> None:
    """
    Fuzzy entries are unreviewed (often AI-generated drafts). They must not
    count as translated, or backfill runs will feed their own prior output
    back into the prompt as trusted context.
    """
    entry = polib.POEntry(msgid="Hello", msgstr="Hola", flags=["fuzzy"])
    assert build_translation_index._is_translated(entry) is False


def test_is_translated_plural_any_form_counts() -> None:
    entry = polib.POEntry(msgid="apple", msgid_plural="apples")
    entry.msgstr_plural = {0: "manzana", 1: ""}
    assert build_translation_index._is_translated(entry) is True


def test_is_translated_plural_all_empty() -> None:
    entry = polib.POEntry(msgid="apple", msgid_plural="apples")
    entry.msgstr_plural = {0: "", 1: ""}
    assert build_translation_index._is_translated(entry) is False


def test_is_translated_plural_fuzzy_is_not_trusted() -> None:
    entry = polib.POEntry(msgid="apple", msgid_plural="apples", flags=["fuzzy"])
    entry.msgstr_plural = {0: "manzana", 1: "manzanas"}
    assert build_translation_index._is_translated(entry) is False


# ---------------------------------------------------------------------------
# _plural_key
# ---------------------------------------------------------------------------


def test_plural_key_uses_null_byte_separator() -> None:
    """The composite key must use \\x00 so it cannot collide with any msgid."""
    entry = polib.POEntry(msgid="apple", msgid_plural="apples")
    assert build_translation_index._plural_key(entry) == "apple\x00apples"


# ---------------------------------------------------------------------------
# build_index
# ---------------------------------------------------------------------------


def _write_po(path: Path, entries: list[polib.POEntry]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    po = polib.POFile()
    po.metadata = {
        "Content-Type": "text/plain; charset=UTF-8",
        "Content-Transfer-Encoding": "8bit",
    }
    for entry in entries:
        po.append(entry)
    po.save(str(path))


@pytest.fixture
def translations_dir(tmp_path: Path) -> Path:
    """
    Build a minimal translations directory with three languages:
    - es: has "Hello" translated, "World" missing, plural translated
    - fr: has "Hello" fuzzy (must be treated as missing), "World" translated
    - en: source locale — must be excluded from the index
    """
    root = tmp_path / "translations"

    _write_po(
        root / "es" / "LC_MESSAGES" / "messages.po",
        [
            polib.POEntry(msgid="Hello", msgstr="Hola"),
            polib.POEntry(msgid="World", msgstr=""),
            _plural_entry("apple", "apples", {0: "manzana", 1: "manzanas"}),
        ],
    )
    _write_po(
        root / "fr" / "LC_MESSAGES" / "messages.po",
        [
            polib.POEntry(msgid="Hello", msgstr="Bonjour", flags=["fuzzy"]),
            polib.POEntry(msgid="World", msgstr="Monde"),
            _plural_entry("apple", "apples", {0: "", 1: ""}),
        ],
    )
    _write_po(
        root / "en" / "LC_MESSAGES" / "messages.po",
        [polib.POEntry(msgid="Hello", msgstr="")],
    )

    return root


def _plural_entry(
    msgid: str, msgid_plural: str, plurals: dict[int, str]
) -> polib.POEntry:
    entry = polib.POEntry(msgid=msgid, msgid_plural=msgid_plural)
    entry.msgstr_plural = plurals
    return entry


def test_build_index_excludes_en(translations_dir: Path) -> None:
    """``en`` is the source locale and must never appear in the index."""
    index = build_translation_index.build_index(translations_dir)
    for value in index.values():
        assert "en" not in value


def test_build_index_records_singular_translations(translations_dir: Path) -> None:
    index = build_translation_index.build_index(translations_dir)
    assert index["Hello"]["es"] == "Hola"
    assert index["World"]["fr"] == "Monde"


def test_build_index_fuzzy_entries_become_null(translations_dir: Path) -> None:
    """
    Fuzzy translations must surface as null. If they leaked through as text,
    they would (a) feed unreviewed AI output back into the backfill prompt
    as trusted context, and (b) inflate the --min-context count past the
    threshold of real reviewed translations.
    """
    index = build_translation_index.build_index(translations_dir)
    assert index["Hello"]["fr"] is None


def test_build_index_missing_translations_become_null(
    translations_dir: Path,
) -> None:
    """Empty msgstr → null (not empty string)."""
    index = build_translation_index.build_index(translations_dir)
    assert index["World"]["es"] is None


def test_build_index_fills_every_language_slot(translations_dir: Path) -> None:
    """
    Every msgid must have a slot for every non-en language, even if that
    language's .po file did not contain the entry. Defaults to null.
    """
    index = build_translation_index.build_index(translations_dir)
    expected_langs = {"es", "fr"}
    for key, value in index.items():
        assert set(value.keys()) == expected_langs, (
            f"{key!r} missing language slots: {set(value.keys())}"
        )


def test_build_index_plural_uses_composite_key(translations_dir: Path) -> None:
    """Plural entries must be keyed by ``msgid\\x00msgid_plural``."""
    index = build_translation_index.build_index(translations_dir)
    assert "apple\x00apples" in index
    assert "apple" not in index  # not stored under bare msgid


def test_build_index_plural_translated_stored_as_dict(
    translations_dir: Path,
) -> None:
    index = build_translation_index.build_index(translations_dir)
    plural = index["apple\x00apples"]
    assert plural["es"] == {0: "manzana", 1: "manzanas"}


def test_build_index_plural_untranslated_stored_as_null(
    translations_dir: Path,
) -> None:
    """Empty plural forms across the board → null, not an empty dict."""
    index = build_translation_index.build_index(translations_dir)
    plural = index["apple\x00apples"]
    assert plural["fr"] is None


def test_build_index_skips_languages_without_messages_po(tmp_path: Path) -> None:
    """
    A subdirectory that doesn't contain ``LC_MESSAGES/messages.po`` (e.g.
    leftover scratch dirs, dotfiles) must not be picked up as a language.
    """
    root = tmp_path / "translations"
    _write_po(
        root / "es" / "LC_MESSAGES" / "messages.po",
        [polib.POEntry(msgid="Hello", msgstr="Hola")],
    )
    (root / "scratch").mkdir()  # no LC_MESSAGES/messages.po
    (root / ".DS_Store").touch()

    index = build_translation_index.build_index(root)
    assert index == {"Hello": {"es": "Hola"}}


def test_build_index_skips_header_entry(tmp_path: Path) -> None:
    """
    The .po header entry has an empty msgid by convention. It must not be
    included as a translation key.
    """
    root = tmp_path / "translations"
    _write_po(
        root / "es" / "LC_MESSAGES" / "messages.po",
        [polib.POEntry(msgid="Hello", msgstr="Hola")],
    )
    index = build_translation_index.build_index(root)
    assert "" not in index
