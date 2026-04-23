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

from superset.commands.datasource.list import GetCombinedDatasourceListCommand


def test_parse_filters_semantic_view_requires_dataset_operator() -> None:
    source_type, name_filter, sql_filter, type_filter = (
        GetCombinedDatasourceListCommand._parse_filters(
            [{"col": "sql", "opr": "eq", "value": "semantic_view"}]
        )
    )

    assert source_type == "all"
    assert name_filter is None
    assert sql_filter is None
    assert type_filter is None


def test_parse_filters_semantic_view_with_dataset_operator() -> None:
    source_type, name_filter, sql_filter, type_filter = (
        GetCombinedDatasourceListCommand._parse_filters(
            [
                {
                    "col": "sql",
                    "opr": "dataset_is_null_or_empty",
                    "value": "semantic_view",
                }
            ]
        )
    )

    assert source_type == "all"
    assert name_filter is None
    assert sql_filter is None
    assert type_filter == "semantic_view"


def test_parse_filters_sql_bool_requires_dataset_operator() -> None:
    source_type, name_filter, sql_filter, type_filter = (
        GetCombinedDatasourceListCommand._parse_filters(
            [{"col": "sql", "opr": "eq", "value": True}]
        )
    )

    assert source_type == "all"
    assert name_filter is None
    assert sql_filter is None
    assert type_filter is None


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
