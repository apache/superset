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
Popularity scoring for charts, dashboards, and datasets.

Computes a composite popularity score based on views, favorites,
relationships, certification, and recency.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa

from superset.extensions import db

logger = logging.getLogger(__name__)


def _recency_bonus(changed_on: datetime | None) -> float:
    """Compute recency bonus based on changed_on timestamp."""
    if not changed_on:
        return 0.0
    now = datetime.now(timezone.utc)
    # Ensure changed_on is timezone-aware for comparison
    if changed_on.tzinfo is None:
        changed_on = changed_on.replace(tzinfo=timezone.utc)
    delta = now - changed_on
    if delta <= timedelta(days=7):
        return 5.0
    if delta <= timedelta(days=30):
        return 2.0
    return 0.0


def _init_scores(ids: list[int]) -> dict[int, float]:
    """Initialize a score dict with 0.0 for each ID."""
    return {i: 0.0 for i in ids}  # noqa: C420


def _add_view_scores(
    scores: dict[int, float],
    action: str,
    id_column: sa.Column,
    entity_ids: list[int],
    cutoff: datetime,
    weight: int,
) -> None:
    """Add view count scores from the logs table."""
    from superset.models.core import Log

    view_counts = (
        db.session.query(id_column, sa.func.count(Log.id).label("view_count"))
        .filter(Log.action == action, id_column.in_(entity_ids), Log.dttm >= cutoff)
        .group_by(id_column)
        .all()
    )
    for row in view_counts:
        entity_id = row[0]
        if entity_id in scores:
            scores[entity_id] += row.view_count * weight


def _add_fav_scores(
    scores: dict[int, float],
    class_name: str,
    entity_ids: list[int],
    weight: int,
) -> None:
    """Add favorite count scores from the favstar table."""
    from superset.models.core import FavStar

    fav_counts = (
        db.session.query(FavStar.obj_id, sa.func.count(FavStar.id).label("fav_count"))
        .filter(FavStar.class_name == class_name, FavStar.obj_id.in_(entity_ids))
        .group_by(FavStar.obj_id)
        .all()
    )
    for row in fav_counts:
        if row.obj_id in scores:
            scores[row.obj_id] += row.fav_count * weight


def compute_chart_popularity(chart_ids: list[int], days: int = 30) -> dict[int, float]:
    """Compute popularity scores for charts.

    Formula: view_count_30d * 3 + fav_count * 5 + dashboard_count * 2
             + is_certified * 10 + recency_bonus

    Args:
        chart_ids: List of chart IDs to score
        days: Number of days for view count window

    Returns:
        Dict mapping chart_id -> popularity score
    """
    if not chart_ids:
        return {}

    from superset.models.core import Log
    from superset.models.dashboard import dashboard_slices
    from superset.models.slice import Slice

    scores = _init_scores(chart_ids)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    _add_view_scores(scores, "mount_explorer", Log.slice_id, chart_ids, cutoff, 3)
    _add_fav_scores(scores, "slice", chart_ids, 5)

    # Dashboard count (how many dashboards contain each chart)
    dash_counts = (
        db.session.query(
            dashboard_slices.c.slice_id,
            sa.func.count(dashboard_slices.c.dashboard_id).label("dash_count"),
        )
        .filter(dashboard_slices.c.slice_id.in_(chart_ids))
        .group_by(dashboard_slices.c.slice_id)
        .all()
    )
    for row in dash_counts:
        if row.slice_id in scores:
            scores[row.slice_id] += row.dash_count * 2

    # Certification and recency from chart objects
    charts = (
        db.session.query(Slice.id, Slice.certified_by, Slice.changed_on)
        .filter(Slice.id.in_(chart_ids))
        .all()
    )
    for chart in charts:
        if chart.id in scores:
            if chart.certified_by:
                scores[chart.id] += 10
            scores[chart.id] += _recency_bonus(chart.changed_on)

    return scores


def compute_dashboard_popularity(
    dashboard_ids: list[int], days: int = 30
) -> dict[int, float]:
    """Compute popularity scores for dashboards.

    Formula: view_count_30d * 3 + fav_count * 5 + chart_count * 1
             + is_published * 3 + is_certified * 10 + recency_bonus

    Args:
        dashboard_ids: List of dashboard IDs to score
        days: Number of days for view count window

    Returns:
        Dict mapping dashboard_id -> popularity score
    """
    if not dashboard_ids:
        return {}

    from superset.models.core import Log
    from superset.models.dashboard import Dashboard, dashboard_slices

    scores = _init_scores(dashboard_ids)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    _add_view_scores(
        scores, "mount_dashboard", Log.dashboard_id, dashboard_ids, cutoff, 3
    )
    _add_fav_scores(scores, "Dashboard", dashboard_ids, 5)

    # Chart count per dashboard
    chart_counts = (
        db.session.query(
            dashboard_slices.c.dashboard_id,
            sa.func.count(dashboard_slices.c.slice_id).label("chart_count"),
        )
        .filter(dashboard_slices.c.dashboard_id.in_(dashboard_ids))
        .group_by(dashboard_slices.c.dashboard_id)
        .all()
    )
    for row in chart_counts:
        if row.dashboard_id in scores:
            scores[row.dashboard_id] += row.chart_count * 1

    # 4. Published, certification, and recency from dashboard objects
    dashboards = (
        db.session.query(
            Dashboard.id,
            Dashboard.published,
            Dashboard.certified_by,
            Dashboard.changed_on,
        )
        .filter(Dashboard.id.in_(dashboard_ids))
        .all()
    )
    for dash in dashboards:
        if dash.id in scores:
            if dash.published:
                scores[dash.id] += 3
            if dash.certified_by:
                scores[dash.id] += 10
            scores[dash.id] += _recency_bonus(dash.changed_on)

    return scores


def compute_dataset_popularity(
    dataset_ids: list[int], days: int = 30
) -> dict[int, float]:
    """Compute popularity scores for datasets.

    Formula: chart_count * 3 + is_certified * 10 + recency_bonus

    Args:
        dataset_ids: List of dataset IDs to score
        days: Number of days (unused for datasets, kept for API consistency)

    Returns:
        Dict mapping dataset_id -> popularity score
    """
    if not dataset_ids:
        return {}

    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice

    scores = _init_scores(dataset_ids)

    # 1. Chart count per dataset (how many charts use each dataset)
    chart_counts = (
        db.session.query(
            Slice.datasource_id,
            sa.func.count(Slice.id).label("chart_count"),
        )
        .filter(
            Slice.datasource_id.in_(dataset_ids),
            Slice.datasource_type == "table",
        )
        .group_by(Slice.datasource_id)
        .all()
    )
    for row in chart_counts:
        if row.datasource_id in scores:
            scores[row.datasource_id] += row.chart_count * 3

    # 2. Certification and recency from dataset objects
    # Datasets use CertificationMixin where certification is in the extra JSON
    datasets = (
        db.session.query(SqlaTable.id, SqlaTable.extra, SqlaTable.changed_on)
        .filter(SqlaTable.id.in_(dataset_ids))
        .all()
    )
    for ds in datasets:
        if ds.id in scores:
            # Check certification from extra JSON
            if ds.extra:
                from superset.utils import json as json_utils

                try:
                    extra_dict = json_utils.loads(ds.extra)
                    if extra_dict.get("certification"):
                        scores[ds.id] += 10
                except (TypeError, ValueError):
                    pass
            scores[ds.id] += _recency_bonus(ds.changed_on)

    return scores


def get_popularity_sorted_ids(
    compute_fn: callable,
    dao_class: type,
    filters: list | None,
    search: str | None,
    search_columns: list[str],
    order_direction: str = "desc",
    days: int = 30,
) -> tuple[list[int], dict[int, float], int]:
    """Fetch all matching IDs, compute popularity scores, return sorted IDs.

    This is the "two-pass" approach: first get all matching IDs (lightweight),
    then compute scores and sort by popularity.

    Args:
        compute_fn: One of compute_chart/dashboard/dataset_popularity
        dao_class: DAO class to query
        filters: Column operator filters
        search: Search string
        search_columns: Columns to search
        order_direction: "asc" or "desc"
        days: Days window for view counts

    Returns:
        Tuple of (sorted_ids, scores_dict, total_count)
    """
    # Use a large page_size to get all matching IDs in one query
    max_page_size = 100_000
    all_items, total_count = dao_class.list(
        column_operators=filters,
        order_column="changed_on",
        order_direction="desc",
        page=0,
        page_size=max_page_size,
        search=search,
        search_columns=search_columns,
        columns=["id"],
    )

    if not all_items:
        return [], {}, 0

    all_ids = [getattr(item, "id", None) for item in all_items]
    all_ids = [i for i in all_ids if i is not None]

    if not all_ids:
        return [], {}, total_count

    # Compute popularity scores
    scores = compute_fn(all_ids, days=days)

    # Sort by score
    reverse = order_direction == "desc"
    sorted_ids = sorted(all_ids, key=lambda x: scores.get(x, 0.0), reverse=reverse)

    return sorted_ids, scores, total_count
