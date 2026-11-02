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

from importlib import util
from pathlib import Path
from unittest.mock import patch

from fastmcp import FastMCP
from fastmcp.server import create_proxy


def test_simple_proxy_builds_and_runs() -> None:
    """Build the real proxy without starting a transport or changing signal handlers."""
    path = Path(__file__).resolve().parents[2] / "superset/mcp_service/simple_proxy.py"
    spec = util.spec_from_file_location("simple_proxy", path)
    assert spec is not None
    assert spec.loader is not None
    module = util.module_from_spec(spec)
    spec.loader.exec_module(module)

    with (
        patch("fastmcp.server.create_proxy", wraps=create_proxy) as mock_create,
        patch.object(FastMCP, "run") as mock_run,
        patch.object(module.signal, "signal"),
    ):
        module.main()

    mock_create.assert_called_once_with("http://localhost:5008/mcp/", name="MCP Proxy")
    assert isinstance(module.proxy, FastMCP)
    assert module.proxy.name == "MCP Proxy"
    mock_run.assert_called_once_with()
