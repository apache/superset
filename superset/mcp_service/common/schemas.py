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
Common schemas shared across multiple MCP tools.

This module contains Pydantic models that are used by multiple tools
or represent common response patterns across the MCP service.
"""

from pydantic import BaseModel


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
