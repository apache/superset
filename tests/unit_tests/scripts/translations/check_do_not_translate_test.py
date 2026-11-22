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
Tests for ``scripts/translations/check_do_not_translate.py``.

The script is not installed as a package, so it is loaded via importlib from
its on-disk path, matching ``check_pot_drift_test.py``.

What these pin down is the one comparison the check turns on: a registered
msgid is clean only when its ``msgstr`` is *exactly* empty, because that is the
only value gettext answers with the source token. Trimming before comparing
would let `" DELETE "` and `"   "` through, and both of those render instead of
the token the app reads back.
"""

import importlib.util
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

_SCRIPT_PATH = (
    Path(__file__).resolve().parents[4]
    / "scripts"
    / "translations"
    / "check_do_not_translate.py"
)
_spec = importlib.util.spec_from_file_location("check_do_not_translate", _SCRIPT_PATH)
assert _spec is not None, f"Could not load {_SCRIPT_PATH}"
assert _spec.loader is not None, f"No loader on spec for {_SCRIPT_PATH}"
check_do_not_translate = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(check_do_not_translate)


_HEADER = 'msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"\n\n'

_REGISTRY = "# a comment, and a blank line below\n\nDELETE\nbolt\ncrontab\n"


def _catalog(tmp_path: Path, body: str, lang: str = "xx") -> Path:
    """Write ``body`` as the ``lang`` catalog and return the translations dir."""
    (tmp_path / "do-not-translate.txt").write_text(_REGISTRY, encoding="utf-8")
    po_file = tmp_path / lang / "LC_MESSAGES" / "messages.po"
    po_file.parent.mkdir(parents=True, exist_ok=True)
    po_file.write_text(_HEADER + body, encoding="utf-8")
    return tmp_path


def _violations(tmp_path: Path, body: str) -> list[tuple[str, str]]:
    translations_dir = _catalog(tmp_path, body)
    return check_do_not_translate.violations(
        translations_dir / "xx" / "LC_MESSAGES" / "messages.po",
        check_do_not_translate.load_registry(translations_dir / "do-not-translate.txt"),
    )


def test_registry_skips_comments_and_blank_lines(tmp_path: Path) -> None:
    (tmp_path / "do-not-translate.txt").write_text(_REGISTRY, encoding="utf-8")
    registry = check_do_not_translate.load_registry(tmp_path / "do-not-translate.txt")
    assert registry == {"DELETE", "bolt", "crontab"}


def test_a_translated_entry_is_reported(tmp_path: Path) -> None:
    found = _violations(tmp_path, 'msgid "crontab"\nmsgstr "cron tabla"\n')
    assert found == [("crontab", "cron tabla")]


def test_a_padded_value_is_reported(tmp_path: Path) -> None:
    # " DELETE " trims down to the msgid but is not the msgid: gettext answers
    # with the padding, so the confirmation modal no longer matches the token.
    found = _violations(tmp_path, 'msgid "DELETE"\nmsgstr " DELETE "\n')
    assert found == [("DELETE", " DELETE ")]


def test_a_whitespace_only_value_is_reported(tmp_path: Path) -> None:
    # Only an exactly empty msgstr falls back to the source, so "   " renders as
    # blank space where an icon name like `bolt` is expected.
    found = _violations(tmp_path, 'msgid "bolt"\nmsgstr "   "\n')
    assert found == [("bolt", "   ")]


def test_an_empty_msgstr_is_clean(tmp_path: Path) -> None:
    assert _violations(tmp_path, 'msgid "DELETE"\nmsgstr ""\n') == []


def test_a_msgstr_identical_to_the_msgid_is_clean(tmp_path: Path) -> None:
    assert _violations(tmp_path, 'msgid "DELETE"\nmsgstr "DELETE"\n') == []


def test_an_obsolete_entry_is_ignored(tmp_path: Path) -> None:
    assert _violations(tmp_path, '#~ msgid "DELETE"\n#~ msgstr "BORRAR"\n') == []


def test_an_unregistered_msgid_is_ignored(tmp_path: Path) -> None:
    assert _violations(tmp_path, 'msgid "Dashboard"\nmsgstr "Tablero"\n') == []


def test_main_exits_one_and_names_the_offender(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    translations_dir = _catalog(tmp_path, 'msgid "DELETE"\nmsgstr " DELETE "\n')
    argv = ["check_do_not_translate.py", "--translations-dir", str(translations_dir)]
    with patch.object(sys, "argv", argv), pytest.raises(SystemExit) as exc:
        check_do_not_translate.main()
    assert exc.value.code == 1

    captured = capsys.readouterr()
    assert "xx: 1 translated do-not-translate entries" in captured.out
    assert "' DELETE '" in captured.out
    assert "do-not-translate.txt" in captured.err


def test_main_returns_cleanly_when_no_entry_is_translated(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    translations_dir = _catalog(tmp_path, 'msgid "DELETE"\nmsgstr ""\n')
    argv = ["check_do_not_translate.py", "--translations-dir", str(translations_dir)]
    with patch.object(sys, "argv", argv):
        check_do_not_translate.main()  # no SystemExit

    assert "No do-not-translate entries are translated." in capsys.readouterr().out


def test_the_english_catalog_is_skipped(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    # en is the source language, so its msgstrs are empty by convention and it
    # can hold no violation; checking it would only add noise.
    translations_dir = _catalog(tmp_path, 'msgid "DELETE"\nmsgstr "DELETE!"\n', "en")
    argv = ["check_do_not_translate.py", "--translations-dir", str(translations_dir)]
    with patch.object(sys, "argv", argv):
        check_do_not_translate.main()  # no SystemExit

    assert "No do-not-translate entries are translated." in capsys.readouterr().out
