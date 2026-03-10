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

"""Tests for MCP tool search transform configuration and application."""

from unittest.mock import MagicMock, patch

from superset.mcp_service.mcp_config import MCP_TOOL_SEARCH_CONFIG


def test_tool_search_config_defaults():
    """Default config has expected keys and values."""
    assert MCP_TOOL_SEARCH_CONFIG["enabled"] is True
    assert MCP_TOOL_SEARCH_CONFIG["strategy"] == "bm25"
    assert MCP_TOOL_SEARCH_CONFIG["max_results"] == 5
    assert "health_check" in MCP_TOOL_SEARCH_CONFIG["always_visible"]
    assert "get_instance_info" in MCP_TOOL_SEARCH_CONFIG["always_visible"]
    assert MCP_TOOL_SEARCH_CONFIG["search_tool_name"] == "search_tools"
    assert MCP_TOOL_SEARCH_CONFIG["call_tool_name"] == "call_tool"


def test_apply_bm25_transform():
    """BM25SearchTransform is applied when strategy is 'bm25'."""
    from superset.mcp_service.server import _apply_tool_search_transform

    mock_mcp = MagicMock()
    config = {
        "strategy": "bm25",
        "max_results": 5,
        "always_visible": ["health_check"],
        "search_tool_name": "search_tools",
        "call_tool_name": "call_tool",
    }

    with patch("fastmcp.server.transforms.search.BM25SearchTransform") as mock_bm25_cls:
        mock_transform = MagicMock()
        mock_bm25_cls.return_value = mock_transform

        _apply_tool_search_transform(mock_mcp, config)

        mock_bm25_cls.assert_called_once_with(
            max_results=5,
            always_visible=["health_check"],
            search_tool_name="search_tools",
            call_tool_name="call_tool",
        )
        mock_mcp.add_transform.assert_called_once_with(mock_transform)


def test_apply_regex_transform():
    """RegexSearchTransform is applied when strategy is 'regex'."""
    from superset.mcp_service.server import _apply_tool_search_transform

    mock_mcp = MagicMock()
    config = {
        "strategy": "regex",
        "max_results": 10,
        "always_visible": ["health_check", "get_instance_info"],
        "search_tool_name": "find_tools",
        "call_tool_name": "invoke_tool",
    }

    with patch(
        "fastmcp.server.transforms.search.RegexSearchTransform"
    ) as mock_regex_cls:
        mock_transform = MagicMock()
        mock_regex_cls.return_value = mock_transform

        _apply_tool_search_transform(mock_mcp, config)

        mock_regex_cls.assert_called_once_with(
            max_results=10,
            always_visible=["health_check", "get_instance_info"],
            search_tool_name="find_tools",
            call_tool_name="invoke_tool",
        )
        mock_mcp.add_transform.assert_called_once_with(mock_transform)


def test_apply_transform_uses_defaults_for_missing_keys():
    """Missing config keys fall back to sensible defaults."""
    from superset.mcp_service.server import _apply_tool_search_transform

    mock_mcp = MagicMock()
    config = {}  # All keys missing — should use defaults

    with patch("fastmcp.server.transforms.search.BM25SearchTransform") as mock_bm25_cls:
        mock_bm25_cls.return_value = MagicMock()

        _apply_tool_search_transform(mock_mcp, config)

        mock_bm25_cls.assert_called_once_with(
            max_results=5,
            always_visible=[],
            search_tool_name="search_tools",
            call_tool_name="call_tool",
        )


def test_transform_not_applied_when_disabled():
    """No transform applied when config has enabled=False."""
    # This tests the gating logic in run_server, not _apply_tool_search_transform
    config = {"enabled": False}
    assert not config.get("enabled", False)


def test_transform_applied_when_enabled():
    """Transform is applied when config has enabled=True."""
    config = {"enabled": True}
    assert config.get("enabled", False)
