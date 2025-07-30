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

"""Tests for request schemas to ensure API consistency."""

import pytest
from pydantic import ValidationError

from superset.mcp_service.pydantic_schemas.chart_schemas import (
    GetChartAvailableFiltersRequest,
)
from superset.mcp_service.pydantic_schemas.dashboard_schemas import (
    GetDashboardAvailableFiltersRequest,
)
from superset.mcp_service.pydantic_schemas.dataset_schemas import (
    GetDatasetAvailableFiltersRequest,
)
from superset.mcp_service.pydantic_schemas.system_schemas import (
    GetSupersetInstanceInfoRequest,
)


class TestRequestSchemas:
    """Test request schemas for API consistency."""

    def test_get_dataset_available_filters_request_empty(self):
        """Test that empty request is valid."""
        request = GetDatasetAvailableFiltersRequest()
        assert request is not None

    def test_get_dataset_available_filters_request_extra_forbidden(self):
        """Test that extra fields are forbidden."""
        with pytest.raises(ValidationError) as exc_info:
            GetDatasetAvailableFiltersRequest(extra_field="value")

        assert "extra_field" in str(exc_info.value)

    def test_get_chart_available_filters_request_empty(self):
        """Test that empty request is valid."""
        request = GetChartAvailableFiltersRequest()
        assert request is not None

    def test_get_chart_available_filters_request_extra_forbidden(self):
        """Test that extra fields are forbidden."""
        with pytest.raises(ValidationError) as exc_info:
            GetChartAvailableFiltersRequest(unexpected="value")

        assert "unexpected" in str(exc_info.value)

    def test_get_dashboard_available_filters_request_empty(self):
        """Test that empty request is valid."""
        request = GetDashboardAvailableFiltersRequest()
        assert request is not None

    def test_get_dashboard_available_filters_request_extra_forbidden(self):
        """Test that extra fields are forbidden."""
        with pytest.raises(ValidationError) as exc_info:
            GetDashboardAvailableFiltersRequest(invalid_field="value")

        assert "invalid_field" in str(exc_info.value)

    def test_get_superset_instance_info_request_empty(self):
        """Test that empty request is valid."""
        request = GetSupersetInstanceInfoRequest()
        assert request is not None

    def test_get_superset_instance_info_request_extra_forbidden(self):
        """Test that extra fields are forbidden."""
        with pytest.raises(ValidationError) as exc_info:
            GetSupersetInstanceInfoRequest(invalid_param="test")

        assert "invalid_param" in str(exc_info.value)

    def test_request_schemas_consistency(self):
        """Test that all request schemas follow consistent patterns."""
        # All request schemas should be instantiable with no parameters
        dataset_request = GetDatasetAvailableFiltersRequest()
        chart_request = GetChartAvailableFiltersRequest()
        dashboard_request = GetDashboardAvailableFiltersRequest()
        system_request = GetSupersetInstanceInfoRequest()

        # All should have model_config with extra="forbid"
        assert dataset_request.model_config["extra"] == "forbid"
        assert chart_request.model_config["extra"] == "forbid"
        assert dashboard_request.model_config["extra"] == "forbid"
        assert system_request.model_config["extra"] == "forbid"

        # All should have str_strip_whitespace=True
        assert dataset_request.model_config["str_strip_whitespace"] is True
        assert chart_request.model_config["str_strip_whitespace"] is True
        assert dashboard_request.model_config["str_strip_whitespace"] is True
        assert system_request.model_config["str_strip_whitespace"] is True
