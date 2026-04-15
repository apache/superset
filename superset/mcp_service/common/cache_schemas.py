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
Cache control schemas for MCP tools.

These schemas provide cache control parameters that leverage Superset's
existing cache infrastructure including query result cache, metadata cache,
form data cache, and dashboard cache.
"""

from pydantic import BaseModel, Field


class CacheControlMixin(BaseModel):
    """
    Mixin for cache control parameters that can be added to any request schema.

    Leverages Superset's existing cache layers:
    - Query Result Cache: Caches actual query results from customer databases
    - Metadata Cache: Caches table schemas, column info, etc.
    - Form Data Cache: Caches chart configurations for explore URLs
    - Dashboard Cache: Caches rendered dashboard components
    """

    use_cache: bool = Field(default=True, description="Use cache if available")

    force_refresh: bool = Field(
        default=False, description="Invalidate cache and fetch fresh data"
    )


class QueryCacheControl(CacheControlMixin):
    """
    Cache control specifically for data queries.

    Used by tools that execute SQL queries against customer databases
    like get_chart_data, chart previews, and chart creation.
    """

    cache_timeout: int | None = Field(
        default=None, description="Cache timeout override in seconds (0 to disable)"
    )


class MetadataCacheControl(CacheControlMixin):
    """
    Cache control for metadata operations.

    Used by tools that fetch database metadata like table schemas,
    column information, metrics, and dataset listings.
    """

    refresh_metadata: bool = Field(
        default=False, description="Refresh metadata cache for schema changes"
    )


class FormDataCacheControl(CacheControlMixin):
    """
    Cache control for form data and chart configurations.

    Used by tools that work with chart configurations and explore URLs
    like generate_explore_link and chart preview updates.
    """

    cache_form_data: bool = Field(
        default=True, description="Cache form data for future use"
    )


class CacheStatus(BaseModel):
    """
    Information about cache usage in tool responses.

    Provides transparency about whether data was served from cache
    or freshly fetched, helping users understand data freshness.
    """

    cache_hit: bool = Field(
        description="Whether the data was served from cache (True) or "
        "freshly fetched (False)"
    )

    cache_type: str | None = Field(
        default=None,
        description=(
            "Type of cache used: 'query', 'metadata', 'form_data', 'dashboard', "
            "or 'none' if no cache was used"
        ),
    )

    cache_age_seconds: int | None = Field(
        default=None, description="Age of cached data in seconds, if served from cache"
    )

    cache_key: str | None = Field(
        default=None,
        description="Cache key used (for debugging), truncated if too long",
    )

    refreshed: bool = Field(
        default=False, description="Whether cache was refreshed as part of this request"
    )
