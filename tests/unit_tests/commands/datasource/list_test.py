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
    _dataset_schema,
    _semantic_view_schema,
    GetCombinedDatasourceListCommand,
)


def test_parse_filters_semantic_view_requires_dataset_operator() -> None:
    (
        source_type,
        name_filter,
        sql_filter,
        type_filter,
        database_id,
        semantic_layer_uuid,
        schema_filter,
    ) = GetCombinedDatasourceListCommand._parse_filters(
        [{"col": "sql", "opr": "eq", "value": "semantic_view"}]
    )

    assert source_type == "all"
    assert name_filter is None
    assert sql_filter is None
    assert type_filter is None
    assert database_id is None
    assert semantic_layer_uuid is None
    assert schema_filter is None


def test_parse_filters_semantic_view_with_dataset_operator() -> None:
    (
        source_type,
        name_filter,
        sql_filter,
        type_filter,
        database_id,
        semantic_layer_uuid,
        schema_filter,
    ) = GetCombinedDatasourceListCommand._parse_filters(
        [
            {
                "col": "sql",
                "opr": "dataset_is_null_or_empty",
                "value": "semantic_view",
            }
        ]
    )

    assert source_type == "all"
    assert name_filter is None
    assert sql_filter is None
    assert type_filter == "semantic_view"
    assert database_id is None
    assert semantic_layer_uuid is None
    assert schema_filter is None


def test_parse_filters_sql_bool_requires_dataset_operator() -> None:
    (
        source_type,
        name_filter,
        sql_filter,
        type_filter,
        database_id,
        semantic_layer_uuid,
        schema_filter,
    ) = GetCombinedDatasourceListCommand._parse_filters(
        [{"col": "sql", "opr": "eq", "value": True}]
    )

    assert source_type == "all"
    assert name_filter is None
    assert sql_filter is None
    assert type_filter is None
    assert database_id is None
    assert semantic_layer_uuid is None
    assert schema_filter is None


def test_parse_filters_extracts_schema() -> None:
    (
        source_type,
        name_filter,
        sql_filter,
        type_filter,
        database_id,
        semantic_layer_uuid,
        schema_filter,
    ) = GetCombinedDatasourceListCommand._parse_filters(
        [{"col": "schema", "opr": "eq", "value": "main"}]
    )

    assert schema_filter == "main"
    assert source_type == "all"
    assert name_filter is None
    assert sql_filter is None
    assert type_filter is None
    assert database_id is None
    assert semantic_layer_uuid is None


def test_parse_filters_ignores_schema_with_wrong_operator() -> None:
    (*_, schema_filter) = GetCombinedDatasourceListCommand._parse_filters(
        [{"col": "schema", "opr": "ct", "value": "main"}]
    )

    assert schema_filter is None


def test_parse_filters_schema_boundary_values() -> None:
    # An empty string is a real value: it becomes ``schema == ''`` (matching
    # empty-schema rows, not NULL), mirroring the canonical /api/v1/dataset/
    # FilterEqual behavior.
    (*_, empty) = GetCombinedDatasourceListCommand._parse_filters(
        [{"col": "schema", "opr": "eq", "value": ""}]
    )
    assert empty == ""

    # A null value is ignored so no schema filter is applied.
    (*_, missing) = GetCombinedDatasourceListCommand._parse_filters(
        [{"col": "schema", "opr": "eq", "value": None}]
    )
    assert missing is None


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


def test_resolve_source_type_schema_filter_forces_database() -> None:
    command = GetCombinedDatasourceListCommand(
        args={},
        can_read_datasets=True,
        can_read_semantic_views=True,
    )

    source_type = command._resolve_source_type(
        source_type="all",
        sql_filter=None,
        type_filter=None,
        schema_filter="main",
    )

    assert source_type == "database"


def test_resolve_source_type_explicit_semantic_layer_wins_over_schema() -> None:
    command = GetCombinedDatasourceListCommand(
        args={},
        can_read_datasets=True,
        can_read_semantic_views=True,
    )

    source_type = command._resolve_source_type(
        source_type="semantic_layer",
        sql_filter=None,
        type_filter=None,
        schema_filter="main",
    )

    assert source_type == "semantic_layer"


def test_resolve_source_type_semantic_view_type_plus_schema_is_empty() -> None:
    command = GetCombinedDatasourceListCommand(
        args={},
        can_read_datasets=True,
        can_read_semantic_views=True,
    )

    # Type="Semantic View" AND a schema is contradictory (views have no schema);
    # the honest AND result is zero rows, not a silently-dropped filter.
    source_type = command._resolve_source_type(
        source_type="all",
        sql_filter=None,
        type_filter="semantic_view",
        schema_filter="main",
    )

    assert source_type == "empty"


def test_resolve_source_type_views_only_user_with_schema_is_empty() -> None:
    command = GetCombinedDatasourceListCommand(
        args={},
        can_read_datasets=False,
        can_read_semantic_views=True,
    )

    # A user who can only read semantic views matches nothing when a
    # (dataset-only) schema filter is applied, so the honest result is empty.
    source_type = command._resolve_source_type(
        source_type="all",
        sql_filter=None,
        type_filter=None,
        schema_filter="main",
    )

    assert source_type == "empty"


def test_resolve_source_type_views_only_user_without_schema_is_semantic_layer() -> None:
    command = GetCombinedDatasourceListCommand(
        args={},
        can_read_datasets=False,
        can_read_semantic_views=True,
    )

    # Without a schema filter the views-only user still sees semantic views.
    source_type = command._resolve_source_type(
        source_type="all",
        sql_filter=None,
        type_filter=None,
    )

    assert source_type == "semantic_layer"


def test_resolve_source_type_views_only_user_with_sql_filter_is_empty() -> None:
    command = GetCombinedDatasourceListCommand(
        args={},
        can_read_datasets=False,
        can_read_semantic_views=True,
    )

    # sql_filter (physical/virtual) is dataset-only, so a views-only user matches
    # nothing rather than seeing the full view list with the filter dropped.
    source_type = command._resolve_source_type(
        source_type="all",
        sql_filter=True,
        type_filter=None,
    )

    assert source_type == "empty"


def test_resolve_connection_semantic_layer_uuid_with_schema_is_empty() -> None:
    # Picking a semantic-layer connection (not an explicit source type) narrows to
    # that layer's schema-less views; a dataset-only schema filter matches nothing.
    source_type = GetCombinedDatasourceListCommand._resolve_connection_source_type(
        source_type="all",
        database_id=None,
        semantic_layer_uuid="uuid-123",
        schema_filter="main",
    )

    assert source_type == "empty"


def test_resolve_connection_semantic_layer_uuid_without_schema() -> None:
    # Without a schema filter the connection still narrows to that layer's views.
    source_type = GetCombinedDatasourceListCommand._resolve_connection_source_type(
        source_type="all",
        database_id=None,
        semantic_layer_uuid="uuid-123",
        schema_filter=None,
    )

    assert source_type == "semantic_layer"


def test_resolve_connection_explicit_semantic_layer_ignores_schema() -> None:
    # The "empty" narrowing only applies to the implicit (source_type="all") route;
    # an explicit source_type is left alone even with uuid + schema both set.
    source_type = GetCombinedDatasourceListCommand._resolve_connection_source_type(
        source_type="semantic_layer",
        database_id=None,
        semantic_layer_uuid="uuid-123",
        schema_filter="main",
    )

    assert source_type == "semantic_layer"


def test_run_semantic_layer_connection_with_schema_returns_empty() -> None:
    """A semantic-layer connection + schema filter short-circuits to empty.

    Pins the run() guard that stops the content-filter stage from overriding a
    connection-stage "empty": without it, the query would fall through to a
    dataset source instead of returning zero rows.
    """
    command = GetCombinedDatasourceListCommand(
        args={
            "filters": [
                {"col": "semantic_layer_uuid", "opr": "eq", "value": "uuid-123"},
                {"col": "schema", "opr": "eq", "value": "main"},
            ]
        },
        can_read_datasets=True,
        can_read_semantic_views=True,
    )

    with patch(
        "superset.commands.datasource.list.DatasourceDAO.paginate_combined_query"
    ) as paginate_mock:
        result = command.run()

    assert result == {"count": 0, "result": []}
    paginate_mock.assert_not_called()


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
