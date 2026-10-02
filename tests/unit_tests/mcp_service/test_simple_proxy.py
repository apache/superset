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

"""Tests for the stdio proxy entry point used by ``run_proxy.sh``."""

from unittest.mock import patch

from fastmcp import FastMCP

from superset.mcp_service import simple_proxy


def test_main_builds_real_proxy_and_runs_it() -> None:
    """``main()`` creates a real FastMCP proxy with the supported API.

    ``create_proxy`` is exercised unmocked (only wrapped) so the test fails if
    the installed FastMCP no longer provides it (``FastMCP.as_proxy`` was
    removed in FastMCP 4).
    """
    with (
        patch.object(
            simple_proxy, "create_proxy", wraps=simple_proxy.create_proxy
        ) as spy,
        patch.object(FastMCP, "run") as mock_run,
        patch.object(simple_proxy.signal, "signal"),
        patch.object(simple_proxy, "proxy", None),
    ):
        simple_proxy.main()
        built = simple_proxy.proxy

    spy.assert_called_once_with("http://localhost:5008/mcp/", name="MCP Proxy")
    assert isinstance(built, FastMCP)
    assert built.name == "MCP Proxy"
    mock_run.assert_called_once_with()
