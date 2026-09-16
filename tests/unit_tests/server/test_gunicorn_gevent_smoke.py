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
Smoke tests for the gevent gunicorn worker.

Superset is commonly deployed under gunicorn with the gevent worker class
(``SERVER_WORKER_CLASS=gevent`` in ``docker/entrypoints/run-server.sh``). The
gevent worker monkey-patches the standard library and relies on gevent
internals, so a major gevent upgrade can break the worker at boot/serve time in
ways that import-only checks do not catch. These tests boot the worker in a
subprocess and exercise it, giving CI a real compatibility signal for gevent
bumps.
"""

import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from textwrap import dedent

import pytest

# These run wherever gevent + gunicorn are installed (e.g. the unit-test job,
# which installs requirements/development.txt). Skip cleanly otherwise.
pytest.importorskip("gevent")
pytest.importorskip("gunicorn")

pytestmark = pytest.mark.skipif(
    sys.platform.startswith("win"), reason="gunicorn does not run on Windows"
)


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _gunicorn_command() -> list[str]:
    if gunicorn_bin := shutil.which("gunicorn"):
        return [gunicorn_bin]
    # Fall back to the module entry point if the console script isn't on PATH.
    return [sys.executable, "-m", "gunicorn.app.wsgiapp"]


def test_gunicorn_gevent_worker_serves_request(tmp_path: Path) -> None:
    """gunicorn's gevent worker boots and serves an HTTP request."""
    app_module = tmp_path / "wsgi_smoke_app.py"
    app_module.write_text(
        dedent(
            """
            def app(environ, start_response):
                start_response("200 OK", [("Content-Type", "text/plain")])
                return [b"ok"]
            """
        )
    )

    port = _free_port()
    cmd = _gunicorn_command() + [
        "--worker-class",
        "gevent",
        "--workers",
        "1",
        "--bind",
        f"127.0.0.1:{port}",
        "--pythonpath",
        str(tmp_path),
        "--graceful-timeout",
        "5",
        "--log-level",
        "error",
        "wsgi_smoke_app:app",
    ]
    proc = subprocess.Popen(  # noqa: S603
        cmd,
        cwd=str(tmp_path),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    try:
        deadline = time.time() + 30
        status = None
        body = None
        last_err: Exception | None = None
        while time.time() < deadline:
            if proc.poll() is not None:
                output = proc.stdout.read().decode() if proc.stdout else ""
                pytest.fail(
                    f"gunicorn gevent worker exited early "
                    f"(code {proc.returncode}):\n{output}"
                )
            try:
                with urllib.request.urlopen(  # noqa: S310
                    f"http://127.0.0.1:{port}/", timeout=1
                ) as resp:
                    status = resp.status
                    body = resp.read()
                break
            except Exception as ex:  # noqa: BLE001
                last_err = ex
                time.sleep(0.3)
        else:
            pytest.fail(
                f"gunicorn gevent worker did not serve a request in time: {last_err}"
            )

        assert status == 200
        assert body == b"ok"
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)


def test_gevent_monkey_patch_all_patches_stdlib() -> None:
    """gevent's monkey-patching applies cleanly in a fresh interpreter.

    Runs in a subprocess so it never patches the test process, and asserts the
    core stdlib modules the gevent worker depends on are patched.
    """
    script = dedent(
        """
        from gevent import monkey

        monkey.patch_all()
        assert monkey.is_module_patched("socket"), "socket not patched"
        assert monkey.is_module_patched("ssl"), "ssl not patched"
        print("ok")
        """
    )
    result = subprocess.run(  # noqa: S603
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert result.returncode == 0, (
        f"gevent monkey.patch_all() failed:\n{result.stdout}\n{result.stderr}"
    )
    assert "ok" in result.stdout
