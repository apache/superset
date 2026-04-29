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

"""Unit tests for the open_sql_lab_with_context MCP tool."""

import importlib
import sys
import types
from contextlib import nullcontext
from unittest.mock import MagicMock, Mock, patch
from urllib.parse import parse_qs, urlsplit

from superset.mcp_service.sql_lab.schemas import OpenSqlLabRequest
from superset.mcp_service.utils.sanitization import sanitize_for_llm_context


def _force_passthrough_decorators() -> dict[str, types.ModuleType]:
    """Force the MCP tool decorator to be a passthrough for unit tests."""

    def _passthrough_tool(func=None, **kwargs):
        del kwargs
        if func is not None:
            return func
        return lambda f: f

    mock_mcp = MagicMock()
    mock_mcp.tool = _passthrough_tool

    mock_decorators = MagicMock()
    mock_decorators.tool = _passthrough_tool

    mock_api = MagicMock()
    mock_api.mcp = mock_mcp

    saved_modules: dict[str, types.ModuleType] = {}
    for key in (
        "superset_core.api",
        "superset_core.api.mcp",
        "superset_core.api.types",
        "superset_core.mcp",
        "superset_core.mcp.decorators",
    ):
        if key in sys.modules:
            saved_modules[key] = sys.modules[key]

    sys.modules["superset_core.api"] = mock_api
    sys.modules["superset_core.api.mcp"] = mock_mcp
    sys.modules["superset_core.mcp"] = mock_mcp
    sys.modules["superset_core.mcp.decorators"] = mock_decorators
    sys.modules.setdefault("superset_core.api.types", MagicMock())

    return saved_modules


def _restore_modules(saved_modules: dict[str, types.ModuleType]) -> None:
    """Restore mocked decorator modules after each test import."""
    for key in list(sys.modules.keys()):
        if key.startswith(("superset_core.api", "superset_core.mcp")) or key.startswith(
            "superset.mcp_service.sql_lab.tool"
        ):
            del sys.modules[key]
    sys.modules.update(saved_modules)


def _get_tool_module():
    """Import the tool module with passthrough decorators."""
    saved_modules = _force_passthrough_decorators()
    mod_name = "superset.mcp_service.sql_lab.tool.open_sql_lab_with_context"
    saved_tool_modules: dict[str, object] = {}
    for key in list(sys.modules.keys()):
        if key.startswith("superset.mcp_service.sql_lab.tool"):
            saved_tool_modules[key] = sys.modules.pop(key)
    saved_modules.update(saved_tool_modules)
    mod = importlib.import_module(mod_name)
    return mod, saved_modules


def _make_mock_ctx() -> MagicMock:
    """Create a mock FastMCP context."""
    return MagicMock()


class TestOpenSqlLabWithContext:
    """Regression coverage for sanitized SQL Lab read-path output."""

    def test_sanitizes_direct_sql_and_title_in_url_and_response(self) -> None:
        mod, saved_modules = _get_tool_module()
        try:
            request = OpenSqlLabRequest(
                database_id=7,
                schema="analytics",
                sql="SELECT * FROM users LIMIT 10",
                title="Review this query",
            )

            with (
                patch(
                    "superset.daos.database.DatabaseDAO.find_by_id",
                    return_value=Mock(database_name="examples"),
                ),
                patch.object(
                    mod.event_logger, "log_context", return_value=nullcontext()
                ),
                patch.object(
                    mod,
                    "get_superset_base_url",
                    return_value="https://superset.example.com",
                ),
            ):
                response = mod.open_sql_lab_with_context(request, _make_mock_ctx())

            assert response.database_id == 7
            assert response.schema_name == "analytics"
            assert response.title == sanitize_for_llm_context(
                "Review this query",
                field_path=("title",),
            )

            parsed = urlsplit(response.url)
            params = parse_qs(parsed.query)

            assert parsed.scheme == "https"
            assert parsed.netloc == "superset.example.com"
            assert parsed.path == "/sqllab"
            assert params["dbid"] == ["7"]
            assert params["schema"] == ["analytics"]
            assert params["title"] == ["Review this query"]
            assert params["sql"] == ["SELECT * FROM users LIMIT 10"]
        finally:
            _restore_modules(saved_modules)

    def test_sanitizes_generated_dataset_context_sql(self) -> None:
        mod, saved_modules = _get_tool_module()
        try:
            request = OpenSqlLabRequest(
                database_id=12,
                schema="public",
                dataset_in_context="orders",
            )

            with (
                patch(
                    "superset.daos.database.DatabaseDAO.find_by_id",
                    return_value=Mock(database_name="examples"),
                ),
                patch.object(
                    mod.event_logger, "log_context", return_value=nullcontext()
                ),
                patch.object(
                    mod,
                    "get_superset_base_url",
                    return_value="https://superset.example.com",
                ),
            ):
                response = mod.open_sql_lab_with_context(request, _make_mock_ctx())

            params = parse_qs(urlsplit(response.url).query)
            expected_sql = (
                "-- Context: Working with dataset 'orders'\n"
                "-- Database: examples\n"
                "-- Schema: public\n"
                "\nSELECT * FROM public.orders LIMIT 100;"
            )

            assert response.database_id == 12
            assert response.schema_name == "public"
            assert response.title is None
            assert params["dbid"] == ["12"]
            assert params["schema"] == ["public"]
            assert params["sql"] == [expected_sql]
        finally:
            _restore_modules(saved_modules)

    def test_sanitizes_dataset_context_without_schema(self) -> None:
        mod, saved_modules = _get_tool_module()
        try:
            request = OpenSqlLabRequest(
                database_id=12,
                dataset_in_context="orders",
            )

            with (
                patch(
                    "superset.daos.database.DatabaseDAO.find_by_id",
                    return_value=Mock(database_name="examples"),
                ),
                patch.object(
                    mod.event_logger, "log_context", return_value=nullcontext()
                ),
                patch.object(
                    mod,
                    "get_superset_base_url",
                    return_value="https://superset.example.com",
                ),
            ):
                response = mod.open_sql_lab_with_context(request, _make_mock_ctx())

            params = parse_qs(urlsplit(response.url).query)
            expected_sql = (
                "-- Context: Working with dataset 'orders'\n"
                "-- Database: examples\n"
                "\nSELECT * FROM orders LIMIT 100;"
            )

            assert response.schema_name is None
            assert "schema" not in params
            assert params["sql"] == [expected_sql]
        finally:
            _restore_modules(saved_modules)

    def test_keeps_sql_lab_url_query_parameters_operational(self) -> None:
        mod, saved_modules = _get_tool_module()
        try:
            url = (
                "https://superset.example.com/sqllab?"
                "dbid=7&schema=analytics&sql=SELECT+1&title=Inspect+query"
            )

            response = mod._sanitize_sql_lab_response_for_llm_context(
                mod.SqlLabResponse(
                    url=url,
                    database_id=7,
                    schema="analytics",
                    title="Inspect query",
                )
            )
            params = parse_qs(urlsplit(response.url).query)

            assert params["dbid"] == ["7"]
            assert params["schema"] == ["analytics"]
            assert params["sql"] == ["SELECT 1"]
            assert params["title"] == ["Inspect query"]
            assert response.title == sanitize_for_llm_context(
                "Inspect query",
                field_path=("title",),
            )
        finally:
            _restore_modules(saved_modules)

    def test_sanitizes_error_and_keeps_empty_url_for_missing_database(self) -> None:
        mod, saved_modules = _get_tool_module()
        try:
            request = OpenSqlLabRequest(
                database_id=404,
                schema="analytics",
                title="Missing database",
            )

            with (
                patch(
                    "superset.daos.database.DatabaseDAO.find_by_id", return_value=None
                ),
                patch.object(
                    mod.event_logger, "log_context", return_value=nullcontext()
                ),
            ):
                response = mod.open_sql_lab_with_context(request, _make_mock_ctx())

            assert response.url == ""
            assert response.database_id == 404
            assert response.schema_name == "analytics"
            assert response.title == sanitize_for_llm_context(
                "Missing database",
                field_path=("title",),
            )
            assert response.error == sanitize_for_llm_context(
                "Database with ID 404 not found",
                field_path=("error",),
            )
        finally:
            _restore_modules(saved_modules)
