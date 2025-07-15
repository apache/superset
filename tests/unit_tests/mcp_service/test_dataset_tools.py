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
from superset.mcp_service.pydantic_schemas.dataset_schemas import (
    DatasetAvailableFilters, DatasetList, DatasetError, DatasetInfo
)
from superset.mcp_service.tools.dataset import (
    get_dataset_available_filters, get_dataset_info, list_datasets,
)
from superset.daos.dataset import DatasetDAO

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class TestDatasetTools:
    """Test dataset-related MCP tools"""

    @patch('superset.daos.dataset.DatasetDAO.list')
    def test_list_datasets_basic(self, mock_list):
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
        dataset.to_model = lambda: DatasetInfo(
            id=dataset.id,
            table_name=dataset.table_name,
            schema=dataset.schema,
            description=dataset.description,
            changed_by_name=dataset.changed_by_name,
            changed_on=dataset.changed_on,
            changed_on_humanized=dataset.changed_on_humanized,
            created_by_name=dataset.created_by_name,
            created_on=dataset.created_on,
            created_on_humanized=dataset.created_on_humanized,
            tags=dataset.tags,
            owners=dataset.owners,
            is_virtual=dataset.is_virtual,
            database_id=dataset.database_id,
            schema_perm=dataset.schema_perm,
            url=dataset.url,
            database_name=dataset.database.database_name,
            sql=dataset.sql,
            main_dttm_col=dataset.main_dttm_col,
            offset=dataset.offset,
            cache_timeout=dataset.cache_timeout,
            params=dataset.params,
            template_params=dataset.template_params,
            extra=dataset.extra,
        )
        # Patch _mapping to a real dict for item_serializer compatibility
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

        result = list_datasets()
        assert result.count == 1
        assert result.total_count == 1
        assert result.datasets[0].table_name == "Test DatasetInfo"
        assert result.datasets[0].database_name == "examples"

    @patch('superset.daos.dataset.DatasetDAO.list')
    def test_list_datasets_with_filters(self, mock_list):
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
        dataset.to_model = lambda: DatasetInfo(
            id=dataset.id,
            table_name=dataset.table_name,
            schema=dataset.schema,
            description=dataset.description,
            changed_by_name=dataset.changed_by_name,
            changed_on=dataset.changed_on,
            changed_on_humanized=dataset.changed_on_humanized,
            created_by_name=dataset.created_by_name,
            created_on=dataset.created_on,
            created_on_humanized=dataset.created_on_humanized,
            tags=dataset.tags,
            owners=dataset.owners,
            is_virtual=dataset.is_virtual,
            database_id=dataset.database_id,
            schema_perm=dataset.schema_perm,
            url=dataset.url,
            database_name=dataset.database.database_name,
            sql=dataset.sql,
            main_dttm_col=dataset.main_dttm_col,
            offset=dataset.offset,
            cache_timeout=dataset.cache_timeout,
            params=dataset.params,
            template_params=dataset.template_params,
            extra=dataset.extra,
        )
        # Patch _mapping to a real dict for item_serializer compatibility
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
        result = list_datasets(
            filters=filters,
            select_columns=["id", "table_name"],
            order_column="changed_on",
            order_direction="desc",
            page=1,
            page_size=50
        )
        assert result.count == 1
        assert result.datasets[0].table_name == "Filtered Dataset"

    @patch('superset.daos.dataset.DatasetDAO.list')
    def test_list_datasets_with_string_filters(self, mock_list):
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
        dataset.to_model = lambda: DatasetInfo(
            id=dataset.id,
            table_name=dataset.table_name,
            schema=dataset.schema,
            description=dataset.description,
            changed_by_name=dataset.changed_by_name,
            changed_on=dataset.changed_on,
            changed_on_humanized=dataset.changed_on_humanized,
            created_by_name=dataset.created_by_name,
            created_on=dataset.created_on,
            created_on_humanized=dataset.created_on_humanized,
            tags=dataset.tags,
            owners=dataset.owners,
            is_virtual=dataset.is_virtual,
            database_id=dataset.database_id,
            schema_perm=dataset.schema_perm,
            url=dataset.url,
            database_name=dataset.database.database_name,
            sql=dataset.sql,
            main_dttm_col=dataset.main_dttm_col,
            offset=dataset.offset,
            cache_timeout=dataset.cache_timeout,
            params=dataset.params,
            template_params=dataset.template_params,
            extra=dataset.extra,
        )
        # Patch _mapping to a real dict for item_serializer compatibility
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
        filters = '[{"col": "table_name", "opr": "sw", "value": "Sales"}]'
        result = list_datasets(filters=filters)
        assert result.count == 1
        assert result.datasets[0].table_name == "String Filter Dataset"

    @patch('superset.daos.dataset.DatasetDAO.list')
    def test_list_datasets_api_error(self, mock_list):
        mock_list.side_effect = Exception("API request failed")
        with pytest.raises(Exception) as excinfo:
            list_datasets()
        assert "API request failed" in str(excinfo.value)

    @patch('superset.daos.dataset.DatasetDAO.list')
    def test_list_datasets_with_search(self, mock_list):
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
        dataset.to_model = lambda: DatasetInfo(
            id=dataset.id,
            table_name=dataset.table_name,
            schema=dataset.schema,
            description=dataset.description,
            changed_by_name=dataset.changed_by_name,
            changed_on=dataset.changed_on,
            changed_on_humanized=dataset.changed_on_humanized,
            created_by_name=dataset.created_by_name,
            created_on=dataset.created_on,
            created_on_humanized=dataset.created_on_humanized,
            tags=dataset.tags,
            owners=dataset.owners,
            is_virtual=dataset.is_virtual,
            database_id=dataset.database_id,
            schema_perm=dataset.schema_perm,
            url=dataset.url,
            database_name=dataset.database_name,
            sql=dataset.sql,
            main_dttm_col=dataset.main_dttm_col,
            offset=dataset.offset,
            cache_timeout=dataset.cache_timeout,
            params=dataset.params,
            template_params=dataset.template_params,
            extra=dataset.extra,
        )
        # Patch _mapping to a real dict for item_serializer compatibility
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
        result = list_datasets(search="search_table")
        assert result.count == 1
        assert result.datasets[0].table_name == "search_table"
        args, kwargs = mock_list.call_args
        assert kwargs["search"] == "search_table"
        assert "table_name" in kwargs["search_columns"]
        assert "schema" in kwargs["search_columns"]

    @patch('superset.daos.dataset.DatasetDAO.list')
    def test_list_datasets_simple_with_search(self, mock_list):
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
        dataset.to_model = lambda: DatasetInfo(
            id=dataset.id,
            table_name=dataset.table_name,
            schema=dataset.schema,
            description=dataset.description,
            changed_by_name=dataset.changed_by_name,
            changed_on=dataset.changed_on,
            changed_on_humanized=dataset.changed_on_humanized,
            created_by_name=dataset.created_by_name,
            created_on=dataset.created_on,
            created_on_humanized=dataset.created_on_humanized,
            tags=dataset.tags,
            owners=dataset.owners,
            is_virtual=dataset.is_virtual,
            database_id=dataset.database_id,
            schema_perm=dataset.schema_perm,
            url=dataset.url,
            database_name=dataset.database_name,
            sql=dataset.sql,
            main_dttm_col=dataset.main_dttm_col,
            offset=dataset.offset,
            cache_timeout=dataset.cache_timeout,
            params=dataset.params,
            template_params=dataset.template_params,
            extra=dataset.extra,
        )
        # Patch _mapping to a real dict for item_serializer compatibility
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
        result = list_datasets(search="simple_search")
        assert result.count == 1
        assert result.datasets[0].table_name == "simple_search"
        args, kwargs = mock_list.call_args
        assert kwargs["search"] == "simple_search"
        assert "table_name" in kwargs["search_columns"]
        assert "schema" in kwargs["search_columns"]

    @patch('superset.daos.dataset.DatasetDAO.list')
    def test_list_datasets_simple_basic(self, mock_list):
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
        dataset.to_model = lambda: DatasetInfo(
            id=dataset.id,
            table_name=dataset.table_name,
            schema=dataset.schema,
            description=dataset.description,
            changed_by_name=dataset.changed_by_name,
            changed_on=dataset.changed_on,
            changed_on_humanized=dataset.changed_on_humanized,
            created_by_name=dataset.created_by_name,
            created_on=dataset.created_on,
            created_on_humanized=dataset.created_on_humanized,
            tags=dataset.tags,
            owners=dataset.owners,
            is_virtual=dataset.is_virtual,
            database_id=dataset.database_id,
            schema_perm=dataset.schema_perm,
            url=dataset.url,
            database_name=dataset.database.database_name,
            sql=dataset.sql,
            main_dttm_col=dataset.main_dttm_col,
            offset=dataset.offset,
            cache_timeout=dataset.cache_timeout,
            params=dataset.params,
            template_params=dataset.template_params,
            extra=dataset.extra,
        )
        # Patch _mapping to a real dict for item_serializer compatibility
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
        result = list_datasets(filters=filters)
        assert isinstance(result, DatasetList)
        assert result.count == 1
        assert result.datasets[0].table_name == "Test DatasetInfo"
        assert result.datasets[0].database_name == "examples"

    @patch('superset.daos.dataset.DatasetDAO.list')
    def test_list_datasets_simple_with_filters(self, mock_list):
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
        dataset.to_model = lambda: DatasetInfo(
            id=dataset.id,
            table_name=dataset.table_name,
            schema=dataset.schema,
            description=dataset.description,
            changed_by_name=dataset.changed_by_name,
            changed_on=dataset.changed_on,
            changed_on_humanized=dataset.changed_on_humanized,
            created_by_name=dataset.created_by_name,
            created_on=dataset.created_on,
            created_on_humanized=dataset.created_on_humanized,
            tags=dataset.tags,
            owners=dataset.owners,
            is_virtual=dataset.is_virtual,
            database_id=dataset.database_id,
            schema_perm=dataset.schema_perm,
            url=dataset.url,
            database_name=dataset.database.database_name,
            sql=dataset.sql,
            main_dttm_col=dataset.main_dttm_col,
            offset=dataset.offset,
            cache_timeout=dataset.cache_timeout,
            params=dataset.params,
            template_params=dataset.template_params,
            extra=dataset.extra,
        )
        # Patch _mapping to a real dict for item_serializer compatibility
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
        result = list_datasets(filters=filters)
        assert result.count == 1
        assert result.datasets[0].table_name == "Sales Dataset"

    @patch('superset.daos.dataset.DatasetDAO.list')
    def test_list_datasets_simple_api_error(self, mock_list):
        mock_list.side_effect = Exception("API request failed")
        filters = [{"col": "table_name", "opr": "sw", "value": "Sales"}, {"col": "schema", "opr": "eq", "value": "main"}]
        with pytest.raises(Exception) as excinfo:
            list_datasets(filters=filters)
        assert "API request failed" in str(excinfo.value)

    @patch('superset.daos.dataset.DatasetDAO.find_by_id')
    def test_get_dataset_info_success(self, mock_info):
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
        dataset.to_model = lambda: DatasetInfo(
            id=dataset.id,
            table_name=dataset.table_name,
            schema=dataset.schema,
            description=dataset.description,
            changed_by_name=dataset.changed_by_name,
            changed_on=dataset.changed_on,
            changed_on_humanized=dataset.changed_on_humanized,
            created_by_name=dataset.created_by_name,
            created_on=dataset.created_on,
            created_on_humanized=dataset.created_on_humanized,
            tags=dataset.tags,
            owners=dataset.owners,
            is_virtual=dataset.is_virtual,
            database_id=dataset.database_id,
            schema_perm=dataset.schema_perm,
            url=dataset.url,
            database_name=dataset.database.database_name,
            sql=dataset.sql,
            main_dttm_col=dataset.main_dttm_col,
            offset=dataset.offset,
            cache_timeout=dataset.cache_timeout,
            params=dataset.params,
            template_params=dataset.template_params,
            extra=dataset.extra,
        )
        mock_info.return_value = dataset  # Only the dataset object
        result = get_dataset_info(1)
        assert result.table_name == "Test DatasetInfo"

    @patch('superset.daos.dataset.DatasetDAO.find_by_id')
    def test_get_dataset_info_not_found(self, mock_info):
        mock_info.return_value = None  # Not found returns None
        result = get_dataset_info(999)
        assert result.error_type == "not_found"

    def test_get_dataset_available_filters_success(self):
        result = get_dataset_available_filters()
        assert hasattr(result, "filters")
        assert hasattr(result, "operators")
        assert hasattr(result, "columns")

    def test_get_dataset_available_filters_exception_handling(self):
        result = get_dataset_available_filters()
        assert isinstance(result, DatasetAvailableFilters)
        assert hasattr(result, "filters")
        assert hasattr(result, "operators")
        assert hasattr(result, "columns") 