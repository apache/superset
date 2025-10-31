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
"""Test for double time filter application in virtual datasets (Issue #34894)"""

from __future__ import annotations

from datetime import datetime

from flask import Flask
from freezegun import freeze_time
from pytest_mock import MockerFixture

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.models.core import Database


def test_time_filter_applied_once_with_remove_filter_in_virtual_dataset(
    mocker: MockerFixture, app: Flask
) -> None:
    """
    Test that time filter is applied only once when using get_time_filter with
    remove_filter=True in a virtual dataset.

    This test reproduces the issue described in GitHub issue #34894 where time
    filters are being applied twice - once in the inner query (virtual dataset)
    and again in the outer query.

    Expected behavior: When remove_filter=True is used in the virtual dataset,
    the time filter should only be applied in the inner query, not in the outer query.

    Actual behavior (bug): The filter is applied in both inner and outer queries.
    """
    # Mock the database connection
    database = Database(
        id=1,
        database_name="test_db",
        sqlalchemy_uri="postgresql://test",
    )

    # Create a virtual dataset that uses get_time_filter with
    # remove_filter=True
    virtual_dataset_sql = """
    SELECT *
    FROM my_table
    WHERE
        dttm >= {{
            get_time_filter('dttm', remove_filter=True, target_type='DATE')
                .from_expr
        }}
        AND dttm < {{
            get_time_filter('dttm', remove_filter=True, target_type='DATE')
                .to_expr
        }}
    """

    columns = [
        TableColumn(column_name="dttm", is_dttm=1, type="TIMESTAMP"),
        TableColumn(column_name="value", type="INTEGER"),
    ]

    virtual_dataset = SqlaTable(
        table_name="virtual_dataset",
        sql=virtual_dataset_sql,
        columns=columns,
        main_dttm_col="dttm",
        database=database,
    )

    # Mock the security manager to avoid RLS checks
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.is_guest_user",
        return_value=False,
    )

    # Create a query object with a time filter
    query_obj = {
        "granularity": "dttm",
        "from_dttm": datetime(2024, 1, 1),
        "to_dttm": datetime(2024, 1, 31),
        "is_timeseries": False,
        "filter": [
            {
                "col": "dttm",
                "op": "TEMPORAL_RANGE",
                "val": "2024-01-01 : 2024-01-31",
            }
        ],
        "metrics": [],
        "columns": ["value"],
    }

    with (
        freeze_time("2024-01-15"),
        app.test_request_context(
            json={
                "queries": [
                    {
                        "filters": [
                            {
                                "col": "dttm",
                                "op": "TEMPORAL_RANGE",
                                "val": "2024-01-01 : 2024-01-31",
                            }
                        ],
                    }
                ],
            }
        ),
    ):
        # Get the query SQL
        sqla_query = virtual_dataset.get_query_str_extended(query_obj, mutate=False)
        generated_sql = sqla_query.sql.lower()

        print(f"\n\nGenerated SQL:\n{generated_sql}\n\n")

        # Count how many times the date filter condition appears
        # The filter should appear only ONCE (in the inner query from the
        # virtual dataset). It should NOT appear in the outer query WHERE clause

        # Check for patterns that indicate the filter is applied in the outer query
        # This would be a bug - the filter should only be in the subquery
        outer_where_pattern = (
            "where" in generated_sql.split("from (")[1]
            if "from (" in generated_sql
            else False
        )

        # The assertion we want to pass: time filter should NOT be in outer query
        # because remove_filter=True was used in the virtual dataset
        # Currently this will FAIL because of bug #34894
        assert (
            not outer_where_pattern or "dttm" not in generated_sql.split("from (")[1]
        ), (
            "Time filter should only be applied in the inner query (virtual dataset), "
            "not in the outer query when using remove_filter=True. "
            "This indicates the filter is being applied twice."
        )


def test_time_filter_removed_from_outer_query_simple_case(
    mocker: MockerFixture, app: Flask
) -> None:
    """
    Test the basic mechanism: when a Jinja template uses get_time_filter with
    remove_filter=True, the filter should be added to removed_filters list and
    not be applied in the SQLAlchemy query generation.

    This is a simpler test that verifies the core mechanism works at a single level.
    """
    database = Database(
        id=1,
        database_name="test_db",
        sqlalchemy_uri="postgresql://test",
    )

    columns = [
        TableColumn(column_name="dttm", is_dttm=1, type="TIMESTAMP"),
        TableColumn(column_name="value", type="INTEGER"),
    ]

    # Simple query with Jinja template that removes the filter
    simple_sql = """
    SELECT *
    FROM my_table
    WHERE dttm >= {{
        get_time_filter('dttm', remove_filter=True, target_type='DATE').from_expr
    }}
    """

    dataset = SqlaTable(
        table_name="test_table",
        sql=simple_sql,
        columns=columns,
        main_dttm_col="dttm",
        database=database,
    )

    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.is_guest_user",
        return_value=False,
    )

    query_obj = {
        "granularity": "dttm",
        "from_dttm": datetime(2024, 1, 1),
        "to_dttm": datetime(2024, 1, 31),
        "is_timeseries": False,
        "filter": [
            {
                "col": "dttm",
                "op": "TEMPORAL_RANGE",
                "val": "2024-01-01 : 2024-01-31",
            }
        ],
        "metrics": [],
        "columns": ["value"],
    }

    with (
        freeze_time("2024-01-15"),
        app.test_request_context(
            json={
                "queries": [
                    {
                        "filters": [
                            {
                                "col": "dttm",
                                "op": "TEMPORAL_RANGE",
                                "val": "2024-01-01 : 2024-01-31",
                            }
                        ],
                    }
                ],
            }
        ),
    ):
        sqla_query = dataset.get_query_str_extended(query_obj, mutate=False)
        generated_sql = sqla_query.sql.lower()

        print(f"\n\nSimple case SQL:\n{generated_sql}\n\n")

        # In this simple case, the filter should appear exactly once
        # (in the template, not added by SQLAlchemy)
        # Count occurrences of date filter patterns
        dttm_count = generated_sql.count("dttm")

        # We expect to see dttm in the SELECT and WHERE (from template only)
        # But NOT duplicated by SQLAlchemy's filter application
        assert dttm_count <= 3, (
            f"Expected at most 3 occurrences of 'dttm' "
            f"(SELECT, WHERE from template), but found {dttm_count}. "
            f"This suggests the filter is being applied multiple times."
        )


def test_time_filter_with_timestamp_alias(mocker: MockerFixture, app: Flask) -> None:
    """
    Test that remove_filter works correctly when using __timestamp alias.

    This test specifically addresses the issue where time filters use the __timestamp
    alias in timeseries queries, but get_time_filter uses the actual column name.
    The fix ensures both are recognized as the same column.
    """
    database = Database(
        id=1,
        database_name="test_db",
        sqlalchemy_uri="postgresql://test",
    )

    columns = [
        TableColumn(column_name="dttm", is_dttm=1, type="TIMESTAMP"),
        TableColumn(column_name="value", type="INTEGER"),
    ]

    # Virtual dataset with Jinja template that removes the filter using
    # actual column name
    virtual_sql = """
    SELECT *
    FROM my_table
    WHERE dttm >= {{
        get_time_filter('dttm', remove_filter=True, target_type='DATE').from_expr
    }}
      AND dttm < {{
        get_time_filter('dttm', remove_filter=True, target_type='DATE').to_expr
    }}
    """

    dataset = SqlaTable(
        table_name="test_table",
        sql=virtual_sql,
        columns=columns,
        main_dttm_col="dttm",
        database=database,
    )

    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.is_guest_user",
        return_value=False,
    )

    # Query using __timestamp alias (as timeseries charts do)
    query_obj = {
        "granularity": "dttm",
        "from_dttm": datetime(2024, 1, 1),
        "to_dttm": datetime(2024, 1, 31),
        "is_timeseries": True,  # This will cause __timestamp alias to be used
        "filter": [
            {
                "col": "__timestamp",  # Using the special alias
                "op": "TEMPORAL_RANGE",
                "val": "2024-01-01 : 2024-01-31",
            }
        ],
        "metrics": ["count"],
        "columns": [],
    }

    with (
        freeze_time("2024-01-15"),
        app.test_request_context(
            json={
                "queries": [
                    {
                        "filters": [
                            {
                                "col": "__timestamp",
                                "op": "TEMPORAL_RANGE",
                                "val": "2024-01-01 : 2024-01-31",
                            }
                        ],
                    }
                ],
            }
        ),
    ):
        sqla_query = dataset.get_query_str_extended(query_obj, mutate=False)
        generated_sql = sqla_query.sql.lower()

        print(f"\n\nTimestamp alias case SQL:\n{generated_sql}\n\n")

        # The filter should only appear in the inner query (virtual dataset)
        # NOT in the outer query WHERE clause
        # Check if there's a WHERE clause after the subquery
        parts = generated_sql.split(")")
        if len(parts) > 1:
            outer_part = parts[-1]
            # The outer part should not have additional date filter conditions
            # (It may have GROUP BY, ORDER BY, LIMIT, but not WHERE with dttm)
            if "where" in outer_part:
                assert "dttm" not in outer_part or "to_date" not in outer_part, (
                    "Time filter should not be applied in outer query when using "
                    "remove_filter=True in virtual dataset. The __timestamp alias "
                    "should be recognized as equivalent to the actual column name."
                )
