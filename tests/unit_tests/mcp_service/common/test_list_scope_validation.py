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

"""Consistent validation for MCP list tools with caller-relative filters."""

from unittest.mock import Mock, patch

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError
from pydantic import BaseModel, ValidationError

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.schemas import ListChartsRequest
from superset.mcp_service.dashboard.schemas import ListDashboardsRequest
from superset.mcp_service.database.schemas import ListDatabasesRequest
from superset.mcp_service.dataset.schemas import ListDatasetsRequest
from superset.mcp_service.report.schemas import ListReportsRequest

LIST_REQUESTS = [
    ListChartsRequest,
    ListDashboardsRequest,
    ListDatasetsRequest,
    ListReportsRequest,
    ListDatabasesRequest,
]


@pytest.mark.parametrize("request_type", LIST_REQUESTS)
@pytest.mark.parametrize(("field", "value"), [("owned_by_me", True), ("page_szie", 10)])
def test_self_scoped_lists_reject_unknown_fields(
    request_type: type[BaseModel], field: str, value: bool | int
) -> None:
    """Unknown scope flags and typos cannot silently broaden any sibling list."""
    suggestion = (
        "page_size"
        if field == "page_szie"
        else (
            "edited_by_me"
            if "edited_by_me" in request_type.model_fields
            else "created_by_me"
        )
    )
    with pytest.raises(ValidationError, match=f"did you mean '{suggestion}'"):
        request_type.model_validate({field: value})
    assert request_type.model_json_schema()["additionalProperties"] is False


@pytest.mark.parametrize("request_type", LIST_REQUESTS)
@pytest.mark.parametrize("alias", ["columns", "select_columns"])
def test_self_scoped_lists_preserve_filters_and_aliases(
    request_type: type[BaseModel], alias: str
) -> None:
    """Strictness preserves valid self filters, cache controls and column aliases."""
    flags = {"created_by_me": True}
    if "edited_by_me" in request_type.model_fields:
        flags["edited_by_me"] = True
    request = request_type.model_validate(
        {**flags, alias: ["id"], "page_size": 5, "refresh_metadata": True}
    )
    values = request.model_dump()
    assert all(values[flag] for flag in flags)
    assert values["select_columns"] == ["id"]
    assert values["page_size"] == 5
    assert values["refresh_metadata"] is True


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool_name", "dao_path", "suggestion"),
    [
        ("list_charts", "superset.daos.chart.ChartDAO.list", "edited_by_me"),
        ("list_datasets", "superset.daos.dataset.DatasetDAO.list", "edited_by_me"),
        ("list_reports", "superset.daos.report.ReportScheduleDAO.list", "edited_by_me"),
        ("list_databases", "superset.daos.database.DatabaseDAO.list", "created_by_me"),
    ],
)
async def test_sibling_list_unknown_scope_never_reaches_dao(
    tool_name: str, dao_path: str, suggestion: str
) -> None:
    """The registered MCP tools reject unsupported scope before querying data."""
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request", return_value=Mock(id=42)
        ),
        patch(dao_path) as dao,
    ):
        async with Client(mcp) as client:
            with pytest.raises(ToolError, match=f"did you mean '{suggestion}'"):
                await client.call_tool(tool_name, {"request": {"owned_by_me": True}})
    dao.assert_not_called()
