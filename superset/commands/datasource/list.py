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
from superset.daos.datasource import DatasourceDAO
from superset.datasource.schemas import DatasetListSchema, SemanticViewListSchema
from superset.semantic_layers.models import SemanticView

logger = logging.getLogger(__name__)

_dataset_schema = DatasetListSchema()
_semantic_view_schema = SemanticViewListSchema()


@dataclass
class _Filters:
    source_type: str = "all"
    name_filter: str | None = None
    sql_filter: bool | None = None
    type_filter: str | None = None
    database_id: int | None = None
    semantic_layer_uuid: str | None = None
    schema_filter: str | None = None
    owners_filter: list[int] | None = None
    changed_by_filter: int | None = None
    certified_filter: bool | None = None


def _apply_owners_filter(value: Any) -> list[int] | None:
    if isinstance(value, list):
        try:
            return [int(v) for v in value if v is not None]
        except (TypeError, ValueError):
            return None
    if value is not None:
        try:
            return [int(value)]
        except (TypeError, ValueError):
            return None
    return None


def _apply_query_filter(
    result: _Filters,
    col: str | None,
    opr: str | None,
    value: Any,
) -> None:
    if col == "source_type":
        result.source_type = value or "all"
    elif col == "table_name" and opr == "ct":
        result.name_filter = value
    elif col == "sql":
        if opr == "dataset_is_null_or_empty" and value == "semantic_view":
            result.type_filter = "semantic_view"
        elif opr == "dataset_is_null_or_empty" and isinstance(value, bool):
            result.sql_filter = value


def _apply_entity_filter(
    result: _Filters,
    col: str | None,
    opr: str | None,
    value: Any,
) -> None:
    if col == "database" and value is not None:
        try:
            result.database_id = int(value)
        except (TypeError, ValueError):
            pass
    elif col == "semantic_layer_uuid" and value is not None:
        result.semantic_layer_uuid = str(value)
    elif col == "schema" and opr == "eq":
        result.schema_filter = value


def _apply_access_filter(
    result: _Filters,
    col: str | None,
    opr: str | None,
    value: Any,
) -> None:
    if col == "owners" and opr == "rel_m_m":
        parsed = _apply_owners_filter(value)
        if parsed is not None:
            result.owners_filter = parsed
    elif col == "changed_by" and opr == "rel_o_m" and value is not None:
        try:
            result.changed_by_filter = int(value)
        except (TypeError, ValueError):
            pass
    elif col == "id" and opr == "dataset_is_certified":
        if isinstance(value, bool):
            result.certified_filter = value


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
        filters = self._parse_filters(self._args.get("filters", []))

        filters.source_type = self._resolve_connection_source_type(
            filters.source_type,
            filters.database_id,
            filters.semantic_layer_uuid,
        )
        filters.source_type = self._resolve_source_type(
            filters.source_type, filters.sql_filter, filters.type_filter
        )

        if filters.source_type == "empty":
            return {"count": 0, "result": []}

        combined = self._build_combined_query(filters)
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
    ) -> str:
        # A connection filter implicitly narrows the source type: selecting a
        # database ID means "show only datasets", and selecting a semantic layer
        # UUID means "show only semantic views". Only apply the implicit
        # narrowing when the user hasn't already set an explicit source_type.
        if source_type == "all":
            if database_id is not None:
                return "database"
            elif semantic_layer_uuid is not None:
                return "semantic_layer"

        return source_type

    @staticmethod
    def _build_combined_query(filters: _Filters) -> Any:
        ds_q = DatasourceDAO.build_dataset_query(
            name_filter=filters.name_filter,
            sql_filter=filters.sql_filter,
            database_id=filters.database_id,
            schema_filter=filters.schema_filter,
            owners_filter=filters.owners_filter,
            changed_by_filter=filters.changed_by_filter,
            certified_filter=filters.certified_filter,
        )
        sv_q = DatasourceDAO.build_semantic_view_query(
            filters.name_filter, filters.semantic_layer_uuid
        )

        if filters.source_type == "database":
            return ds_q.subquery()
        if filters.source_type == "semantic_layer":
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

        return result

    def validate(self) -> None:
        pass  # access checks are performed by the caller (API layer)

    def _resolve_source_type(
        self,
        source_type: str,
        sql_filter: bool | None,
        type_filter: str | None,
    ) -> str:
        """Narrow source_type based on access flags, sql filter, and type filter.

        Returns one of: "database", "semantic_layer", "all", or "empty".
        "empty" signals that the caller should short-circuit and return no results
        (used when the user explicitly requests semantic views but lacks access).
        """
        if not self._can_read_semantic_views:
            # If the user explicitly asked for semantic views but cannot read them,
            # return "empty" so the caller yields zero results rather than silently
            # falling back to the full dataset list.
            if source_type == "semantic_layer" or type_filter == "semantic_view":
                return "empty"
            return "database"
        if not self._can_read_datasets:
            return "semantic_layer"
        # An explicit source_type selection ("database" or "semantic_layer") always
        # wins. This prevents e.g. Type="Semantic View" from overriding an explicit
        # Source="Database" filter and showing inconsistent results.
        if source_type in ("database", "semantic_layer"):
            return source_type
        # sql_filter (physical/virtual toggle) only applies to datasets
        if sql_filter is not None:
            return "database"
        # Explicit semantic-view type filter (only reached when source_type="all")
        if type_filter == "semantic_view":
            return "semantic_layer"
        return source_type

    @staticmethod
    def _apply_filter(result: _Filters, f: dict[str, Any]) -> None:
        col = f.get("col")
        opr = f.get("opr")
        value = f.get("value")

        if col in ("source_type", "table_name", "sql"):
            _apply_query_filter(result, col, opr, value)
        elif col in ("database", "semantic_layer_uuid", "schema"):
            _apply_entity_filter(result, col, opr, value)
        elif col in ("owners", "changed_by", "id"):
            _apply_access_filter(result, col, opr, value)

    @staticmethod
    def _parse_filters(
        filters: list[dict[str, Any]],
    ) -> _Filters:
        """
        Translate raw rison filter dicts into typed query parameters.

        Returns a ``_Filters`` dataclass with the following fields:

            source_type:        ``"all"`` | ``"database"`` | ``"semantic_layer"``
            name_filter:        substring to match against name/table_name
            sql_filter:         ``True`` → physical only, ``False`` → virtual only,
                                ``None`` → both
            type_filter:        ``"semantic_view"`` when caller wants only semantic
                                views
            database_id:        filter datasets to a specific database ID
            semantic_layer_uuid: filter semantic views to a specific semantic layer
                                UUID
            schema_filter:      filter datasets by schema name
            owners_filter:      filter datasets by owner user IDs
            changed_by_filter:  filter datasets by last-modified user ID
            certified_filter:   ``True`` → certified only, ``False`` → uncertified
                                only, ``None`` → both
        """
        result = _Filters()

        for f in filters:
            GetCombinedDatasourceListCommand._apply_filter(result, f)

        return result
