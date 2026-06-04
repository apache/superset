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
Tests for ``scripts/translations/check_translation_regression.py``.

The script is not installed as a package, so it is loaded via importlib from
its on-disk path.
"""

import importlib.util
import json  # noqa: TID251 - testing a standalone script that uses stdlib json
from collections.abc import Mapping
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

_SCRIPT_PATH = (
    Path(__file__).resolve().parents[4]
    / "scripts"
    / "translations"
    / "check_translation_regression.py"
)
_spec = importlib.util.spec_from_file_location(
    "check_translation_regression", _SCRIPT_PATH
)
assert _spec is not None, f"Could not load {_SCRIPT_PATH}"
assert _spec.loader is not None, f"No loader on spec for {_SCRIPT_PATH}"
check_translation_regression = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(check_translation_regression)


def _compare(
    tmp_path: Path,
    before: Mapping[str, object],
    after: Mapping[str, object],
    failures: set[str] | None = None,
) -> None:
    """Run cmd_compare with a baseline file and a mocked 'after' state.

    ``failures`` simulates languages whose .po file was present but could not
    be counted; cmd_compare passes a ``failures`` set into get_counts, so the
    mock populates it (mirroring the real get_counts contract).
    """

    def fake_get_counts(
        _dir: Path, failures: set[str] | None = None
    ) -> Mapping[str, object]:
        if failures is not None and _simulated_failures:
            failures.update(_simulated_failures)
        return after

    _simulated_failures = failures or set()
    before_file = tmp_path / "before.json"
    before_file.write_text(json.dumps(before), encoding="utf-8")
    with patch.object(
        check_translation_regression, "get_counts", side_effect=fake_get_counts
    ):
        check_translation_regression.cmd_compare(str(before_file), tmp_path)


def test_deleting_a_translated_string_is_not_a_regression(tmp_path: Path) -> None:
    # Translated count drops by 1 (string removed from source) but no new
    # fuzzy is introduced -> intentional deletion, must NOT be flagged.
    before = {"fr": {"translated": 100, "fuzzy": 5}}
    after = {"fr": {"translated": 99, "fuzzy": 5}}
    _compare(tmp_path, before, after)  # no SystemExit


def test_renaming_a_string_flags_a_regression(tmp_path: Path) -> None:
    # A reworded source string strands its translation as fuzzy: translated
    # drops by 1 AND fuzzy rises by 1 -> real regression.
    before = {"fr": {"translated": 100, "fuzzy": 5}}
    after = {"fr": {"translated": 99, "fuzzy": 6}}
    with pytest.raises(SystemExit) as exc:
        _compare(tmp_path, before, after)
    assert exc.value.code == 1


def test_no_change_is_clean(tmp_path: Path) -> None:
    stats = {"fr": {"translated": 100, "fuzzy": 5}}
    _compare(tmp_path, stats, dict(stats))  # no SystemExit


def test_adding_strings_does_not_offset_a_regression(tmp_path: Path) -> None:
    # Even when the PR adds new (untranslated) strings, a fresh fuzzy elsewhere
    # is still a regression — additions must not mask it.
    before = {"de": {"translated": 200, "fuzzy": 10}}
    after = {"de": {"translated": 205, "fuzzy": 11}}
    with pytest.raises(SystemExit) as exc:
        _compare(tmp_path, before, after)
    assert exc.value.code == 1


def test_legacy_integer_baseline_is_tolerated(tmp_path: Path) -> None:
    # Older baselines stored a bare translated count with no fuzzy data.
    before = {"fr": 100}
    after = {"fr": {"translated": 90, "fuzzy": 0}}
    _compare(tmp_path, before, after)  # deletion-only, no SystemExit


def test_deleting_an_entire_catalog_is_not_a_regression(tmp_path: Path) -> None:
    # The whole `fr` catalog was intentionally removed: it is absent from
    # `after` and did NOT fail to count -> a legitimate deletion, not flagged.
    before = {"fr": {"translated": 100, "fuzzy": 5}}
    after: dict[str, object] = {}
    _compare(tmp_path, before, after)  # no SystemExit


def test_uncountable_baseline_catalog_is_a_hard_failure(tmp_path: Path) -> None:
    # `fr` still exists on disk but msgfmt could not count it (malformed .po),
    # so it is missing from `after` AND reported as a failure. This must NOT be
    # mistaken for an intentional deletion — it is a hard error.
    before = {"fr": {"translated": 100, "fuzzy": 5}}
    after: dict[str, object] = {}
    with pytest.raises(SystemExit) as exc:
        _compare(tmp_path, before, after, failures={"fr"})
    assert exc.value.code == 1


def test_uncountable_new_catalog_not_in_baseline_is_ignored(tmp_path: Path) -> None:
    # A catalog that fails to count but was not in the baseline can't be a
    # regression of a previously-good translation, so it does not fail the run.
    before = {"fr": {"translated": 100, "fuzzy": 5}}
    after = {"fr": {"translated": 100, "fuzzy": 5}}
    _compare(tmp_path, before, after, failures={"zz"})  # no SystemExit


def test_writes_report_on_regression(tmp_path: Path) -> None:
    before_file = tmp_path / "before.json"
    before_file.write_text(json.dumps({"ja": {"translated": 50, "fuzzy": 2}}))
    report = tmp_path / "report.md"
    after = {"ja": {"translated": 49, "fuzzy": 3}}
    with patch.object(check_translation_regression, "get_counts", return_value=after):
        with pytest.raises(SystemExit):
            check_translation_regression.cmd_compare(
                str(before_file), tmp_path, str(report)
            )
    body = report.read_text(encoding="utf-8")
    assert "Translation Regression Detected" in body
    assert "`ja`" in body
    # The report must make clear deletions are not flagged.
    assert "deleting" in body.lower()


def test_count_stats_parses_translated_and_fuzzy() -> None:
    stderr = (
        "3731 translated messages, 1009 fuzzy translations, 175 untranslated messages."
    )
    mock_result = MagicMock(stderr=stderr)
    with patch.object(
        check_translation_regression.subprocess, "run", return_value=mock_result
    ):
        stats = check_translation_regression.count_stats(Path("dummy.po"))
    assert stats == {"translated": 3731, "fuzzy": 1009}


def test_count_stats_defaults_fuzzy_to_zero_when_absent() -> None:
    # msgfmt omits the fuzzy clause entirely when there are none.
    mock_result = MagicMock(stderr="42 translated messages.")
    with patch.object(
        check_translation_regression.subprocess, "run", return_value=mock_result
    ):
        stats = check_translation_regression.count_stats(Path("dummy.po"))
    assert stats == {"translated": 42, "fuzzy": 0}
