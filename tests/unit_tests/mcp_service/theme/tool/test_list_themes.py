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

"""Unit tests for the list_themes MCP tool."""

from collections.abc import Iterator
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError
from pydantic import ValidationError

from superset.mcp_service.app import mcp
from superset.mcp_service.constants import MAX_PAGE_SIZE
from superset.mcp_service.theme.schemas import ListThemesRequest, ThemeFilter
from superset.utils import json


def create_mock_theme(
    theme_id: int = 1,
    theme_name: str = "Corporate Blue",
    json_data: str = '{"token": {"colorPrimary": "#1d4ed8"}}',
    uuid: str = "11111111-1111-1111-1111-111111111111",
) -> MagicMock:
    theme = MagicMock()
    theme.id = theme_id
    theme.theme_name = theme_name
    theme.json_data = json_data
    theme.uuid = uuid
    theme.is_system = False
    theme.is_system_default = False
    theme.is_system_dark = False
    theme.changed_on = None
    theme.created_on = None
    return theme


@pytest.fixture
def mcp_server() -> object:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[Mock]:
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


class TestThemeFilterSchema:
    """Tests for ThemeFilter schema — filterable columns."""

    def test_invalid_filter_column_rejected(self) -> None:
        with pytest.raises(ValidationError):
            ThemeFilter(col="not_a_real_column", opr="eq", value="x")

    def test_valid_theme_name_filter(self) -> None:
        f = ThemeFilter(col="theme_name", opr="ct", value="blue")
        assert f.col == "theme_name"


@patch("superset.daos.theme.ThemeDAO.list")
@pytest.mark.asyncio
async def test_list_themes_basic(mock_list: MagicMock, mcp_server: object) -> None:
    """Basic theme listing returns the mocked theme."""
    theme = create_mock_theme()
    mock_list.return_value = ([theme], 1)
    async with Client(mcp_server) as client:
        request = ListThemesRequest(page=1, page_size=10)
        result = await client.call_tool(
            "list_themes", {"request": request.model_dump()}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["themes"] is not None
        assert len(data["themes"]) == 1
        assert data["themes"][0]["id"] == 1
        assert "Corporate Blue" in data["themes"][0]["theme_name"]


@patch("superset.daos.theme.ThemeDAO.list")
@pytest.mark.asyncio
async def test_list_themes_without_request(
    mock_list: MagicMock, mcp_server: object
) -> None:
    """Listing with no request payload uses defaults."""
    theme = create_mock_theme()
    mock_list.return_value = ([theme], 1)
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_themes", {})
        data = json.loads(result.content[0].text)
        assert data["themes"] is not None
        assert len(data["themes"]) == 1


@patch("superset.daos.theme.ThemeDAO.list")
@pytest.mark.asyncio
async def test_list_themes_multiple(mock_list: MagicMock, mcp_server: object) -> None:
    """Multiple themes are returned."""
    themes = [
        create_mock_theme(theme_id=1, theme_name="Light"),
        create_mock_theme(theme_id=2, theme_name="Dark"),
    ]
    mock_list.return_value = (themes, 2)
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_themes", {})
        data = json.loads(result.content[0].text)
        assert data["total_count"] == 2
        assert len(data["themes"]) == 2
        names = {t["theme_name"] for t in data["themes"]}
        assert any("Light" in n for n in names)
        assert any("Dark" in n for n in names)


class TestListThemesRequestPaginationValidation:
    """Schema-level validation for page/page_size — mirrors
    ListChartsRequest's pagination validation tests, since ListThemesRequest
    uses the identical PositiveInt/Field(gt=0, le=MAX_PAGE_SIZE) constraints."""

    def test_negative_page_rejected(self) -> None:
        """page is a PositiveInt (gt=0), so negative values fail schema
        validation before the tool body ever runs."""
        with pytest.raises(ValidationError, match="Input should be greater than 0"):
            ListThemesRequest(page=-1)

    def test_zero_page_rejected(self) -> None:
        with pytest.raises(ValidationError, match="Input should be greater than 0"):
            ListThemesRequest(page=0)

    def test_page_size_zero_rejected(self) -> None:
        """page_size has gt=0, so 0 is rejected at the schema level."""
        with pytest.raises(ValidationError, match="Input should be greater than 0"):
            ListThemesRequest(page_size=0)

    def test_page_size_negative_rejected(self) -> None:
        with pytest.raises(ValidationError, match="Input should be greater than 0"):
            ListThemesRequest(page_size=-5)

    def test_page_size_exceeds_max_rejected(self) -> None:
        """page_size has le=MAX_PAGE_SIZE, so values over the max are rejected
        at the schema level — ModelListCore's min(page_size, MAX_PAGE_SIZE)
        clamp is defense-in-depth for callers that bypass schema validation,
        not something reachable through the public ListThemesRequest path."""
        with pytest.raises(
            ValidationError,
            match=f"Input should be less than or equal to {MAX_PAGE_SIZE}",
        ):
            ListThemesRequest(page_size=MAX_PAGE_SIZE + 1)

    def test_page_size_at_max_accepted(self) -> None:
        """page_size == MAX_PAGE_SIZE is the boundary-valid case."""
        request = ListThemesRequest(page_size=MAX_PAGE_SIZE)
        assert request.page_size == MAX_PAGE_SIZE

    def test_search_and_filters_mutually_exclusive(self) -> None:
        """The model_validator rejects combining search with filters."""
        with pytest.raises(
            ValidationError, match="Cannot use both 'search' and 'filters'"
        ):
            ListThemesRequest(
                search="blue",
                filters=[ThemeFilter(col="theme_name", opr="ct", value="blue")],
            )


class TestListThemesPaginationEdges:
    """Pagination edge cases exercised through the actual tool call path,
    matching ModelListCore.run_tool's real (0-based internally, 1-based in
    the response) pagination arithmetic."""

    @patch("superset.daos.theme.ThemeDAO.list")
    @pytest.mark.asyncio
    async def test_page_beyond_last_page_returns_empty(
        self, mock_list: MagicMock, mcp_server: object
    ) -> None:
        """Requesting a page past the last page of results returns an empty
        themes list but preserves the real total_count/total_pages, since
        those come from a separate DAO count independent of the page slice."""
        # Only 1 theme exists in total, but we ask for page 5 (page_size=10):
        # a real DB would return no rows for that offset while total_count
        # still reflects the overall match count.
        mock_list.return_value = ([], 1)
        async with Client(mcp_server) as client:
            request = ListThemesRequest(page=5, page_size=10)
            result = await client.call_tool(
                "list_themes", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

        # page is converted to 0-based (page - 1 = 4) before hitting the DAO.
        assert mock_list.call_args.kwargs["page"] == 4
        assert mock_list.call_args.kwargs["page_size"] == 10
        assert data["themes"] == []
        assert data["total_count"] == 1
        assert data["total_pages"] == 1
        assert data["page"] == 5
        assert data["has_previous"] is True
        assert data["has_next"] is False

    @patch("superset.daos.theme.ThemeDAO.list")
    @pytest.mark.asyncio
    async def test_page_size_at_max_is_not_clamped(
        self, mock_list: MagicMock, mcp_server: object
    ) -> None:
        """page_size == MAX_PAGE_SIZE passes through untouched (the
        defense-in-depth min() clamp in ModelListCore is a no-op here)."""
        mock_list.return_value = ([], 0)
        async with Client(mcp_server) as client:
            request = ListThemesRequest(page=1, page_size=MAX_PAGE_SIZE)
            result = await client.call_tool(
                "list_themes", {"request": request.model_dump()}
            )
            data = json.loads(result.content[0].text)

        assert mock_list.call_args.kwargs["page_size"] == MAX_PAGE_SIZE
        assert data["page_size"] == MAX_PAGE_SIZE

    @patch("superset.daos.theme.ThemeDAO.list")
    @pytest.mark.asyncio
    async def test_empty_result_set(
        self, mock_list: MagicMock, mcp_server: object
    ) -> None:
        """No matching themes: total_pages is 0 (not negative/erroring), and
        has_previous/has_next both reflect the first-page, no-results state."""
        mock_list.return_value = ([], 0)
        async with Client(mcp_server) as client:
            result = await client.call_tool("list_themes", {})
            data = json.loads(result.content[0].text)

        assert data["themes"] == []
        assert data["total_count"] == 0
        assert data["total_pages"] == 0
        assert data["has_previous"] is False
        assert data["has_next"] is False


@patch("superset.daos.theme.ThemeDAO.list")
@pytest.mark.asyncio
async def test_list_themes_dao_error_propagates_as_tool_error(
    mock_list: MagicMock, mcp_server: object
) -> None:
    """Unlike get_theme_info, list_themes' outermost except re-raises rather
    than returning a ThemeError — the FastMCP middleware converts the
    unhandled exception into a ToolError."""
    mock_list.side_effect = RuntimeError("database connection lost")
    async with Client(mcp_server) as client:
        with pytest.raises(ToolError) as excinfo:  # noqa: PT012
            await client.call_tool("list_themes", {})
        assert "database connection lost" in str(excinfo.value)


@patch("superset.daos.theme.ThemeDAO.list")
@pytest.mark.asyncio
async def test_list_themes_invalid_select_columns_raises_tool_error(
    mock_list: MagicMock, mcp_server: object
) -> None:
    """select_columns made up entirely of unknown columns are filtered out
    by the ALL_THEME_COLUMNS allowlist in _get_columns_to_load, leaving no
    valid columns — ModelListCore raises ValueError, which list_themes lets
    propagate (surfaced by middleware as a ToolError)."""
    async with Client(mcp_server) as client:
        with pytest.raises(ToolError) as excinfo:  # noqa: PT012
            await client.call_tool(
                "list_themes", {"request": {"select_columns": ["not_a_real_column"]}}
            )
        assert "no valid columns" in str(excinfo.value)
    mock_list.assert_not_called()


@patch("superset.daos.theme.ThemeDAO.list")
@pytest.mark.asyncio
async def test_list_themes_invalid_order_column_raises_tool_error(
    mock_list: MagicMock, mcp_server: object
) -> None:
    """order_column outside SORTABLE_THEME_COLUMNS is rejected by
    _validate_order_column before the DAO is ever queried."""
    async with Client(mcp_server) as client:
        with pytest.raises(ToolError) as excinfo:  # noqa: PT012
            await client.call_tool(
                "list_themes", {"request": {"order_column": "json_data"}}
            )
        assert "Invalid order_column" in str(excinfo.value)
    mock_list.assert_not_called()
