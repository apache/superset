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
Unit tests for save_sql_query MCP tool schemas and logic.
"""

import importlib
import sys
from unittest.mock import MagicMock, Mock, patch

import pytest
from pydantic import ValidationError

from superset.mcp_service.sql_lab.schemas import (
    SaveSqlQueryRequest,
    SaveSqlQueryResponse,
)


class TestSaveSqlQueryRequest:
    """Test SaveSqlQueryRequest schema validation."""

    def test_valid_request(self) -> None:
        req = SaveSqlQueryRequest(
            database_id=1,
            label="Revenue Query",
            sql="SELECT SUM(revenue) FROM sales",
        )
        assert req.database_id == 1
        assert req.label == "Revenue Query"
        assert req.sql == "SELECT SUM(revenue) FROM sales"

    def test_with_optional_fields(self) -> None:
        req = SaveSqlQueryRequest(
            database_id=1,
            label="Revenue Query",
            sql="SELECT 1",
            schema="public",
            catalog="main",
            description="Sums revenue",
        )
        assert req.schema_name == "public"
        assert req.catalog == "main"
        assert req.description == "Sums revenue"

    def test_empty_sql_fails(self) -> None:
        with pytest.raises(ValidationError, match="SQL query cannot be empty"):
            SaveSqlQueryRequest(database_id=1, label="test", sql="  ")

    def test_empty_label_fails(self) -> None:
        with pytest.raises(ValidationError, match="Label cannot be empty"):
            SaveSqlQueryRequest(database_id=1, label="  ", sql="SELECT 1")

    def test_sql_is_stripped(self) -> None:
        req = SaveSqlQueryRequest(database_id=1, label="test", sql="  SELECT 1  ")
        assert req.sql == "SELECT 1"

    def test_label_is_stripped(self) -> None:
        req = SaveSqlQueryRequest(database_id=1, label="  My Query  ", sql="SELECT 1")
        assert req.label == "My Query"

    def test_label_max_length(self) -> None:
        with pytest.raises(ValidationError, match="String should have at most 256"):
            SaveSqlQueryRequest(database_id=1, label="a" * 257, sql="SELECT 1")

    def test_schema_alias(self) -> None:
        """The field accepts 'schema' as alias for 'schema_name'."""
        req = SaveSqlQueryRequest(
            database_id=1,
            label="test",
            sql="SELECT 1",
            schema="public",
        )
        assert req.schema_name == "public"


class TestSaveSqlQueryResponse:
    """Test SaveSqlQueryResponse schema."""

    def test_response_fields(self) -> None:
        resp = SaveSqlQueryResponse(
            id=42,
            label="Revenue",
            sql="SELECT 1",
            database_id=1,
            url="/sqllab?savedQueryId=42",
        )
        assert resp.id == 42
        assert resp.label == "Revenue"
        assert resp.url == "/sqllab?savedQueryId=42"

    def test_response_with_optional_fields(self) -> None:
        resp = SaveSqlQueryResponse(
            id=42,
            label="Revenue",
            sql="SELECT 1",
            database_id=1,
            schema="public",
            description="A query",
            url="/sqllab?savedQueryId=42",
        )
        assert resp.schema_name == "public"
        assert resp.description == "A query"


def _force_passthrough_decorators():
    """Force superset_core.api.mcp.tool to be a passthrough decorator.

    In CI, superset_core is fully installed and the real @tool decorator
    includes authentication middleware. For unit tests we want to bypass
    auth and test the tool logic directly, so we always replace the
    decorator with a passthrough regardless of installation state.
    """

    def _passthrough_tool(func=None, **kwargs):
        if func is not None:
            return func
        return lambda f: f

    mock_mcp = MagicMock()
    mock_mcp.tool = _passthrough_tool

    mock_api = MagicMock()
    mock_api.mcp = mock_mcp

    # Clear any cached superset_core modules first so Python doesn't
    # use the real installed package instead of our mocks.
    for key in list(sys.modules.keys()):
        if key.startswith("superset_core"):
            del sys.modules[key]

    # Mock all possible import paths for superset_core
    sys.modules["superset_core"] = MagicMock()
    sys.modules["superset_core.api"] = mock_api
    sys.modules["superset_core.api.mcp"] = mock_mcp
    sys.modules["superset_core.mcp"] = mock_mcp
    sys.modules.setdefault("superset_core.api.types", MagicMock())


def _get_tool_module():
    """Import save_sql_query with passthrough decorators (no auth)."""
    _force_passthrough_decorators()
    # Clear cached module imports so we get a fresh import with mocked
    # decorators. This is necessary because in CI the real @tool decorator
    # may have been applied during a previous import.
    mod_name = "superset.mcp_service.sql_lab.tool.save_sql_query"
    for key in list(sys.modules.keys()):
        if key.startswith("superset.mcp_service.sql_lab.tool"):
            del sys.modules[key]
    return importlib.import_module(mod_name)


def _make_mock_ctx():
    """Create a mock FastMCP Context with awaitable methods."""

    async def _noop(*args, **kwargs):
        pass

    ctx = MagicMock()
    ctx.info = _noop
    ctx.error = _noop
    ctx.warning = _noop
    return ctx


class TestSaveSqlQueryToolLogic:
    """Test save_sql_query tool internal logic.

    The tool function uses lazy imports inside its body (from flask import g,
    from superset import db, etc.). We patch at the import source so that
    when the function runs, it picks up our mocks.

    The @parse_request decorator injects ctx via get_context() and strips
    __wrapped__, so we mock get_context and call the decorated function
    directly (without unwrapping).
    """

    @pytest.mark.anyio
    async def test_save_query_creates_saved_query(self) -> None:
        """Verify the tool calls SavedQueryDAO.create with correct attrs."""
        mod = _get_tool_module()
        mock_ctx = _make_mock_ctx()

        mock_db_obj = MagicMock()
        mock_db_obj.id = 1
        mock_db_obj.database_name = "test_db"

        mock_sq = MagicMock()
        mock_sq.id = 42
        mock_sq.label = "Revenue Query"
        mock_sq.sql = "SELECT SUM(revenue) FROM sales"

        request = SaveSqlQueryRequest(
            database_id=1,
            label="Revenue Query",
            sql="SELECT SUM(revenue) FROM sales",
        )

        mock_db_session = MagicMock()
        (
            mock_db_session.session.query.return_value.filter_by.return_value.first.return_value
        ) = mock_db_obj

        mock_sm = MagicMock()
        mock_sm.can_access_database.return_value = True

        mock_dao = MagicMock()
        mock_dao.create.return_value = mock_sq

        mock_g = MagicMock()
        mock_g.user = Mock(id=1)

        mock_event_logger = MagicMock()
        mock_event_logger.log_context.return_value.__enter__ = Mock()
        mock_event_logger.log_context.return_value.__exit__ = Mock(return_value=False)

        with (
            patch(
                "fastmcp.server.dependencies.get_context",
                return_value=mock_ctx,
            ),
            patch("superset.db", mock_db_session),
            patch("superset.security_manager", mock_sm),
            patch("superset.daos.query.SavedQueryDAO", mock_dao),
            patch(
                "superset.mcp_service.utils.url_utils.get_superset_base_url",
                return_value="http://localhost:8088",
            ),
            patch("flask.g", mock_g),
            patch.object(mod, "event_logger", mock_event_logger),
        ):
            result = await mod.save_sql_query(request)

            assert result.id == 42
            assert result.label == "Revenue Query"
            assert "savedQueryId=42" in result.url
            mock_dao.create.assert_called_once()
            call_attrs = mock_dao.create.call_args[1]["attributes"]
            assert call_attrs["db_id"] == 1
            assert call_attrs["label"] == "Revenue Query"
            assert call_attrs["sql"] == "SELECT SUM(revenue) FROM sales"
            assert call_attrs["user_id"] == 1
            mock_db_session.session.commit.assert_called_once()

    @pytest.mark.anyio
    async def test_save_query_database_not_found(self) -> None:
        mod = _get_tool_module()
        mock_ctx = _make_mock_ctx()

        request = SaveSqlQueryRequest(
            database_id=999,
            label="Test",
            sql="SELECT 1",
        )

        mock_db_session = MagicMock()
        (
            mock_db_session.session.query.return_value.filter_by.return_value.first.return_value
        ) = None

        mock_g = MagicMock()
        mock_g.user = Mock(id=1)

        mock_event_logger = MagicMock()
        mock_event_logger.log_context.return_value.__enter__ = Mock()
        mock_event_logger.log_context.return_value.__exit__ = Mock(return_value=False)

        with (
            patch(
                "fastmcp.server.dependencies.get_context",
                return_value=mock_ctx,
            ),
            patch("superset.db", mock_db_session),
            patch("flask.g", mock_g),
            patch.object(mod, "event_logger", mock_event_logger),
        ):
            from superset.exceptions import SupersetErrorException

            with pytest.raises(SupersetErrorException, match="not found"):
                await mod.save_sql_query(request)

    @pytest.mark.anyio
    async def test_save_query_access_denied(self) -> None:
        mod = _get_tool_module()
        mock_ctx = _make_mock_ctx()

        mock_db_obj = MagicMock()
        mock_db_obj.id = 1
        mock_db_obj.database_name = "test_db"

        request = SaveSqlQueryRequest(
            database_id=1,
            label="Test",
            sql="SELECT 1",
        )

        mock_db_session = MagicMock()
        (
            mock_db_session.session.query.return_value.filter_by.return_value.first.return_value
        ) = mock_db_obj

        mock_sm = MagicMock()
        mock_sm.can_access_database.return_value = False

        mock_g = MagicMock()
        mock_g.user = Mock(id=1)

        mock_event_logger = MagicMock()
        mock_event_logger.log_context.return_value.__enter__ = Mock()
        mock_event_logger.log_context.return_value.__exit__ = Mock(return_value=False)

        with (
            patch(
                "fastmcp.server.dependencies.get_context",
                return_value=mock_ctx,
            ),
            patch("superset.db", mock_db_session),
            patch("superset.security_manager", mock_sm),
            patch("flask.g", mock_g),
            patch.object(mod, "event_logger", mock_event_logger),
        ):
            from superset.exceptions import SupersetSecurityException

            with pytest.raises(SupersetSecurityException, match="Access denied"):
                await mod.save_sql_query(request)

    @pytest.mark.anyio
    async def test_save_query_with_schema_and_description(self) -> None:
        mod = _get_tool_module()
        mock_ctx = _make_mock_ctx()

        mock_db_obj = MagicMock()
        mock_db_obj.id = 1
        mock_db_obj.database_name = "test_db"

        mock_sq = MagicMock()
        mock_sq.id = 10
        mock_sq.label = "Test"
        mock_sq.sql = "SELECT 1"

        request = SaveSqlQueryRequest(
            database_id=1,
            label="Test",
            sql="SELECT 1",
            schema="public",
            description="A test query",
        )

        mock_db_session = MagicMock()
        (
            mock_db_session.session.query.return_value.filter_by.return_value.first.return_value
        ) = mock_db_obj

        mock_sm = MagicMock()
        mock_sm.can_access_database.return_value = True

        mock_dao = MagicMock()
        mock_dao.create.return_value = mock_sq

        mock_g = MagicMock()
        mock_g.user = Mock(id=1)

        mock_event_logger = MagicMock()
        mock_event_logger.log_context.return_value.__enter__ = Mock()
        mock_event_logger.log_context.return_value.__exit__ = Mock(return_value=False)

        with (
            patch(
                "fastmcp.server.dependencies.get_context",
                return_value=mock_ctx,
            ),
            patch("superset.db", mock_db_session),
            patch("superset.security_manager", mock_sm),
            patch("superset.daos.query.SavedQueryDAO", mock_dao),
            patch(
                "superset.mcp_service.utils.url_utils.get_superset_base_url",
                return_value="http://localhost:8088",
            ),
            patch("flask.g", mock_g),
            patch.object(mod, "event_logger", mock_event_logger),
        ):
            result = await mod.save_sql_query(request)

            assert result.id == 10
            call_attrs = mock_dao.create.call_args[1]["attributes"]
            assert call_attrs["schema"] == "public"
            assert call_attrs["description"] == "A test query"
