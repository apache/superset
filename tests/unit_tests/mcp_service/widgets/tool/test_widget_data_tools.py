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
"""Tests for the embeddable-widget data MCP tools."""

from __future__ import annotations

from collections.abc import Generator
from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client
from pydantic import ValidationError

from superset.commands.widget.exceptions import (
    SavedWidgetForbiddenError,
    SavedWidgetNotFoundError,
    WidgetInvalidError,
)
from superset.mcp_service.app import mcp
from superset.mcp_service.widgets.schemas import (
    GetSavedWidgetRequest,
    GetWidgetDataRequest,
    GetWidgetValuesRequest,
)
from superset.mcp_service.widgets.tool.get_saved_widget import (
    _get_saved_widget_impl,
)
from superset.mcp_service.widgets.tool.get_widget_data import _get_widget_data_impl
from superset.mcp_service.widgets.tool.get_widget_values import (
    _get_widget_values_impl,
)
from superset.utils import json

DATA_COMMAND = "superset.commands.widget.data.WidgetDataCommand"
VALUES_COMMAND = "superset.commands.widget.data.WidgetValuesCommand"
SAVED_COMMAND = "superset.commands.widget.saved.GetSavedWidgetCommand"
WIDGET_UUID = "cedf0501-fa36-4e19-9f84-e9da6d657dcc"

INLINE_BAR = {
    "type": "echarts",
    "props": {
        "chartType": "bar",
        "dataBinding": {
            "datasetId": 17,
            "metrics": ["sum__num"],
            "dimensions": ["state"],
        },
    },
}


@pytest.fixture(autouse=True)
def mock_auth() -> Generator[MagicMock, None, None]:
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def test_selector_requires_exactly_one_of_widget_or_id() -> None:
    with pytest.raises(ValidationError):
        GetWidgetDataRequest()
    with pytest.raises(ValidationError):
        GetWidgetValuesRequest(widget=INLINE_BAR, id=WIDGET_UUID)

    assert GetWidgetDataRequest(id=WIDGET_UUID).selector() == {"id": WIDGET_UUID}
    assert GetWidgetDataRequest(widget=INLINE_BAR).selector() == {"widget": INLINE_BAR}


def test_filters_reject_unknown_operators() -> None:
    with pytest.raises(ValidationError):
        GetWidgetDataRequest(
            id=WIDGET_UUID,
            filters=[{"column": "state", "operator": "LIKE", "value": "C%"}],
        )


def test_get_widget_data_dispatches_selector_and_filters() -> None:
    request = GetWidgetDataRequest(
        widget=INLINE_BAR,
        filters=[{"column": "state", "operator": "IN", "value": ["CA"]}],
    )
    with patch(DATA_COMMAND) as command:
        command.return_value.run.return_value = {
            "columns": ["state", "sum__num"],
            "rows": [{"state": "CA", "sum__num": Decimal("8998550")}],
        }
        result = _get_widget_data_impl(request)

    command.assert_called_once_with(
        {"widget": INLINE_BAR},
        [{"column": "state", "operator": "IN", "value": ["CA"]}],
    )
    assert result.model_dump() == {
        "columns": ["state", "sum__num"],
        "rows": [{"state": "CA", "sum__num": 8998550}],
    }


def test_get_widget_data_serializes_datetimes() -> None:
    with patch(DATA_COMMAND) as command:
        command.return_value.run.return_value = {
            "columns": ["ds"],
            "rows": [{"ds": datetime(2020, 1, 1)}],
        }
        result = _get_widget_data_impl(GetWidgetDataRequest(id=WIDGET_UUID))

    assert result.model_dump()["rows"] == [{"ds": "2020-01-01T00:00:00"}]


@pytest.mark.parametrize(
    ("exception", "error_type"),
    [
        (SavedWidgetNotFoundError(WIDGET_UUID), "NotFound"),
        (SavedWidgetForbiddenError(), "Forbidden"),
        (WidgetInvalidError("Unknown column 'nope'"), "ValidationError"),
        (RuntimeError("boom"), "UnexpectedError"),
    ],
)
def test_get_widget_data_maps_command_errors(
    exception: Exception, error_type: str
) -> None:
    with patch(DATA_COMMAND) as command:
        command.return_value.run.side_effect = exception
        result = _get_widget_data_impl(GetWidgetDataRequest(id=WIDGET_UUID))

    assert result.error_type == error_type
    assert "boom" not in result.error


def test_validation_errors_carry_field_details() -> None:
    details = [{"loc": ["dataBinding", "datasetId"], "message": "required"}]
    with patch(DATA_COMMAND) as command:
        command.return_value.run.side_effect = WidgetInvalidError(
            "Widget props failed validation.", details
        )
        result = _get_widget_data_impl(GetWidgetDataRequest(widget=INLINE_BAR))

    assert result.error_type == "ValidationError"
    assert result.errors == details


def test_get_widget_values_dispatches_selector() -> None:
    request = GetWidgetValuesRequest(id=WIDGET_UUID)
    with patch(VALUES_COMMAND) as command:
        command.return_value.run.return_value = ["boy", "girl"]
        result = _get_widget_values_impl(request)

    command.assert_called_once_with({"id": WIDGET_UUID})
    assert result.model_dump() == {"values": ["boy", "girl"]}


def test_get_saved_widget_serializes_model() -> None:
    widget = Mock(
        uuid=WIDGET_UUID,
        widget_type="echarts",
        title="Births by state",
        props_dict=INLINE_BAR["props"],
        dataset_id=17,
        changed_on=datetime(2026, 9, 15),
    )
    with patch(SAVED_COMMAND) as command:
        command.return_value.run.return_value = widget
        result = _get_saved_widget_impl(GetSavedWidgetRequest(id=WIDGET_UUID))

    command.assert_called_once_with(WIDGET_UUID)
    assert result.uuid == WIDGET_UUID
    assert result.dataset_id == 17
    assert result.props == INLINE_BAR["props"]


def test_get_saved_widget_not_found() -> None:
    with patch(SAVED_COMMAND) as command:
        command.return_value.run.side_effect = SavedWidgetNotFoundError(WIDGET_UUID)
        result = _get_saved_widget_impl(GetSavedWidgetRequest(id=WIDGET_UUID))

    assert result.error_type == "NotFound"


@pytest.mark.asyncio
async def test_tools_are_callable_through_mcp() -> None:
    async with Client(mcp) as client:
        names = {tool.name for tool in await client.list_tools()}
        assert {"get_widget_data", "get_widget_values", "get_saved_widget"} <= names

        with patch(DATA_COMMAND) as command:
            command.return_value.run.return_value = {
                "columns": ["state", "sum__num"],
                "rows": [{"state": "CA", "sum__num": 1}],
            }
            data = await client.call_tool(
                "get_widget_data",
                {"request": {"widget": INLINE_BAR, "filters": []}},
            )
        assert json.loads(data.content[0].text) == {
            "columns": ["state", "sum__num"],
            "rows": [{"state": "CA", "sum__num": 1}],
        }

        with patch(VALUES_COMMAND) as command:
            command.return_value.run.return_value = ["boy", "girl"]
            values = await client.call_tool(
                "get_widget_values", {"request": {"id": WIDGET_UUID}}
            )
        assert json.loads(values.content[0].text) == {"values": ["boy", "girl"]}

        with patch(SAVED_COMMAND) as command:
            command.return_value.run.side_effect = SavedWidgetForbiddenError()
            saved = await client.call_tool(
                "get_saved_widget", {"request": {"id": WIDGET_UUID}}
            )
        assert json.loads(saved.content[0].text)["error_type"] == "Forbidden"


@pytest.mark.asyncio
async def test_tool_rejects_ambiguous_selector() -> None:
    async with Client(mcp) as client:
        with pytest.raises(Exception, match="exactly one"):
            await client.call_tool(
                "get_widget_data",
                {"request": {"widget": INLINE_BAR, "id": WIDGET_UUID}},
            )
