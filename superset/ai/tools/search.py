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
Finding Superset's own assets.

Without this the assistant cannot find anything: it has no way to get from "the
signups dashboard" to an id it can ask about. Search runs over Superset's
metadata database, not a warehouse.

Authorization is the whole design here. Each asset type is queried through the
filter class its DAO declares as ``base_filter`` — which is the same class the
corresponding REST API declares in ``base_filters``:

* datasets   — ``DatasourceFilter``
* charts     — ``ChartFilter``
* dashboards — ``DashboardAccessFilter``

Taking the class off the DAO rather than naming it here means the two cannot
drift apart. Because the filters do the scoping, a result set never contains an
asset the user could not open in the UI, and a search term can therefore never
be used to confirm that a hidden asset exists.
"""

from __future__ import annotations

import logging
from typing import Any, ClassVar

from superset.ai.tools.base import AITool, ToolError, ToolOutput

logger = logging.getLogger(__name__)

#: Results per asset type before the list is cut. Deliberately small: the model
#: needs candidates to choose between, and a long list of near-identical titles
#: costs context without adding information.
DEFAULT_LIMIT = 10
MAX_LIMIT = 50

#: Asset types this tool understands, in the order results are reported.
ASSET_TYPES = ("dataset", "chart", "dashboard")


def _requested_types(value: Any) -> tuple[str, ...]:
    """
    Normalise the ``asset_types`` argument.

    An unknown type is an error rather than a silent omission: a model that
    asked for "table" and got an empty result would conclude nothing matched,
    when in fact nothing was searched.
    """
    if value is None:
        return ASSET_TYPES
    if isinstance(value, str):
        requested = [part.strip() for part in value.split(",") if part.strip()]
    elif isinstance(value, (list, tuple)):
        requested = [str(item).strip() for item in value if str(item).strip()]
    else:
        raise ToolError("'asset_types' must be a string or a list of strings.")

    unknown = [item for item in requested if item not in ASSET_TYPES]
    if unknown:
        raise ToolError(
            f"Unknown asset type(s) {', '.join(sorted(unknown))}. "
            f"Valid values: {', '.join(ASSET_TYPES)}."
        )
    # Preserve the canonical order so output is stable regardless of input order.
    return tuple(item for item in ASSET_TYPES if item in requested) or ASSET_TYPES


def _limit(value: Any) -> int:
    """Clamp the per-type result count."""
    if value is None:
        return DEFAULT_LIMIT
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise ToolError("'limit' must be a positive integer.")
    return min(value, MAX_LIMIT)


def _match(column: Any, term: str) -> Any:
    """
    Build a case-insensitive substring predicate for ``term``.

    ``escape_like`` neutralises ``%``, ``_`` and ``\\`` in the user's term, and
    the ``escape`` argument must be passed alongside it — without that pairing a
    term containing ``%`` degrades into a full scan that matches everything.
    """
    from superset.mcp_service.utils.sanitization import escape_like

    return column.ilike(f"%{escape_like(term)}%", escape="\\")


def _untrusted(value: Any) -> Any:
    """
    Mark a user-authored string as untrusted before the model reads it.

    Asset titles and descriptions are written by other Superset users, so they
    are outside the trust boundary of the prompt: an attacker who can name a
    chart can otherwise attempt to inject instructions into the conversation.
    Applied only to free text — ids, type names and schema identifiers are
    operational values and stay verbatim so the model can pass them back.
    """
    from superset.mcp_service.utils.sanitization import sanitize_for_llm_context

    if value is None:
        return None
    return sanitize_for_llm_context(value)


def _scoped_query(dao: Any, model: Any) -> Any:
    """
    A query over ``model`` narrowed to what the current user may see.

    The filter class is read off the DAO rather than imported by name, so this
    stays in step with whatever the REST API enforces. The filters ignore the
    ``value`` argument, which is why ``None`` is passed.
    """
    from flask_appbuilder.models.sqla.interface import SQLAInterface

    from superset.extensions import db

    # Checked before the query is built, so an unscoped query never exists even
    # transiently. A DAO with no base filter would return every row; that is a
    # defect rather than something the caller can fix, so it refuses.
    access_filter = dao.base_filter
    if access_filter is None:
        raise ToolError("This asset type cannot be searched safely.")

    query = db.session.query(model)
    return access_filter("id", SQLAInterface(model, db.session)).apply(query, None)


def _search_datasets(term: str, limit: int) -> list[dict[str, Any]]:
    """Datasets whose table name or description matches."""
    from sqlalchemy import or_

    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.dataset import DatasetDAO

    # DatasourceFilter joins Database itself, so nothing here may join it again.
    query = _scoped_query(DatasetDAO, SqlaTable).filter(
        or_(
            _match(SqlaTable.table_name, term),
            _match(SqlaTable.description, term),
        )
    )
    rows = query.order_by(SqlaTable.table_name).limit(limit).all()

    return [
        {
            "type": "dataset",
            "id": dataset.id,
            "name": _untrusted(dataset.table_name),
            "description": _untrusted(dataset.description),
            "schema": dataset.schema,
            "catalog": dataset.catalog,
            "database_id": dataset.database_id,
            # A dataset backed by SQL rather than a physical table is worth
            # flagging: its columns come from the query, not the warehouse.
            "is_virtual": bool(dataset.sql),
        }
        for dataset in rows
    ]


def _search_charts(term: str, limit: int) -> list[dict[str, Any]]:
    """Charts whose name or description matches."""
    from sqlalchemy import or_

    from superset.daos.chart import ChartDAO
    from superset.models.slice import Slice

    query = _scoped_query(ChartDAO, Slice).filter(
        or_(
            _match(Slice.slice_name, term),
            _match(Slice.description, term),
        )
    )
    rows = query.order_by(Slice.slice_name).limit(limit).all()

    return [
        {
            "type": "chart",
            "id": chart.id,
            "name": _untrusted(chart.slice_name),
            "description": _untrusted(chart.description),
            "viz_type": chart.viz_type,
            "datasource_id": chart.datasource_id,
        }
        for chart in rows
    ]


def _search_dashboards(term: str, limit: int) -> list[dict[str, Any]]:
    """Dashboards whose title or slug matches."""
    from sqlalchemy import or_

    from superset.daos.dashboard import DashboardDAO
    from superset.models.dashboard import Dashboard

    query = _scoped_query(DashboardDAO, Dashboard).filter(
        or_(
            _match(Dashboard.dashboard_title, term),
            _match(Dashboard.slug, term),
        )
    )
    rows = query.order_by(Dashboard.dashboard_title).limit(limit).all()

    return [
        {
            "type": "dashboard",
            "id": dashboard.id,
            "name": _untrusted(dashboard.dashboard_title),
            "description": _untrusted(dashboard.description),
            "slug": dashboard.slug,
            "published": bool(dashboard.published),
        }
        for dashboard in rows
    ]


_SEARCHERS = {
    "dataset": _search_datasets,
    "chart": _search_charts,
    "dashboard": _search_dashboards,
}


class SearchAssetsTool(AITool):
    """Search datasets, charts and dashboards by name."""

    name: ClassVar[str] = "search_assets"
    description: ClassVar[str] = (
        "Search Superset's own datasets, charts and dashboards by name or "
        "description, returning the id of each match. This is how you find "
        "things: use it before get_chart_context, get_dashboard_context, or any "
        "question that names an existing dashboard or chart. Results only ever "
        "include assets you are permitted to see. Search terms are matched as "
        "substrings, so a short distinctive word works better than a full title."
    )
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": (
                    "Substring to look for in names and descriptions, matched "
                    "case-insensitively."
                ),
            },
            "asset_types": {
                "type": "array",
                "items": {"type": "string", "enum": list(ASSET_TYPES)},
                "description": (
                    "Which kinds to search. Defaults to all three. Narrow this "
                    "when you already know what you are looking for."
                ),
            },
            "limit": {
                "type": "integer",
                "description": f"Matches per type, up to {MAX_LIMIT}.",
            },
        },
        "required": ["query"],
    }

    def run(
        self,
        query: Any = None,
        asset_types: Any = None,
        limit: Any = None,
        **_ignored: Any,
    ) -> ToolOutput:
        if not isinstance(query, str) or not query.strip():
            raise ToolError("'query' must be a non-empty search term.")
        term = query.strip()

        types = _requested_types(asset_types)
        per_type = _limit(limit)

        results: list[dict[str, Any]] = []
        for asset_type in types:
            try:
                results.extend(_SEARCHERS[asset_type](term, per_type))
            except Exception:  # pylint: disable=broad-except
                # One asset type failing should not lose the others' results.
                logger.exception("search_assets failed for type %s", asset_type)

        payload: dict[str, Any] = {
            "query": term,
            "results": results,
            "count": len(results),
        }
        if not results:
            payload["note"] = (
                "Nothing matched. Try a shorter or more distinctive term, or "
                "call list_databases and get_schema to browse the data directly."
            )

        counts = {
            asset_type: sum(1 for item in results if item.get("type") == asset_type)
            for asset_type in types
        }
        return ToolOutput.of(
            payload,
            display={
                "kind": "asset_search",
                "query": term,
                "count": len(results),
                "counts_by_type": counts,
                # Enough for the UI to list what was found and link to it.
                "results": [
                    {
                        "type": item.get("type"),
                        "id": item.get("id"),
                        "name": item.get("name"),
                    }
                    for item in results
                ],
            },
        )
