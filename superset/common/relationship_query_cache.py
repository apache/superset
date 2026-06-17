# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file that in compliance
# with the License.  You may obtain the copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Cache layer for cross-database merge results.

Provides TTL-based caching with automatic invalidation when
relationships or underlying data change.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from typing import Any, Optional

from superset.extensions import cache_manager

logger = logging.getLogger(__name__)

# Default TTL: 5 minutes
DEFAULT_CACHE_TTL = 300

# Cache key prefix
CACHE_PREFIX = "dataset_relationship_merge"


class RelationshipQueryCache:
    """Cache for cross-database merge results.

    Uses Superset's cache_manager (Redis or Memcached) to store
    merge results keyed by a hash of the input parameters.

    Cache keys follow the pattern::

        dataset_relationship_merge:<hash(source_dataset_id, target_dataset_id,
                         column_pairs, join_type, filter_hash)>

    Invalidation happens via:
    1. TTL expiry (default 5 minutes)
    2. Explicit invalidation when a relationship is modified
    3. Explicit invalidation when a dataset is refreshed
    """

    @staticmethod
    def _make_cache_key(
        source_dataset_id: int,
        target_dataset_id: int,
        column_pairs: list[tuple[str, str]],
        join_type: str,
        extra: dict[str, Any] | None = None,
    ) -> str:
        """Build a deterministic cache key from merge parameters."""
        payload = json.dumps(
            {
                "src": source_dataset_id,
                "tgt": target_dataset_id,
                "cols": sorted(column_pairs),
                "join": join_type,
                "extra": extra or {},
            },
            sort_keys=True,
        )
        digest = hashlib.sha256(payload.encode()).hexdigest()[:16]
        return f"{CACHE_PREFIX}:{digest}"

    @staticmethod
    def get(
        source_dataset_id: int,
        target_dataset_id: int,
        column_pairs: list[tuple[str, str]],
        join_type: str,
        extra: dict[str, Any] | None = None,
    ) -> Optional[dict[str, Any]]:
        """Retrieve a cached merge result.

        Returns the cached entry dict or ``None`` if not found / expired.
        """
        key = RelationshipQueryCache._make_cache_key(
            source_dataset_id, target_dataset_id, column_pairs, join_type, extra,
        )
        try:
            cached = cache_manager.cache.get(key)
            if cached is not None:
                logger.debug("Cache hit for key %s", key)
                return cached
        except Exception:
            logger.warning("Cache read error for key %s", key, exc_info=True)
        return None

    @staticmethod
    def set(
        source_dataset_id: int,
        target_dataset_id: int,
        column_pairs: list[tuple[str, str]],
        join_type: str,
        result: dict[str, Any],
        ttl: int = DEFAULT_CACHE_TTL,
        extra: dict[str, Any] | None = None,
    ) -> None:
        """Store a merge result in cache.

        Parameters
        ----------
        ttl : int
            Time-to-live in seconds.  Defaults to ``DEFAULT_CACHE_TTL`` (300s).
        """
        key = RelationshipQueryCache._make_cache_key(
            source_dataset_id, target_dataset_id, column_pairs, join_type, extra,
        )
        entry = {
            "result": result,
            "cached_at": time.time(),
            "ttl": ttl,
        }
        try:
            cache_manager.cache.set(key, entry, timeout=ttl)
            logger.debug("Cached merge result at key %s (ttl=%ds)", key, ttl)
        except Exception:
            logger.warning("Cache write error for key %s", key, exc_info=True)

    @staticmethod
    def invalidate_dataset(dataset_id: int) -> int:
        """Invalidate all cache entries related to a dataset.

        Since we cannot enumerate cache keys efficiently in all backends,
        this method uses a versioning approach: incrementing a dataset
        version counter that is included in the cache key hash.

        Returns the new version number.
        """
        version_key = f"{CACHE_PREFIX}:version:{dataset_id}"
        try:
            current = cache_manager.cache.get(version_key) or 0
            new_version = current + 1
            cache_manager.cache.set(version_key, new_version, timeout=0)
            logger.info(
                "Invalidated cache for dataset %d (version %d → %d)",
                dataset_id,
                current,
                new_version,
            )
            return new_version
        except Exception:
            logger.warning(
                "Cache invalidation error for dataset %d", dataset_id, exc_info=True,
            )
            return 0

    @staticmethod
    def invalidate_relationship(relationship_id: int) -> None:
        """Invalidate cache entries related to a relationship.

        Fetches the relationship's datasets and invalidates both.
        """
        try:
            from superset.daos.dataset_relationship import DatasetRelationshipDAO

            rel = DatasetRelationshipDAO.find_by_id(relationship_id)
            if rel:
                RelationshipQueryCache.invalidate_dataset(rel.source_dataset_id)
                RelationshipQueryCache.invalidate_dataset(rel.target_dataset_id)
        except Exception:
            logger.warning(
                "Relationship cache invalidation error for id=%d",
                relationship_id,
                exc_info=True,
            )

    @staticmethod
    def get_dataset_version(dataset_id: int) -> int:
        """Get the current version number for a dataset (for cache key)."""
        version_key = f"{CACHE_PREFIX}:version:{dataset_id}"
        try:
            return cache_manager.cache.get(version_key) or 0
        except Exception:
            return 0
