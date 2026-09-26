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
"""Tests for ``scripts/translations/compile_po.py``.

The script is not installed as a package, so it is loaded via importlib from
its filesystem path.
"""

from __future__ import annotations

import importlib.util
import json  # noqa: TID251 - testing a standalone script that uses stdlib json
from pathlib import Path
from unittest.mock import MagicMock, patch

_SCRIPT_PATH = (
    Path(__file__).resolve().parents[4] / "scripts" / "translations" / "compile_po.py"
)
_spec = importlib.util.spec_from_file_location("compile_po", _SCRIPT_PATH)
assert _spec is not None, f"Could not load {_SCRIPT_PATH}"
assert _spec.loader is not None, f"No loader on spec for {_SCRIPT_PATH}"
compile_po = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(compile_po)


# ---------------------------------------------------------------------------
# resolve_node_entry
# ---------------------------------------------------------------------------


def test_resolve_node_entry_dict_bin(tmp_path: Path) -> None:
    """A dict "bin" field is resolved by package name, not the first key."""
    pkg_dir = tmp_path / "node_modules" / "po2json"
    pkg_dir.mkdir(parents=True)
    (pkg_dir / "package.json").write_text(
        json.dumps({"bin": {"po2json": "bin/po2json"}})
    )
    (pkg_dir / "bin").mkdir()
    entry = pkg_dir / "bin" / "po2json"
    entry.touch()

    with patch.object(compile_po, "FRONTEND_DIR", str(tmp_path)):
        resolved = compile_po.resolve_node_entry("po2json")
    assert resolved == str(entry)


def test_resolve_node_entry_string_bin(tmp_path: Path) -> None:
    """A plain string "bin" field (single-command package shorthand) resolves too."""
    pkg_dir = tmp_path / "node_modules" / "oxfmt"
    pkg_dir.mkdir(parents=True)
    (pkg_dir / "package.json").write_text(json.dumps({"bin": "bin/oxfmt"}))
    (pkg_dir / "bin").mkdir()
    entry = pkg_dir / "bin" / "oxfmt"
    entry.touch()

    with patch.object(compile_po, "FRONTEND_DIR", str(tmp_path)):
        resolved = compile_po.resolve_node_entry("oxfmt")
    assert resolved == str(entry)


def test_resolve_node_entry_missing_package(tmp_path: Path) -> None:
    """Returns None when the package isn't installed at all."""
    with patch.object(compile_po, "FRONTEND_DIR", str(tmp_path)):
        assert compile_po.resolve_node_entry("po2json") is None


def test_resolve_node_entry_missing_bin_field(tmp_path: Path) -> None:
    """Returns None when package.json has no "bin" field."""
    pkg_dir = tmp_path / "node_modules" / "po2json"
    pkg_dir.mkdir(parents=True)
    (pkg_dir / "package.json").write_text(json.dumps({"name": "po2json"}))

    with patch.object(compile_po, "FRONTEND_DIR", str(tmp_path)):
        assert compile_po.resolve_node_entry("po2json") is None


def test_resolve_node_entry_entry_file_missing(tmp_path: Path) -> None:
    """Returns None when package.json declares a bin entry that doesn't exist
    on disk (a partially-installed / corrupted node_modules)."""
    pkg_dir = tmp_path / "node_modules" / "po2json"
    pkg_dir.mkdir(parents=True)
    (pkg_dir / "package.json").write_text(
        json.dumps({"bin": {"po2json": "bin/po2json"}})
    )

    with patch.object(compile_po, "FRONTEND_DIR", str(tmp_path)):
        assert compile_po.resolve_node_entry("po2json") is None


# ---------------------------------------------------------------------------
# run
# ---------------------------------------------------------------------------


def test_run_returns_process_returncode() -> None:
    """run() returns the child process's exit code and never shells out."""
    with patch.object(compile_po.subprocess, "run") as mock_run:
        mock_run.return_value = MagicMock(returncode=3)
        rc = compile_po.run(["node", "script.js"])
        assert rc == 3
        args, kwargs = mock_run.call_args
        assert args[0] == ["node", "script.js"]
        assert "shell" not in kwargs
        assert kwargs["env"]["NODE_NO_WARNINGS"] == "1"


# ---------------------------------------------------------------------------
# convert_po_to_json
# ---------------------------------------------------------------------------


def test_convert_po_to_json_success(tmp_path: Path) -> None:
    """Builds the po2json argv and writes to the .po file's .json sibling."""
    po_file = tmp_path / "fr" / "LC_MESSAGES" / "messages.po"
    po_file.parent.mkdir(parents=True)
    po_file.write_text('msgid ""\nmsgstr ""\n')

    with patch.object(compile_po, "run", return_value=0) as mock_run:
        json_dest = compile_po.convert_po_to_json(
            "/usr/bin/node", "/pkg/bin/po2json", str(po_file)
        )

    assert json_dest == str(po_file.with_suffix(".json"))
    mock_run.assert_called_once_with(
        [
            "/usr/bin/node",
            "/pkg/bin/po2json",
            "--domain",
            "superset",
            "--format",
            "jed1.x",
            "--fuzzy",
            str(po_file),
            str(po_file.with_suffix(".json")),
        ]
    )


def test_convert_po_to_json_failure() -> None:
    """Reports failure when po2json returns non-zero."""
    with patch.object(compile_po, "run", return_value=1):
        json_dest = compile_po.convert_po_to_json(
            "/usr/bin/node", "/pkg/bin/po2json", "x.po"
        )
    assert json_dest is None


def test_convert_po_to_json_preserves_locale_in_path(tmp_path: Path) -> None:
    """Regression: two locales' messages.po must not collide on one .json
    output -- the destination is derived from the full glob path (which
    includes the locale and LC_MESSAGES components), not a locale-stripped
    relative path."""
    fr_po = tmp_path / "fr" / "LC_MESSAGES" / "messages.po"
    de_po = tmp_path / "de" / "LC_MESSAGES" / "messages.po"
    for f in (fr_po, de_po):
        f.parent.mkdir(parents=True)
        f.touch()

    destinations = []
    with patch.object(compile_po, "run", return_value=0) as mock_run:
        for po_file in (fr_po, de_po):
            compile_po.convert_po_to_json(
                "/usr/bin/node", "/pkg/bin/po2json", str(po_file)
            )
            destinations.append(mock_run.call_args.args[0][-1])

    assert destinations[0] != destinations[1]
    assert destinations[0] == str(fr_po.with_suffix(".json"))
    assert destinations[1] == str(de_po.with_suffix(".json"))


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def test_main_missing_node() -> None:
    """Returns 1 when node isn't on PATH."""
    with patch.object(compile_po.shutil, "which", return_value=None):
        assert compile_po.main() == 1


def test_main_missing_npm_packages() -> None:
    """Returns 1 when po2json or oxfmt aren't installed."""
    with (
        patch.object(compile_po.shutil, "which", return_value="/usr/bin/node"),
        patch.object(compile_po, "resolve_node_entry", return_value=None),
    ):
        assert compile_po.main() == 1


def test_main_missing_translations_dir(tmp_path: Path) -> None:
    """Returns 1 when the translations directory doesn't exist."""
    with (
        patch.object(compile_po.shutil, "which", return_value="/usr/bin/node"),
        patch.object(compile_po, "resolve_node_entry", return_value="/pkg/bin/x"),
        patch.object(compile_po, "TRANSLATIONS_DIR", str(tmp_path / "nope")),
    ):
        assert compile_po.main() == 1


def test_main_reports_conversion_failures(tmp_path: Path) -> None:
    """Returns 1 and does not run oxfmt when any .po conversion fails."""
    po_file = tmp_path / "fr" / "LC_MESSAGES" / "messages.po"
    po_file.parent.mkdir(parents=True)
    po_file.touch()

    with (
        patch.object(compile_po.shutil, "which", return_value="/usr/bin/node"),
        patch.object(compile_po, "resolve_node_entry", return_value="/pkg/bin/x"),
        patch.object(compile_po, "TRANSLATIONS_DIR", str(tmp_path)),
        patch.object(compile_po, "convert_po_to_json", return_value=None),
        patch.object(compile_po, "run") as mock_run,
    ):
        assert compile_po.main() == 1
        mock_run.assert_not_called()


def test_main_runs_oxfmt_on_generated_json(tmp_path: Path) -> None:
    """On success, oxfmt is invoked on the generated JSON with the gitignore
    workaround flag, and main() returns 0."""
    po_file = tmp_path / "fr" / "LC_MESSAGES" / "messages.po"
    po_file.parent.mkdir(parents=True)
    po_file.touch()
    json_file = po_file.with_suffix(".json")
    json_file.touch()

    with (
        patch.object(compile_po.shutil, "which", return_value="/usr/bin/node"),
        patch.object(compile_po, "resolve_node_entry", return_value="/pkg/bin/x"),
        patch.object(compile_po, "TRANSLATIONS_DIR", str(tmp_path)),
        patch.object(compile_po, "convert_po_to_json", return_value=str(json_file)),
        patch.object(compile_po, "run", return_value=0) as mock_run,
    ):
        rc = compile_po.main()

    assert rc == 0
    mock_run.assert_called_once()
    oxfmt_args = mock_run.call_args.args[0]
    assert "--write" in oxfmt_args
    assert "--no-error-on-unmatched-pattern" in oxfmt_args
    assert str(json_file) in oxfmt_args


def test_main_does_not_format_unrelated_tracked_json(tmp_path: Path) -> None:
    """Regression: oxfmt only runs on the .json this pass generated, not
    every tracked .json under TRANSLATIONS_DIR -- a blanket glob would also
    catch the checked-in empty_language_pack.json, which po2json.sh never
    touched, and reformat it as a side effect."""
    po_file = tmp_path / "fr" / "LC_MESSAGES" / "messages.po"
    po_file.parent.mkdir(parents=True)
    po_file.touch()
    json_file = po_file.with_suffix(".json")
    json_file.touch()
    unrelated_json = tmp_path / "empty_language_pack.json"
    unrelated_json.touch()

    with (
        patch.object(compile_po.shutil, "which", return_value="/usr/bin/node"),
        patch.object(compile_po, "resolve_node_entry", return_value="/pkg/bin/x"),
        patch.object(compile_po, "TRANSLATIONS_DIR", str(tmp_path)),
        patch.object(compile_po, "convert_po_to_json", return_value=str(json_file)),
        patch.object(compile_po, "run", return_value=0) as mock_run,
    ):
        rc = compile_po.main()

    assert rc == 0
    oxfmt_args = mock_run.call_args.args[0]
    assert str(unrelated_json) not in oxfmt_args


def test_main_reports_oxfmt_failure(tmp_path: Path) -> None:
    """Returns 1 when the oxfmt formatting step fails."""
    po_file = tmp_path / "fr" / "LC_MESSAGES" / "messages.po"
    po_file.parent.mkdir(parents=True)
    po_file.touch()
    json_file = po_file.with_suffix(".json")
    json_file.touch()

    with (
        patch.object(compile_po.shutil, "which", return_value="/usr/bin/node"),
        patch.object(compile_po, "resolve_node_entry", return_value="/pkg/bin/x"),
        patch.object(compile_po, "TRANSLATIONS_DIR", str(tmp_path)),
        patch.object(compile_po, "convert_po_to_json", return_value=str(json_file)),
        patch.object(compile_po, "run", return_value=1),
    ):
        assert compile_po.main() == 1


def test_main_never_touches_a_shell(tmp_path: Path) -> None:
    """The whole pipeline runs with no shell involved -- the thing the
    previous shell-metacharacter/`%VAR%`-expansion bugs required. Nothing
    here branches on the platform, so one run covers them all.
    """
    po_file = tmp_path / "fr" / "LC_MESSAGES" / "messages.po"
    po_file.parent.mkdir(parents=True)
    po_file.touch()
    po_file.with_suffix(".json").touch()

    with (
        patch.object(compile_po.shutil, "which", return_value="/usr/bin/node"),
        patch.object(compile_po, "resolve_node_entry", return_value="/pkg/bin/x"),
        patch.object(compile_po, "TRANSLATIONS_DIR", str(tmp_path)),
        patch.object(compile_po.subprocess, "run") as mock_subprocess_run,
    ):
        mock_subprocess_run.return_value = MagicMock(returncode=0)
        assert compile_po.main() == 0

    for call in mock_subprocess_run.call_args_list:
        assert call.args[0][0] == "/usr/bin/node"
        assert "shell" not in call.kwargs
