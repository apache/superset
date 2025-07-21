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


import json
import logging
from unittest.mock import MagicMock, patch

import fastmcp
import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError

from superset.mcp_service.mcp_app import mcp

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@pytest.fixture
def mcp_server():
    return mcp


@pytest.mark.asyncio
@patch("superset.daos.dataset.DatasetDAO.list")
async def test_list_datasets_basic(mock_list, mcp_server):
    dataset = MagicMock()
    dataset.id = 1
    dataset.table_name = "Test DatasetInfo"
    dataset.schema = "main"
    dataset.description = "desc"
    dataset.changed_by_name = "admin"
    dataset.changed_on = None
    dataset.changed_on_humanized = None
    dataset.created_by_name = "admin"
    dataset.created_on = None
    dataset.created_on_humanized = None
    dataset.tags = []
    dataset.owners = []
    dataset.is_virtual = False
    dataset.database_id = 1
    dataset.schema_perm = "[examples].[main]"
    dataset.url = "/tablemodelview/edit/1"
    dataset.database = MagicMock()
    dataset.database.database_name = "examples"
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    # Add proper mock columns and metrics
    col1 = MagicMock()
    col1.column_name = "id"
    col1.verbose_name = "ID"
    col1.type = "INTEGER"
    col1.is_dttm = False
    col1.groupby = True
    col1.filterable = True
    col1.description = "Primary key"

    col2 = MagicMock()
    col2.column_name = "name"
    col2.verbose_name = "Name"
    col2.type = "VARCHAR"
    col2.is_dttm = False
    col2.groupby = True
    col2.filterable = True
    col2.description = "Name column"

    metric1 = MagicMock()
    metric1.metric_name = "count"
    metric1.verbose_name = "Count"
    metric1.expression = "COUNT(*)"
    metric1.description = "Row count"
    metric1.d3format = None

    dataset.columns = [col1, col2]
    dataset.metrics = [metric1]
    dataset._mapping = {
        "id": dataset.id,
        "table_name": dataset.table_name,
        "db_schema": dataset.schema,
        "database_name": dataset.database.database_name,
        "description": dataset.description,
        "changed_by_name": dataset.changed_by_name,
        "changed_on": dataset.changed_on,
        "changed_on_humanized": dataset.changed_on_humanized,
        "created_by_name": dataset.created_by_name,
        "created_on": dataset.created_on,
        "created_on_humanized": dataset.created_on_humanized,
        "tags": dataset.tags,
        "owners": dataset.owners,
        "is_virtual": dataset.is_virtual,
        "database_id": dataset.database_id,
        "schema_perm": dataset.schema_perm,
        "url": dataset.url,
        "sql": dataset.sql,
        "main_dttm_col": dataset.main_dttm_col,
        "offset": dataset.offset,
        "cache_timeout": dataset.cache_timeout,
        "params": dataset.params,
        "template_params": dataset.template_params,
        "extra": dataset.extra,
    }
    mock_list.return_value = ([dataset], 1)
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_datasets", {"page": 1, "page_size": 10})
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["datasets"] is not None
        assert len(data["datasets"]) == 1
        assert data["datasets"][0]["id"] == 1
        assert data["datasets"][0]["table_name"] == "Test DatasetInfo"
        # Check that columns and metrics are included
        assert len(data["datasets"][0]["columns"]) == 2
        assert len(data["datasets"][0]["metrics"]) == 1
        assert data["datasets"][0]["columns"][0]["column_name"] == "id"
        assert data["datasets"][0]["metrics"][0]["metric_name"] == "count"


@pytest.mark.asyncio
@patch("superset.daos.dataset.DatasetDAO.list")
async def test_list_datasets_with_filters(mock_list, mcp_server):
    dataset = MagicMock()
    dataset.id = 2
    dataset.table_name = "Filtered Dataset"
    dataset.schema = "main"
    dataset.description = "desc"
    dataset.changed_by_name = "admin"
    dataset.changed_on = None
    dataset.changed_on_humanized = None
    dataset.created_by_name = "admin"
    dataset.created_on = None
    dataset.created_on_humanized = None
    dataset.tags = []
    dataset.owners = []
    dataset.is_virtual = False
    dataset.database_id = 1
    dataset.schema_perm = "[examples].[main]"
    dataset.url = "/tablemodelview/edit/2"
    dataset.database = MagicMock()
    dataset.database.database_name = "examples"
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    # Add proper mock columns and metrics
    col1 = MagicMock()
    col1.column_name = "id"
    col1.verbose_name = "ID"
    col1.type = "INTEGER"
    col1.is_dttm = False
    col1.groupby = True
    col1.filterable = True
    col1.description = "Primary key"

    metric1 = MagicMock()
    metric1.metric_name = "sum"
    metric1.verbose_name = "Sum"
    metric1.expression = "SUM(value)"
    metric1.description = "Sum of values"
    metric1.d3format = None

    dataset.columns = [col1]
    dataset.metrics = [metric1]
    dataset._mapping = {
        "id": dataset.id,
        "table_name": dataset.table_name,
        "db_schema": dataset.schema,
        "database_name": dataset.database.database_name,
        "description": dataset.description,
        "changed_by_name": dataset.changed_by_name,
        "changed_on": dataset.changed_on,
        "changed_on_humanized": dataset.changed_on_humanized,
        "created_by_name": dataset.created_by_name,
        "created_on": dataset.created_on,
        "created_on_humanized": dataset.created_on_humanized,
        "tags": dataset.tags,
        "owners": dataset.owners,
        "is_virtual": dataset.is_virtual,
        "database_id": dataset.database_id,
        "schema_perm": dataset.schema_perm,
        "url": dataset.url,
        "sql": dataset.sql,
        "main_dttm_col": dataset.main_dttm_col,
        "offset": dataset.offset,
        "cache_timeout": dataset.cache_timeout,
        "params": dataset.params,
        "template_params": dataset.template_params,
        "extra": dataset.extra,
    }
    mock_list.return_value = ([dataset], 1)
    filters = [
        {"col": "table_name", "opr": "sw", "value": "Sales"},
        {"col": "schema", "opr": "eq", "value": "main"},
    ]
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "list_datasets",
            {
                "filters": filters,
                "select_columns": ["id", "table_name"],
                "order_column": "changed_on",
                "order_direction": "desc",
                "page": 1,
                "page_size": 50,
            },
        )
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["datasets"] is not None
        assert len(data["datasets"]) == 1
        assert data["datasets"][0]["id"] == 2
        assert data["datasets"][0]["table_name"] == "Filtered Dataset"
        # Check that columns and metrics are included
        assert len(data["datasets"][0]["columns"]) == 1
        assert len(data["datasets"][0]["metrics"]) == 1


@pytest.mark.asyncio
@patch("superset.daos.dataset.DatasetDAO.list")
async def test_list_datasets_with_string_filters(mock_list, mcp_server):
    dataset = MagicMock()
    dataset.id = 3
    dataset.table_name = "String Filter Dataset"
    dataset.schema = "main"
    dataset.description = "desc"
    dataset.changed_by_name = "admin"
    dataset.changed_on = None
    dataset.changed_on_humanized = None
    dataset.created_by_name = "admin"
    dataset.created_on = None
    dataset.created_on_humanized = None
    dataset.tags = []
    dataset.owners = []
    dataset.is_virtual = False
    dataset.database_id = 1
    dataset.schema_perm = "[examples].[main]"
    dataset.url = "/tablemodelview/edit/3"
    dataset.database = MagicMock()
    dataset.database.database_name = "examples"
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    dataset._mapping = {
        "id": dataset.id,
        "table_name": dataset.table_name,
        "db_schema": dataset.schema,
        "database_name": dataset.database.database_name,
        "description": dataset.description,
        "changed_by_name": dataset.changed_by_name,
        "changed_on": dataset.changed_on,
        "changed_on_humanized": dataset.changed_on_humanized,
        "created_by_name": dataset.created_by_name,
        "created_on": dataset.created_on,
        "created_on_humanized": dataset.created_on_humanized,
        "tags": dataset.tags,
        "owners": dataset.owners,
        "is_virtual": dataset.is_virtual,
        "database_id": dataset.database_id,
        "schema_perm": dataset.schema_perm,
        "url": dataset.url,
        "sql": dataset.sql,
        "main_dttm_col": dataset.main_dttm_col,
        "offset": dataset.offset,
        "cache_timeout": dataset.cache_timeout,
        "params": dataset.params,
        "template_params": dataset.template_params,
        "extra": dataset.extra,
    }
    mock_list.return_value = ([dataset], 1)
    async with Client(mcp_server) as client:
        with pytest.raises(ToolError) as excinfo:
            await client.call_tool(
                "list_datasets",
                {"filters": '[{"col": "table_name", "opr": "sw", "value": "Sales"}]'},
            )
        assert "Input validation error" in str(excinfo.value)


@pytest.mark.asyncio
@patch("superset.daos.dataset.DatasetDAO.list")
async def test_list_datasets_api_error(mock_list, mcp_server):
    mock_list.side_effect = ToolError("API request failed")
    async with Client(mcp_server) as client:
        with pytest.raises(ToolError) as excinfo:
            await client.call_tool("list_datasets", {})
        assert "API request failed" in str(excinfo.value)


@pytest.mark.asyncio
@patch("superset.daos.dataset.DatasetDAO.list")
async def test_list_datasets_with_search(mock_list, mcp_server):
    dataset = MagicMock()
    dataset.id = 1
    dataset.table_name = "search_table"
    dataset.schema = "public"
    dataset.database_name = "test_db"
    dataset.database = None
    dataset.description = "A test dataset"
    dataset.changed_by = "admin"
    dataset.changed_by_name = "admin"
    dataset.changed_on = None
    dataset.changed_on_humanized = None
    dataset.created_by = "admin"
    dataset.created_by_name = "admin"
    dataset.created_on = None
    dataset.created_on_humanized = None
    dataset.tags = []
    dataset.owners = []
    dataset.is_virtual = False
    dataset.database_id = 1
    dataset.schema_perm = None
    dataset.url = None
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    # Add proper mock columns and metrics
    col1 = MagicMock()
    col1.column_name = "id"
    col1.verbose_name = "ID"
    col1.type = "INTEGER"
    col1.is_dttm = False
    col1.groupby = True
    col1.filterable = True
    col1.description = "Primary key"

    metric1 = MagicMock()
    metric1.metric_name = "count"
    metric1.verbose_name = "Count"
    metric1.expression = "COUNT(*)"
    metric1.description = "Row count"
    metric1.d3format = None

    dataset.columns = [col1]
    dataset.metrics = [metric1]
    dataset._mapping = {
        "id": dataset.id,
        "table_name": dataset.table_name,
        "db_schema": dataset.schema,
        "database_name": dataset.database_name,
        "description": dataset.description,
        "changed_by_name": dataset.changed_by_name,
        "changed_on": dataset.changed_on,
        "changed_on_humanized": dataset.changed_on_humanized,
        "created_by_name": dataset.created_by_name,
        "created_on": dataset.created_on,
        "created_on_humanized": dataset.created_on_humanized,
        "tags": dataset.tags,
        "owners": dataset.owners,
        "is_virtual": dataset.is_virtual,
        "database_id": dataset.database_id,
        "schema_perm": dataset.schema_perm,
        "url": dataset.url,
        "sql": dataset.sql,
        "main_dttm_col": dataset.main_dttm_col,
        "offset": dataset.offset,
        "cache_timeout": dataset.cache_timeout,
        "params": dataset.params,
        "template_params": dataset.template_params,
        "extra": dataset.extra,
    }
    mock_list.return_value = ([dataset], 1)
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_datasets", {"search": "search_table"})
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["datasets"] is not None
        assert len(data["datasets"]) == 1
        assert data["datasets"][0]["id"] == 1
        assert data["datasets"][0]["table_name"] == "search_table"
        # Check that columns and metrics are included
        assert len(data["datasets"][0]["columns"]) == 1
        assert len(data["datasets"][0]["metrics"]) == 1


@pytest.mark.asyncio
@patch("superset.daos.dataset.DatasetDAO.list")
async def test_list_datasets_simple_with_search(mock_list, mcp_server):
    dataset = MagicMock()
    dataset.id = 2
    dataset.table_name = "simple_search"
    dataset.schema = "analytics"
    dataset.database_name = "analytics_db"
    dataset.database = None
    dataset.description = "Another test dataset"
    dataset.changed_by = "user"
    dataset.changed_by_name = "user"
    dataset.changed_on = None
    dataset.changed_on_humanized = None
    dataset.created_by = "user"
    dataset.created_by_name = "user"
    dataset.created_on = None
    dataset.created_on_humanized = None
    dataset.tags = []
    dataset.owners = []
    dataset.is_virtual = True
    dataset.database_id = 2
    dataset.schema_perm = None
    dataset.url = None
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    # Add proper mock columns and metrics
    col1 = MagicMock()
    col1.column_name = "id"
    col1.verbose_name = "ID"
    col1.type = "INTEGER"
    col1.is_dttm = False
    col1.groupby = True
    col1.filterable = True
    col1.description = "Primary key"

    metric1 = MagicMock()
    metric1.metric_name = "count"
    metric1.verbose_name = "Count"
    metric1.expression = "COUNT(*)"
    metric1.description = "Row count"
    metric1.d3format = None

    dataset.columns = [col1]
    dataset.metrics = [metric1]
    dataset._mapping = {
        "id": dataset.id,
        "table_name": dataset.table_name,
        "db_schema": dataset.schema,
        "database_name": dataset.database_name,
        "description": dataset.description,
        "changed_by_name": dataset.changed_by_name,
        "changed_on": dataset.changed_on,
        "changed_on_humanized": dataset.changed_on_humanized,
        "created_by_name": dataset.created_by_name,
        "created_on": dataset.created_on,
        "created_on_humanized": dataset.created_on_humanized,
        "tags": dataset.tags,
        "owners": dataset.owners,
        "is_virtual": dataset.is_virtual,
        "database_id": dataset.database_id,
        "schema_perm": dataset.schema_perm,
        "url": dataset.url,
        "sql": dataset.sql,
        "main_dttm_col": dataset.main_dttm_col,
        "offset": dataset.offset,
        "cache_timeout": dataset.cache_timeout,
        "params": dataset.params,
        "template_params": dataset.template_params,
        "extra": dataset.extra,
    }
    mock_list.return_value = ([dataset], 1)
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_datasets", {"search": "simple_search"})
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["datasets"] is not None
        assert len(data["datasets"]) == 1
        assert data["datasets"][0]["id"] == 2
        assert data["datasets"][0]["table_name"] == "simple_search"
        # Check that columns and metrics are included
        assert len(data["datasets"][0]["columns"]) == 1
        assert len(data["datasets"][0]["metrics"]) == 1


@pytest.mark.asyncio
@patch("superset.daos.dataset.DatasetDAO.list")
async def test_list_datasets_simple_basic(mock_list, mcp_server):
    dataset = MagicMock()
    dataset.id = 1
    dataset.table_name = "Test DatasetInfo"
    dataset.schema = "main"
    dataset.description = "desc"
    dataset.changed_by_name = "admin"
    dataset.changed_on = None
    dataset.changed_on_humanized = None
    dataset.created_by_name = "admin"
    dataset.created_on = None
    dataset.created_on_humanized = None
    dataset.tags = []
    dataset.owners = []
    dataset.is_virtual = False
    dataset.database_id = 1
    dataset.schema_perm = "[examples].[main]"
    dataset.url = "/tablemodelview/edit/1"
    dataset.database = MagicMock()
    dataset.database.database_name = "examples"
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    # Add proper mock columns and metrics
    col1 = MagicMock()
    col1.column_name = "id"
    col1.verbose_name = "ID"
    col1.type = "INTEGER"
    col1.is_dttm = False
    col1.groupby = True
    col1.filterable = True
    col1.description = "Primary key"

    metric1 = MagicMock()
    metric1.metric_name = "count"
    metric1.verbose_name = "Count"
    metric1.expression = "COUNT(*)"
    metric1.description = "Row count"
    metric1.d3format = None

    dataset.columns = [col1]
    dataset.metrics = [metric1]
    dataset._mapping = {
        "id": dataset.id,
        "table_name": dataset.table_name,
        "db_schema": dataset.schema,
        "database_name": dataset.database.database_name,
        "description": dataset.description,
        "changed_by_name": dataset.changed_by_name,
        "changed_on": dataset.changed_on,
        "changed_on_humanized": dataset.changed_on_humanized,
        "created_by_name": dataset.created_by_name,
        "created_on": dataset.created_on,
        "created_on_humanized": dataset.created_on_humanized,
        "tags": dataset.tags,
        "owners": dataset.owners,
        "is_virtual": dataset.is_virtual,
        "database_id": dataset.database_id,
        "schema_perm": dataset.schema_perm,
        "url": dataset.url,
        "sql": dataset.sql,
        "main_dttm_col": dataset.main_dttm_col,
        "offset": dataset.offset,
        "cache_timeout": dataset.cache_timeout,
        "params": dataset.params,
        "template_params": dataset.template_params,
        "extra": dataset.extra,
    }
    mock_list.return_value = ([dataset], 1)
    filters = [
        {"col": "table_name", "opr": "eq", "value": "Test DatasetInfo"},
        {"col": "schema", "opr": "eq", "value": "main"},
    ]
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_datasets", {"filters": filters})
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["datasets"] is not None
        assert len(data["datasets"]) == 1
        assert data["datasets"][0]["id"] == 1
        assert data["datasets"][0]["table_name"] == "Test DatasetInfo"
        # Check that columns and metrics are included
        assert len(data["datasets"][0]["columns"]) == 1
        assert len(data["datasets"][0]["metrics"]) == 1


@pytest.mark.asyncio
@patch("superset.daos.dataset.DatasetDAO.list")
async def test_list_datasets_simple_with_filters(mock_list, mcp_server):
    dataset = MagicMock()
    dataset.id = 2
    dataset.table_name = "Sales Dataset"
    dataset.schema = "main"
    dataset.description = "desc"
    dataset.changed_by_name = "admin"
    dataset.changed_on = None
    dataset.changed_on_humanized = None
    dataset.created_by_name = "admin"
    dataset.created_on = None
    dataset.created_on_humanized = None
    dataset.tags = []
    dataset.owners = []
    dataset.is_virtual = False
    dataset.database_id = 1
    dataset.schema_perm = "[examples].[main]"
    dataset.url = "/tablemodelview/edit/2"
    dataset.database = MagicMock()
    dataset.database.database_name = "examples"
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    # Add proper mock columns and metrics
    col1 = MagicMock()
    col1.column_name = "id"
    col1.verbose_name = "ID"
    col1.type = "INTEGER"
    col1.is_dttm = False
    col1.groupby = True
    col1.filterable = True
    col1.description = "Primary key"

    metric1 = MagicMock()
    metric1.metric_name = "sum"
    metric1.verbose_name = "Sum"
    metric1.expression = "SUM(value)"
    metric1.description = "Sum of values"
    metric1.d3format = None

    dataset.columns = [col1]
    dataset.metrics = [metric1]
    dataset._mapping = {
        "id": dataset.id,
        "table_name": dataset.table_name,
        "db_schema": dataset.schema,
        "database_name": dataset.database.database_name,
        "description": dataset.description,
        "changed_by_name": dataset.changed_by_name,
        "changed_on": dataset.changed_on,
        "changed_on_humanized": dataset.changed_on_humanized,
        "created_by_name": dataset.created_by_name,
        "created_on": dataset.created_on,
        "created_on_humanized": dataset.created_on_humanized,
        "tags": dataset.tags,
        "owners": dataset.owners,
        "is_virtual": dataset.is_virtual,
        "database_id": dataset.database_id,
        "schema_perm": dataset.schema_perm,
        "url": dataset.url,
        "sql": dataset.sql,
        "main_dttm_col": dataset.main_dttm_col,
        "offset": dataset.offset,
        "cache_timeout": dataset.cache_timeout,
        "params": dataset.params,
        "template_params": dataset.template_params,
        "extra": dataset.extra,
    }
    mock_list.return_value = ([dataset], 1)
    filters = [
        {"col": "table_name", "opr": "sw", "value": "Sales"},
        {"col": "schema", "opr": "eq", "value": "main"},
    ]
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_datasets", {"filters": filters})
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["datasets"] is not None
        assert len(data["datasets"]) == 1
        assert data["datasets"][0]["id"] == 2
        assert data["datasets"][0]["table_name"] == "Sales Dataset"
        # Check that columns and metrics are included
        assert len(data["datasets"][0]["columns"]) == 1
        assert len(data["datasets"][0]["metrics"]) == 1


@pytest.mark.asyncio
@patch("superset.daos.dataset.DatasetDAO.list")
async def test_list_datasets_simple_api_error(mock_list, mcp_server):
    mock_list.side_effect = Exception("API request failed")
    filters = [
        {"col": "table_name", "opr": "sw", "value": "Sales"},
        {"col": "schema", "opr": "eq", "value": "main"},
    ]
    async with Client(mcp_server) as client:
        with pytest.raises(ToolError) as excinfo:
            await client.call_tool("list_datasets", {"filters": filters})
        assert "API request failed" in str(excinfo.value)


@pytest.mark.asyncio
@patch("superset.daos.dataset.DatasetDAO.find_by_id")
async def test_get_dataset_info_success(mock_info, mcp_server):
    dataset = MagicMock()
    dataset.id = 1
    dataset.table_name = "Test DatasetInfo"
    dataset.schema = "main"
    dataset.description = "desc"
    dataset.changed_by_name = "admin"
    dataset.changed_on = None
    dataset.changed_on_humanized = None
    dataset.created_by_name = "admin"
    dataset.created_on = None
    dataset.created_on_humanized = None
    dataset.tags = []
    dataset.owners = []
    dataset.is_virtual = False
    dataset.database_id = 1
    dataset.schema_perm = "[examples].[main]"
    dataset.url = "/tablemodelview/edit/1"
    dataset.database = MagicMock()
    dataset.database.database_name = "examples"
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    # Add proper mock columns and metrics
    col1 = MagicMock()
    col1.column_name = "id"
    col1.verbose_name = "ID"
    col1.type = "INTEGER"
    col1.is_dttm = False
    col1.groupby = True
    col1.filterable = True
    col1.description = "Primary key"

    metric1 = MagicMock()
    metric1.metric_name = "count"
    metric1.verbose_name = "Count"
    metric1.expression = "COUNT(*)"
    metric1.description = "Row count"
    metric1.d3format = None

    dataset.columns = [col1]
    dataset.metrics = [metric1]
    mock_info.return_value = dataset
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_dataset_info", {"dataset_id": 1})
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["id"] == 1
        assert data["table_name"] == "Test DatasetInfo"
        assert data["database_name"] == "examples"
        # Check that columns and metrics are included
        assert len(data["columns"]) == 1
        assert len(data["metrics"]) == 1
        assert data["columns"][0]["column_name"] == "id"
        assert data["metrics"][0]["metric_name"] == "count"


@pytest.mark.asyncio
@patch("superset.daos.dataset.DatasetDAO.find_by_id")
async def test_get_dataset_info_not_found(mock_info, mcp_server):
    mock_info.return_value = None  # Not found returns None
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_dataset_info", {"dataset_id": 999})
        assert result.data["error_type"] == "not_found"


@pytest.mark.xfail(
    reason="MCP protocol bug: dict fields named column_operators are deserialized as "
    "custom types (Column_Operators). "
    "TODO: revisit after protocol fix."
)
@pytest.mark.asyncio
async def test_get_dataset_available_filters_success(mcp_server):
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_dataset_available_filters", {})
        assert hasattr(result.data, "column_operators")
        assert isinstance(result.data.column_operators, dict)


@pytest.mark.xfail(
    reason="MCP protocol bug: dict fields named column_operators are deserialized as "
    "custom types (Column_Operators). "
    "TODO: revisit after protocol fix."
)
@pytest.mark.asyncio
async def test_get_dataset_available_filters_includes_custom_fields(mcp_server):
    async with fastmcp.Client(mcp_server) as client:
        result = await client.call_tool("get_dataset_available_filters")
        filters = result.data.filters
        print("DEBUG filters type:", type(filters))
        print("DEBUG filters dir:", dir(filters))
        print("DEBUG filters __dict__:", getattr(filters, "__dict__", None))
        if hasattr(filters, "model_dump"):
            print("DEBUG filters model_dump:", filters.model_dump())
        print("DEBUG filters repr:", repr(filters))
        raise AssertionError("See debug output above.")


@pytest.mark.asyncio
async def test_invalid_filter_column_raises(mcp_server):
    async with fastmcp.Client(mcp_server) as client:
        with pytest.raises(ToolError) as excinfo:
            await client.call_tool(
                "list_datasets",
                {"filters": [{"col": "not_a_column", "opr": "eq", "value": "foo"}]},
            )
        assert "Input validation error" in str(excinfo.value)


@pytest.mark.asyncio
@patch("superset.daos.dataset.DatasetDAO.find_by_id")
async def test_get_dataset_info_includes_columns_and_metrics(mock_info, mcp_server):
    dataset = MagicMock()
    dataset.id = 10
    dataset.table_name = "Dataset With Columns"
    dataset.schema = "main"
    dataset.database = MagicMock()
    dataset.database.database_name = "examples"
    dataset.description = "desc"
    dataset.changed_by_name = "admin"
    dataset.changed_on = None
    dataset.changed_on_humanized = None
    dataset.created_by_name = "admin"
    dataset.created_on = None
    dataset.created_on_humanized = None
    dataset.tags = []
    dataset.owners = []
    dataset.is_virtual = False
    dataset.database_id = 1
    dataset.schema_perm = "[examples].[main]"
    dataset.url = "/tablemodelview/edit/10"
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    dataset.columns = [
        MagicMock(
            column_name="col1",
            verbose_name="Column 1",
            type="INTEGER",
            is_dttm=False,
            groupby=True,
            filterable=True,
            description="First column",
        ),
        MagicMock(
            column_name="col2",
            verbose_name="Column 2",
            type="VARCHAR",
            is_dttm=False,
            groupby=False,
            filterable=True,
            description="Second column",
        ),
    ]
    dataset.metrics = [
        MagicMock(
            metric_name="sum_sales",
            verbose_name="Sum Sales",
            expression="SUM(sales)",
            description="Total sales",
            d3format=None,
        ),
        MagicMock(
            metric_name="count_orders",
            verbose_name="Count Orders",
            expression="COUNT(orders)",
            description="Order count",
            d3format=None,
        ),
    ]
    mock_info.return_value = dataset
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_dataset_info", {"dataset_id": 10})
        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["table_name"] == "Dataset With Columns"
        assert data["database_name"] == "examples"
        # Check that columns and metrics are included
        assert len(data["columns"]) == 2
        assert len(data["metrics"]) == 2
        assert data["columns"][0]["column_name"] == "col1"
        assert data["columns"][1]["column_name"] == "col2"
        assert data["metrics"][0]["metric_name"] == "sum_sales"
        assert data["metrics"][1]["metric_name"] == "count_orders"


@pytest.mark.asyncio
@patch("superset.daos.dataset.DatasetDAO.list")
async def test_list_datasets_includes_columns_and_metrics(mock_list, mcp_server):
    dataset = MagicMock()
    dataset.id = 11
    dataset.table_name = "DatasetList With Columns"
    dataset.schema = "main"
    dataset.database = MagicMock()
    dataset.database.database_name = "examples"
    dataset.description = "desc"
    dataset.changed_by_name = "admin"
    dataset.changed_on = None
    dataset.changed_on_humanized = None
    dataset.created_by_name = "admin"
    dataset.created_on = None
    dataset.created_on_humanized = None
    dataset.tags = []
    dataset.owners = []
    dataset.is_virtual = False
    dataset.database_id = 1
    dataset.schema_perm = "[examples].[main]"
    dataset.url = "/tablemodelview/edit/11"
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    dataset.columns = [
        MagicMock(
            column_name="colA",
            verbose_name="Column A",
            type="FLOAT",
            is_dttm=False,
            groupby=True,
            filterable=True,
            description="A column",
        ),
    ]
    dataset.metrics = [
        MagicMock(
            metric_name="avg_value",
            verbose_name="Avg Value",
            expression="AVG(value)",
            description="Average value",
            d3format=None,
        ),
    ]
    mock_list.return_value = ([dataset], 1)
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_datasets", {"page": 1, "page_size": 10})
        datasets = result.data.datasets
        assert len(datasets) == 1
        ds = datasets[0]
        assert hasattr(ds, "columns")
        assert hasattr(ds, "metrics")
        assert isinstance(ds.columns, list)
        assert isinstance(ds.metrics, list)
        assert len(ds.columns) == 1
        assert len(ds.metrics) == 1
        assert ds.columns[0].column_name == "colA"
        assert ds.metrics[0].metric_name == "avg_value"
