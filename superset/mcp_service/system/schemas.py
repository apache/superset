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
Schema definitions for system-related MCP tools and responses.

This module defines the Pydantic schemas that will be used for:
- Superset instance information and metadata
- System health checks and status
- Configuration information
- Authentication and authorization status

These schemas establish the contract for system-related MCP tools.
"""

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SystemHealthStatus(str, Enum):
    """System health status options."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class DatabaseConnectionStatus(str, Enum):
    """Database connection status."""

    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class DatabaseInfo(BaseModel):
    """Database connection information."""

    id: int = Field(..., description="Database ID")
    name: str = Field(..., description="Database name")
    backend: str = Field(..., description="Database backend type")
    status: DatabaseConnectionStatus = Field(..., description="Connection status")
    tables_count: Optional[int] = Field(None, description="Number of tables")


class SupersetInstanceInfo(BaseModel):
    """Comprehensive Superset instance information."""

    version: str = Field(..., description="Superset version")
    database_count: int = Field(..., description="Number of databases")
    dataset_count: int = Field(..., description="Number of datasets")
    chart_count: int = Field(..., description="Number of charts")
    dashboard_count: int = Field(..., description="Number of dashboards")
    active_users: Optional[int] = Field(None, description="Number of active users")
    databases: List[DatabaseInfo] = Field(..., description="Database connections")


class SystemHealthResponse(BaseModel):
    """Response schema for system health checks."""

    status: SystemHealthStatus = Field(..., description="Overall system status")
    timestamp: str = Field(..., description="Health check timestamp")
    services: Dict[str, Any] = Field(..., description="Individual service statuses")
    database_connections: List[DatabaseInfo] = Field(
        ..., description="Database connection statuses"
    )
    uptime: Optional[int] = Field(None, description="System uptime in seconds")


class MCPServiceInfo(BaseModel):
    """MCP Service information."""

    service_name: str = Field(..., description="Service name")
    version: str = Field(..., description="Service version")
    status: str = Field(..., description="Service status")
    supported_tools: List[str] = Field(..., description="List of supported MCP tools")
    authentication_enabled: bool = Field(
        ..., description="Whether authentication is enabled"
    )
    features: Dict[str, bool] = Field(..., description="Enabled features")


class GetInstanceInfoRequest(BaseModel):
    """Request schema for getting instance information."""

    include_databases: bool = Field(True, description="Include database information")
    include_metrics: bool = Field(True, description="Include usage metrics")


class GetInstanceInfoResponse(BaseModel):
    """Response schema for instance information."""

    instance_info: SupersetInstanceInfo = Field(..., description="Instance information")
    mcp_service_info: MCPServiceInfo = Field(..., description="MCP service information")
    timestamp: str = Field(..., description="Information timestamp")


class ConfigurationInfo(BaseModel):
    """System configuration information (non-sensitive)."""

    feature_flags: Dict[str, bool] = Field(..., description="Enabled feature flags")
    supported_databases: List[str] = Field(..., description="Supported database types")
    authentication_type: str = Field(..., description="Authentication method")
    cache_enabled: bool = Field(..., description="Whether caching is enabled")
    # Additional safe configuration fields will be added


class SystemMetrics(BaseModel):
    """System performance metrics."""

    memory_usage: Optional[float] = Field(None, description="Memory usage percentage")
    cpu_usage: Optional[float] = Field(None, description="CPU usage percentage")
    active_connections: Optional[int] = Field(
        None, description="Active database connections"
    )
    cache_hit_rate: Optional[float] = Field(
        None, description="Cache hit rate percentage"
    )
    # Additional metrics will be added


class SystemStatusResponse(BaseModel):
    """Comprehensive system status response."""

    health: SystemHealthResponse = Field(..., description="System health information")
    configuration: ConfigurationInfo = Field(..., description="System configuration")
    metrics: Optional[SystemMetrics] = Field(None, description="Performance metrics")
    last_updated: str = Field(..., description="Last status update timestamp")
