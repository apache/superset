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
from superset.mcp_service.css_template.schemas import (
    CssTemplateFilter,
    ListCssTemplatesRequest,
)
from superset.mcp_service.utils.sanitization import (
    LLM_CONTEXT_CLOSE_DELIMITER,
    LLM_CONTEXT_OPEN_DELIMITER,
)
from superset.utils import json

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


def _wrapped(value: str) -> str:
    return f"{LLM_CONTEXT_OPEN_DELIMITER}\n{value}\n{LLM_CONTEXT_CLOSE_DELIMITER}"


class TestCssTemplateFilterSchema:
    """Tests for CssTemplateFilter schema — filterable columns."""

    def test_invalid_filter_column_rejected(self):
        """Columns not in the Literal set must be rejected."""
        with pytest.raises(ValidationError):
            CssTemplateFilter(col="not_a_real_column", opr="eq", value="test")

    def test_valid_filter_column_accepted(self):
        """template_name is a valid filter column."""
        f = CssTemplateFilter(col="template_name", opr="eq", value="my_template")
        assert f.col == "template_name"

    def test_css_column_not_filterable(self):
        """css is not a public filter column (large field)."""
        with pytest.raises(ValidationError):
            CssTemplateFilter(col="css", opr="eq", value="body {}")

    def test_created_by_fk_filter_accepted(self):
        """created_by_fk is a valid filter column for filtering by creator."""
        f = CssTemplateFilter(col="created_by_fk", opr="eq", value=1)
        assert f.col == "created_by_fk"


def create_mock_css_template(
    template_id: int = 1,
    template_name: str = "my_template",
    css: str = "body { color: red; }",
    uuid: str | None = None,
    created_by_name: str | None = "admin",
    changed_by_name: str | None = "admin",
) -> MagicMock:
    """Factory function to create mock CSS template objects."""
    template = MagicMock()
    template.id = template_id
    template.template_name = template_name
    template.css = css
    template.uuid = (
        uuid if uuid is not None else f"test-css-template-uuid-{template_id}"
    )
    template.changed_on = None
    template.created_on = None
    template.created_by_name = created_by_name
    template.changed_by_name = changed_by_name
    return template


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests."""
    from unittest.mock import Mock, patch

    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


@patch("superset.daos.css.CssTemplateDAO.list")
@pytest.mark.asyncio
async def test_list_css_templates_basic(mock_list, mcp_server):
    """Test basic CSS template listing functionality."""
    template = create_mock_css_template()
    mock_list.return_value = ([template], 1)

    async with Client(mcp_server) as client:
        request = ListCssTemplatesRequest(page=1, page_size=10)
        result = await client.call_tool(
            "list_css_templates", {"request": request.model_dump()}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["css_templates"] is not None
        assert len(data["css_templates"]) == 1
        assert data["css_templates"][0]["id"] == 1
        assert data["css_templates"][0]["template_name"] == _wrapped("my_template")


@patch("superset.daos.css.CssTemplateDAO.list")
@pytest.mark.asyncio
async def test_list_css_templates_css_not_in_default_columns(mock_list, mcp_server):
    """Test that css field is excluded from default columns (it's large)."""
    template = create_mock_css_template()
    mock_list.return_value = ([template], 1)

    async with Client(mcp_server) as client:
        result = await client.call_tool("list_css_templates", {})
        data = json.loads(result.content[0].text)

    assert data["css_templates"] is not None
    assert len(data["css_templates"]) == 1
    # css not in default columns
    assert "css" not in data["css_templates"][0]
    assert data["columns_requested"] == ["id", "uuid", "template_name"]
    assert data["css_templates"][0]["uuid"] == "test-css-template-uuid-1"


@patch("superset.daos.css.CssTemplateDAO.list")
@pytest.mark.asyncio
async def test_list_css_templates_with_search(mock_list, mcp_server):
    """Test CSS template listing with search functionality."""
    template = create_mock_css_template(template_name="dark_theme_css")
    mock_list.return_value = ([template], 1)

    async with Client(mcp_server) as client:
        request = ListCssTemplatesRequest(page=1, page_size=10, search="dark")
        result = await client.call_tool(
            "list_css_templates", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        assert len(data["css_templates"]) == 1
        assert data["css_templates"][0]["template_name"] == _wrapped("dark_theme_css")


@patch("superset.daos.css.CssTemplateDAO.list")
@pytest.mark.asyncio
async def test_list_css_templates_with_select_columns_css(mock_list, mcp_server):
    """Test that css can be requested via select_columns."""
    template = create_mock_css_template(css="body { margin: 0; }")
    mock_list.return_value = ([template], 1)

    async with Client(mcp_server) as client:
        request = ListCssTemplatesRequest(
            page=1, page_size=10, select_columns=["id", "template_name", "css"]
        )
        result = await client.call_tool(
            "list_css_templates", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        assert data["css_templates"][0]["css"] == _wrapped("body { margin: 0; }")


@patch("superset.daos.css.CssTemplateDAO.list")
@pytest.mark.asyncio
async def test_list_css_templates_with_filters(mock_list, mcp_server):
    """Test CSS template listing with filters."""
    template = create_mock_css_template(template_name="bootstrap_css")
    mock_list.return_value = ([template], 1)

    async with Client(mcp_server) as client:
        request = ListCssTemplatesRequest(
            page=1,
            page_size=10,
            filters=[{"col": "template_name", "opr": "eq", "value": "bootstrap_css"}],
        )
        result = await client.call_tool(
            "list_css_templates", {"request": request.model_dump()}
        )
        data = json.loads(result.content[0].text)
        assert len(data["css_templates"]) == 1


@patch("superset.daos.css.CssTemplateDAO.list")
@pytest.mark.asyncio
async def test_list_css_templates_api_error(mock_list, mcp_server):
    """Test error handling when DAO raises an exception."""
    mock_list.side_effect = ToolError("CSS template error")

    async with Client(mcp_server) as client:
        request = ListCssTemplatesRequest(page=1, page_size=10)
        with pytest.raises(ToolError) as excinfo:  # noqa: PT012
            await client.call_tool(
                "list_css_templates", {"request": request.model_dump()}
            )
        assert "CSS template error" in str(excinfo.value)


@patch("superset.daos.css.CssTemplateDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_css_template_info_basic(mock_find, mcp_server):
    """Test basic get CSS template info functionality."""
    template = create_mock_css_template()
    mock_find.return_value = template

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_css_template_info", {"request": {"identifier": 1}}
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["id"] == 1
        assert data["template_name"] == _wrapped("my_template")
        assert data["uuid"] == "test-css-template-uuid-1"
        assert data["css"] == _wrapped("body { color: red; }")
        assert data["created_by_name"] == _wrapped("admin")
        assert data["changed_by_name"] == _wrapped("admin")


@patch("superset.daos.css.CssTemplateDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_css_template_info_by_uuid(mock_find, mcp_server):
    """Test get CSS template info by UUID."""
    template = create_mock_css_template(uuid="a1b2c3d4-5678-90ab-cdef-1234567890ab")
    mock_find.return_value = template

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_css_template_info",
            {"request": {"identifier": "a1b2c3d4-5678-90ab-cdef-1234567890ab"}},
        )
        data = json.loads(result.content[0].text)
        assert data["id"] == 1
        assert data["uuid"] == "a1b2c3d4-5678-90ab-cdef-1234567890ab"

    mock_find.assert_called_once_with(
        "a1b2c3d4-5678-90ab-cdef-1234567890ab", id_column="uuid", query_options=None
    )


@patch("superset.daos.css.CssTemplateDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_css_template_info_not_found(mock_find, mcp_server):
    """Test get CSS template info when template does not exist."""
    mock_find.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_css_template_info", {"request": {"identifier": 999}}
        )
        assert json.loads(result.content[0].text)["error_type"] == "not_found"


def test_list_css_templates_request_search_and_filters_conflict():
    """Cannot use search and filters simultaneously."""
    with pytest.raises(ValidationError):
        ListCssTemplatesRequest(
            search="something",
            filters=[{"col": "template_name", "opr": "eq", "value": "test"}],
        )
