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

"""Unit tests for update_saved_query MCP tool."""

import importlib
import sys
import types
from unittest.mock import MagicMock, patch

import pytest

from superset.commands.query.exceptions import (
    SavedQueryInvalidError,
    SavedQueryNotFoundError,
    SavedQueryUpdateFailedError,
)
from superset.mcp_service.saved_query.schemas import UpdateSavedQueryRequest

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

    sys.modules["superset.extensions"] = MagicMock()

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
    mod_name = "superset.mcp_service.saved_query.tool.update_saved_query"
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


def _mock_update_module(sq=None, exception=None):
    """Return a mock superset.commands.query.update module."""
    mod = MagicMock()
    if exception is not None:
        mod.UpdateSavedQueryCommand.return_value.run.side_effect = exception
    elif sq is not None:
        mod.UpdateSavedQueryCommand.return_value.run.return_value = sq
    return mod


def _mock_exceptions_module():
    """Return a mock superset.commands.query.exceptions module with real classes."""
    mod = MagicMock()
    mod.SavedQueryInvalidError = SavedQueryInvalidError
    mod.SavedQueryNotFoundError = SavedQueryNotFoundError
    mod.SavedQueryUpdateFailedError = SavedQueryUpdateFailedError
    return mod


class TestUpdateSavedQuerySchemas:
    def test_valid_request_with_label(self) -> None:
        req = UpdateSavedQueryRequest(id=1, label="New Name")
        assert req.id == 1
        assert req.label == "New Name"

    def test_id_only_is_valid(self) -> None:
        req = UpdateSavedQueryRequest(id=5)
        assert req.id == 5
        assert req.label is None
        assert req.sql is None

    def test_empty_sql_fails(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="sql must not be empty"):
            UpdateSavedQueryRequest(id=1, sql="  ")

    def test_empty_label_fails(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError, match="label must not be empty"):
            UpdateSavedQueryRequest(id=1, label="  ")

    def test_sql_is_stripped(self) -> None:
        req = UpdateSavedQueryRequest(id=1, sql="  SELECT 1  ")
        assert req.sql == "SELECT 1"


class TestUpdateSavedQueryToolLogic:
    @pytest.mark.anyio
    async def test_update_success(self) -> None:
        mod, saved = _get_tool_module()
        try:
            mock_sq = MagicMock()
            mock_sq.id = 42
            mock_sq.label = "Renamed"
            mock_sq.sql = "SELECT 1"
            mock_sq.db_id = 1
            mock_sq.schema = None
            mock_sq.description = None

            request = UpdateSavedQueryRequest(id=42, label="Renamed")

            with patch.dict(
                sys.modules,
                {
                    "superset.commands.query.update": _mock_update_module(sq=mock_sq),
                    "superset.commands.query.exceptions": _mock_exceptions_module(),
                },
            ):
                result = await mod.update_saved_query(request, _make_mock_ctx())

            assert result.id == 42
            assert result.label == "Renamed"
            assert result.error is None
            assert "savedQueryId=42" in result.url
            assert _BASE_URL in result.url
        finally:
            _restore_modules(saved)

    @pytest.mark.anyio
    async def test_update_no_fields_returns_error(self) -> None:
        mod, saved = _get_tool_module()
        try:
            request = UpdateSavedQueryRequest(id=42)

            # The tool still performs lazy imports before the no-op check,
            # so we must stub the command modules to avoid transitive failures.
            with patch.dict(
                sys.modules,
                {
                    "superset.commands.query.update": _mock_update_module(),
                    "superset.commands.query.exceptions": _mock_exceptions_module(),
                },
            ):
                result = await mod.update_saved_query(request, _make_mock_ctx())

            assert result.id is None
            assert result.error is not None
            assert "No fields to update" in result.error
        finally:
            _restore_modules(saved)

    @pytest.mark.anyio
    async def test_update_not_found(self) -> None:
        mod, saved = _get_tool_module()
        try:
            exc = SavedQueryNotFoundError()
            request = UpdateSavedQueryRequest(id=999, label="Ghost")

            with patch.dict(
                sys.modules,
                {
                    "superset.commands.query.update": _mock_update_module(
                        exception=exc
                    ),
                    "superset.commands.query.exceptions": _mock_exceptions_module(),
                },
            ):
                result = await mod.update_saved_query(request, _make_mock_ctx())

            assert result.id is None
            assert result.error is not None
            assert "999" in result.error
        finally:
            _restore_modules(saved)

    @pytest.mark.anyio
    async def test_update_invalid_db(self) -> None:
        mod, saved = _get_tool_module()
        try:
            from marshmallow import ValidationError as MarshmallowValidationError

            exc = SavedQueryInvalidError(
                exceptions=[
                    MarshmallowValidationError(
                        "Database with ID 999 not found", field_name="db_id"
                    )
                ]
            )
            request = UpdateSavedQueryRequest(id=1, db_id=999)

            with patch.dict(
                sys.modules,
                {
                    "superset.commands.query.update": _mock_update_module(
                        exception=exc
                    ),
                    "superset.commands.query.exceptions": _mock_exceptions_module(),
                },
            ):
                result = await mod.update_saved_query(request, _make_mock_ctx())

            assert result.id is None
            assert result.error is not None
        finally:
            _restore_modules(saved)

    @pytest.mark.anyio
    async def test_update_command_failed(self) -> None:
        mod, saved = _get_tool_module()
        try:
            exc = SavedQueryUpdateFailedError()
            request = UpdateSavedQueryRequest(id=1, sql="SELECT 2")

            with patch.dict(
                sys.modules,
                {
                    "superset.commands.query.update": _mock_update_module(
                        exception=exc
                    ),
                    "superset.commands.query.exceptions": _mock_exceptions_module(),
                },
            ):
                result = await mod.update_saved_query(request, _make_mock_ctx())

            assert result.id is None
            assert result.error is not None
            assert "Failed to update" in result.error
        finally:
            _restore_modules(saved)
