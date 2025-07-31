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
Cache utilities for MCP tools.

This module provides utilities for working with Superset's cache layers
and implementing cache control in MCP tools.
"""

import logging
from typing import Any, Dict, Optional

from superset.mcp_service.schemas.cache_schemas import CacheStatus

logger = logging.getLogger(__name__)


def get_cache_status_from_result(
    result: Dict[str, Any], force_refresh: bool = False
) -> CacheStatus:
    """
    Extract cache status information from a Superset query result.

    Args:
        result: Query result dictionary from Superset
        force_refresh: Whether cache was force refreshed

    Returns:
        CacheStatus object with cache usage information
    """
    # Handle different result structures
    if "queries" in result and len(result["queries"]) > 0:
        query_result = result["queries"][0]
    else:
        query_result = result

    cache_hit = bool(query_result.get("is_cached", False))

    # Convert cache age to seconds if available
    cache_age_seconds = None
    if cache_age := query_result.get("cache_dttm"):
        try:
            from datetime import datetime

            if isinstance(cache_age, str):
                cache_dt = datetime.fromisoformat(cache_age.replace("Z", "+00:00"))
                cache_age_seconds = int(
                    (datetime.now(cache_dt.tzinfo) - cache_dt).total_seconds()
                )
            elif isinstance(cache_age, datetime):
                cache_age_seconds = int(
                    (datetime.now(cache_age.tzinfo) - cache_age).total_seconds()
                )
        except Exception as e:
            logger.debug(f"Could not parse cache age: {e}")

    return CacheStatus(
        cache_hit=cache_hit,
        cache_type="query" if cache_hit else "none",
        cache_age_seconds=cache_age_seconds,
        refreshed=force_refresh,
    )


def apply_cache_control_to_query_context(
    query_context: Dict[str, Any],
    use_cache: bool = True,
    force_refresh: bool = False,
    cache_timeout: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Apply cache control parameters to a query context.

    Args:
        query_context: Query context dictionary
        use_cache: Whether to use cache
        force_refresh: Whether to force refresh
        cache_timeout: Cache timeout override

    Returns:
        Modified query context with cache control applied
    """
    if not use_cache or force_refresh:
        query_context["force"] = True

    if cache_timeout is not None:
        # Apply to all queries in the context
        for query in query_context.get("queries", []):
            query["cache_timeout"] = cache_timeout

    return query_context


def should_use_metadata_cache(
    use_cache: bool = True,
    refresh_metadata: bool = False,
) -> bool:
    """
    Determine whether to use metadata cache based on cache control parameters.

    Args:
        use_cache: Whether to use cache
        refresh_metadata: Whether to refresh metadata

    Returns:
        True if metadata cache should be used
    """
    return use_cache and not refresh_metadata


def get_cache_key_info(cache_key: Optional[str]) -> Optional[str]:
    """
    Get truncated cache key for debugging purposes.

    Args:
        cache_key: Full cache key

    Returns:
        Truncated cache key or None
    """
    if not cache_key:
        return None

    # Truncate long cache keys for readability
    if len(cache_key) > 50:
        return cache_key[:47] + "..."

    return cache_key
