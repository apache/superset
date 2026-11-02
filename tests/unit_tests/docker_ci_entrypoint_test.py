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
"""Behavioral tests for the CI Docker entrypoint."""

import os
import subprocess
from pathlib import Path

import pytest


def _write_executable(path: Path, body: str) -> None:
    """Write an executable Bash stub at ``path``."""
    path.write_text(f"#!/usr/bin/env bash\n{body}", encoding="utf-8")
    path.chmod(0o755)


def _prepare_entrypoint(tmp_path: Path, init_body: str, server_body: str) -> Path:
    """Create disposable stubs and relocate only the entrypoint's app paths."""
    repository_root = Path(__file__).resolve().parents[2]
    source = repository_root / "docker/entrypoints/docker-ci.sh"
    docker_root = tmp_path / "app/docker"
    entrypoints = docker_root / "entrypoints"
    entrypoints.mkdir(parents=True)
    _write_executable(docker_root / "docker-init.sh", init_body)
    _write_executable(entrypoints / "run-server.sh", server_body)

    relocated = tmp_path / "docker-ci.sh"
    relocated.write_text(
        source.read_text(encoding="utf-8").replace("/app/docker", str(docker_root)),
        encoding="utf-8",
    )
    return relocated


def _entrypoint_environment() -> dict[str, str]:
    """Return a clean environment with no inherited server thread setting."""
    environment = os.environ.copy()
    environment.pop("SERVER_THREADS_AMOUNT", None)
    return environment


def test_init_failure_preserves_status_and_prevents_server_start(
    tmp_path: Path,
) -> None:
    """A failed initialization stops startup and remains the container status."""
    events = tmp_path / "events"
    entrypoint = _prepare_entrypoint(
        tmp_path,
        'printf "init\\n" >> "${EVENTS_FILE}"\nexit 37\n',
        'printf "server\\n" >> "${EVENTS_FILE}"\n',
    )
    environment = _entrypoint_environment()
    environment["EVENTS_FILE"] = str(events)

    result = subprocess.run(  # noqa: S603
        ["/bin/bash", str(entrypoint)],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 37, result.stderr
    assert events.read_text(encoding="utf-8").splitlines() == ["init"]


@pytest.mark.parametrize(
    "thread_value, expected",
    [(None, "8"), ("23", "23"), ("", "8")],
    ids=["default", "custom", "empty"],
)
def test_successful_startup_orders_init_before_server_and_sets_threads(
    tmp_path: Path,
    thread_value: str | None,
    expected: str,
) -> None:
    """Successful startup runs in order with default or supplied thread counts."""
    events = tmp_path / "events"
    entrypoint = _prepare_entrypoint(
        tmp_path,
        'printf "init\\n" >> "${EVENTS_FILE}"\n',
        'printf "server:%s\\n" "${SERVER_THREADS_AMOUNT}" >> "${EVENTS_FILE}"\n',
    )
    environment = _entrypoint_environment()
    environment["EVENTS_FILE"] = str(events)
    if thread_value is not None:
        environment["SERVER_THREADS_AMOUNT"] = thread_value

    result = subprocess.run(  # noqa: S603
        ["/bin/bash", str(entrypoint)],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert events.read_text(encoding="utf-8").splitlines() == [
        "init",
        f"server:{expected}",
    ]


def test_server_replaces_entrypoint_process_and_preserves_status(
    tmp_path: Path,
) -> None:
    """The server inherits the entrypoint PID and its exit status is returned."""
    server_pid = tmp_path / "server-pid"
    entrypoint = _prepare_entrypoint(
        tmp_path,
        "exit 0\n",
        'printf "%s\\n" "$$" > "${SERVER_PID_FILE}"\nexit 42\n',
    )
    environment = _entrypoint_environment()
    environment["SERVER_PID_FILE"] = str(server_pid)

    process = subprocess.Popen(  # noqa: S603
        ["/bin/bash", str(entrypoint)],
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    stdout, stderr = process.communicate(timeout=10)

    assert process.returncode == 42, f"stdout={stdout}\nstderr={stderr}"
    assert int(server_pid.read_text(encoding="utf-8")) == process.pid
