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
Unit tests for get_chart_info MCP tool privacy behavior.
"""

import importlib
from contextlib import nullcontext
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.schemas import (
    ChartInfo,
    extract_filters_from_form_data,
    GetChartInfoRequest,
)
from superset.utils import json

get_chart_info_module = importlib.import_module(
    "superset.mcp_service.chart.tool.get_chart_info"
)


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield


def _make_chart_info() -> ChartInfo:
    form_data = {
        "viz_type": "table",
        "datasource": "12__table",
        "datasource_name": "vehicle_sales",
        "filters": [{"col": "state", "op": "IN", "val": ["CA"]}],
    }
    return ChartInfo(
        id=123,
        slice_name="Vehicle Sales",
        viz_type="table",
        datasource_name="vehicle_sales",
        datasource_type="table",
        filters=extract_filters_from_form_data(form_data),
        form_data=form_data,
    )


class TestGetChartInfoPrivacy:
    @pytest.mark.asyncio
    async def test_restricted_user_redacts_saved_chart_data_model_fields(
        self, mcp_server
    ) -> None:
        chart_info = _make_chart_info()

        with (
            patch.object(
                get_chart_info_module.event_logger,
                "log_context",
                return_value=nullcontext(),
            ),
            patch.object(
                get_chart_info_module.ModelGetInfoCore,
                "run_tool",
                return_value=chart_info,
            ),
            patch.object(
                get_chart_info_module,
                "user_can_view_data_model_metadata",
                return_value=False,
                create=True,
            ),
            patch.object(
                get_chart_info_module,
                "validate_chart_dataset",
                return_value=SimpleNamespace(is_valid=True, warnings=[]),
            ),
            patch("superset.daos.chart.ChartDAO.find_by_id", return_value=Mock()),
            patch("superset.mcp_service.auth.check_tool_permission", return_value=True),
        ):
            async with Client(mcp_server) as client:
                response = await client.call_tool(
                    "get_chart_info",
                    {"request": GetChartInfoRequest(identifier=123).model_dump()},
                )

        result = json.loads(response.content[0].text)
        assert result["datasource_name"] is None
        assert result["datasource_type"] is None
        assert result["filters"] is None
        assert result["form_data"] is None

    @pytest.mark.asyncio
    async def test_restricted_user_redacts_unsaved_chart_data_model_fields(
        self, mcp_server
    ) -> None:
        cached_form_data = (
            '{"viz_type":"table","datasource_name":"vehicle_sales",'
            '"datasource_type":"table","filters":[{"col":"state","op":"IN",'
            '"val":["CA"]}],"metrics":["count"]}'
        )

        with (
            patch.object(
                get_chart_info_module.event_logger,
                "log_context",
                return_value=nullcontext(),
            ),
            patch.object(
                get_chart_info_module,
                "user_can_view_data_model_metadata",
                return_value=False,
                create=True,
            ),
            patch.object(
                get_chart_info_module,
                "get_cached_form_data",
                return_value=cached_form_data,
            ),
            patch("superset.mcp_service.auth.check_tool_permission", return_value=True),
        ):
            async with Client(mcp_server) as client:
                response = await client.call_tool(
                    "get_chart_info",
                    {
                        "request": GetChartInfoRequest(
                            form_data_key="cached-key"
                        ).model_dump()
                    },
                )

        result = json.loads(response.content[0].text)
        assert result["datasource_name"] is None
        assert result["datasource_type"] is None
        assert result["filters"] is None
        assert result["form_data"] is None
