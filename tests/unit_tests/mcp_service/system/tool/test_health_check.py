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

"""Tests for health_check MCP tool."""

import pytest
from pydantic import ValidationError

from superset.mcp_service.system.schemas import (
    GetHealthCheckRequest,
    HealthCheckResponse,
)


def test_health_check_request_schema():
    """Test that GetHealthCheckRequest schema allows empty object."""
    # This should not raise validation errors
    request = GetHealthCheckRequest()

    # Verify it's a valid schema with no required fields
    assert request is not None

    # Verify it can be created from empty dict (simulating MCP client)
    request_from_dict = GetHealthCheckRequest.model_validate({})
    assert request_from_dict is not None


def test_health_check_request_forbids_extra_fields():
    """Test that GetHealthCheckRequest forbids unexpected fields."""
    # Should raise validation error when extra fields are provided
    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        GetHealthCheckRequest.model_validate({"unexpected_field": "value"})


def test_health_check_response_schema():
    """Test that HealthCheckResponse has required fields."""
    response = HealthCheckResponse(
        status="healthy",
        timestamp="2025-11-10T19:00:00",
        service="Superset MCP Service",
        version="1.0.0",
        python_version="3.11.0",
        platform="Darwin",
    )

    assert response.status == "healthy"
    assert response.service == "Superset MCP Service"
    assert response.version == "1.0.0"
    assert response.python_version == "3.11.0"
    assert response.platform == "Darwin"
    assert response.timestamp is not None
    assert response.uptime_seconds is None  # Optional field


def test_health_check_response_with_uptime():
    """Test HealthCheckResponse with optional uptime field."""
    response = HealthCheckResponse(
        status="healthy",
        timestamp="2025-11-10T19:00:00",
        service="Superset MCP Service",
        version="1.0.0",
        python_version="3.11.0",
        platform="Darwin",
        uptime_seconds=123.45,
    )

    assert response.uptime_seconds == 123.45
