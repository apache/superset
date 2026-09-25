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
Tests for ``scripts/translations/check_pot_drift.py``.

The script is not installed as a package, so it is loaded via importlib from
its on-disk path, matching ``check_translation_regression_test.py``.
"""

import importlib.util
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

_SCRIPT_PATH = (
    Path(__file__).resolve().parents[4]
    / "scripts"
    / "translations"
    / "check_pot_drift.py"
)
_spec = importlib.util.spec_from_file_location("check_pot_drift", _SCRIPT_PATH)
assert _spec is not None, f"Could not load {_SCRIPT_PATH}"
assert _spec.loader is not None, f"No loader on spec for {_SCRIPT_PATH}"
check_pot_drift = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(check_pot_drift)


def _pot(*msgids: str) -> str:
    header = 'msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"\n\n'
    entries = "\n".join(f'msgid "{msgid}"\nmsgstr ""\n' for msgid in msgids)
    return header + entries


def _fake_extract(fresh_msgids: tuple[str, ...]):
    def run(args: list[str], **_kwargs: object) -> MagicMock:
        output_path = Path(args[args.index("-o") + 1])
        output_path.write_text(_pot(*fresh_msgids), encoding="utf-8")
        return MagicMock(returncode=0)

    return run


def test_diff_reports_missing_and_stale(tmp_path: Path) -> None:
    committed = tmp_path / "messages.pot"
    committed.write_text(_pot("Kept", "Removed from source"), encoding="utf-8")

    with patch.object(
        check_pot_drift.subprocess,
        "run",
        side_effect=_fake_extract(("Kept", "New in source")),
    ):
        missing, stale = check_pot_drift.diff(committed)

    assert missing == {"New in source"}
    assert stale == {"Removed from source"}


def test_diff_is_empty_when_in_sync(tmp_path: Path) -> None:
    committed = tmp_path / "messages.pot"
    committed.write_text(_pot("A", "B"), encoding="utf-8")

    with patch.object(
        check_pot_drift.subprocess, "run", side_effect=_fake_extract(("A", "B"))
    ):
        missing, stale = check_pot_drift.diff(committed)

    assert missing == set()
    assert stale == set()


def test_diff_ignores_line_wrapping(tmp_path: Path) -> None:
    # pybabel wraps a long msgid across continuation lines. Those concatenate
    # back to the exact original, so a wrapped and an unwrapped copy of the
    # same message are not drift.
    committed = tmp_path / "messages.pot"
    committed.write_text(
        'msgid ""\nmsgstr ""\n\nmsgid ""\n"A long "\n"wrapped string"\nmsgstr ""\n',
        encoding="utf-8",
    )

    with patch.object(
        check_pot_drift.subprocess,
        "run",
        side_effect=_fake_extract(("A long wrapped string",)),
    ):
        missing, stale = check_pot_drift.diff(committed)

    assert missing == set()
    assert stale == set()


def test_diff_reports_a_whitespace_only_reword(tmp_path: Path) -> None:
    # gettext lookups are exact, so collapsing a double space in source makes
    # the committed msgid unreachable at runtime just as surely as a full
    # reword does. It must be reported, not normalized away.
    committed = tmp_path / "messages.pot"
    committed.write_text(_pot("Save  chart"), encoding="utf-8")

    with patch.object(
        check_pot_drift.subprocess, "run", side_effect=_fake_extract(("Save chart",))
    ):
        missing, stale = check_pot_drift.diff(committed)

    assert missing == {"Save chart"}
    assert stale == {"Save  chart"}


def test_main_exits_zero_when_in_sync(capsys: pytest.CaptureFixture[str]) -> None:
    with patch.object(check_pot_drift, "diff", return_value=(set(), set())):
        assert check_pot_drift.main() == 0

    assert "matches a fresh extraction" in capsys.readouterr().out


def test_main_exits_one_and_lists_drift_when_out_of_sync(
    capsys: pytest.CaptureFixture[str],
) -> None:
    with patch.object(
        check_pot_drift, "diff", return_value=({"Missing one"}, {"Stale one"})
    ):
        assert check_pot_drift.main() == 1

    out = capsys.readouterr().out
    assert "'Missing one'" in out
    assert "'Stale one'" in out
    assert "babel_update.sh" in out


def test_committed_template_matches_a_fresh_extraction() -> None:
    """The actual regression test: source and the committed template agree.

    This is the check this module exists to add. It shells out to the real
    ``pybabel extract`` (no mocking) against this checkout's own source tree
    and committed ``superset/translations/messages.pot`` — the same
    reproduction the reported issue used. It is the RED/GREEN gate for the
    bug this module fixes: RED before the template is regenerated, GREEN
    after.
    """
    missing, stale = check_pot_drift.diff()
    assert not missing, f"{len(missing)} string(s) in source missing from messages.pot"
    assert not stale, f"{len(stale)} string(s) in messages.pot no longer in source"
