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
import subprocess
import sys
from pathlib import Path

from scripts import pre_commit_dependency_needs as needs

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_PATH = REPO_ROOT / "scripts" / "pre_commit_dependency_needs.py"


def test_pure_backend_change_needs_neither() -> None:
    files = ["superset/commands/database/update.py", "tests/unit_tests/foo.py"]
    assert needs.needs_frontend(files) is False
    assert needs.needs_docs(files) is False


def test_pure_frontend_change_needs_frontend_only() -> None:
    files = ["superset-frontend/src/preamble.ts"]
    assert needs.needs_frontend(files) is True
    assert needs.needs_docs(files) is False


def test_mixed_backend_and_frontend_change_needs_frontend() -> None:
    files = ["superset/foo.py", "superset-frontend/src/bar.ts"]
    assert needs.needs_frontend(files) is True
    assert needs.needs_docs(files) is False


def test_docs_prose_change_needs_neither() -> None:
    """oxlint-docs only lints JS/TS under docs/, so a prose-only docs PR
    (the common case) must not pay for the yarn install."""
    files = ["docs/docs/some-page.mdx", "docs/docs/another.md"]
    assert needs.needs_frontend(files) is False
    assert needs.needs_docs(files) is False


def test_docs_js_change_needs_docs_only() -> None:
    files = ["docs/src/components/Foo.tsx"]
    assert needs.needs_frontend(files) is False
    assert needs.needs_docs(files) is True


def test_empty_file_list_needs_neither() -> None:
    assert needs.needs_frontend([]) is False
    assert needs.needs_docs([]) is False


def test_similarly_named_path_outside_the_real_directory_does_not_match() -> None:
    """A path that merely contains "superset-frontend" or "docs" as a
    substring, without it being the actual path prefix, must not match --
    _matches_any anchors with re.match, not a bare substring search."""
    files = ["scripts/not-superset-frontend-related.py", "some/docs-ish/file.py"]
    assert needs.needs_frontend(files) is False
    assert needs.needs_docs(files) is False


def test_large_file_list_with_an_early_frontend_match() -> None:
    """Regression test for the bug a previous `printf | grep -q` bash
    implementation had: under `pipefail`, grep -q's early exit on a match
    could SIGPIPE a producer still mid-write for a large list, corrupting
    the result. A large list (order of magnitude past a typical 64KB pipe
    buffer if this were piped) with the real match on the first line must
    still resolve correctly -- plain Python has no equivalent failure mode,
    which this pins."""
    files = ["superset-frontend/early-match.ts"] + [
        f"path/to/file_{i}.py" for i in range(5000)
    ]
    assert needs.needs_frontend(files) is True


def test_main_writes_expected_outputs_to_github_output(tmp_path: Path) -> None:
    """End-to-end: invokes the script as a subprocess exactly the way the
    workflow does (files piped in on stdin, GITHUB_OUTPUT pointed at a
    file), the same interface pre-commit.yml relies on."""
    output_file = tmp_path / "github_output.txt"
    result = subprocess.run(  # noqa: S603
        [sys.executable, str(SCRIPT_PATH)],
        input="superset/foo.py\nsuperset-frontend/src/bar.ts\n",
        capture_output=True,
        text=True,
        env={"GITHUB_OUTPUT": str(output_file), "PATH": "/usr/bin:/bin"},
        check=True,
    )
    assert result.returncode == 0
    output = output_file.read_text()
    assert "needs_frontend=true" in output
    assert "needs_docs=false" in output
