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
Unit tests for MCP dataset tools (list_datasets, get_dataset_info, get_dataset_available_filters)
"""
import logging
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client
from superset.mcp_service.mcp_app import mcp

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

@pytest.fixture
def mcp_server():
    return mcp

@pytest.mark.asyncio
@patch('superset.daos.dataset.DatasetDAO.list')
async def test_list_datasets_basic(mock_list, mcp_server):
    dataset = Mock()
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
    dataset.database = Mock()
    dataset.database.database_name = "examples"
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    dataset._mapping = {
        'id': dataset.id,
        'table_name': dataset.table_name,
        'db_schema': dataset.schema,
        'database_name': dataset.database.database_name,
        'description': dataset.description,
        'changed_by_name': dataset.changed_by_name,
        'changed_on': dataset.changed_on,
        'changed_on_humanized': dataset.changed_on_humanized,
        'created_by_name': dataset.created_by_name,
        'created_on': dataset.created_on,
        'created_on_humanized': dataset.created_on_humanized,
        'tags': dataset.tags,
        'owners': dataset.owners,
        'is_virtual': dataset.is_virtual,
        'database_id': dataset.database_id,
        'schema_perm': dataset.schema_perm,
        'url': dataset.url,
        'sql': dataset.sql,
        'main_dttm_col': dataset.main_dttm_col,
        'offset': dataset.offset,
        'cache_timeout': dataset.cache_timeout,
        'params': dataset.params,
        'template_params': dataset.template_params,
        'extra': dataset.extra,
    }
    mock_list.return_value = ([dataset], 1)
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_datasets", {"page": 1, "page_size": 10})
        datasets = result.data.datasets
        assert len(datasets) == 1
        assert datasets[0].table_name == "Test DatasetInfo"
        assert datasets[0].database_name == "examples"

@pytest.mark.asyncio
@patch('superset.daos.dataset.DatasetDAO.list')
async def test_list_datasets_with_filters(mock_list, mcp_server):
    dataset = Mock()
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
    dataset.database = Mock()
    dataset.database.database_name = "examples"
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    dataset._mapping = {
        'id': dataset.id,
        'table_name': dataset.table_name,
        'db_schema': dataset.schema,
        'database_name': dataset.database.database_name,
        'description': dataset.description,
        'changed_by_name': dataset.changed_by_name,
        'changed_on': dataset.changed_on,
        'changed_on_humanized': dataset.changed_on_humanized,
        'created_by_name': dataset.created_by_name,
        'created_on': dataset.created_on,
        'created_on_humanized': dataset.created_on_humanized,
        'tags': dataset.tags,
        'owners': dataset.owners,
        'is_virtual': dataset.is_virtual,
        'database_id': dataset.database_id,
        'schema_perm': dataset.schema_perm,
        'url': dataset.url,
        'sql': dataset.sql,
        'main_dttm_col': dataset.main_dttm_col,
        'offset': dataset.offset,
        'cache_timeout': dataset.cache_timeout,
        'params': dataset.params,
        'template_params': dataset.template_params,
        'extra': dataset.extra,
    }
    mock_list.return_value = ([dataset], 1)
    filters = [
        {"col": "table_name", "opr": "sw", "value": "Sales"},
        {"col": "schema", "opr": "eq", "value": "main"}
    ]
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_datasets", {
            "filters": filters,
            "select_columns": ["id", "table_name"],
            "order_column": "changed_on",
            "order_direction": "desc",
            "page": 1,
            "page_size": 50
        })
        assert result.data.count == 1
        assert result.data.datasets[0].table_name == "Filtered Dataset"

@pytest.mark.asyncio
@patch('superset.daos.dataset.DatasetDAO.list')
async def test_list_datasets_with_string_filters(mock_list, mcp_server):
    dataset = Mock()
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
    dataset.database = Mock()
    dataset.database.database_name = "examples"
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    dataset._mapping = {
        'id': dataset.id,
        'table_name': dataset.table_name,
        'db_schema': dataset.schema,
        'database_name': dataset.database.database_name,
        'description': dataset.description,
        'changed_by_name': dataset.changed_by_name,
        'changed_on': dataset.changed_on,
        'changed_on_humanized': dataset.changed_on_humanized,
        'created_by_name': dataset.created_by_name,
        'created_on': dataset.created_on,
        'created_on_humanized': dataset.created_on_humanized,
        'tags': dataset.tags,
        'owners': dataset.owners,
        'is_virtual': dataset.is_virtual,
        'database_id': dataset.database_id,
        'schema_perm': dataset.schema_perm,
        'url': dataset.url,
        'sql': dataset.sql,
        'main_dttm_col': dataset.main_dttm_col,
        'offset': dataset.offset,
        'cache_timeout': dataset.cache_timeout,
        'params': dataset.params,
        'template_params': dataset.template_params,
        'extra': dataset.extra,
    }
    mock_list.return_value = ([dataset], 1)
    async with Client(mcp_server) as client:
        import fastmcp
        with pytest.raises(fastmcp.exceptions.ToolError) as excinfo:
            await client.call_tool("list_datasets", {"filters": '[{"col": "table_name", "opr": "sw", "value": "Sales"}]'})
        assert "Input validation error" in str(excinfo.value)

@pytest.mark.asyncio
@patch('superset.daos.dataset.DatasetDAO.list')
async def test_list_datasets_api_error(mock_list, mcp_server):
    mock_list.side_effect = Exception("API request failed")
    async with Client(mcp_server) as client:
        with pytest.raises(Exception) as excinfo:
            await client.call_tool("list_datasets", {})
        assert "API request failed" in str(excinfo.value)

@pytest.mark.asyncio
@patch('superset.daos.dataset.DatasetDAO.list')
async def test_list_datasets_with_search(mock_list, mcp_server):
    dataset = Mock()
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
    dataset._mapping = {
        'id': dataset.id,
        'table_name': dataset.table_name,
        'db_schema': dataset.schema,
        'database_name': dataset.database_name,
        'description': dataset.description,
        'changed_by_name': dataset.changed_by_name,
        'changed_on': dataset.changed_on,
        'changed_on_humanized': dataset.changed_on_humanized,
        'created_by_name': dataset.created_by_name,
        'created_on': dataset.created_on,
        'created_on_humanized': dataset.created_on_humanized,
        'tags': dataset.tags,
        'owners': dataset.owners,
        'is_virtual': dataset.is_virtual,
        'database_id': dataset.database_id,
        'schema_perm': dataset.schema_perm,
        'url': dataset.url,
        'sql': dataset.sql,
        'main_dttm_col': dataset.main_dttm_col,
        'offset': dataset.offset,
        'cache_timeout': dataset.cache_timeout,
        'params': dataset.params,
        'template_params': dataset.template_params,
        'extra': dataset.extra,
    }
    mock_list.return_value = ([dataset], 1)
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_datasets", {"search": "search_table"})
        assert result.data.count == 1
        assert result.data.datasets[0].table_name == "search_table"
        args, kwargs = mock_list.call_args
        assert kwargs["search"] == "search_table"
        assert "table_name" in kwargs["search_columns"]
        assert "schema" in kwargs["search_columns"]

@pytest.mark.asyncio
@patch('superset.daos.dataset.DatasetDAO.list')
async def test_list_datasets_simple_with_search(mock_list, mcp_server):
    dataset = Mock()
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
    dataset._mapping = {
        'id': dataset.id,
        'table_name': dataset.table_name,
        'db_schema': dataset.schema,
        'database_name': dataset.database_name,
        'description': dataset.description,
        'changed_by_name': dataset.changed_by_name,
        'changed_on': dataset.changed_on,
        'changed_on_humanized': dataset.changed_on_humanized,
        'created_by_name': dataset.created_by_name,
        'created_on': dataset.created_on,
        'created_on_humanized': dataset.created_on_humanized,
        'tags': dataset.tags,
        'owners': dataset.owners,
        'is_virtual': dataset.is_virtual,
        'database_id': dataset.database_id,
        'schema_perm': dataset.schema_perm,
        'url': dataset.url,
        'sql': dataset.sql,
        'main_dttm_col': dataset.main_dttm_col,
        'offset': dataset.offset,
        'cache_timeout': dataset.cache_timeout,
        'params': dataset.params,
        'template_params': dataset.template_params,
        'extra': dataset.extra,
    }
    mock_list.return_value = ([dataset], 1)
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_datasets", {"search": "simple_search"})
        assert result.data.count == 1
        assert result.data.datasets[0].table_name == "simple_search"
        args, kwargs = mock_list.call_args
        assert kwargs["search"] == "simple_search"
        assert "table_name" in kwargs["search_columns"]
        assert "schema" in kwargs["search_columns"]

@pytest.mark.asyncio
@patch('superset.daos.dataset.DatasetDAO.list')
async def test_list_datasets_simple_basic(mock_list, mcp_server):
    dataset = Mock()
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
    dataset.database = Mock()
    dataset.database.database_name = "examples"
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    dataset._mapping = {
        'id': dataset.id,
        'table_name': dataset.table_name,
        'db_schema': dataset.schema,
        'database_name': dataset.database.database_name,
        'description': dataset.description,
        'changed_by_name': dataset.changed_by_name,
        'changed_on': dataset.changed_on,
        'changed_on_humanized': dataset.changed_on_humanized,
        'created_by_name': dataset.created_by_name,
        'created_on': dataset.created_on,
        'created_on_humanized': dataset.created_on_humanized,
        'tags': dataset.tags,
        'owners': dataset.owners,
        'is_virtual': dataset.is_virtual,
        'database_id': dataset.database_id,
        'schema_perm': dataset.schema_perm,
        'url': dataset.url,
        'sql': dataset.sql,
        'main_dttm_col': dataset.main_dttm_col,
        'offset': dataset.offset,
        'cache_timeout': dataset.cache_timeout,
        'params': dataset.params,
        'template_params': dataset.template_params,
        'extra': dataset.extra,
    }
    mock_list.return_value = ([dataset], 1)
    filters = [{"col": "table_name", "opr": "eq", "value": "Test DatasetInfo"}, {"col": "schema", "opr": "eq", "value": "main"}]
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_datasets", {"filters": filters})
        print("DEBUG datasets class:", result.data.__class__)
        print("DEBUG datasets value:", result.data)
        assert hasattr(result.data, "count")
        assert hasattr(result.data, "datasets")
        assert result.data.datasets[0].table_name == "Test DatasetInfo"
        assert result.data.datasets[0].database_name == "examples"

@pytest.mark.asyncio
@patch('superset.daos.dataset.DatasetDAO.list')
async def test_list_datasets_simple_with_filters(mock_list, mcp_server):
    dataset = Mock()
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
    dataset.database = Mock()
    dataset.database.database_name = "examples"
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    dataset._mapping = {
        'id': dataset.id,
        'table_name': dataset.table_name,
        'db_schema': dataset.schema,
        'database_name': dataset.database.database_name,
        'description': dataset.description,
        'changed_by_name': dataset.changed_by_name,
        'changed_on': dataset.changed_on,
        'changed_on_humanized': dataset.changed_on_humanized,
        'created_by_name': dataset.created_by_name,
        'created_on': dataset.created_on,
        'created_on_humanized': dataset.created_on_humanized,
        'tags': dataset.tags,
        'owners': dataset.owners,
        'is_virtual': dataset.is_virtual,
        'database_id': dataset.database_id,
        'schema_perm': dataset.schema_perm,
        'url': dataset.url,
        'sql': dataset.sql,
        'main_dttm_col': dataset.main_dttm_col,
        'offset': dataset.offset,
        'cache_timeout': dataset.cache_timeout,
        'params': dataset.params,
        'template_params': dataset.template_params,
        'extra': dataset.extra,
    }
    mock_list.return_value = ([dataset], 1)
    filters = [{"col": "table_name", "opr": "sw", "value": "Sales"}, {"col": "schema", "opr": "eq", "value": "main"}]
    async with Client(mcp_server) as client:
        result = await client.call_tool("list_datasets", {"filters": filters})
        assert result.data.count == 1
        assert result.data.datasets[0].table_name == "Sales Dataset"

@pytest.mark.asyncio
@patch('superset.daos.dataset.DatasetDAO.list')
async def test_list_datasets_simple_api_error(mock_list, mcp_server):
    mock_list.side_effect = Exception("API request failed")
    filters = [{"col": "table_name", "opr": "sw", "value": "Sales"}, {"col": "schema", "opr": "eq", "value": "main"}]
    async with Client(mcp_server) as client:
        with pytest.raises(Exception) as excinfo:
            await client.call_tool("list_datasets", {"filters": filters})
        assert "API request failed" in str(excinfo.value)

@pytest.mark.asyncio
@patch('superset.daos.dataset.DatasetDAO.find_by_id')
async def test_get_dataset_info_success(mock_info, mcp_server):
    dataset = Mock()
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
    dataset.database = Mock()
    dataset.database.database_name = "examples"
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    dataset._mapping = {
        'id': dataset.id,
        'table_name': dataset.table_name,
        'db_schema': dataset.schema,
        'database_name': dataset.database.database_name,
        'description': dataset.description,
        'changed_by_name': dataset.changed_by_name,
        'changed_on': dataset.changed_on,
        'changed_on_humanized': dataset.changed_on_humanized,
        'created_by_name': dataset.created_by_name,
        'created_on': dataset.created_on,
        'created_on_humanized': dataset.created_on_humanized,
        'tags': dataset.tags,
        'owners': dataset.owners,
        'is_virtual': dataset.is_virtual,
        'database_id': dataset.database_id,
        'schema_perm': dataset.schema_perm,
        'url': dataset.url,
        'sql': dataset.sql,
        'main_dttm_col': dataset.main_dttm_col,
        'offset': dataset.offset,
        'cache_timeout': dataset.cache_timeout,
        'params': dataset.params,
        'template_params': dataset.template_params,
        'extra': dataset.extra,
    }
    mock_info.return_value = dataset  # Only the dataset object
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_dataset_info", {"dataset_id": 1})
        assert result.data["table_name"] == "Test DatasetInfo"

@pytest.mark.asyncio
@patch('superset.daos.dataset.DatasetDAO.find_by_id')
async def test_get_dataset_info_not_found(mock_info, mcp_server):
    mock_info.return_value = None  # Not found returns None
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_dataset_info", {"dataset_id": 999})
        assert result.data["error_type"] == "not_found"

@pytest.mark.asyncio
async def test_get_dataset_available_filters_success(mcp_server):
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_dataset_available_filters")
        assert hasattr(result.data, "filters")
        assert hasattr(result.data, "operators")
        assert hasattr(result.data, "columns")

@pytest.mark.asyncio
async def test_get_dataset_available_filters_exception_handling(mcp_server):
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_dataset_available_filters")
        assert hasattr(result.data, "filters")
        assert hasattr(result.data, "operators")
        assert hasattr(result.data, "columns") 
