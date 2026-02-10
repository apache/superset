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
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

# Import the same ChartConfig used by generate_chart
from superset.mcp_service.chart.schemas import ChartConfig


class GetEmbeddableChartRequest(BaseModel):
    """Request schema for get_embeddable_chart tool.

    Uses the same simplified ChartConfig schema as generate_chart for consistency.
    """

    datasource_id: int | str = Field(
        ...,
        description="Dataset ID (numeric) or UUID",
    )
    config: ChartConfig = Field(
        ...,
        description=(
            "Chart configuration using simplified schema. Use chart_type='xy' for "
            "line/bar/area/scatter charts, or chart_type='table' for tables. "
            'Example: {"chart_type": "xy", "x": {"name": "genre"}, '
            '"y": [{"name": "sales", "aggregate": "SUM"}], "kind": "bar"}'
        ),
    )
    ttl_minutes: int = Field(
        default=60,
        ge=1,
        le=10080,  # max 1 week
        description="Permalink TTL in minutes (default: 60, max: 10080 = 1 week)",
    )
    height: int = Field(
        default=400,
        ge=100,
        le=2000,
        description="Chart height in pixels for iframe (default: 400)",
    )
    rls_rules: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Row-level security rules to apply to the guest token",
    )
    allowed_domains: list[str] = Field(
        default_factory=list,
        description=(
            "List of domains allowed to embed this chart. "
            "If empty, any domain can embed (less secure). "
            "Example: ['https://example.com', 'https://app.example.com']"
        ),
    )


class GetEmbeddableChartResponse(BaseModel):
    """Response schema for get_embeddable_chart tool."""

    success: bool = Field(
        ...,
        description="Whether the operation succeeded",
    )
    iframe_url: str | None = Field(
        default=None,
        description="URL for embedding in iframe",
    )
    guest_token: str | None = Field(
        default=None,
        description="Guest token for authentication",
    )
    iframe_html: str | None = Field(
        default=None,
        description="Ready-to-use HTML iframe snippet",
    )
    permalink_key: str | None = Field(
        default=None,
        description="The permalink key for the chart",
    )
    expires_at: datetime | None = Field(
        default=None,
        description="When the permalink and token expire",
    )
    error: str | None = Field(
        default=None,
        description="Error message if operation failed",
    )
