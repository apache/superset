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

"""SQL-dataset errors guide semantic callers without resolving another source."""

from unittest.mock import MagicMock, patch

import pytest
from fastmcp import Client
from fastmcp.client.client import CallToolResult

from superset.commands.dataset.exceptions import (
    DatasetDataAccessIsNotAllowed,
    DatasetInvalidError,
    DatasetNotFoundError,
    TableNotFoundValidationError,
)
from superset.mcp_service.app import mcp
from superset.mcp_service.dataset.schemas import DatasetError
from superset.mcp_service.dataset.tool.create_dataset import _classify_invalid_error
from superset.mcp_service.privacy import DATA_MODEL_METADATA_ERROR_TYPE
from superset.sql.parse import Table
from superset.utils import json


async def _call(name: str, request: dict[str, object]) -> dict[str, object]:
    """Call the registered tool as an authenticated metadata-enabled user."""
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=MagicMock(id=1),
        ),
        patch(
            "superset.mcp_service.dataset.tool.get_dataset_info.user_can_view_data_model_metadata",
            return_value=True,
        ),
        patch(
            "superset.mcp_service.dataset.tool.query_dataset.user_can_view_data_model_metadata",
            return_value=True,
        ),
    ):
        async with Client(mcp) as client:
            result: CallToolResult = await client.call_tool(name, {"request": request})
    return json.loads(result.content[0].text)


def _assert_guidance(error: object) -> None:
    """Assert the action and source distinction, not a shared message constant."""
    assert isinstance(error, str)
    assert "SQL dataset" in error
    assert "semantic view" in error
    assert "list_metrics" in error
    assert "get_table" in error


@pytest.mark.asyncio
@pytest.mark.parametrize("identifier", [7, "9b6f05a7-3b88-4ad9-a34e-7a9b2ea465f4"])
async def test_get_dataset_info_missing_source_guidance(identifier: int | str) -> None:
    """IDs and UUIDs receive generic guidance, not a semantic-view diagnosis."""
    with patch(
        "superset.mcp_service.mcp_core.ModelGetInfoCore._find_object", return_value=None
    ):
        data: dict[str, object] = await _call(
            "get_dataset_info", {"identifier": identifier}
        )
    assert data["error_type"] == "not_found"
    _assert_guidance(data["error"])


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["query_dataset", "update_dataset"])
@pytest.mark.parametrize("identifier", [7, "9b6f05a7-3b88-4ad9-a34e-7a9b2ea465f4"])
async def test_missing_sql_dataset_guidance(name: str, identifier: int | str) -> None:
    """Do not resolve a different source after a SQL-dataset miss."""
    request: dict[str, object] = {"dataset_id": identifier}
    if name == "update_dataset":
        request["description"] = "unchanged"
    else:
        request["columns"] = ["category"]
    lookup_path: str = (
        "superset.mcp_service.dataset.tool.query_dataset.resolve_dataset"
        if name == "query_dataset"
        else "superset.mcp_service.dataset.dataset_utils.resolve_dataset"
    )
    with (
        patch(lookup_path, return_value=None) as lookup,
        patch("superset.commands.dataset.update.UpdateDatasetCommand") as update,
    ):
        data: dict[str, object] = await _call(name, request)
    lookup.assert_called_once()
    assert lookup.call_args.args[0] == identifier
    update.assert_not_called()
    _assert_guidance(data["error"])
    if name == "query_dataset":
        assert data["error_type"] == "NotFound"


@pytest.mark.asyncio
async def test_update_dataset_disappearing_source_guidance() -> None:
    """The command's not-found race carries the same SQL-only guidance."""
    dataset: MagicMock = MagicMock(id=7, columns=[])
    with (
        patch(
            "superset.mcp_service.dataset.dataset_utils.resolve_dataset",
            return_value=dataset,
        ),
        patch("superset.security.SupersetSecurityManager.raise_for_editorship"),
        patch("superset.commands.dataset.update.UpdateDatasetCommand") as update,
    ):
        update.return_value.run.side_effect = DatasetNotFoundError()
        data: dict[str, object] = await _call(
            "update_dataset", {"dataset_id": 7, "description": "x"}
        )
    _assert_guidance(data["error"])


def test_create_dataset_missing_table_guidance() -> None:
    """A missing physical table can be a mistaken semantic-view registration."""
    result: DatasetError = _classify_invalid_error(
        DatasetInvalidError(exceptions=[TableNotFoundValidationError(Table("orders"))])
    )
    assert result.error_type == "TableNotFoundError"
    assert "orders" in result.error
    _assert_guidance(result.error)


def test_create_dataset_denial_does_not_suggest_an_alternative_source() -> None:
    """Access denials remain denials, not routing suggestions."""
    result: DatasetError = _classify_invalid_error(
        DatasetInvalidError(exceptions=[DatasetDataAccessIsNotAllowed("denied")])
    )
    assert result.error_type == "AccessDeniedError"
    assert result.error == "Access denied"


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["get_dataset_info", "query_dataset"])
async def test_privacy_denial_precedes_lookup_and_guidance(name: str) -> None:
    """Routing advice must not bypass the direct-call privacy gate."""
    request: dict[str, object] = {
        "identifier" if name == "get_dataset_info" else "dataset_id": 7
    }
    if name == "query_dataset":
        request["columns"] = ["category"]
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=MagicMock(id=1),
        ),
        patch(
            f"superset.mcp_service.dataset.tool.{name}.user_can_view_data_model_metadata",
            return_value=False,
        ),
        patch(
            "superset.mcp_service.mcp_core.ModelGetInfoCore._find_object"
        ) as info_lookup,
        patch(
            "superset.mcp_service.dataset.tool.query_dataset.resolve_dataset"
        ) as dataset_lookup,
    ):
        async with Client(mcp) as client:
            result: CallToolResult = await client.call_tool(name, {"request": request})
    data: dict[str, object] = json.loads(result.content[0].text)
    assert data["error_type"] == DATA_MODEL_METADATA_ERROR_TYPE
    assert "list_metrics" not in str(data["error"])
    info_lookup.assert_not_called()
    dataset_lookup.assert_not_called()
