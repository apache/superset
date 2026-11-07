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
import re
import shlex
import subprocess
import tomllib
from pathlib import Path

import pytest


@pytest.mark.parametrize(
    "relative_path",
    [
        "docker/install-app-dependencies.sh",
        "tests/unit_tests/docker_app_dependencies_test.py",
    ],
)
def test_dependency_installation_files_have_asf_headers(relative_path: str) -> None:
    repository = Path(__file__).resolve().parents[2]
    header = "\n".join((repository / relative_path).read_text().splitlines()[:20])
    assert "Licensed to the Apache Software Foundation (ASF)" in header
    assert "http://www.apache.org/licenses/LICENSE-2.0" in header


@pytest.mark.parametrize("metadata", [False, True])
def test_docker_dependency_layers_preserve_legacy_cache(metadata: bool) -> None:
    repository = Path(__file__).resolve().parents[2]
    dockerfile = (repository / "Dockerfile").read_text()
    layers = [
        layer.replace("\\\n", " ")
        for layer in re.findall(r"^RUN (?:.*\\\n)*.*", dockerfile, re.MULTILINE)
        if "/app/docker/install-app-dependencies.sh" in layer
    ]
    assert len(layers) == 2
    assert "type=bind" not in layers[0]
    assert "type=bind,source=.,target=/src" in layers[1]
    outputs = []
    for layer in layers:
        script = layer[layer.index("if python") :]
        script = (
            script.replace(
                "python -c 'import sys; raise SystemExit(sys.version_info >= (3, 15))'",
                "false" if metadata else "true",
            )
            .replace(
                "python -c 'import sys; raise SystemExit(sys.version_info < (3, 15))'",
                "true" if metadata else "false",
            )
            .replace("/app/docker/install-app-dependencies.sh", "printf '%s\\n'")
        )
        outputs.append(
            subprocess.run(
                ["/bin/bash", "-s"],
                input=script,
                capture_output=True,
                text=True,
                check=True,
            ).stdout
        )
    assert outputs == (["", "/src\n"] if metadata else ["/app\n", ""])


@pytest.mark.parametrize("metadata", [False, True])
def test_dependency_installation_selects_interpreter_contract(metadata: bool) -> None:
    """Use metadata only for interpreters newer than the generated lock baseline."""
    repository = Path(__file__).resolve().parents[2]
    script = (repository / "docker/install-app-dependencies.sh").read_text()
    script = script.replace("/app/docker/pip-install.sh", "printf '%s\\n'").replace(
        "python -c 'import sys; raise SystemExit(sys.version_info < (3, 15))'",
        "true" if metadata else "false",
    )
    result = subprocess.run(
        ["/bin/bash", "-s", "--", "/source"],
        input=script,
        capture_output=True,
        text=True,
        check=True,
    )
    arguments = result.stdout.splitlines()
    assert arguments[0] == "--requires-build-essential"
    if metadata:
        assert arguments[1:] == [
            "--no-sources",
            "/source/superset-core",
            "/source",
        ]
    else:
        assert arguments[1:] == ["-r", "requirements/base.txt"]


def test_cli_dependency_is_declared() -> None:
    """The CLI must not rely on a test environment to supply rich."""
    repository = Path(__file__).resolve().parents[2]
    project = tomllib.loads((repository / "pyproject.toml").read_text())
    assert "rich" in project["project"]["dependencies"]


@pytest.mark.parametrize("installer_exit", [0, 1])
def test_readonly_build_copy_is_cleaned(tmp_path: Path, installer_exit: int) -> None:
    """Leave mounted sources intact and remove build copies on either outcome."""
    source = tmp_path / "source"
    source.mkdir()
    marker = source / "marker"
    marker.write_text("original")
    repository = Path(__file__).resolve().parents[2]
    script = (repository / "docker/install-app-dependencies.sh").read_text()
    script = (
        script.replace(
            "python -c 'import sys; raise SystemExit(sys.version_info < (3, 15))'",
            "true",
        )
        .replace(
            '[[ -d "${SOURCE_ROOT}" && ! -w "${SOURCE_ROOT}" ]]',
            "true",
        )
        .replace("/app/docker/pip-install.sh", "install_dependencies")
    )
    installer = (
        'install_dependencies() { printf "%s\\n" "${SOURCE_ROOT}"; '
        'test "$(cat "${SOURCE_ROOT}/marker")" = original; '
        'printf changed > "${SOURCE_ROOT}/marker"; '
        f"return {installer_exit}; }}\n"
    )
    result: subprocess.CompletedProcess[str] | subprocess.CalledProcessError
    try:
        result = subprocess.run(
            ["/bin/bash", "-s"],
            input=installer + f"set -- {shlex.quote(str(source))}\n" + script,
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError as error:
        assert installer_exit == 1
        result = error
    assert result.returncode == installer_exit
    copied_source = Path(result.stdout.strip())
    assert copied_source != source
    assert not copied_source.exists()
    assert marker.read_text() == "original"
