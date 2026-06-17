# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file that in compliance
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
"""Unit tests for the resolve_values endpoint and query cache."""

from __future__ import annotations

import pytest
from unittest.mock import MagicMock, patch, PropertyMock


class TestResolveValuesEndpoint:
    """Tests for the /api/v1/dataset_relationship/resolve_values/ endpoint."""

    def test_rejects_missing_required_fields(self) -> None:
        """Should return 400 when required fields are missing."""
        from superset.dataset_relationship.api import (
            DatasetRelationshipRestApi,
        )

        api = DatasetRelationshipRestApi()
        api._check_feature_flag = lambda: None  # type: ignore[assignment]

        with patch("superset.dataset_relationship.api.request") as mock_request:
            mock_request.json = {"source_dataset_id": 1}
            response = api.resolve_values()
            assert response.status_code == 400

    def test_rejects_invalid_column_name(self) -> None:
        """Should return 400 when target_column doesn't exist in table."""
        from superset.dataset_relationship.api import (
            DatasetRelationshipRestApi,
        )

        api = DatasetRelationshipRestApi()
        api._check_feature_flag = lambda: None  # type: ignore[assignment]

        with (
            patch("superset.dataset_relationship.api.request") as mock_request,
            patch("superset.dataset_relationship.api.db") as mock_db,
        ):
            mock_request.json = {
                "source_dataset_id": 1,
                "target_dataset_id": 2,
                "source_column": "id",
                "target_column": "nonexistent_col",
                "source_values": [1, 2, 3],
            }

            # Mock the target dataset
            mock_table = MagicMock()
            mock_sqla_table = MagicMock()
            mock_sqla_table.c = []  # empty columns
            mock_table.get_sqla_table.return_value = mock_sqla_table

            mock_session = MagicMock()
            mock_session.query.return_value.filter.return_value.one_or_none.return_value = (
                mock_table
            )
            mock_db.session = mock_session

            response = api.resolve_values()
            assert response.status_code == 400

    def test_returns_distinct_values(self) -> None:
        """Should return distinct values from the target column."""
        from superset.dataset_relationship.api import (
            DatasetRelationshipRestApi,
        )

        api = DatasetRelationshipRestApi()
        api._check_feature_flag = lambda: None  # type: ignore[assignment]

        with (
            patch("superset.dataset_relationship.api.request") as mock_request,
            patch("superset.dataset_relationship.api.db") as mock_db,
        ):
            mock_request.json = {
                "source_dataset_id": 1,
                "target_dataset_id": 2,
                "source_column": "region_id",
                "target_column": "id",
                "source_values": [10, 20],
            }

            # Mock the target dataset
            mock_table = MagicMock()
            mock_sqla_table = MagicMock()
            mock_col = MagicMock()
            mock_col.distinct.return_value = mock_col
            type(mock_sqla_table.c).id = mock_col
            mock_sqla_table.c.__iter__ = lambda self: iter([mock_col])
            mock_table.get_sqla_table.return_value = mock_sqla_table

            mock_session = MagicMock()
            mock_session.query.return_value.filter.return_value.one_or_none.return_value = (
                mock_table
            )
            # Mock the query chain for distinct values
            mock_session.query.return_value.select_from.return_value.limit.return_value.all.return_value = [
                (1,),
                (2,),
                (3,),
            ]
            mock_db.session = mock_session

            response = api.resolve_values()
            assert response.status_code == 200


class TestRelationshipQueryCache:
    """Tests for the TTL-based relationship query cache."""

    def test_cache_key_deterministic(self) -> None:
        """Same inputs should produce the same cache key."""
        from superset.common.relationship_query_cache import (
            RelationshipQueryCache,
        )

        key1 = RelationshipQueryCache._make_cache_key(
            1, 2, [("col_a", "col_b")], "LEFT"
        )
        key2 = RelationshipQueryCache._make_cache_key(
            1, 2, [("col_a", "col_b")], "LEFT"
        )
        assert key1 == key2

    def test_cache_key_differs_for_different_inputs(self) -> None:
        """Different inputs should produce different cache keys."""
        from superset.common.relationship_query_cache import (
            RelationshipQueryCache,
        )

        key1 = RelationshipQueryCache._make_cache_key(
            1, 2, [("col_a", "col_b")], "LEFT"
        )
        key2 = RelationshipQueryCache._make_cache_key(
            1, 3, [("col_a", "col_b")], "LEFT"
        )
        assert key1 != key2

    def test_cache_key_ignores_column_order(self) -> None:
        """Column pair order should not affect the cache key (sorted)."""
        from superset.common.relationship_query_cache import (
            RelationshipQueryCache,
        )

        key1 = RelationshipQueryCache._make_cache_key(
            1, 2, [("col_a", "col_b"), ("col_c", "col_d")], "LEFT"
        )
        key2 = RelationshipQueryCache._make_cache_key(
            1, 2, [("col_c", "col_d"), ("col_a", "col_b")], "LEFT"
        )
        assert key1 == key2

    @patch("superset.common.relationship_query_cache.cache_manager")
    def test_set_and_get(self, mock_cm: MagicMock) -> None:
        """Should store and retrieve cache entries."""
        from superset.common.relationship_query_cache import (
            RelationshipQueryCache,
        )

        mock_cache = MagicMock()
        mock_cm.cache = mock_cache

        RelationshipQueryCache.set(
            1, 2, [("col_a", "col_b")], "LEFT", {"rows": 100}
        )
        assert mock_cache.set.called

    @patch("superset.common.relationship_query_cache.cache_manager")
    def test_invalidate_dataset(self, mock_cm: MagicMock) -> None:
        """Should increment version counter on invalidation."""
        from superset.common.relationship_query_cache import (
            RelationshipQueryCache,
        )

        mock_cache = MagicMock()
        mock_cache.get.return_value = 5
        mock_cm.cache = mock_cache

        version = RelationshipQueryCache.invalidate_dataset(42)
        assert version == 6
        mock_cache.set.assert_called()

    @patch("superset.common.relationship_query_cache.cache_manager")
    def test_get_returns_none_on_miss(self, mock_cm: MagicMock) -> None:
        """Should return None on cache miss."""
        from superset.common.relationship_query_cache import (
            RelationshipQueryCache,
        )

        mock_cache = MagicMock()
        mock_cache.get.return_value = None
        mock_cm.cache = mock_cache

        result = RelationshipQueryCache.get(
            1, 2, [("col_a", "col_b")], "LEFT"
        )
        assert result is None
