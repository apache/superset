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

"""Unit tests for the update_dataset MCP tool."""

from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastmcp import Client, FastMCP
from pydantic import ValidationError

from superset.mcp_service.app import mcp
from superset.mcp_service.dataset.schemas import UpdateDatasetRequest
from superset.utils import json

_FIND = "superset.daos.dataset.DatasetDAO.find_by_id"
_UPDATE = "superset.commands.dataset.update.UpdateDatasetCommand"
_REFRESH = "superset.commands.dataset.refresh.RefreshDatasetCommand"


@pytest.fixture
def mcp_server() -> FastMCP:
    """Provide the shared FastMCP app instance for the in-process test client."""
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[MagicMock]:
    """Mock authentication for all tests."""
    from unittest.mock import Mock

    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


@pytest.fixture(autouse=True)
def allow_ownership() -> Iterator[MagicMock]:
    """Let ownership checks pass by default; override to simulate a non-owner.

    Patches the security manager class method (rather than the module-level
    proxy) so it resolves without an app context, as in CI.
    """
    with patch(
        "superset.security.SupersetSecurityManager.raise_for_editorship",
        return_value=None,
    ) as mock_raise:
        yield mock_raise


@pytest.fixture(autouse=True)
def base_url() -> Iterator[None]:
    with patch(
        "superset.mcp_service.utils.url_utils.get_superset_base_url",
        return_value="http://localhost:8088",
    ):
        yield


def make_dataset(
    dataset_id: int = 1,
    table_name: str = "my_dataset",
    sql: str | None = "SELECT a, b FROM t",
    columns: list[str] | None = None,
    main_dttm_col: str | None = None,
) -> MagicMock:
    """Build a stand-in SqlaTable exposing the attributes the tool reads."""
    dataset = MagicMock()
    dataset.id = dataset_id
    dataset.table_name = table_name
    dataset.sql = sql
    dataset.main_dttm_col = main_dttm_col
    dataset.columns = [
        SimpleNamespace(column_name=name) for name in (columns or ["a", "b"])
    ]
    return dataset


def command_returning(dataset: MagicMock) -> MagicMock:
    command = MagicMock()
    command.run.return_value = dataset
    command.metadata_refreshed = True
    return command


async def call_update(mcp_server: FastMCP, **request: Any) -> dict[str, Any]:
    async with Client(mcp_server) as client:
        result = await client.call_tool("update_dataset", {"request": request})
    return json.loads(result.content[0].text)


# ---------------------------------------------------------------------------
# Request schema validation
# ---------------------------------------------------------------------------


def test_request_requires_a_property_or_sync() -> None:
    with pytest.raises(ValidationError, match="At least one dataset property"):
        UpdateDatasetRequest(dataset_id=1)


def test_request_allows_sync_columns_alone() -> None:
    request = UpdateDatasetRequest(dataset_id=1, sync_columns=True)
    assert request.updates() == {}


def test_request_rejects_sync_columns_false_alone() -> None:
    with pytest.raises(ValidationError, match="At least one dataset property"):
        UpdateDatasetRequest(dataset_id=1, sync_columns=False)


def test_request_rejects_empty_sql() -> None:
    with pytest.raises(ValidationError, match="sql cannot be empty"):
        UpdateDatasetRequest(dataset_id=1, sql="  ")


def test_request_rejects_null_sql() -> None:
    """Clearing sql would silently turn a virtual dataset into a physical one."""
    with pytest.raises(ValidationError, match="sql cannot be empty"):
        UpdateDatasetRequest(dataset_id=1, sql=None)


def test_request_rejects_null_table_name() -> None:
    with pytest.raises(ValidationError, match="table_name cannot be empty"):
        UpdateDatasetRequest(dataset_id=1, table_name=None)


def test_request_rejects_boolean_dataset_id() -> None:
    with pytest.raises(ValidationError, match="dataset_id must be"):
        UpdateDatasetRequest(dataset_id=True, description="x")


def test_request_rejects_cache_timeout_below_minus_one() -> None:
    with pytest.raises(ValidationError):
        UpdateDatasetRequest(dataset_id=1, cache_timeout=-2)


def test_request_rejects_boolean_cache_timeout() -> None:
    """cache_timeout=true would otherwise coerce to a one-second timeout."""
    with pytest.raises(ValidationError, match="cache_timeout must be"):
        UpdateDatasetRequest(dataset_id=1, cache_timeout=True)


def test_request_updates_keeps_explicit_nulls() -> None:
    request = UpdateDatasetRequest.model_validate(
        {"dataset_id": 1, "description": None, "cache_timeout": 600}
    )
    assert request.updates() == {"description": None, "cache_timeout": 600}


# ---------------------------------------------------------------------------
# Tool behavior
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_dataset_not_found(mcp_server: FastMCP) -> None:
    with patch(_FIND, return_value=None), patch(_UPDATE) as update_cls:
        data = await call_update(mcp_server, dataset_id=999, description="x")

    assert "999" in data["error"]
    update_cls.assert_not_called()


@pytest.mark.asyncio
async def test_update_dataset_forbidden_before_any_write(
    mcp_server: FastMCP, allow_ownership: MagicMock
) -> None:
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    allow_ownership.side_effect = SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.MISSING_OWNERSHIP_ERROR,
            message="nope",
            level=ErrorLevel.ERROR,
        )
    )
    with patch(_FIND, return_value=make_dataset()), patch(_UPDATE) as update_cls:
        data = await call_update(mcp_server, dataset_id=1, description="x")

    assert data["permission_denied"] is True
    assert "owner" in data["error"]
    update_cls.assert_not_called()


@pytest.mark.asyncio
async def test_update_dataset_description_only(mcp_server: FastMCP) -> None:
    dataset = make_dataset()
    with (
        patch(_FIND, return_value=dataset),
        patch(_UPDATE, return_value=command_returning(dataset)) as update_cls,
        patch(_REFRESH) as refresh_cls,
    ):
        data = await call_update(mcp_server, dataset_id=1, description="new")

    update_cls.assert_called_once_with(
        1, {"description": "new"}, override_columns=False
    )
    refresh_cls.assert_not_called()
    assert data["error"] is None
    assert data["updated_properties"] == ["description"]
    assert data["columns_synced"] is False
    assert data["dataset_name"] == "my_dataset"
    assert "datasource_id=1" in data["url"]


@pytest.mark.asyncio
async def test_update_dataset_rejects_sql_on_physical_dataset(
    mcp_server: FastMCP,
) -> None:
    with (
        patch(_FIND, return_value=make_dataset(sql=None)),
        patch(_UPDATE) as update_cls,
    ):
        data = await call_update(mcp_server, dataset_id=1, sql="SELECT 1 AS x")

    assert "virtual dataset" in data["error"]
    update_cls.assert_not_called()


@pytest.mark.asyncio
async def test_update_dataset_sql_change_syncs_columns(mcp_server: FastMCP) -> None:
    dataset = make_dataset(columns=["a", "b"])
    refreshed = make_dataset(sql="SELECT a, c FROM t", columns=["a", "c"])
    with (
        patch(_FIND, return_value=dataset),
        patch(_UPDATE, return_value=command_returning(dataset)) as update_cls,
        patch(_REFRESH, return_value=command_returning(refreshed)) as refresh_cls,
    ):
        data = await call_update(mcp_server, dataset_id=1, sql="SELECT a, c FROM t")

    update_cls.assert_called_once_with(
        1, {"sql": "SELECT a, c FROM t"}, override_columns=True
    )
    refresh_cls.assert_called_once_with(1)
    assert data["error"] is None
    assert data["columns_synced"] is True
    assert data["added_columns"] == ["c"]
    assert data["removed_columns"] == ["b"]
    assert data["warnings"] == []


@pytest.mark.asyncio
async def test_update_dataset_unchanged_sql_does_not_sync(mcp_server: FastMCP) -> None:
    dataset = make_dataset(sql="SELECT a, b FROM t")
    with (
        patch(_FIND, return_value=dataset),
        patch(_UPDATE, return_value=command_returning(dataset)),
        patch(_REFRESH) as refresh_cls,
    ):
        data = await call_update(mcp_server, dataset_id=1, sql="SELECT a, b FROM t")

    refresh_cls.assert_not_called()
    assert data["columns_synced"] is False


@pytest.mark.asyncio
async def test_update_dataset_sync_columns_false_skips_sync(
    mcp_server: FastMCP,
) -> None:
    dataset = make_dataset()
    with (
        patch(_FIND, return_value=dataset),
        patch(_UPDATE, return_value=command_returning(dataset)) as update_cls,
        patch(_REFRESH) as refresh_cls,
    ):
        data = await call_update(
            mcp_server, dataset_id=1, sql="SELECT a FROM t", sync_columns=False
        )

    update_cls.assert_called_once_with(
        1, {"sql": "SELECT a FROM t"}, override_columns=False
    )
    refresh_cls.assert_not_called()
    assert data["columns_synced"] is False


@pytest.mark.asyncio
async def test_update_dataset_sync_columns_alone(mcp_server: FastMCP) -> None:
    dataset = make_dataset(columns=["a"])
    refreshed = make_dataset(columns=["a", "b"])
    with (
        patch(_FIND, return_value=dataset),
        patch(_UPDATE) as update_cls,
        patch(_REFRESH, return_value=command_returning(refreshed)),
    ):
        data = await call_update(mcp_server, dataset_id=1, sync_columns=True)

    update_cls.assert_not_called()
    assert data["error"] is None
    assert data["updated_properties"] == []
    assert data["columns_synced"] is True
    assert data["added_columns"] == ["b"]


@pytest.mark.asyncio
async def test_update_dataset_sync_failure_is_a_warning(mcp_server: FastMCP) -> None:
    """The update is already committed when the refresh fails, so the response
    must say so instead of reporting a plain failure."""
    from superset.commands.dataset.exceptions import DatasetRefreshFailedError

    dataset = make_dataset()
    refresh = MagicMock()
    refresh.run.side_effect = DatasetRefreshFailedError()
    with (
        patch(_FIND, return_value=dataset),
        patch(_UPDATE, return_value=command_returning(dataset)),
        patch(_REFRESH, return_value=refresh),
    ):
        data = await call_update(mcp_server, dataset_id=1, sql="SELECT a FROM t")

    assert data["error"] is None
    assert data["updated_properties"] == ["sql"]
    assert data["columns_synced"] is False
    assert len(data["warnings"]) == 1
    assert "saved" in data["warnings"][0]


@pytest.mark.asyncio
async def test_update_dataset_sync_db_error_does_not_leak(mcp_server: FastMCP) -> None:
    from sqlalchemy.exc import OperationalError

    dataset = make_dataset()
    refresh = MagicMock()
    refresh.run.side_effect = OperationalError(
        "SELECT * FROM secret", {}, Exception("secret-host refused")
    )
    with (
        patch(_FIND, return_value=dataset),
        patch(_UPDATE, return_value=command_returning(dataset)),
        patch(_REFRESH, return_value=refresh),
    ):
        data = await call_update(mcp_server, dataset_id=1, sql="SELECT a FROM t")

    assert "secret-host" not in data["warnings"][0]
    assert "database error" in data["warnings"][0]


@pytest.mark.asyncio
async def test_update_dataset_rejects_unknown_main_dttm_col(
    mcp_server: FastMCP,
) -> None:
    with (
        patch(_FIND, return_value=make_dataset(columns=["a", "b"])),
        patch(_UPDATE) as update_cls,
    ):
        data = await call_update(mcp_server, dataset_id=1, main_dttm_col="ds")

    assert "ds" in data["error"]
    update_cls.assert_not_called()


@pytest.mark.asyncio
async def test_update_dataset_main_dttm_col_applied_after_sync(
    mcp_server: FastMCP,
) -> None:
    """A datetime column that only exists in the new SQL is set after the
    re-sync, in a second update."""
    dataset = make_dataset(columns=["a"])
    refreshed = make_dataset(columns=["a", "ds"])
    with (
        patch(_FIND, return_value=dataset),
        patch(_UPDATE, return_value=command_returning(refreshed)) as update_cls,
        patch(_REFRESH, return_value=command_returning(refreshed)),
    ):
        data = await call_update(
            mcp_server, dataset_id=1, sql="SELECT a, ds FROM t", main_dttm_col="ds"
        )

    assert update_cls.call_args_list[0].args == (1, {"sql": "SELECT a, ds FROM t"})
    assert update_cls.call_args_list[1].args == (1, {"main_dttm_col": "ds"})
    assert data["updated_properties"] == ["main_dttm_col", "sql"]
    assert data["warnings"] == []


@pytest.mark.asyncio
async def test_update_dataset_main_dttm_col_missing_after_sync_warns(
    mcp_server: FastMCP,
) -> None:
    dataset = make_dataset(columns=["a"])
    refreshed = make_dataset(columns=["a", "b"])
    with (
        patch(_FIND, return_value=dataset),
        patch(_UPDATE, return_value=command_returning(refreshed)) as update_cls,
        patch(_REFRESH, return_value=command_returning(refreshed)),
    ):
        data = await call_update(
            mcp_server, dataset_id=1, sql="SELECT a, b FROM t2", main_dttm_col="ds"
        )

    assert update_cls.call_count == 1
    assert data["updated_properties"] == ["sql"]
    assert "main_dttm_col was not changed" in data["warnings"][0]


@pytest.mark.asyncio
async def test_update_dataset_main_dttm_col_not_applied_when_sync_fails(
    mcp_server: FastMCP,
) -> None:
    from superset.commands.dataset.exceptions import DatasetRefreshFailedError

    dataset = make_dataset(columns=["a"])
    refresh = MagicMock()
    refresh.run.side_effect = DatasetRefreshFailedError()
    with (
        patch(_FIND, return_value=dataset),
        patch(_UPDATE, return_value=command_returning(dataset)) as update_cls,
        patch(_REFRESH, return_value=refresh),
    ):
        data = await call_update(
            mcp_server, dataset_id=1, sql="SELECT a, ds FROM t", main_dttm_col="ds"
        )

    assert update_cls.call_count == 1
    assert data["updated_properties"] == ["sql"]
    assert any("could not be re-synced" in warning for warning in data["warnings"])


@pytest.mark.asyncio
async def test_update_dataset_warns_when_sync_drops_main_dttm_col(
    mcp_server: FastMCP,
) -> None:
    dataset = make_dataset(columns=["a", "ds"], main_dttm_col="ds")
    refreshed = make_dataset(columns=["a"], main_dttm_col="ds")
    with (
        patch(_FIND, return_value=dataset),
        patch(_UPDATE, return_value=command_returning(dataset)),
        patch(_REFRESH, return_value=command_returning(refreshed)),
    ):
        data = await call_update(mcp_server, dataset_id=1, sql="SELECT a FROM t")

    assert data["removed_columns"] == ["ds"]
    assert "no longer a column" in data["warnings"][0]


@pytest.mark.asyncio
async def test_update_dataset_invalid(mcp_server: FastMCP) -> None:
    from marshmallow import ValidationError as MarshmallowValidationError

    from superset.commands.dataset.exceptions import DatasetInvalidError

    update = MagicMock()
    update.run.side_effect = DatasetInvalidError(
        exceptions=[
            MarshmallowValidationError(
                "Dataset my_dataset already exists", field_name="table_name"
            )
        ]
    )
    with patch(_FIND, return_value=make_dataset()), patch(_UPDATE, return_value=update):
        data = await call_update(mcp_server, dataset_id=1, table_name="taken")

    assert "already exists" in data["error"]


@pytest.mark.asyncio
async def test_update_dataset_forbidden_from_command(mcp_server: FastMCP) -> None:
    from superset.commands.dataset.exceptions import DatasetForbiddenError

    update = MagicMock()
    update.run.side_effect = DatasetForbiddenError()
    with patch(_FIND, return_value=make_dataset()), patch(_UPDATE, return_value=update):
        data = await call_update(mcp_server, dataset_id=1, description="x")

    assert data["permission_denied"] is True


@pytest.mark.asyncio
async def test_update_dataset_skipped_refresh_is_a_warning(
    mcp_server: FastMCP,
) -> None:
    """RefreshDatasetCommand skips, without raising, SQL it cannot render
    outside a query; the response must not claim the columns were synced."""
    dataset = make_dataset(columns=["a"])
    refresh = command_returning(dataset)
    refresh.metadata_refreshed = False
    with (
        patch(_FIND, return_value=dataset),
        patch(_UPDATE, return_value=command_returning(dataset)) as update_cls,
        patch(_REFRESH, return_value=refresh),
    ):
        data = await call_update(
            mcp_server,
            dataset_id=1,
            sql="SELECT a, ds FROM t WHERE ds > '{{ from_dttm }}'",
            main_dttm_col="ds",
        )

    assert data["error"] is None
    assert data["updated_properties"] == ["sql"]
    assert data["columns_synced"] is False
    assert data["added_columns"] == []
    assert data["removed_columns"] == []
    assert "not re-synced" in data["warnings"][0]
    assert "main_dttm_col was not changed" in data["warnings"][1]
    assert update_cls.call_count == 1


@pytest.mark.asyncio
async def test_update_dataset_main_dttm_col_update_failure_is_partial(
    mcp_server: FastMCP,
) -> None:
    """The SQL and the column re-sync are committed before main_dttm_col is
    set, so a failure there is reported next to the saved changes."""
    from superset.commands.dataset.exceptions import DatasetUpdateFailedError

    dataset = make_dataset(columns=["a"])
    refreshed = make_dataset(columns=["a", "ds"])
    failing = MagicMock()
    failing.run.side_effect = DatasetUpdateFailedError()
    with (
        patch(_FIND, return_value=dataset),
        patch(_UPDATE, side_effect=[command_returning(refreshed), failing]),
        patch(_REFRESH, return_value=command_returning(refreshed)),
    ):
        data = await call_update(
            mcp_server, dataset_id=1, sql="SELECT a, ds FROM t", main_dttm_col="ds"
        )

    assert data["error"] is None
    assert data["updated_properties"] == ["sql"]
    assert data["columns_synced"] is True
    assert data["added_columns"] == ["ds"]
    assert len(data["warnings"]) == 1
    assert "main_dttm_col was not changed to 'ds'" in data["warnings"][0]
    assert "rest of the update was saved" in data["warnings"][0]


@pytest.mark.asyncio
async def test_update_dataset_lookup_db_error_is_structured(
    mcp_server: FastMCP,
) -> None:
    """A database failure while resolving the dataset returns a structured
    error instead of escaping the tool, and does not leak the driver text."""
    from sqlalchemy.exc import OperationalError

    with (
        patch(_FIND, side_effect=OperationalError("SELECT ...", {}, Exception("down"))),
        patch(_UPDATE) as update_cls,
    ):
        data = await call_update(mcp_server, dataset_id=1, description="x")

    assert data["error"] == "Dataset lookup failed due to a database error."
    assert "down" not in data["error"]
    update_cls.assert_not_called()
