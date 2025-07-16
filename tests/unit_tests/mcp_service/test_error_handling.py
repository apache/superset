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
from superset.mcp_service.dashboard.tool.get_dashboard_available_filters import \
    get_dashboard_available_filters
from superset.mcp_service.dashboard.tool.list_dashboards import list_dashboards
from superset.mcp_service.dataset.tool.list_datasets import list_datasets
from superset.mcp_service.pydantic_schemas.dashboard_schemas import \
    DashboardAvailableFilters

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class TestErrorHandling:
    """Test error handling and parameter validation in MCP tools"""

    @patch('superset.daos.dashboard.DashboardDAO.list')
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

    @patch('superset.daos.dataset.DatasetDAO.list')
    def test_list_datasets_exception_handling(self, mock_list):
        mock_list.side_effect = Exception("API request failed")
        with pytest.raises(Exception) as excinfo:
            list_datasets()
        assert "API request failed" in str(excinfo.value)

    def test_list_dashboards_parameter_types(self):
        from pydantic import ValidationError
        with patch('superset.daos.dashboard.DashboardDAO.list') as mock_list:
            mock_list.return_value = ([], 0)
            with pytest.raises(ValidationError):
                list_dashboards(filters='[{"col": "test", "opr": "eq", "value": "value"}]')
            with pytest.raises(ValidationError):
                list_dashboards(filters=[{"col": "test", "opr": "eq", "value": "value"}])
            list_dashboards(select_columns="id,dashboard_title")
            list_dashboards(select_columns=["id", "dashboard_title"])

    def test_list_datasets_parameter_types(self):
        from pydantic import ValidationError
        with patch('superset.daos.dataset.DatasetDAO.list') as mock_list:
            mock_list.return_value = ([], 0)
            with pytest.raises(ValidationError):
                list_datasets(filters='[{"col": "test", "opr": "eq", "value": "value"}]')
            with pytest.raises(ValidationError):
                list_datasets(filters=[{"col": "test", "opr": "eq", "value": "value"}])
            list_datasets(select_columns="id,table_name")
            list_datasets(select_columns=["id", "table_name"])

    # Example: test for missing required param, extra param, and malformed input would be in protocol/integration tests 
