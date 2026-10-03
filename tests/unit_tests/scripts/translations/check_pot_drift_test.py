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
import io
import shlex
import subprocess
from collections.abc import Callable
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from babel.messages.pofile import read_po

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


_HEADER = 'msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"\n\n'


def _pot(*msgids: str) -> str:
    entries = "\n".join(f'msgid "{msgid}"\nmsgstr ""\n' for msgid in msgids)
    return _HEADER + entries


def _fake_extract_text(pot_text: str) -> Callable[..., MagicMock]:
    """Stand-in for ``pybabel extract`` that writes ``pot_text`` to its ``-o`` path."""

    def run(args: list[str], **_kwargs: object) -> MagicMock:
        Path(args[args.index("-o") + 1]).write_text(pot_text, encoding="utf-8")
        return MagicMock(returncode=0)

    return run


def _fake_extract(fresh_msgids: tuple[str, ...]) -> Callable[..., MagicMock]:
    """Stand-in for ``pybabel extract`` whose template holds ``fresh_msgids``."""
    return _fake_extract_text(_pot(*fresh_msgids))


def test_diff_reports_missing_and_stale(tmp_path: Path) -> None:
    committed = tmp_path / "messages.pot"
    committed.write_text(_pot("Kept", "Removed from source"), encoding="utf-8")

    with patch.object(
        check_pot_drift.subprocess,
        "run",
        side_effect=_fake_extract(("Kept", "New in source")),
    ):
        missing, stale, _ = check_pot_drift.diff(committed)

    assert missing == {"New in source"}
    assert stale == {"Removed from source"}


def test_diff_is_empty_when_in_sync(tmp_path: Path) -> None:
    committed = tmp_path / "messages.pot"
    committed.write_text(_pot("A", "B"), encoding="utf-8")

    with patch.object(
        check_pot_drift.subprocess, "run", side_effect=_fake_extract(("A", "B"))
    ):
        missing, stale, _ = check_pot_drift.diff(committed)

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
        missing, stale, _ = check_pot_drift.diff(committed)

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
        missing, stale, _ = check_pot_drift.diff(committed)

    assert missing == {"Save chart"}
    assert stale == {"Save  chart"}


def test_main_exits_zero_when_in_sync(capsys: pytest.CaptureFixture[str]) -> None:
    with patch.object(
        check_pot_drift, "diff", return_value=check_pot_drift.Drift(set(), set(), set())
    ):
        assert check_pot_drift.main() == 0

    assert "matches a fresh extraction" in capsys.readouterr().out


def test_main_exits_one_and_lists_drift_when_out_of_sync(
    capsys: pytest.CaptureFixture[str],
) -> None:
    with patch.object(
        check_pot_drift,
        "diff",
        return_value=check_pot_drift.Drift({"Missing one"}, {"Stale one"}, set()),
    ):
        assert check_pot_drift.main() == 1

    out = capsys.readouterr().out
    assert "'Missing one'" in out
    assert "'Stale one'" in out
    assert "babel_update.sh" in out


def _context_drift(tmp_path: Path, committed_text: str, fresh_text: str) -> set[str]:
    """Run ``diff`` on two templates with the same msgids; return comment drift."""
    committed = tmp_path / "messages.pot"
    committed.write_text(_HEADER + committed_text, encoding="utf-8")
    with patch.object(
        check_pot_drift.subprocess,
        "run",
        side_effect=_fake_extract_text(_HEADER + fresh_text),
    ):
        result = check_pot_drift.diff(committed)
    assert result.missing == set()
    assert result.stale == set()
    return result.context_changed


def test_diff_reports_a_reworded_i18n_comment(tmp_path: Path) -> None:
    """Rewording an ``i18n:`` comment is drift even when the msgid is unchanged."""
    changed = _context_drift(
        tmp_path,
        '#. i18n: a URL identifier\nmsgid "Slug"\nmsgstr ""\n',
        "#. i18n: the short identifier in a URL, not the animal\n"
        'msgid "Slug"\nmsgstr ""\n',
    )
    assert changed == {"Slug"}


def test_diff_reports_an_added_and_a_removed_i18n_comment(tmp_path: Path) -> None:
    """A comment that appears in source, or disappears from it, is drift."""
    changed = _context_drift(
        tmp_path,
        'msgid "Host"\nmsgstr ""\n\n#. i18n: old context\nmsgid "Slug"\nmsgstr ""\n',
        '#. i18n: the database server\nmsgid "Host"\nmsgstr ""\n\n'
        'msgid "Slug"\nmsgstr ""\n',
    )
    assert changed == {"Host", "Slug"}


def test_diff_ignores_rewrapping_an_i18n_comment(tmp_path: Path) -> None:
    """Comments compare word by word, so a different line wrap is not drift."""
    changed = _context_drift(
        tmp_path,
        "#. i18n: the database engine behind a connection,\n"
        '#. not a server tier\nmsgid "Backend"\nmsgstr ""\n',
        "#. i18n: the database engine behind a connection, not a server tier\n"
        'msgid "Backend"\nmsgstr ""\n',
    )
    assert changed == set()


def test_diff_ignores_the_stamped_do_not_translate_marker(tmp_path: Path) -> None:
    """The ``do-not-translate`` marker is excluded from the comparison.

    babel_update.sh stamps the marker after extraction, so the committed
    template carries it and a fresh extraction never does.
    """
    changed = _context_drift(
        tmp_path,
        '#. do-not-translate\nmsgid "XLSX"\nmsgstr ""\n\n'
        '#. i18n: kept\n#. do-not-translate\nmsgid "SQL"\nmsgstr ""\n',
        'msgid "XLSX"\nmsgstr ""\n\n#. i18n: kept\nmsgid "SQL"\nmsgstr ""\n',
    )
    assert changed == set()


def test_stamped_comments_match_apply_do_not_translate_marker() -> None:
    """``STAMPED_COMMENTS`` stays in step with the marker the stamping script writes."""
    path = _SCRIPT_PATH.parent / "apply_do_not_translate.py"
    spec = importlib.util.spec_from_file_location("apply_do_not_translate", path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert {module.MARKER} == check_pot_drift.STAMPED_COMMENTS


def test_main_exits_one_and_lists_changed_i18n_comments(
    capsys: pytest.CaptureFixture[str],
) -> None:
    """``main`` fails on comment drift alone and lists the strings with ``~``."""
    with patch.object(
        check_pot_drift,
        "diff",
        return_value=check_pot_drift.Drift(set(), set(), {"Slug"}),
    ):
        assert check_pot_drift.main() == 1

    out = capsys.readouterr().out
    assert "1 string(s) have changed i18n: comments" in out
    assert "  ~ 'Slug'" in out


class _FakeArchiveProcess:
    """Minimal stand-in for the ``git archive`` ``Popen`` object."""

    def __init__(self, stdout: bytes, stderr: bytes, returncode: int) -> None:
        self.stdout = io.BytesIO(stdout)
        self.args = ["git", "archive", "HEAD"]
        self.returncode = returncode
        self._stderr = stderr

    def communicate(self) -> tuple[bytes, bytes]:
        return b"", self._stderr


def test_archive_ref_raises_called_process_error_with_stderr_on_stash_failure() -> None:
    fake_stderr = "fatal: not a git repository\n"
    fake_process = MagicMock()
    fake_process.communicate.return_value = ("", fake_stderr)
    fake_process.returncode = 1
    fake_process.args = ["git", "stash", "create"]

    with patch.object(check_pot_drift.subprocess, "Popen", return_value=fake_process):
        with pytest.raises(subprocess.CalledProcessError) as exc_info:
            check_pot_drift._archive_ref()

    assert exc_info.value.stderr == fake_stderr


def test_extract_fresh_raises_called_process_error_with_stderr_on_archive_failure(
    tmp_path: Path,
) -> None:
    # A truncated/empty tar stream makes `tarfile` raise its own `ReadError`
    # before `extract_fresh` gets a chance to look at git's exit code; the
    # fix must surface git's stderr via `CalledProcessError` instead.
    fake_stderr = b"fatal: your current branch does not have any commits yet\n"
    fake_process = _FakeArchiveProcess(stdout=b"", stderr=fake_stderr, returncode=128)

    with (
        patch.object(check_pot_drift, "_archive_ref", return_value="HEAD"),
        patch.object(check_pot_drift.subprocess, "Popen", return_value=fake_process),
    ):
        with pytest.raises(subprocess.CalledProcessError) as exc_info:
            check_pot_drift.extract_fresh(tmp_path / "fresh.pot")

    assert exc_info.value.stderr == fake_stderr


def test_extract_fresh_raises_runtime_error_when_archive_has_no_stdout_pipe(
    tmp_path: Path,
) -> None:
    fake_process = MagicMock(stdout=None)

    with (
        patch.object(check_pot_drift, "_archive_ref", return_value="HEAD"),
        patch.object(check_pot_drift.subprocess, "Popen", return_value=fake_process),
    ):
        with pytest.raises(RuntimeError, match="stdout"):
            check_pot_drift.extract_fresh(tmp_path / "fresh.pot")


def test_extract_fresh_passes_an_absolute_output_path_to_pybabel(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # `cwd` for the `pybabel extract` call is the temp snapshot directory, not
    # the caller's cwd, so a relative `output_path` must be resolved before
    # being passed on the command line.
    monkeypatch.chdir(tmp_path)
    captured_args: list[str] = []

    def fake_run(args: list[str], **_kwargs: object) -> MagicMock:
        captured_args.extend(args)
        return MagicMock(returncode=0)

    with patch.object(check_pot_drift.subprocess, "run", side_effect=fake_run):
        check_pot_drift.extract_fresh(Path("fresh.pot"))

    output_arg = captured_args[captured_args.index("-o") + 1]
    assert Path(output_arg).is_absolute()
    assert output_arg == str((tmp_path / "fresh.pot").resolve())


def test_committed_template_matches_a_fresh_extraction() -> None:
    """The actual regression test: source and the committed template agree.

    This is the check this module exists to add. It shells out to the real
    ``pybabel extract`` (no mocking) against this checkout's own source tree
    and committed ``superset/translations/messages.pot`` — the same
    reproduction the reported issue used. It is the RED/GREEN gate for the
    bug this module fixes: RED before the template is regenerated, GREEN
    after.
    """
    missing, stale, context_changed = check_pot_drift.diff()
    assert not missing, f"{len(missing)} string(s) in source missing from messages.pot"
    assert not stale, f"{len(stale)} string(s) in messages.pot no longer in source"
    assert not context_changed, (
        f"{len(context_changed)} string(s) in messages.pot carry out-of-date i18n: "
        f"comments: {sorted(context_changed, key=str)}"
    )


def test_extract_flags_match_babel_update_sh() -> None:
    """``EXTRACT_FLAGS`` mirrors the ``pybabel extract`` call in babel_update.sh.

    Only ``-F`` and ``-o`` differ, since the drift check writes to a temporary
    path. Any other flag added to one invocation and not the other fails here.
    """
    script = (_SCRIPT_PATH.parent / "babel_update.sh").read_text(encoding="utf-8")
    command = script[script.index("\npybabel extract") :]
    command = command[: command.index(" .\n") + 2].replace("\\\n", " ")
    args = shlex.split(command)[2:]
    for flag in ("-F", "-o"):
        del args[args.index(flag) : args.index(flag) + 2]
    assert args == check_pot_drift.EXTRACT_FLAGS


def test_extraction_carries_i18n_comments_to_the_template(tmp_path: Path) -> None:
    """An ``i18n:`` comment above a string lands on its template entry.

    Runs the real ``pybabel extract`` with ``EXTRACT_FLAGS`` (which
    ``test_extract_flags_match_babel_update_sh`` ties to babel_update.sh) over
    a Python and a TypeScript source. Dropping ``--add-comments=i18n:`` from
    both invocations passes the flag-parity and msgid-only drift checks, but
    fails here. Untagged comments must stay out of the template.
    """
    (tmp_path / "babel.cfg").write_text(
        "[python: **.py]\n[javascript: **.ts]\n", encoding="utf-8"
    )
    (tmp_path / "views.py").write_text(
        "# i18n: the short identifier in a dashboard's URL, not the animal\n"
        '_("Slug")\n'
        "# an ordinary code comment\n"
        '_("Owner")\n',
        encoding="utf-8",
    )
    (tmp_path / "list.ts").write_text(
        "// i18n: the database engine behind a connection\nt('Backend');\n",
        encoding="utf-8",
    )
    output = tmp_path / "messages.pot"
    subprocess.run(  # noqa: S603
        ["pybabel", "extract", "-F", "babel.cfg", "-o", str(output)]  # noqa: S607
        + check_pot_drift.EXTRACT_FLAGS,
        cwd=tmp_path,
        check=True,
        capture_output=True,
    )

    with output.open("rb") as pot:
        comments = {m.id: m.auto_comments for m in read_po(pot) if m.id}
    assert comments == {
        "Slug": ["i18n: the short identifier in a dashboard's URL, not the animal"],
        "Owner": [],
        "Backend": ["i18n: the database engine behind a connection"],
    }
