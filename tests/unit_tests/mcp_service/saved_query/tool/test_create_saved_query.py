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

"""Unit tests for create_saved_query MCP tool."""

import importlib
import sys
import types
from unittest.mock import MagicMock, patch

import pytest

from superset.commands.query.exceptions import (
    SavedQueryCreateFailedError,
    SavedQueryInvalidError,
)
from superset.mcp_service.saved_query.schemas import CreateSavedQueryRequest

_BASE_URL = "http://localhost:8088"


def _force_passthrough_decorators() -> dict[str, types.ModuleType]:
    def _passthrough_tool(func=None, **kwargs):
        if func is not None:
            return func
        return lambda f: f

    mock_mcp = MagicMock()
    mock_mcp.tool = _passthrough_tool
    mock_decorators = MagicMock()
    mock_decorators.tool = _passthrough_tool
    mock_api = MagicMock()
    mock_api.mcp = mock_mcp

    # Keys we will override — save originals so _restore_modules can put them back.
    override_keys = [
        "superset_core.api",
        "superset_core.api.mcp",
        "superset_core.api.types",
        "superset_core.mcp",
        "superset_core.mcp.decorators",
        "superset.extensions",
        "superset.mcp_service.utils",
        "superset.mcp_service.utils.url_utils",
    ]
    saved: dict[str, types.ModuleType] = {}
    for key in override_keys:
        if key in sys.modules:
            saved[key] = sys.modules[key]

    sys.modules["superset_core.api"] = mock_api
    sys.modules["superset_core.api.mcp"] = mock_mcp
    sys.modules["superset_core.mcp"] = mock_mcp
    sys.modules["superset_core.mcp.decorators"] = mock_decorators
    sys.modules.setdefault("superset_core.api.types", MagicMock())

    # Stub extensions so `from superset.extensions import event_logger` succeeds.
    sys.modules["superset.extensions"] = MagicMock()

    # Stub url_utils to avoid importing nh3 (a PyO3 module that can't be
    # re-initialized in the same process).
    mock_url_utils = MagicMock()
    mock_url_utils.get_superset_base_url.return_value = _BASE_URL
    sys.modules["superset.mcp_service.utils"] = MagicMock()
    sys.modules["superset.mcp_service.utils.url_utils"] = mock_url_utils

    return saved


def _restore_modules(saved: dict[str, types.ModuleType]) -> None:
    evict_prefixes = (
        "superset_core.api",
        "superset_core.mcp",
        "superset.mcp_service.saved_query.tool",
        "superset.mcp_service.utils",
        "superset.extensions",
    )
    for key in list(sys.modules.keys()):
        if any(key == p or key.startswith(p + ".") for p in evict_prefixes):
            del sys.modules[key]
    sys.modules.update(saved)


def _get_tool_module():
    saved = _force_passthrough_decorators()
    mod_name = "superset.mcp_service.saved_query.tool.create_saved_query"
    for key in list(sys.modules.keys()):
        if key.startswith("superset.mcp_service.saved_query.tool"):
            saved[key] = sys.modules.pop(key)
    mod = importlib.import_module(mod_name)
    return mod, saved


def _make_mock_ctx():
    async def _noop(*args, **kwargs):
        pass

    ctx = MagicMock()
    ctx.info = _noop
    ctx.error = _noop
    ctx.warning = _noop
    return ctx


def _mock_create_module(sq=None, exception=None):
    """Return a mock superset.commands.query.create module."""
    mod = MagicMock()
    if exception is not None:
        mod.CreateSavedQueryCommand.return_value.run.side_effect = exception
    elif sq is not None:
        mod.CreateSavedQueryCommand.return_value.run.return_value = sq
    return mod


def _mock_exceptions_module():
    """Return a mock superset.commands.query.exceptions module with real classes."""
    mod = MagicMock()
    mod.SavedQueryInvalidError = SavedQueryInvalidError
    mod.SavedQueryCreateFailedError = SavedQueryCreateFailedError
    return mod


class TestCreateSavedQuerySchemas:
    def test_valid_request(self) -> None:
        req = CreateSavedQueryRequest(db_id=1, label="My Query", sql="SELECT 1")
        assert req.db_id == 1
        assert req.label == "My Query"
        assert req.sql == "SELECT 1"

    def test_optional_fields(self) -> None:
        req = CreateSavedQueryRequest(
            db_id=1,
            label="My Query",
            sql="SELECT 1",
            schema="public",
            catalog="main",
            description="A test",
            template_parameters='{"limit": 100}',
        )
        assert req.schema == "public"
        assert req.catalog == "main"
        assert req.description == "A test"
        assert req.template_parameters == '{"limit": 100}'

    def test_empty_sql_fails(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="sql must not be empty"):
            CreateSavedQueryRequest(db_id=1, label="test", sql="  ")

    def test_empty_label_fails(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="label must not be empty"):
            CreateSavedQueryRequest(db_id=1, label="  ", sql="SELECT 1")

    def test_sql_is_stripped(self) -> None:
        req = CreateSavedQueryRequest(db_id=1, label="test", sql="  SELECT 1  ")
        assert req.sql == "SELECT 1"

    def test_label_is_stripped(self) -> None:
        req = CreateSavedQueryRequest(db_id=1, label="  My Query  ", sql="SELECT 1")
        assert req.label == "My Query"


class TestCreateSavedQueryToolLogic:
    @pytest.mark.anyio
    async def test_create_success(self) -> None:
        mod, saved = _get_tool_module()
        try:
            mock_sq = MagicMock()
            mock_sq.id = 42
            mock_sq.label = "My Query"
            mock_sq.sql = "SELECT 1"
            mock_sq.db_id = 1
            mock_sq.schema = None
            mock_sq.catalog = None
            mock_sq.description = None

            request = CreateSavedQueryRequest(db_id=1, label="My Query", sql="SELECT 1")

            with patch.dict(
                sys.modules,
                {
                    "superset.commands.query.create": _mock_create_module(sq=mock_sq),
                    "superset.commands.query.exceptions": _mock_exceptions_module(),
                },
            ):
                result = await mod.create_saved_query(request, _make_mock_ctx())

            assert result.id == 42
            assert result.label == "My Query"
            assert result.error is None
            assert "savedQueryId=42" in result.url
            assert _BASE_URL in result.url
        finally:
            _restore_modules(saved)

    @pytest.mark.anyio
    async def test_create_invalid_db(self) -> None:
        mod, saved = _get_tool_module()
        try:
            from marshmallow import ValidationError as MarshmallowValidationError

            exc = SavedQueryInvalidError(
                exceptions=[
                    MarshmallowValidationError("db_id is required", field_name="db_id")
                ]
            )
            request = CreateSavedQueryRequest(db_id=1, label="Test", sql="SELECT 1")

            with patch.dict(
                sys.modules,
                {
                    "superset.commands.query.create": _mock_create_module(
                        exception=exc
                    ),
                    "superset.commands.query.exceptions": _mock_exceptions_module(),
                },
            ):
                result = await mod.create_saved_query(request, _make_mock_ctx())

            assert result.id is None
            assert result.error is not None
        finally:
            _restore_modules(saved)

    @pytest.mark.anyio
    async def test_create_command_failed(self) -> None:
        mod, saved = _get_tool_module()
        try:
            exc = SavedQueryCreateFailedError()
            request = CreateSavedQueryRequest(db_id=1, label="Test", sql="SELECT 1")

            with patch.dict(
                sys.modules,
                {
                    "superset.commands.query.create": _mock_create_module(
                        exception=exc
                    ),
                    "superset.commands.query.exceptions": _mock_exceptions_module(),
                },
            ):
                result = await mod.create_saved_query(request, _make_mock_ctx())

            assert result.id is None
            assert result.error is not None
            assert "Failed to create" in result.error
        finally:
            _restore_modules(saved)

    @pytest.mark.anyio
    async def test_create_with_optional_fields(self) -> None:
        mod, saved = _get_tool_module()
        try:
            mock_sq = MagicMock()
            mock_sq.id = 10
            mock_sq.label = "Test"
            mock_sq.sql = "SELECT 1"
            mock_sq.db_id = 2
            mock_sq.schema = "analytics"
            mock_sq.catalog = None
            mock_sq.description = "My desc"

            request = CreateSavedQueryRequest(
                db_id=2,
                label="Test",
                sql="SELECT 1",
                schema="analytics",
                description="My desc",
                template_parameters='{"x": 1}',
            )

            mock_create_mod = _mock_create_module(sq=mock_sq)

            with patch.dict(
                sys.modules,
                {
                    "superset.commands.query.create": mock_create_mod,
                    "superset.commands.query.exceptions": _mock_exceptions_module(),
                },
            ):
                result = await mod.create_saved_query(request, _make_mock_ctx())

            assert result.id == 10
            called_with = mock_create_mod.CreateSavedQueryCommand.call_args[0][0]
            assert called_with["schema"] == "analytics"
            assert called_with["description"] == "My desc"
            assert called_with["template_parameters"] == '{"x": 1}'
        finally:
            _restore_modules(saved)

    @pytest.mark.anyio
    async def test_create_with_catalog(self) -> None:
        mod, saved = _get_tool_module()
        try:
            mock_sq = MagicMock()
            mock_sq.id = 55
            mock_sq.label = "Catalog Query"
            mock_sq.sql = "SELECT 1"
            mock_sq.db_id = 3
            mock_sq.schema = "dbo"
            mock_sq.catalog = "main"
            mock_sq.description = None

            request = CreateSavedQueryRequest(
                db_id=3,
                label="Catalog Query",
                sql="SELECT 1",
                schema="dbo",
                catalog="main",
            )

            mock_create_mod = _mock_create_module(sq=mock_sq)

            with patch.dict(
                sys.modules,
                {
                    "superset.commands.query.create": mock_create_mod,
                    "superset.commands.query.exceptions": _mock_exceptions_module(),
                },
            ):
                result = await mod.create_saved_query(request, _make_mock_ctx())

            assert result.id == 55
            assert result.catalog == "main"
            called_with = mock_create_mod.CreateSavedQueryCommand.call_args[0][0]
            assert called_with["catalog"] == "main"
        finally:
            _restore_modules(saved)
