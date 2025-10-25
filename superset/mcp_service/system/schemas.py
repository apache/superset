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
Pydantic schemas for shared system types (UserInfo, TagInfo, PaginationInfo)
"""

from typing import List

from pydantic import BaseModel, ConfigDict, Field


class HealthCheckResponse(BaseModel):
    """Response model for health check.

    Used by health check tool to return service status and system information.
    """

    status: str
    timestamp: str
    service: str
    version: str
    python_version: str
    platform: str
    uptime_seconds: float


class UserInfo(BaseModel):
    """User information schema."""

    id: int | None = None
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    active: bool | None = None


class TagInfo(BaseModel):
    """Tag information schema."""

    id: int | None = None
    name: str | None = None
    type: str | None = None
    description: str | None = None


class PaginationInfo(BaseModel):
    """Pagination metadata."""

    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    total_count: int = Field(..., description="Total number of items")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there is a next page")
    has_previous: bool = Field(..., description="Whether there is a previous page")
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class RoleInfo(BaseModel):
    """Role information schema (for future use)."""

    id: int | None = None
    name: str | None = None
    permissions: List[str] | None = None
