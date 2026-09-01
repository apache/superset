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

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

import scripts.compile_po as compile_po


# ---------------------------------------------------------------------------
# run_command
# ---------------------------------------------------------------------------


def test_run_command_success() -> None:
    """run_command returns 0 when the process succeeds."""
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        rc = compile_po.run_command(["echo", "hello"])
        assert rc == 0


def test_run_command_failure() -> None:
    """run_command returns nonzero returncode on failure."""
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=1)
        rc = compile_po.run_command(["false"])
        assert rc == 1


def test_run_command_handles_timeout() -> None:
    """run_command returns 1 on TimeoutExpired without raising."""
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(["cmd"], 10)):
        assert compile_po.run_command(["cmd"]) == 1


def test_run_command_handles_file_not_found() -> None:
    """run_command returns 1 when the executable does not exist."""
    with patch("subprocess.run", side_effect=FileNotFoundError):
        assert compile_po.run_command(["nonexistent_command"]) == 1


def test_run_command_handles_os_error() -> None:
    """run_command returns 1 on generic OSError."""
    with patch("subprocess.run", side_effect=OSError("permission denied")):
        assert compile_po.run_command(["cmd"]) == 1


# ---------------------------------------------------------------------------
# find_command and find_node_bin
# ---------------------------------------------------------------------------


def test_find_command_found() -> None:
    """find_command returns path when binary is in PATH."""
    with patch("shutil.which", return_value="/usr/bin/npm"):
        assert compile_po.find_command(["npm"]) == "/usr/bin/npm"


def test_find_command_not_found() -> None:
    """find_command returns None when no executable matches."""
    with patch("shutil.which", return_value=None):
        assert compile_po.find_command(["nonexistent_binary"]) is None


def test_find_node_bin_finds_in_frontend_node_modules(tmp_path: Path) -> None:
    """find_node_bin locates binaries in superset-frontend/node_modules/.bin."""
    bin_dir = tmp_path / "superset-frontend" / "node_modules" / ".bin"
    bin_dir.mkdir(parents=True)
    target = bin_dir / "oxfmt"
    target.touch()

    found = compile_po.find_node_bin(str(tmp_path), "oxfmt")
    assert found is not None
    assert Path(found).resolve() == target.resolve()


def test_find_node_bin_returns_none_when_missing(tmp_path: Path) -> None:
    """find_node_bin returns None when the binary does not exist."""
    assert compile_po.find_node_bin(str(tmp_path), "oxfmt") is None


# ---------------------------------------------------------------------------
# install_npm_packages
# ---------------------------------------------------------------------------


def test_install_npm_packages_calls_npm(tmp_path: Path) -> None:
    """install_npm_packages calls npm install with the required flags."""
    with patch.object(compile_po, "run_command", return_value=0) as mock_run:
        ok = compile_po.install_npm_packages(
            "/usr/bin/npm", str(tmp_path), ["po2json", "oxfmt"]
        )
        assert ok is True
        mock_run.assert_called_once_with(
            [
                "/usr/bin/npm",
                "install",
                "--no-save",
                "--prefer-offline",
                "po2json",
                "oxfmt",
            ],
            cwd=str(tmp_path),
        )


# ---------------------------------------------------------------------------
# convert_po_file
# ---------------------------------------------------------------------------


def test_convert_po_file_success(tmp_path: Path) -> None:
    """convert_po_file constructs jed1.x command and outputs to .json."""
    po_file = tmp_path / "messages.po"
    po_file.write_text('msgid ""\nmsgstr ""\n', encoding="utf-8")

    with patch.object(compile_po, "run_command", return_value=0) as mock_run:
        ok, path, err = compile_po.convert_po_file(str(po_file), ["po2json"])
        assert ok is True
        assert path == str(po_file)
        assert err == ""
        json_dest = str(tmp_path / "messages.json")
        mock_run.assert_called_once_with(
            [
                "po2json",
                "--domain",
                "superset",
                "--format",
                "jed1.x",
                "--fuzzy",
                str(po_file),
                json_dest,
            ],
            timeout=60,
        )


def test_convert_po_file_failure(tmp_path: Path) -> None:
    """convert_po_file reports failure when po2json returns non-zero."""
    po_file = tmp_path / "messages.po"
    po_file.write_text('msgid ""\nmsgstr ""\n', encoding="utf-8")

    with patch.object(compile_po, "run_command", return_value=1):
        ok, path, err = compile_po.convert_po_file(str(po_file), ["po2json"])
        assert ok is False
        assert path == str(po_file)
        assert "po2json failed" in err


# ---------------------------------------------------------------------------
# compile_translations end-to-end flow
# ---------------------------------------------------------------------------


def test_compile_translations_missing_babel(monkeypatch: pytest.MonkeyPatch) -> None:
    """Returns 1 if babel module is not installed."""
    with patch.dict(sys.modules, {"babel": None}):
        with patch(
            "builtins.__import__", side_effect=ImportError("No module named babel")
        ):
            assert compile_po.compile_translations() == 1


def test_compile_translations_missing_node_tools() -> None:
    """Returns 1 if npm or npx is not found."""
    with (
        patch.dict(sys.modules, {"babel": MagicMock()}),
        patch.object(compile_po, "find_command", return_value=None),
    ):
        assert compile_po.compile_translations() == 1


def test_compile_translations_missing_translations_dir(tmp_path: Path) -> None:
    """Returns 1 if the translations directory does not exist."""
    with (
        patch.dict(sys.modules, {"babel": MagicMock()}),
        patch.object(compile_po, "find_command", return_value="/usr/bin/node"),
        patch(
            "os.path.isdir",
            side_effect=lambda p: False if "translations" in p else True,
        ),
    ):
        assert compile_po.compile_translations() == 1


def test_compile_translations_pybabel_failure() -> None:
    """Returns 1 if pybabel compile step fails."""
    with (
        patch.dict(sys.modules, {"babel": MagicMock()}),
        patch.object(compile_po, "find_command", return_value="/usr/bin/npm"),
        patch("os.path.isdir", return_value=True),
        patch.object(compile_po, "run_command", return_value=1),
    ):
        assert compile_po.compile_translations() == 1


def test_compile_translations_conversion_failure(tmp_path: Path) -> None:
    """Returns 1 if any .po file conversion fails."""
    po_file = tmp_path / "messages.po"
    po_file.touch()

    with (
        patch.dict(sys.modules, {"babel": MagicMock()}),
        patch.object(compile_po, "find_command", return_value="/usr/bin/npm"),
        patch("os.path.isdir", return_value=True),
        patch(
            "glob.glob",
            side_effect=lambda pattern, **kwargs: (
                [str(po_file)] if "*.po" in pattern else []
            ),
        ),
        patch.object(compile_po, "run_command", return_value=0),
        patch.object(
            compile_po,
            "convert_po_file",
            return_value=(False, str(po_file), "conversion error"),
        ),
    ):
        assert compile_po.compile_translations() == 1


def test_compile_translations_oxfmt_failure(tmp_path: Path) -> None:
    """Returns 1 if oxfmt formatting step fails."""
    po_file = tmp_path / "messages.po"
    json_file = tmp_path / "messages.json"
    po_file.touch()
    json_file.touch()

    def _run_side_effect(cmd: list[str], **kwargs: object) -> int:
        if any("oxfmt" in arg for arg in cmd):
            return 1
        return 0

    with (
        patch.dict(sys.modules, {"babel": MagicMock()}),
        patch.object(compile_po, "find_command", return_value="/usr/bin/npm"),
        patch("os.path.isdir", return_value=True),
        patch(
            "glob.glob",
            side_effect=lambda pattern, **kwargs: (
                [str(po_file)] if "*.po" in pattern else [str(json_file)]
            ),
        ),
        patch.object(compile_po, "run_command", side_effect=_run_side_effect),
        patch.object(
            compile_po, "convert_po_file", return_value=(True, str(po_file), "")
        ),
    ):
        assert compile_po.compile_translations() == 1


def test_compile_translations_success(tmp_path: Path) -> None:
    """Returns 0 on successful compilation, conversion, and oxfmt formatting."""
    po_file = tmp_path / "messages.po"
    json_file = tmp_path / "messages.json"
    po_file.touch()
    json_file.touch()

    executed_commands: list[list[str]] = []

    def _run_side_effect(cmd: list[str], **kwargs: object) -> int:
        executed_commands.append(cmd)
        return 0

    with (
        patch.dict(sys.modules, {"babel": MagicMock()}),
        patch.object(compile_po, "find_command", return_value="/usr/bin/npm"),
        patch.object(
            compile_po,
            "find_node_bin",
            return_value="/workspace/node_modules/.bin/oxfmt",
        ),
        patch("os.path.isdir", return_value=True),
        patch(
            "glob.glob",
            side_effect=lambda pattern, **kwargs: (
                [str(po_file)] if "*.po" in pattern else [str(json_file)]
            ),
        ),
        patch.object(compile_po, "run_command", side_effect=_run_side_effect),
        patch.object(
            compile_po, "convert_po_file", return_value=(True, str(po_file), "")
        ),
    ):
        rc = compile_po.compile_translations()
        assert rc == 0
        # Verify oxfmt was called with --no-ignore
        oxfmt_calls = [c for c in executed_commands if any("oxfmt" in arg for arg in c)]
        assert len(oxfmt_calls) >= 1
        assert "--no-ignore" in oxfmt_calls[0]
        assert "--write" in oxfmt_calls[0]
