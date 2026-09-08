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
from unittest.mock import patch

import pytest
from sqlalchemy import literal, select

from superset.commands.datasource.list import (
    _apply_owners_filter,
    _dataset_schema,
    _Filters,
    _semantic_view_schema,
    GetCombinedDatasourceListCommand,
)


def test_parse_filters_semantic_view_requires_dataset_operator() -> None:
    filters: _Filters = GetCombinedDatasourceListCommand._parse_filters(
        [{"col": "sql", "opr": "eq", "value": "semantic_view"}]
    )

    assert filters.source_type == "all"
    assert filters.name_filter is None
    assert filters.sql_filter is None
    assert filters.type_filter is None
    assert filters.database_id is None
    assert filters.semantic_layer_uuid is None


def test_parse_filters_semantic_view_with_dataset_operator() -> None:
    filters: _Filters = GetCombinedDatasourceListCommand._parse_filters(
        [
            {
                "col": "sql",
                "opr": "dataset_is_null_or_empty",
                "value": "semantic_view",
            }
        ]
    )

    assert filters.source_type == "all"
    assert filters.name_filter is None
    assert filters.sql_filter is None
    assert filters.type_filter == "semantic_view"
    assert filters.database_id is None
    assert filters.semantic_layer_uuid is None


def test_parse_filters_sql_bool_requires_dataset_operator() -> None:
    filters: _Filters = GetCombinedDatasourceListCommand._parse_filters(
        [{"col": "sql", "opr": "eq", "value": True}]
    )

    assert filters.source_type == "all"
    assert filters.name_filter is None
    assert filters.sql_filter is None
    assert filters.type_filter is None
    assert filters.database_id is None
    assert filters.semantic_layer_uuid is None


def test_parse_filters_schema() -> None:
    filters: _Filters = GetCombinedDatasourceListCommand._parse_filters(
        [{"col": "schema", "opr": "eq", "value": "public"}]
    )

    assert filters.schema_filter == "public"
    assert filters.database_id is None
    assert filters.owners_filter is None


def test_parse_filters_owners_scalar() -> None:
    filters: _Filters = GetCombinedDatasourceListCommand._parse_filters(
        [{"col": "owners", "opr": "rel_m_m", "value": "5"}]
    )

    assert filters.owners_filter == [5]
    assert filters.schema_filter is None
    assert filters.changed_by_filter is None


def test_parse_filters_owners_list() -> None:
    filters: _Filters = GetCombinedDatasourceListCommand._parse_filters(
        [{"col": "owners", "opr": "rel_m_m", "value": ["5", "7"]}]
    )

    assert filters.owners_filter == [5, 7]


def test_parse_filters_owners_none() -> None:
    assert _apply_owners_filter(None) is None


def test_parse_filters_changed_by() -> None:
    filters: _Filters = GetCombinedDatasourceListCommand._parse_filters(
        [{"col": "changed_by", "opr": "rel_o_m", "value": "3"}]
    )

    assert filters.changed_by_filter == 3
    assert filters.owners_filter is None
    assert filters.schema_filter is None


def test_parse_filters_certified_true() -> None:
    filters: _Filters = GetCombinedDatasourceListCommand._parse_filters(
        [{"col": "id", "opr": "dataset_is_certified", "value": True}]
    )

    assert filters.certified_filter is True


def test_parse_filters_certified_false() -> None:
    filters: _Filters = GetCombinedDatasourceListCommand._parse_filters(
        [{"col": "id", "opr": "dataset_is_certified", "value": False}]
    )

    assert filters.certified_filter is False


def test_parse_filters_certified_non_bool_ignored() -> None:
    filters: _Filters = GetCombinedDatasourceListCommand._parse_filters(
        [{"col": "id", "opr": "dataset_is_certified", "value": "false"}]
    )

    assert filters.certified_filter is None


def test_resolve_source_type_semantic_view_filter_forces_semantic_layer() -> None:
    command = GetCombinedDatasourceListCommand(
        args={},
        can_read_datasets=True,
        can_read_semantic_views=True,
    )

    source_type = command._resolve_source_type(
        source_type="all",
        sql_filter=None,
        type_filter="semantic_view",
    )

    assert source_type == "semantic_layer"


def test_resolve_source_type_sql_filter_forces_database() -> None:
    command = GetCombinedDatasourceListCommand(
        args={},
        can_read_datasets=True,
        can_read_semantic_views=True,
    )

    source_type = command._resolve_source_type(
        source_type="all",
        sql_filter=True,
        type_filter=None,
    )

    assert source_type == "database"


@pytest.mark.parametrize(
    "order_column",
    ["unknown", "database.database_name", "id"],
)
def test_run_raises_for_invalid_sort_column(order_column: str) -> None:
    command = GetCombinedDatasourceListCommand(
        args={"order_column": order_column, "order_direction": "desc"},
        can_read_datasets=True,
        can_read_semantic_views=True,
    )

    ds_q = select(
        literal(1).label("item_id"),
        literal("database").label("source_type"),
        literal("2026-01-01").label("changed_on"),
        literal("name").label("table_name"),
    )
    sv_q = select(
        literal(2).label("item_id"),
        literal("semantic_layer").label("source_type"),
        literal("2026-01-01").label("changed_on"),
        literal("name").label("table_name"),
    )

    with (
        patch(
            "superset.commands.datasource.list.DatasourceDAO.build_dataset_query",
            return_value=ds_q,
        ),
        patch(
            "superset.commands.datasource.list.DatasourceDAO.build_semantic_view_query",
            return_value=sv_q,
        ),
        patch(
            "superset.commands.datasource.list.DatasourceDAO.paginate_combined_query",
            side_effect=ValueError(f"Invalid order column: {order_column}"),
        ),
    ):
        with pytest.raises(ValueError, match=f"Invalid order column: {order_column}"):
            command.run()


def test_serialize_rows_injects_rls_filters_for_datasets() -> None:
    """Ensure combined datasource list includes `rls_filters` summaries for datasets."""

    # simple row-like objects returned by paginate_combined_query
    row_cls = type("Row", (), {})
    ds_row = row_cls()
    ds_row.item_id = 1
    ds_row.source_type = "database"

    sv_row = row_cls()
    sv_row.item_id = 2
    sv_row.source_type = "semantic_layer"

    dataset_dict = {
        "id": 1,
        "table_name": "ds1",
        "source_type": "database",
    }
    sv_dict = {
        "id": 2,
        "table_name": "sv1",
        "source_type": "semantic_layer",
    }

    rls_summary = {"id": 11, "name": "test", "filter_type": "Base", "group_key": ""}

    with (
        patch(
            "superset.commands.datasource.list.DatasourceDAO.fetch_datasets_by_ids",
            return_value={1: object()},
        ),
        patch(
            "superset.commands.datasource.list.DatasourceDAO.fetch_semantic_views_by_ids",
            return_value={2: object()},
        ),
        patch.object(_dataset_schema, "dump", return_value=dataset_dict),
        patch.object(_semantic_view_schema, "dump", return_value=sv_dict),
        patch(
            "superset.commands.datasource.list.DatasetDAO.get_rls_filters_for_datasets",
            return_value={1: [rls_summary]},
        ),
    ):
        result = GetCombinedDatasourceListCommand._serialize_rows([ds_row, sv_row])

    # dataset entry should have rls_filters injected
    ds_item = next(x for x in result if x["id"] == 1)
    assert "rls_filters" in ds_item
    assert ds_item["rls_filters"] == [rls_summary]

    # semantic view entry should not have rls_filters injected
    sv_item = next(x for x in result if x["id"] == 2)
    assert "rls_filters" not in sv_item
