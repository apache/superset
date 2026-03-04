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
Unit tests for the popularity scoring module.
"""

from __future__ import annotations

from collections import namedtuple
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from superset.mcp_service.common.popularity import (
    _recency_bonus,
    compute_chart_popularity,
    compute_dashboard_popularity,
    compute_dataset_popularity,
    get_popularity_sorted_ids,
)

# Named tuples to simulate SQLAlchemy query results
ViewRow = namedtuple("ViewRow", ["slice_id", "view_count"])
DashViewRow = namedtuple("DashViewRow", ["dashboard_id", "view_count"])
FavRow = namedtuple("FavRow", ["obj_id", "fav_count"])
DashCountRow = namedtuple("DashCountRow", ["slice_id", "dash_count"])
ChartCountRow = namedtuple("ChartCountRow", ["dashboard_id", "chart_count"])
DatasetChartCountRow = namedtuple(
    "DatasetChartCountRow", ["datasource_id", "chart_count"]
)
ChartMeta = namedtuple("ChartMeta", ["id", "certified_by", "changed_on"])
DashMeta = namedtuple("DashMeta", ["id", "published", "certified_by", "changed_on"])
DatasetMeta = namedtuple("DatasetMeta", ["id", "extra", "changed_on"])


class TestRecencyBonus:
    def test_within_7_days(self):
        recent = datetime.now(timezone.utc) - timedelta(days=3)
        assert _recency_bonus(recent) == 5.0

    def test_within_30_days(self):
        moderate = datetime.now(timezone.utc) - timedelta(days=15)
        assert _recency_bonus(moderate) == 2.0

    def test_older_than_30_days(self):
        old = datetime.now(timezone.utc) - timedelta(days=60)
        assert _recency_bonus(old) == 0.0

    def test_none_changed_on(self):
        assert _recency_bonus(None) == 0.0

    def test_naive_datetime_treated_as_utc(self):
        # Naive datetime (no tzinfo) should be treated as UTC
        recent = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=3)
        assert _recency_bonus(recent) == 5.0


class TestComputeChartPopularity:
    def test_empty_ids_returns_empty(self):
        assert compute_chart_popularity([]) == {}

    @patch("superset.mcp_service.common.popularity.db")
    def test_chart_scoring_formula(self, mock_db):
        """Test: view_count*3 + fav_count*5 + dash_count*2 + certified*10 + recency"""
        recent = datetime.now(timezone.utc) - timedelta(days=2)  # +5 recency

        # Setup mock query chain
        mock_session = MagicMock()
        mock_db.session = mock_session

        # Each db.session.query() call returns a different chain
        query_chains = [
            # 1. View counts query
            self._mock_query_chain([ViewRow(slice_id=1, view_count=10)]),
            # 2. Fav counts query
            self._mock_query_chain([FavRow(obj_id=1, fav_count=3)]),
            # 3. Dashboard counts query
            self._mock_query_chain([DashCountRow(slice_id=1, dash_count=4)]),
            # 4. Chart metadata query
            self._mock_query_chain(
                [ChartMeta(id=1, certified_by="admin", changed_on=recent)]
            ),
        ]
        mock_session.query.side_effect = query_chains

        scores = compute_chart_popularity([1])

        # views: 10*3=30, favs: 3*5=15, dashes: 4*2=8, certified: 10, recency: 5
        expected = 30 + 15 + 8 + 10 + 5
        assert scores[1] == expected

    @patch("superset.mcp_service.common.popularity.db")
    def test_chart_no_activity_only_recency(self, mock_db):
        """Chart with no views/favs/dashboards gets only recency + certification."""
        old = datetime.now(timezone.utc) - timedelta(days=60)  # 0 recency

        mock_session = MagicMock()
        mock_db.session = mock_session

        query_chains = [
            self._mock_query_chain([]),  # No views
            self._mock_query_chain([]),  # No favs
            self._mock_query_chain([]),  # No dashboards
            self._mock_query_chain(
                [ChartMeta(id=1, certified_by=None, changed_on=old)]
            ),
        ]
        mock_session.query.side_effect = query_chains

        scores = compute_chart_popularity([1])
        assert scores[1] == 0.0

    @patch("superset.mcp_service.common.popularity.db")
    def test_multiple_charts(self, mock_db):
        """Multiple charts scored independently."""
        mock_session = MagicMock()
        mock_db.session = mock_session

        old = datetime.now(timezone.utc) - timedelta(days=60)

        query_chains = [
            # Views
            self._mock_query_chain(
                [
                    ViewRow(slice_id=1, view_count=5),
                    ViewRow(slice_id=2, view_count=20),
                ]
            ),
            # Favs
            self._mock_query_chain([FavRow(obj_id=2, fav_count=2)]),
            # Dashboard counts
            self._mock_query_chain([]),
            # Metadata
            self._mock_query_chain(
                [
                    ChartMeta(id=1, certified_by=None, changed_on=old),
                    ChartMeta(id=2, certified_by=None, changed_on=old),
                ]
            ),
        ]
        mock_session.query.side_effect = query_chains

        scores = compute_chart_popularity([1, 2])

        # Chart 1: views=5*3=15
        assert scores[1] == 15.0
        # Chart 2: views=20*3=60, favs=2*5=10
        assert scores[2] == 70.0

    def _mock_query_chain(self, results):
        """Create a mock query chain that returns results at the end."""
        chain = MagicMock()
        chain.filter.return_value = chain
        chain.group_by.return_value = chain
        chain.all.return_value = results
        return chain


class TestComputeDashboardPopularity:
    def test_empty_ids_returns_empty(self):
        assert compute_dashboard_popularity([]) == {}

    @patch("superset.mcp_service.common.popularity.db")
    def test_dashboard_scoring_formula(self, mock_db):
        """Test: view_count*3 + fav_count*5 + chart_count*1 + published*3
        + certified*10 + recency"""
        recent = datetime.now(timezone.utc) - timedelta(days=2)  # +5 recency

        mock_session = MagicMock()
        mock_db.session = mock_session

        query_chains = [
            # Views
            self._mock_query_chain([DashViewRow(dashboard_id=1, view_count=8)]),
            # Favs
            self._mock_query_chain([FavRow(obj_id=1, fav_count=2)]),
            # Chart counts
            self._mock_query_chain([ChartCountRow(dashboard_id=1, chart_count=5)]),
            # Metadata
            self._mock_query_chain(
                [
                    DashMeta(
                        id=1, published=True, certified_by="admin", changed_on=recent
                    )
                ]
            ),
        ]
        mock_session.query.side_effect = query_chains

        scores = compute_dashboard_popularity([1])

        # views=8*3=24, favs=2*5=10, charts=5*1=5, published=3,
        # certified=10, recency=5
        expected = 24 + 10 + 5 + 3 + 10 + 5
        assert scores[1] == expected

    @patch("superset.mcp_service.common.popularity.db")
    def test_unpublished_no_certification(self, mock_db):
        """Dashboard that is not published and not certified."""
        old = datetime.now(timezone.utc) - timedelta(days=60)

        mock_session = MagicMock()
        mock_db.session = mock_session

        query_chains = [
            self._mock_query_chain([]),  # No views
            self._mock_query_chain([]),  # No favs
            self._mock_query_chain([]),  # No charts
            self._mock_query_chain(
                [DashMeta(id=1, published=False, certified_by=None, changed_on=old)]
            ),
        ]
        mock_session.query.side_effect = query_chains

        scores = compute_dashboard_popularity([1])
        assert scores[1] == 0.0

    def _mock_query_chain(self, results):
        chain = MagicMock()
        chain.filter.return_value = chain
        chain.group_by.return_value = chain
        chain.all.return_value = results
        return chain


class TestComputeDatasetPopularity:
    def test_empty_ids_returns_empty(self):
        assert compute_dataset_popularity([]) == {}

    @patch("superset.mcp_service.common.popularity.db")
    def test_dataset_scoring_formula(self, mock_db):
        """Test: chart_count*3 + certified*10 + recency"""
        recent = datetime.now(timezone.utc) - timedelta(days=2)  # +5 recency

        mock_session = MagicMock()
        mock_db.session = mock_session

        query_chains = [
            # Chart counts
            self._mock_query_chain(
                [DatasetChartCountRow(datasource_id=1, chart_count=7)]
            ),
            # Metadata
            self._mock_query_chain(
                [
                    DatasetMeta(
                        id=1,
                        extra='{"certification": {"certified_by": "admin"}}',
                        changed_on=recent,
                    )
                ]
            ),
        ]
        mock_session.query.side_effect = query_chains

        scores = compute_dataset_popularity([1])

        # charts=7*3=21, certified=10, recency=5
        expected = 21 + 10 + 5
        assert scores[1] == expected

    @patch("superset.mcp_service.common.popularity.db")
    def test_dataset_no_certification(self, mock_db):
        """Dataset with empty extra JSON is not certified."""
        old = datetime.now(timezone.utc) - timedelta(days=60)

        mock_session = MagicMock()
        mock_db.session = mock_session

        query_chains = [
            self._mock_query_chain([]),
            self._mock_query_chain([DatasetMeta(id=1, extra="{}", changed_on=old)]),
        ]
        mock_session.query.side_effect = query_chains

        scores = compute_dataset_popularity([1])
        assert scores[1] == 0.0

    @patch("superset.mcp_service.common.popularity.db")
    def test_dataset_invalid_extra_json(self, mock_db):
        """Dataset with invalid extra JSON doesn't crash."""
        old = datetime.now(timezone.utc) - timedelta(days=60)

        mock_session = MagicMock()
        mock_db.session = mock_session

        query_chains = [
            self._mock_query_chain([]),
            self._mock_query_chain(
                [DatasetMeta(id=1, extra="not valid json", changed_on=old)]
            ),
        ]
        mock_session.query.side_effect = query_chains

        scores = compute_dataset_popularity([1])
        assert scores[1] == 0.0

    def _mock_query_chain(self, results):
        chain = MagicMock()
        chain.filter.return_value = chain
        chain.group_by.return_value = chain
        chain.all.return_value = results
        return chain


class TestGetPopularitySortedIds:
    @patch("superset.mcp_service.common.popularity.db")
    def test_sorts_by_score_desc(self, mock_db):
        """IDs are returned sorted by score in descending order."""
        mock_dao = MagicMock()
        # Return 3 items with IDs 1, 2, 3
        item1 = MagicMock(id=1)
        item2 = MagicMock(id=2)
        item3 = MagicMock(id=3)
        mock_dao.list.return_value = ([item1, item2, item3], 3)

        # Mock compute function: item 2 has highest score
        def mock_compute(ids, days=30):
            return {1: 10.0, 2: 50.0, 3: 25.0}

        sorted_ids, scores, total = get_popularity_sorted_ids(
            compute_fn=mock_compute,
            dao_class=mock_dao,
            filters=None,
            search=None,
            search_columns=["name"],
            order_direction="desc",
        )

        assert sorted_ids == [2, 3, 1]
        assert total == 3
        assert scores == {1: 10.0, 2: 50.0, 3: 25.0}

    @patch("superset.mcp_service.common.popularity.db")
    def test_sorts_by_score_asc(self, mock_db):
        """IDs are returned sorted by score in ascending order."""
        mock_dao = MagicMock()
        item1 = MagicMock(id=1)
        item2 = MagicMock(id=2)
        mock_dao.list.return_value = ([item1, item2], 2)

        def mock_compute(ids, days=30):
            return {1: 30.0, 2: 10.0}

        sorted_ids, scores, total = get_popularity_sorted_ids(
            compute_fn=mock_compute,
            dao_class=mock_dao,
            filters=None,
            search=None,
            search_columns=["name"],
            order_direction="asc",
        )

        assert sorted_ids == [2, 1]
        assert total == 2

    def test_empty_results(self):
        """Empty result set returns empty list."""
        mock_dao = MagicMock()
        mock_dao.list.return_value = ([], 0)

        sorted_ids, scores, total = get_popularity_sorted_ids(
            compute_fn=lambda ids, days=30: {},
            dao_class=mock_dao,
            filters=None,
            search=None,
            search_columns=["name"],
        )

        assert sorted_ids == []
        assert scores == {}
        assert total == 0
