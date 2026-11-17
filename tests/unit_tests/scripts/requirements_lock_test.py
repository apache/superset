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
"""Guards the universal shape of the compiled ``requirements/*.txt`` locks.

Superset supports every Python minor from the ``requires-python`` floor up, so
one committed lock must install on all of them. ``scripts/uv-pip-compile.sh``
therefore compiles with ``--universal`` from the floor interpreter, and a
package that needs different versions on different interpreters appears on more
than one line, each guarded by a marker. These checks fail when the script
drifts back to a single-interpreter lock, or when a lock stops carrying the
markers that make such a split installable.
"""

import re
import subprocess
from pathlib import Path

import pytest
from packaging.utils import canonicalize_name

REPO_ROOT = Path(__file__).parents[3]
COMPILE_SCRIPT = REPO_ROOT / "scripts" / "uv-pip-compile.sh"
LOCKS = ("base", "development", "translations")

REQUIRES_PYTHON_PATTERN = re.compile(
    r"^requires-python\s*=\s*\"\s*>=\s*(\d+\.\d+)(?:\.\d+)?[^\"]*\"", re.MULTILINE
)
PIN_PATTERN = re.compile(r"^([A-Za-z0-9][A-Za-z0-9._-]*)==")


def _script_lines() -> list[str]:
    """Returns the compile script's lines."""
    return COMPILE_SCRIPT.read_text().splitlines()


def _pyproject_floor() -> str:
    """Returns the ``requires-python`` lower bound, as ``MAJOR.MINOR``."""
    match = REQUIRES_PYTHON_PATTERN.search((REPO_ROOT / "pyproject.toml").read_text())
    assert match, "pyproject.toml no longer declares requires-python as '>=X.Y'"
    return match.group(1)


def test_compile_script_ignores_ci_python_alias() -> None:
    """The floor comes from pyproject.toml, not the CI ``current`` alias.

    The setup-backend action resolves ``current`` to a single interpreter, which
    is exactly the one-interpreter lock this script must no longer produce.
    """
    assert "setup-backend/action.yml" not in COMPILE_SCRIPT.read_text()


def test_compile_script_derives_floor_from_requires_python() -> None:
    """The script's ``PYTHON_FLOOR`` equals the ``requires-python`` lower bound."""
    assignments = [
        line for line in _script_lines() if line.lstrip().startswith("PYTHON_FLOOR=")
    ]
    assert len(assignments) == 1, "expected exactly one PYTHON_FLOOR assignment"

    derived = subprocess.run(  # noqa: S603
        ["/bin/bash", "-c", f'{assignments[0]}\nprintf "%s" "$PYTHON_FLOOR"'],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    assert derived == _pyproject_floor()


def test_compile_script_derives_floor_before_docker_guard() -> None:
    """The floor is derived before the ``RUNNING_IN_DOCKER`` guard.

    The host picks the image from the floor and the in-container re-invocation
    passes it to ``uv``; deriving it ahead of the guard makes both read the same
    value from the same mounted ``pyproject.toml``.
    """
    lines = _script_lines()
    floor_at = next(
        i for i, line in enumerate(lines) if line.lstrip().startswith("PYTHON_FLOOR=")
    )
    guard_at = next(i for i, line in enumerate(lines) if "RUNNING_IN_DOCKER" in line)
    assert floor_at < guard_at


def test_compile_commands_are_universal_from_the_floor() -> None:
    """Every ``uv pip compile`` call is universal and pinned to the floor."""
    compiles = [line for line in _script_lines() if "uv pip compile" in line]
    assert len(compiles) == len(LOCKS), "expected one compile per lock file"
    for line in compiles:
        assert "--universal" in line, line
        assert '--python-version "$PYTHON_FLOOR"' in line, line


@pytest.mark.parametrize("lock", LOCKS)
def test_lock_header_records_universal_compile(lock: str) -> None:
    """Each lock's header shows it was compiled with ``--universal``."""
    header = [
        line
        for line in (REPO_ROOT / "requirements" / f"{lock}.txt")
        .read_text()
        .splitlines()
        if line.startswith("#")
    ]
    assert any("--universal" in line for line in header), (
        f"requirements/{lock}.txt was not compiled with --universal; "
        "run ./scripts/uv-pip-compile.sh"
    )


@pytest.mark.parametrize("lock", LOCKS)
def test_split_pins_carry_markers(lock: str) -> None:
    """A package pinned on several lines has a marker on every one of them.

    Two unmarked pins for one package would be an unresolvable install; a
    marker on each line is what lets pip pick the right one per interpreter.
    """
    lines_by_package: dict[str, list[str]] = {}
    for line in (REPO_ROOT / "requirements" / f"{lock}.txt").read_text().splitlines():
        if match := PIN_PATTERN.match(line):
            lines_by_package.setdefault(canonicalize_name(match.group(1)), []).append(
                line
            )

    for package, pins in lines_by_package.items():
        if len(pins) > 1:
            unmarked = [pin for pin in pins if ";" not in pin]
            assert not unmarked, (
                f"{package} is pinned more than once in requirements/{lock}.txt "
                f"but these lines have no marker: {unmarked}"
            )
