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

        (
            source_type,
            name_filter,
            sql_filter,
            type_filter,
            database_id,
            semantic_layer_uuid,
            schema_filter,
        ) = self._parse_filters(filters)

        source_type = self._resolve_connection_source_type(
            source_type,
            database_id,
            semantic_layer_uuid,
            schema_filter,
        )
        # A connection filter can already resolve to "empty" (e.g. a semantic-layer
        # connection combined with a dataset-only schema filter); don't let the
        # content-filter resolution override that terminal decision.
        if source_type != "empty":
            source_type = self._resolve_source_type(
                source_type, sql_filter, type_filter, schema_filter
            )

        if source_type == "empty":
            return {"count": 0, "result": []}

        combined = self._build_combined_query(
            source_type,
            name_filter,
            sql_filter,
            database_id,
            semantic_layer_uuid,
            schema_filter,
        )
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
        schema_filter: str | None = None,
    ) -> str:
        # A connection filter implicitly narrows the source type: selecting a
        # database ID means "show only datasets", and selecting a semantic layer
        # UUID means "show only semantic views". Only apply the implicit
        # narrowing when the user hasn't already set an explicit source_type.
        if source_type == "all":
            if database_id is not None:
                return "database"
            elif semantic_layer_uuid is not None:
                # A semantic-layer connection selects only that layer's
                # (schema-less) views, so a dataset-only schema filter matches
                # nothing: the honest result is empty. Unlike an explicit
                # Source="Semantic layer" selection (handled in
                # _resolve_source_type), the user never picked a source type
                # here, so the "explicit selection wins" rule does not apply.
                if schema_filter is not None:
                    return "empty"
                return "semantic_layer"

        return source_type

    @staticmethod
    def _build_combined_query(
        source_type: str,
        name_filter: str | None,
        sql_filter: bool | None,
        database_id: int | None,
        semantic_layer_uuid: str | None,
        schema_filter: str | None = None,
    ) -> Any:
        ds_q = DatasourceDAO.build_dataset_query(
            name_filter, sql_filter, database_id, schema_filter
        )
        sv_q = DatasourceDAO.build_semantic_view_query(name_filter, semantic_layer_uuid)

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
        schema_filter: str | None = None,
    ) -> str:
        """Narrow source_type based on access flags, sql filter, and type filter.

        Returns one of: "database", "semantic_layer", "all", or "empty".
        "empty" signals that the caller should short-circuit and return no results
        (used when the user explicitly requests semantic views but lacks access).

        Resolution follows a single precedence order (highest to lowest). This
        is what makes a dataset-only filter (schema/sql) combined with a
        semantic-view result behave consistently across entry points, with one
        deliberate exception noted below:

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
            # schema and sql_filter are both dataset-only, so a semantic-views-only
            # user matches nothing under AND semantics; return "empty" rather than
            # showing views with the filter dropped (mirrors the
            # not-can_read_semantic_views branch above and the
            # schema/Type="Semantic View" case below).
            if schema_filter is not None or sql_filter is not None:
                return "empty"
            return "semantic_layer"
        # An explicit source_type selection ("database" or "semantic_layer") always
        # wins. This prevents e.g. Type="Semantic View" from overriding an explicit
        # Source="Database" filter and showing inconsistent results.
        if source_type in ("database", "semantic_layer"):
            return source_type
        # sql_filter (physical/virtual toggle) and schema both only apply to
        # datasets (semantic views have no schema), so either narrows to datasets.
        if sql_filter is not None or schema_filter is not None:
            # A schema filter combined with an explicit Type="Semantic View" is
            # contradictory: no semantic view has a schema, so under AND semantics
            # the honest result is zero rows rather than silently dropping either
            # filter. This pair is reachable because the Schema control is not part
            # of the frontend cascade. (Via the UI, sql_filter and type_filter come
            # from one control and cannot collide; a direct API payload could set
            # both, in which case sql_filter wins — see _apply_sql_null_filter.)
            if schema_filter is not None and type_filter == "semantic_view":
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
    def _parse_filters(
        filters: list[dict[str, Any]],
    ) -> tuple[
        str, str | None, bool | None, str | None, int | None, str | None, str | None
    ]:
        """
        Translate raw rison filter dicts into typed query parameters.

        Returns:
            source_type:        "all" | "database" | "semantic_layer"
            name_filter:        substring to match against name/table_name
            sql_filter:         True → physical only, False → virtual only, None → both
            type_filter:        "semantic_view" when caller wants only
                                semantic views
            database_id:        filter datasets to a specific database ID
            semantic_layer_uuid: filter semantic views to a specific semantic layer UUID
            schema_filter:      filter datasets to a specific schema name
        """
        source_type = "all"
        name_filter: str | None = None
        sql_filter: bool | None = None
        type_filter: str | None = None
        database_id: int | None = None
        semantic_layer_uuid: str | None = None
        schema_filter: str | None = None

        for f in filters:
            col = f.get("col")
            opr = f.get("opr")
            value = f.get("value")

            if col == "source_type":
                source_type = value or "all"
            elif col == "table_name" and f.get("opr") == "ct":
                name_filter = value
            elif col == "sql" and opr == "dataset_is_null_or_empty":
                type_filter, sql_filter = (
                    GetCombinedDatasourceListCommand._apply_sql_null_filter(
                        value, type_filter, sql_filter
                    )
                )
            elif col == "database" and value is not None:
                try:
                    database_id = int(value)
                except (TypeError, ValueError):
                    pass
            elif col == "semantic_layer_uuid" and value is not None:
                semantic_layer_uuid = str(value)
            elif col == "schema" and opr == "eq" and value is not None:
                schema_filter = str(value)

        return (
            source_type,
            name_filter,
            sql_filter,
            type_filter,
            database_id,
            semantic_layer_uuid,
            schema_filter,
        )
