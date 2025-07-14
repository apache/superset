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
Unit tests for MCP tool error handling and parameter validation
"""
import logging
from unittest.mock import patch
import pytest
from superset.mcp_service.pydantic_schemas.dashboard_schemas import DashboardAvailableFilters, DashboardList
from superset.mcp_service.pydantic_schemas.dataset_schemas import DatasetAvailableFilters, DatasetList
from superset.mcp_service.tools.dashboard import get_dashboard_available_filters, list_dashboards
from superset.mcp_service.tools.dataset import get_dataset_available_filters, list_datasets
from fastmcp.exceptions import ToolError

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class TestErrorHandling:
    """Test error handling and parameter validation in MCP tools"""

    @patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.list')
    def test_list_dashboards_exception_handling(self, mock_list):
        mock_list.side_effect = Exception("Unexpected error")
        with pytest.raises(Exception) as excinfo:
            list_dashboards()
        assert "Unexpected error" in str(excinfo.value)

    def test_get_dashboard_available_filters_exception_handling(self):
        result = get_dashboard_available_filters()
        assert isinstance(result, DashboardAvailableFilters)
        assert hasattr(result, "filters")
        assert hasattr(result, "operators")
        assert hasattr(result, "columns")

    def test_list_datasets_exception_handling(self):
        result = list_datasets()
        assert isinstance(result, (dict, DatasetList))
        if isinstance(result, dict):
            assert "count" in result
            assert "datasets" in result
        else:
            assert hasattr(result, "count")
            assert hasattr(result, "datasets")

    def test_list_dashboards_parameter_types(self):
        with patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.list') as mock_list:
            mock_list.return_value = ([], 0)
            list_dashboards(filters='[{"col": "test", "opr": "eq", "value": "value"}]')
            list_dashboards(filters=[{"col": "test", "opr": "eq", "value": "value"}])
            list_dashboards(select_columns="id,dashboard_title")
            list_dashboards(select_columns=["id", "dashboard_title"])
            assert mock_list.call_count == 4

    def test_list_datasets_parameter_types(self):
        with patch('superset.mcp_service.dao_wrapper.MCPDAOWrapper.list') as mock_list:
            mock_list.return_value = ([], 0)
            list_datasets(filters='[{"col": "test", "opr": "eq", "value": "value"}]')
            list_datasets(filters=[{"col": "test", "opr": "eq", "value": "value"}])
            list_datasets(select_columns="id,table_name")
            list_datasets(select_columns=["id", "table_name"])
            assert mock_list.call_count == 4

    # Example: test for missing required param, extra param, and malformed input would be in protocol/integration tests 