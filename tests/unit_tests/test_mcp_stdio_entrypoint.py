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

import io
import sys
from importlib import util
from pathlib import Path
from types import ModuleType
from typing import Any, cast
from unittest.mock import MagicMock

import click
import pytest

_ENTRYPOINT_PATH = (
    Path(__file__).resolve().parents[2] / "superset/mcp_service/__main__.py"
)


def _install_entrypoint_stubs(monkeypatch: pytest.MonkeyPatch) -> None:
    superset_module = cast(Any, ModuleType("superset"))
    superset_module.__path__ = []

    mcp_service_module = cast(Any, ModuleType("superset.mcp_service"))
    mcp_service_module.__path__ = []

    app_module = cast(Any, ModuleType("superset.mcp_service.app"))
    app_module.init_fastmcp_server = MagicMock()
    app_module.mcp = MagicMock()

    middleware_module = cast(Any, ModuleType("superset.mcp_service.middleware"))
    middleware_module.create_response_size_guard_middleware = lambda: None

    server_module = cast(Any, ModuleType("superset.mcp_service.server"))
    server_module.build_middleware_list = lambda: []

    monkeypatch.setitem(sys.modules, "superset", superset_module)
    monkeypatch.setitem(sys.modules, "superset.mcp_service", mcp_service_module)
    monkeypatch.setitem(sys.modules, "superset.mcp_service.app", app_module)
    monkeypatch.setitem(
        sys.modules,
        "superset.mcp_service.middleware",
        middleware_module,
    )
    monkeypatch.setitem(sys.modules, "superset.mcp_service.server", server_module)


def _load_entrypoint(monkeypatch: pytest.MonkeyPatch) -> None:
    module_name = "superset.mcp_service.__main__"
    spec = util.spec_from_file_location(module_name, _ENTRYPOINT_PATH)
    assert spec is not None
    assert spec.loader is not None

    module = util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, module_name, module)
    spec.loader.exec_module(module)


def test_stdio_click_output_is_redirected_to_stderr(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """click output should use the saved original functions in stdio mode."""
    original_echo = click.echo
    original_secho = click.secho

    monkeypatch.setenv("FASTMCP_TRANSPORT", "stdio")
    monkeypatch.setattr(click, "echo", original_echo)
    monkeypatch.setattr(click, "secho", original_secho)
    _install_entrypoint_stubs(monkeypatch)

    try:
        _load_entrypoint(monkeypatch)

        other_stream = io.StringIO()
        click.echo("plain message")
        click.echo("keyword file message", file=other_stream)
        click.echo("positional file message", other_stream)
        click.secho("styled message")
        click.secho("styled keyword file message", file=other_stream)
        click.secho("styled positional file message", other_stream)

        captured = capsys.readouterr()
        assert captured.out == ""
        assert other_stream.getvalue() == ""
        assert "plain message" in captured.err
        assert "keyword file message" in captured.err
        assert "positional file message" in captured.err
        assert "styled message" in captured.err
        assert "styled keyword file message" in captured.err
        assert "styled positional file message" in captured.err
    finally:
        click.echo = original_echo
        click.secho = original_secho
