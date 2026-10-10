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
"""Command for the combined dataset + semantic view list endpoint."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, cast

from sqlalchemy import union_all

from superset.commands.base import BaseCommand
from superset.connectors.sqla.models import SqlaTable
from superset.daos.dataset import DatasetDAO
from superset.daos.datasource import DatasourceDAO
from superset.datasource.schemas import DatasetListSchema, SemanticViewListSchema
from superset.semantic_layers.models import SemanticView

logger = logging.getLogger(__name__)

_dataset_schema = DatasetListSchema()
_semantic_view_schema = SemanticViewListSchema()

# Relation filters the Datasets page sends, each with the operator the canonical
# ``/api/v1/dataset/`` endpoint declares for it.
_EDITORS_COLUMN = "editors"
_CHANGED_BY_COLUMN = "changed_by"
_CERTIFIED_COLUMN = "id"
_LEGACY_COLUMNS = {
    "source_type",
    "table_name",
    "sql",
    "database",
    "semantic_layer_uuid",
    "schema",
}
_RELATION_OPERATORS = {
    _EDITORS_COLUMN: "rel_m_m",
    _CHANGED_BY_COLUMN: "rel_o_m",
    _CERTIFIED_COLUMN: "dataset_is_certified",
}


@dataclass(frozen=True)
class _Filters:
    """Typed form of the rison filters accepted by the combined list.

    Every attribute is optional. ``None`` means "no such filter"; a boolean or
    id means the filter was sent and has to be honoured.
    """

    source_type: str = "all"
    name_filter: str | None = None
    sql_filter: bool | None = None
    type_filter: str | None = None
    database_id: int | None = None
    semantic_layer_uuid: str | None = None
    schema_filter: str | None = None
    editors_filter: int | None = None
    changed_by_filter: int | None = None
    certified_filter: bool | None = None

    @property
    def dataset_only(self) -> bool:
        """Whether a filter is set that no semantic view can match.

        Semantic views have no schema and no editors, and are never certified,
        so under AND semantics such a filter excludes them. ``certified=False``
        and ``changed_by`` are not in this group: a semantic view is not
        certified, and it is audited like any other model.
        """
        return (
            self.schema_filter is not None
            or self.editors_filter is not None
            or self.certified_filter is True
        )


def _relation_id(col: str, value: Any) -> int:
    """Coerce a relation filter value to an id, as the canonical endpoint does."""
    if isinstance(value, bool):
        raise ValueError(f"Invalid value for filter column: {col}")
    try:
        return int(value)
    except (TypeError, ValueError) as ex:
        raise ValueError(f"Invalid value for filter column: {col}") from ex


class GetCombinedDatasourceListCommand(BaseCommand):
    """
    Fetch and serialize a paginated, combined list of datasets and semantic views.

    Callers are responsible for checking access permissions before constructing
    this command and for passing the appropriate ``can_read_*`` flags.
    """

    def __init__(
        self,
        args: dict[str, Any],
        can_read_datasets: bool,
        can_read_semantic_views: bool,
    ) -> None:
        self._args = args
        self._can_read_datasets = can_read_datasets
        self._can_read_semantic_views = can_read_semantic_views

    def run(self) -> dict[str, Any]:
        self.validate()

        page = self._args.get("page", 0)
        page_size = self._args.get("page_size", 25)
        order_column = self._args.get("order_column", "changed_on")
        order_direction = self._args.get("order_direction", "desc")
        filters = self._args.get("filters", [])

        parsed = self._parse_filters(filters)

        source_type = self._resolve_connection_source_type(
            parsed.source_type,
            parsed.database_id,
            parsed.semantic_layer_uuid,
            parsed.dataset_only,
        )
        # A connection filter can already resolve to "empty" (e.g. a semantic-layer
        # connection combined with a dataset-only schema filter); don't let the
        # content-filter resolution override that terminal decision.
        if source_type != "empty":
            source_type = self._resolve_source_type(
                source_type,
                parsed.sql_filter,
                parsed.type_filter,
                parsed.dataset_only,
            )

        if source_type == "empty":
            return {"count": 0, "result": []}

        combined = self._build_combined_query(source_type, parsed)
        total_count, rows = DatasourceDAO.paginate_combined_query(
            combined, order_column, order_direction, page, page_size
        )

        result = self._serialize_rows(rows)

        return {"count": total_count, "result": result}

    @staticmethod
    def _resolve_connection_source_type(
        source_type: str,
        database_id: int | None,
        semantic_layer_uuid: str | None,
        dataset_only: bool = False,
    ) -> str:
        # A connection filter implicitly narrows the source type: selecting a
        # database ID means "show only datasets", and selecting a semantic layer
        # UUID means "show only semantic views". Only apply the implicit
        # narrowing when the user hasn't already set an explicit source_type.
        if source_type == "all":
            if database_id is not None:
                return "database"
            elif semantic_layer_uuid is not None:
                # A semantic-layer connection selects only that layer's views,
                # so a dataset-only filter (schema, editors, certified) matches
                # nothing: the honest result is empty. Unlike an explicit
                # Source="Semantic layer" selection (handled in
                # _resolve_source_type), the user never picked a source type
                # here, so the "explicit selection wins" rule does not apply.
                if dataset_only:
                    return "empty"
                return "semantic_layer"

        return source_type

    @staticmethod
    def _build_combined_query(source_type: str, filters: _Filters) -> Any:
        ds_q = DatasourceDAO.build_dataset_query(
            filters.name_filter,
            filters.sql_filter,
            filters.database_id,
            filters.schema_filter,
            filters.editors_filter,
            filters.changed_by_filter,
            filters.certified_filter,
        )
        sv_q = DatasourceDAO.build_semantic_view_query(
            filters.name_filter,
            filters.semantic_layer_uuid,
            filters.changed_by_filter,
        )

        if source_type == "database":
            return ds_q.subquery()
        if source_type == "semantic_layer":
            return sv_q.subquery()
        return union_all(ds_q, sv_q).subquery()

    @staticmethod
    def _serialize_rows(rows: list[Any]) -> list[dict[str, Any]]:
        datasets_map = DatasourceDAO.fetch_datasets_by_ids(
            [r.item_id for r in rows if r.source_type == "database"]
        )
        sv_map = DatasourceDAO.fetch_semantic_views_by_ids(
            [r.item_id for r in rows if r.source_type == "semantic_layer"]
        )

        result: list[dict[str, Any]] = []
        for row in rows:
            if row.source_type == "database":
                ds_obj = cast(SqlaTable | None, datasets_map.get(row.item_id))
                if ds_obj:
                    result.append(_dataset_schema.dump(ds_obj))
            else:
                sv_obj = cast(SemanticView | None, sv_map.get(row.item_id))
                if sv_obj:
                    result.append(_semantic_view_schema.dump(sv_obj))

        # Inject RLS summaries for dataset entries so the combined list
        # includes the same `rls_filters` summary shape available on
        # the standalone dataset list endpoint.
        dataset_ids = [
            item["id"] for item in result if item.get("source_type") == "database"
        ]
        if dataset_ids:
            try:
                rls_map = DatasetDAO.get_rls_filters_for_datasets(dataset_ids)
                for item in result:
                    if item.get("source_type") == "database":
                        item_id = item.get("id")
                        if isinstance(item_id, int):
                            item["rls_filters"] = rls_map.get(item_id, [])
                        else:
                            item["rls_filters"] = []
            except Exception:  # noqa: BLE001
                logger.warning(
                    "Failed to inject RLS summaries into combined datasource list",
                    exc_info=True,
                )

        return result

    def validate(self) -> None:
        pass  # access checks are performed by the caller (API layer)

    def _resolve_source_type(
        self,
        source_type: str,
        sql_filter: bool | None,
        type_filter: str | None,
        dataset_only: bool = False,
    ) -> str:
        """Narrow source_type based on access flags, sql filter, and type filter.

        ``dataset_only`` is true when a filter is set that no semantic view can
        match (see ``_Filters.dataset_only``).

        Returns one of: "database", "semantic_layer", "all", or "empty".
        "empty" signals that the caller should short-circuit and return no results
        (used when the user explicitly requests semantic views but lacks access).

        Resolution follows a single precedence order (highest to lowest). This
        is what makes a dataset-only filter (schema, editors, certified, sql)
        combined with a semantic-view result behave consistently across entry
        points, with one deliberate exception noted below:

        1. Access — a principal never sees a source type it cannot read; a
           dataset-only filter applied by a user without dataset access yields
           "empty" (nothing to match).
        2. Explicit ``Source`` selection — an explicit ``source_type`` of
           "database"/"semantic_layer" is authoritative and suppresses
           otherwise-contradictory cross-type filters (a leftover Schema chip
           becomes a no-op rather than a contradiction). This is the one place a
           dataset-only filter is intentionally dropped instead of yielding
           "empty".
        3. Implicit narrowing and content filters — honest AND: a filter that
           cannot match the resulting rows returns "empty" rather than being
           silently dropped. This covers Type="Semantic View" + schema and the
           semantic-layer-*connection* + schema route (see
           ``_resolve_connection_source_type``).

        Consequence: "views + schema=X" resolves to "empty" via the Type filter
        and via a semantic-layer connection, but an explicit ``Source``="Semantic
        layer" selection shows all views with the schema ignored (rule 2). A
        views-only user hits rule 1 first, so the same explicit selection yields
        "empty" for them — access restrictions outrank the explicit-selection
        escape hatch. All intended.
        """
        if not self._can_read_semantic_views:
            # If the user explicitly asked for semantic views but cannot read them,
            # return "empty" so the caller yields zero results rather than silently
            # falling back to the full dataset list.
            if source_type == "semantic_layer" or type_filter == "semantic_view":
                return "empty"
            return "database"
        if not self._can_read_datasets:
            # These filters are dataset-only, so a semantic-views-only user
            # matches nothing under AND semantics; return "empty" rather than
            # showing views with the filter dropped (mirrors the
            # not-can_read_semantic_views branch above and the
            # dataset-only/Type="Semantic View" case below).
            if dataset_only or sql_filter is not None:
                return "empty"
            return "semantic_layer"
        # An explicit source_type selection ("database" or "semantic_layer") always
        # wins. This prevents e.g. Type="Semantic View" from overriding an explicit
        # Source="Database" filter and showing inconsistent results.
        if source_type in ("database", "semantic_layer"):
            return source_type
        # sql_filter (physical/virtual toggle) and the dataset-only filters
        # (semantic views have no schema or editors and are never certified)
        # only apply to datasets, so any of them narrows to datasets.
        if sql_filter is not None or dataset_only:
            # A dataset-only filter combined with an explicit Type="Semantic
            # View" is contradictory: no semantic view can match it, so under
            # AND semantics the honest result is zero rows rather than silently
            # dropping either filter. This pair is reachable because those
            # controls are not part of the frontend cascade. (Via the UI,
            # sql_filter and type_filter come from one control and cannot
            # collide; a direct API payload could set both, in which case
            # sql_filter wins — see _apply_sql_null_filter.)
            if dataset_only and type_filter == "semantic_view":
                return "empty"
            return "database"
        # Explicit semantic-view type filter (only reached when source_type="all")
        if type_filter == "semantic_view":
            return "semantic_layer"
        return source_type

    @staticmethod
    def _apply_sql_null_filter(
        value: Any,
        type_filter: str | None,
        sql_filter: bool | None,
    ) -> tuple[str | None, bool | None]:
        """Interpret a ``sql``/``dataset_is_null_or_empty`` filter value.

        ``"semantic_view"`` selects semantic views; a boolean toggles the
        physical/virtual dataset split. Unrecognized values leave both inputs
        unchanged, so the caller can pass its current values straight through.
        """
        if value == "semantic_view":
            return "semantic_view", sql_filter
        if isinstance(value, bool):
            return type_filter, value
        return type_filter, sql_filter

    @staticmethod
    def _parse_legacy_filter(
        col: str, opr: Any, value: Any, current: dict[str, Any]
    ) -> dict[str, Any]:
        """Parse the columns the combined list supported from the start.

        These stay lenient: an operator that is not the expected one is ignored
        rather than rejected. ``current`` carries the fields parsed so far, for
        the ``sql`` filter that updates two of them at once.
        """
        if col == "source_type":
            return {"source_type": value or "all"}
        if col == "table_name" and opr == "ct":
            return {"name_filter": value}
        if col == "sql" and opr == "dataset_is_null_or_empty":
            type_filter, sql_filter = (
                GetCombinedDatasourceListCommand._apply_sql_null_filter(
                    value, current.get("type_filter"), current.get("sql_filter")
                )
            )
            return {"type_filter": type_filter, "sql_filter": sql_filter}
        if col == "database" and value is not None:
            try:
                return {"database_id": int(value)}
            except (TypeError, ValueError):
                return {}
        if col == "semantic_layer_uuid" and value is not None:
            return {"semantic_layer_uuid": str(value)}
        if col == "schema" and opr == "eq" and value is not None:
            return {"schema_filter": str(value)}
        return {}

    @staticmethod
    def _parse_relation_filter(col: str, opr: Any, value: Any) -> dict[str, Any]:
        """Parse a column the canonical dataset endpoint filters with a fixed
        operator. Anything else is rejected, as that endpoint does."""
        if opr != _RELATION_OPERATORS[col]:
            raise ValueError(f"Filter operation: {opr} not allowed on column: {col}")
        if value is None:
            return {}
        if col == _EDITORS_COLUMN:
            return {"editors_filter": _relation_id(col, value)}
        if col == _CHANGED_BY_COLUMN:
            return {"changed_by_filter": _relation_id(col, value)}
        if isinstance(value, bool):
            return {"certified_filter": value}
        raise ValueError(f"Invalid value for filter column: {col}")

    @staticmethod
    def _parse_filters(filters: list[dict[str, Any]]) -> _Filters:
        """
        Translate raw rison filter dicts into a typed ``_Filters``.

        Raises ``ValueError`` (answered as 400) for a column the endpoint cannot
        filter on, and for an operator or value the relation filters do not
        accept. The canonical ``/api/v1/dataset/`` rejects the same inputs;
        dropping them here would return an unfiltered list that looks filtered.
        """
        fields: dict[str, Any] = {}
        for f in filters:
            col = f.get("col")
            if col in _RELATION_OPERATORS:
                fields.update(
                    GetCombinedDatasourceListCommand._parse_relation_filter(
                        col, f.get("opr"), f.get("value")
                    )
                )
            elif col in _LEGACY_COLUMNS:
                fields.update(
                    GetCombinedDatasourceListCommand._parse_legacy_filter(
                        col, f.get("opr"), f.get("value"), fields
                    )
                )
            else:
                raise ValueError(f"Filter column: {col} not allowed to filter")

        return _Filters(**fields)
