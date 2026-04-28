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
"""DAO for the aggregated soft-deleted items listing.

Runs three per-entity queries (chart / dashboard / dataset) with
``skip_visibility_filter=True`` plus each entity's normal base
security filter, then merges, sorts, and pages the results in Python.
See spec sc-103157-soft-deletes research R-007 for why we chose this
over a SQL ``UNION ALL``.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Iterable

from flask_appbuilder.models.sqla.interface import SQLAInterface
from sqlalchemy.orm import Query

from superset.connectors.sqla.models import SqlaTable
from superset.daos.chart import ChartDAO
from superset.daos.dashboard import DashboardDAO
from superset.daos.dataset import DatasetDAO
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.helpers import SKIP_VISIBILITY_FILTER
from superset.models.slice import Slice

logger = logging.getLogger(__name__)

# Identifiers for the three entity types — also the string values that
# appear in the ``type`` field of each row in the API response.
TYPE_CHART = "chart"
TYPE_DASHBOARD = "dashboard"
TYPE_DATASET = "dataset"
ALL_TYPES = (TYPE_CHART, TYPE_DASHBOARD, TYPE_DATASET)

# Columns the caller can sort on (validated at the API layer too).
SORT_DELETED_AT = "deleted_at"
SORT_DELETED_BY = "deleted_by"
SORT_TYPE = "type"
SORT_NAME = "name"
VALID_SORT_COLUMNS = frozenset({SORT_DELETED_AT, SORT_DELETED_BY, SORT_TYPE, SORT_NAME})
VALID_SORT_DIRECTIONS = frozenset({"asc", "desc"})

# Per-entity configuration: the model class, DAO (for base_filter), and
# the model attribute that carries the entity's display name.
_ENTITY_CONFIG: dict[str, dict[str, Any]] = {
    TYPE_CHART: {
        "model": Slice,
        "dao": ChartDAO,
        "name_col": lambda: Slice.slice_name,
    },
    TYPE_DASHBOARD: {
        "model": Dashboard,
        "dao": DashboardDAO,
        "name_col": lambda: Dashboard.dashboard_title,
    },
    TYPE_DATASET: {
        "model": SqlaTable,
        "dao": DatasetDAO,
        "name_col": lambda: SqlaTable.table_name,
    },
}


class DeletedDAO:
    """Aggregated read-only DAO for the soft-deleted listing endpoint."""

    @classmethod
    def list_items(
        cls,
        *,
        types: Iterable[str],
        search: str | None = None,
        deleted_from: datetime | None = None,
        deleted_to: datetime | None = None,
        order_column: str = SORT_DELETED_AT,
        order_direction: str = "desc",
        page: int = 0,
        page_size: int = 25,
    ) -> tuple[list[dict[str, Any]], int]:
        """Return ``(rows, total_count)`` matching the caller's filters.

        ``rows`` is the paginated slice serialised to a list of dicts
        shaped for ``DeletedListItemSchema``. ``total_count`` is
        the full pre-pagination count across all included types.
        """
        selected_types = [t for t in types if t in _ENTITY_CONFIG]

        all_rows: list[dict[str, Any]] = []
        total = 0
        for entity_type in selected_types:
            rows, count = cls._query_one_type(
                entity_type=entity_type,
                search=search,
                deleted_from=deleted_from,
                deleted_to=deleted_to,
            )
            all_rows.extend(rows)
            total += count

        sorted_rows = sort_and_page(
            all_rows,
            order_column=order_column,
            order_direction=order_direction,
            page=page,
            page_size=page_size,
        )
        return sorted_rows, total

    @classmethod
    def _query_one_type(
        cls,
        *,
        entity_type: str,
        search: str | None,
        deleted_from: datetime | None,
        deleted_to: datetime | None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Run the per-entity query and return ``(rows, count)``.

        The query opts out of the soft-delete ORM filter but keeps the
        active-list base security filter, so a user sees only archived
        items they could have seen when active (FR-016).
        """
        # pylint: disable=import-outside-toplevel
        from flask_appbuilder.security.sqla.models import User

        cfg = _ENTITY_CONFIG[entity_type]
        model: Any = cfg["model"]
        dao: Any = cfg["dao"]
        name_col = cfg["name_col"]()

        query: Query = (
            db.session.query(model, User)
            .outerjoin(User, User.id == model.changed_by_fk)
            .filter(model.deleted_at.is_not(None))
            .execution_options(**{SKIP_VISIBILITY_FILTER: True})
        )

        if search:
            query = query.filter(name_col.ilike(f"%{search}%"))
        if deleted_from is not None:
            query = query.filter(model.deleted_at >= deleted_from)
        if deleted_to is not None:
            query = query.filter(model.deleted_at <= deleted_to)

        # Reuse the active-list base security filter (DatasourceFilter &
        # friends). Row-level access is enforced via the same filter
        # chain that gates the corresponding active list endpoint.
        data_model = SQLAInterface(model, db.session)
        query = dao._apply_base_filter(  # pylint: disable=protected-access
            query, skip_base_filter=False, data_model=data_model
        )

        rows: list[dict[str, Any]] = []
        count = 0
        for entity, user in query.all():
            rows.append(_serialise_row(entity, user, entity_type))
            count += 1
        return rows, count


def _serialise_row(entity: Any, user: Any, entity_type: str) -> dict[str, Any]:
    """Shape one result row to match ``DeletedListItemSchema``."""
    cfg = _ENTITY_CONFIG[entity_type]
    name_col = cfg["name_col"]()
    name_attr = name_col.key
    deleted_by = None
    if user is not None:
        deleted_by = {
            "id": user.id,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }
    return {
        "type": entity_type,
        "id": entity.id,
        "uuid": str(entity.uuid),
        "name": getattr(entity, name_attr),
        "deleted_at": entity.deleted_at,
        "deleted_by": deleted_by,
    }


# ---------------------------------------------------------------------------
# Pure merge / sort / page helper — no DB access, no ORM imports.
# Unit-tested independently in ``tests/unit_tests/deleted/dao_tests.py``.
# ---------------------------------------------------------------------------


def _get_sort_value(row: dict[str, Any], order_column: str) -> Any:
    """Return the value used to sort *row* by *order_column*.

    Returns ``None`` when the column is missing or the nested
    ``deleted_by`` user object is absent. The caller uses this
    nullability to partition rows into non-null and null buckets so
    nulls always sort last, regardless of direction.
    """
    if order_column == SORT_DELETED_BY:
        deleted_by = row.get("deleted_by")
        if not deleted_by:
            return None
        return deleted_by.get("username")
    if order_column == SORT_NAME:
        return row.get("name")
    if order_column == SORT_TYPE:
        return row.get("type")
    # Default / fallback: deleted_at.
    return row.get("deleted_at")


def sort_and_page(
    rows: list[dict[str, Any]],
    *,
    order_column: str,
    order_direction: str,
    page: int,
    page_size: int,
) -> list[dict[str, Any]]:
    """Sort *rows* by *order_column* and return the requested page slice.

    Nulls always sort last, regardless of ``order_direction`` — the
    non-null rows are sorted in the requested direction, the null rows
    are appended. Pure function: no DB access, no side effects. Used
    by :meth:`DeletedDAO.list` and exercised directly in unit tests.
    """
    non_null: list[dict[str, Any]] = []
    nulls: list[dict[str, Any]] = []
    for row in rows:
        (nulls if _get_sort_value(row, order_column) is None else non_null).append(row)

    reverse = order_direction == "desc"
    non_null.sort(key=lambda r: _get_sort_value(r, order_column), reverse=reverse)
    sorted_rows = non_null + nulls
    start = max(page, 0) * max(page_size, 1)
    return sorted_rows[start : start + page_size]
