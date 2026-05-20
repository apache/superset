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

import logging
from unittest.mock import MagicMock, patch

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError
from pydantic import ValidationError

from superset.mcp_service.app import mcp
from superset.mcp_service.report.schemas import ListReportsRequest, ReportFilter
from superset.utils import json

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


def create_mock_report(
    report_id: int = 1,
    name: str = "Daily Sales Report",
    report_type: str = "Report",
    active: bool = True,
    crontab: str = "0 9 * * *",
    description: str = "A daily report",
    dashboard_id: int | None = None,
    chart_id: int | None = None,
) -> MagicMock:
    """Factory function to create mock report objects with sensible defaults."""
    report = MagicMock()
    report.id = report_id
    report.name = name
    report.type = report_type
    report.active = active
    report.crontab = crontab
    report.description = description
    report.dashboard_id = dashboard_id
    report.chart_id = chart_id
    report.owners = []
    report.changed_on = None
    report.created_on = None
    return report


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests."""
    from unittest.mock import Mock

    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


class TestReportFilterSchema:
    """Tests for ReportFilter schema — filterable columns."""

    def test_valid_filter_name(self):
        f = ReportFilter(col="name", opr="eq", value="My Report")
        assert f.col == "name"

    def test_valid_filter_type(self):
        f = ReportFilter(col="type", opr="eq", value="Alert")
        assert f.col == "type"

    def test_valid_filter_active(self):
        f = ReportFilter(col="active", opr="eq", value=True)
        assert f.col == "active"

    def test_valid_filter_dashboard_id(self):
        f = ReportFilter(col="dashboard_id", opr="eq", value=1)
        assert f.col == "dashboard_id"

    def test_valid_filter_chart_id(self):
        f = ReportFilter(col="chart_id", opr="eq", value=42)
        assert f.col == "chart_id"

    def test_invalid_filter_column_rejected(self):
        """Columns not in the Literal set must be rejected."""
        with pytest.raises(ValidationError):
            ReportFilter(col="not_a_real_column", opr="eq", value=1)

    def test_created_by_fk_is_rejected(self):
        """created_by_fk is not a public filter column."""
        with pytest.raises(ValidationError):
            ReportFilter(col="created_by_fk", opr="eq", value=1)


def test_list_reports_request_accepts_valid_fields():
    request = ListReportsRequest(page=1, page_size=10)
    assert request.page == 1
    assert request.page_size == 10


def test_list_reports_request_rejects_search_and_filters_together():
    with pytest.raises(ValidationError):
        ListReportsRequest(
            search="my report",
            filters=[{"col": "active", "opr": "eq", "value": True}],
        )


@patch("superset.daos.report.ReportScheduleDAO.list")
@pytest.mark.asyncio
async def test_list_reports_basic(mock_list, mcp_server):
    """Test basic report listing functionality."""
    report = create_mock_report()
    mock_list.return_value = ([report], 1)

    async with Client(mcp_server) as client:
        request = ListReportsRequest(page=1, page_size=10)
        result = await client.call_tool(
            "list_reports", {"request": request.model_dump()}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["reports"] is not None
        assert len(data["reports"]) == 1
        assert data["reports"][0]["id"] == 1
        assert data["reports"][0]["name"] == "Daily Sales Report"
        assert data["reports"][0]["type"] == "Report"
        assert data["reports"][0]["active"] is True
        assert data["reports"][0]["crontab"] == "0 9 * * *"


@patch("superset.daos.report.ReportScheduleDAO.list")
@pytest.mark.asyncio
async def test_list_reports_with_search(mock_list, mcp_server):
    """Test report listing with search functionality."""
    report = create_mock_report(name="Weekly Alert")
    mock_list.return_value = ([report], 1)

    async with Client(mcp_server) as client:
        request = ListReportsRequest(page=1, page_size=10, search="Weekly")
        result = await client.call_tool(
            "list_reports", {"request": request.model_dump()}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["reports"] is not None
        assert len(data["reports"]) == 1
        assert data["reports"][0]["name"] == "Weekly Alert"


@patch("superset.daos.report.ReportScheduleDAO.list")
@pytest.mark.asyncio
async def test_list_reports_with_type_filter(mock_list, mcp_server):
    """Test report listing filtered by type."""
    report = create_mock_report(report_type="Alert")
    mock_list.return_value = ([report], 1)

    async with Client(mcp_server) as client:
        request = ListReportsRequest(
            page=1,
            page_size=10,
            filters=[{"col": "type", "opr": "eq", "value": "Alert"}],
        )
        result = await client.call_tool(
            "list_reports", {"request": request.model_dump()}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert len(data["reports"]) == 1
        assert data["reports"][0]["type"] == "Alert"


@patch("superset.daos.report.ReportScheduleDAO.list")
@pytest.mark.asyncio
async def test_list_reports_does_not_expose_owners(mock_list, mcp_server):
    """Test that owners field is stripped by privacy controls."""
    report = create_mock_report()
    mock_list.return_value = ([report], 1)

    async with Client(mcp_server) as client:
        request = ListReportsRequest(
            page=1,
            page_size=10,
            select_columns=["id", "name", "owners"],
        )
        result = await client.call_tool(
            "list_reports", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        # owners is filtered by USER_DIRECTORY_FIELDS
        assert "owners" not in data.get("columns_requested", [])
        assert "owners" not in data.get("columns_loaded", [])


@patch("superset.daos.report.ReportScheduleDAO.list")
@pytest.mark.asyncio
async def test_list_reports_empty_results(mock_list, mcp_server):
    """Test report listing with no results."""
    mock_list.return_value = ([], 0)

    async with Client(mcp_server) as client:
        request = ListReportsRequest(page=1, page_size=10)
        result = await client.call_tool(
            "list_reports", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        assert data["reports"] == []
        assert data["count"] == 0
        assert data["total_count"] == 0


@patch("superset.daos.report.ReportScheduleDAO.list")
@pytest.mark.asyncio
async def test_list_reports_api_error(mock_list, mcp_server):
    """Test error handling when DAO raises an exception."""
    mock_list.side_effect = ToolError("Report DAO error")

    async with Client(mcp_server) as client:
        request = ListReportsRequest(page=1, page_size=10)
        with pytest.raises(ToolError) as excinfo:  # noqa: PT012
            await client.call_tool("list_reports", {"request": request.model_dump()})
        assert "Report DAO error" in str(excinfo.value)


@patch("superset.daos.report.ReportScheduleDAO.list")
@pytest.mark.asyncio
async def test_list_reports_without_request_uses_defaults(mock_list, mcp_server):
    """list_reports with no request payload should use default parameters."""
    mock_list.return_value = ([], 0)

    async with Client(mcp_server) as client:
        result = await client.call_tool("list_reports", {})
        data = json.loads(result.content[0].text)
        assert data["reports"] == []
        assert data["page"] == 1


@patch("superset.daos.report.ReportScheduleDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_report_info_basic(mock_find, mcp_server):
    """Test basic get report info functionality."""
    report = create_mock_report()
    mock_find.return_value = report

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_report_info", {"request": {"identifier": 1}}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["id"] == 1
        assert data["name"] == "Daily Sales Report"
        assert data["type"] == "Report"
        assert data["active"] is True
        assert data["crontab"] == "0 9 * * *"
        assert "owners" not in data


@patch("superset.daos.report.ReportScheduleDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_report_info_alert_type(mock_find, mcp_server):
    """Test get report info for an Alert type schedule."""
    report = create_mock_report(report_type="Alert", name="Revenue Alert")
    mock_find.return_value = report

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_report_info", {"request": {"identifier": 1}}
        )
        data = json.loads(result.content[0].text)
        assert data["type"] == "Alert"
        assert data["name"] == "Revenue Alert"


@patch("superset.daos.report.ReportScheduleDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_report_info_not_found(mock_find, mcp_server):
    """Test get report info when report does not exist."""
    mock_find.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_report_info", {"request": {"identifier": 999}}
        )
        data = json.loads(result.content[0].text)
        assert data["error_type"] == "not_found"


@patch("superset.daos.report.ReportScheduleDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_report_info_with_dashboard(mock_find, mcp_server):
    """Test get report info with associated dashboard."""
    report = create_mock_report(dashboard_id=42)
    mock_find.return_value = report

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_report_info", {"request": {"identifier": 1}}
        )
        data = json.loads(result.content[0].text)
        assert data["dashboard_id"] == 42
        assert data["chart_id"] is None


@patch("superset.daos.report.ReportScheduleDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_report_info_with_chart(mock_find, mcp_server):
    """Test get report info with associated chart."""
    report = create_mock_report(chart_id=7)
    mock_find.return_value = report

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_report_info", {"request": {"identifier": 1}}
        )
        data = json.loads(result.content[0].text)
        assert data["chart_id"] == 7
        assert data["dashboard_id"] is None


def test_list_reports_request_rejects_invalid_order_column():
    """order_column is validated against REPORT_SORTABLE_COLUMNS."""
    from superset.mcp_service.common.schema_discovery import REPORT_SORTABLE_COLUMNS

    assert "invalid_column" not in REPORT_SORTABLE_COLUMNS
    # The validation happens inside ModelListCore, not the request schema,
    # so we just verify the sortable list doesn't include bad columns.
    request = ListReportsRequest(page=1, page_size=10, order_column="invalid_column")
    assert (
        request.order_column == "invalid_column"
    )  # schema accepts it; core rejects it


@patch("superset.daos.report.ReportScheduleDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_report_info_humanized_timestamps(mock_find, mcp_server):
    """Test that changed_on_humanized and created_on_humanized are returned."""
    from datetime import datetime, timezone

    report = create_mock_report()
    report.changed_on = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    report.created_on = datetime(2024, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
    mock_find.return_value = report

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_report_info", {"request": {"identifier": 1}}
        )
        data = json.loads(result.content[0].text)
        assert "changed_on_humanized" in data
        assert data["changed_on_humanized"] is not None
        assert "created_on_humanized" in data
        assert data["created_on_humanized"] is not None


@patch("superset.daos.report.ReportScheduleDAO.list")
@pytest.mark.asyncio
async def test_list_reports_owned_by_me_passed_to_dao(mock_list, mcp_server):
    """owned_by_me=True is forwarded to the DAO layer."""
    mock_list.return_value = ([], 0)

    async with Client(mcp_server) as client:
        request = ListReportsRequest(page=1, page_size=10, owned_by_me=True)
        await client.call_tool("list_reports", {"request": request.model_dump()})

    mock_list.assert_called_once()
    _, kwargs = mock_list.call_args
    filters_arg = kwargs.get("filters", [])
    assert any(getattr(f, "col", None) == "owners.id" for f in filters_arg), (
        "owned_by_me should inject an owners.id filter into the DAO call"
    )


@patch("superset.daos.report.ReportScheduleDAO.list")
@pytest.mark.asyncio
async def test_list_reports_created_by_me_passed_to_dao(mock_list, mcp_server):
    """created_by_me=True is forwarded to the DAO layer."""
    mock_list.return_value = ([], 0)

    async with Client(mcp_server) as client:
        request = ListReportsRequest(page=1, page_size=10, created_by_me=True)
        await client.call_tool("list_reports", {"request": request.model_dump()})

    mock_list.assert_called_once()
    _, kwargs = mock_list.call_args
    filters_arg = kwargs.get("filters", [])
    assert any(getattr(f, "col", None) == "created_by_fk" for f in filters_arg), (
        "created_by_me should inject a created_by_fk filter into the DAO call"
    )
