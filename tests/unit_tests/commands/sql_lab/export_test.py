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
"""Unit tests for SQL Lab CSV export."""

from decimal import Decimal
from unittest.mock import MagicMock

import pandas as pd
import pytest
from pytest_mock import MockerFixture

from superset.commands.sql_lab.export import SqlResultExportCommand
from superset.utils import csv


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("0E-18", "0.000000000000000000"),
        ("-1E-7", "-0.0000001"),
        ("1E+30", "1000000000000000000000000000000"),
        ("12.3400", "12.3400"),
        ("NaN", ""),
        ("Infinity", "Infinity"),
        ("-Infinity", "-Infinity"),
    ],
)
def test_csv_export_without_results_backend_preserves_decimals(
    mocker: MockerFixture, value: str, expected: str
) -> None:
    """Re-executed query results use exact fixed-point decimal text."""
    mocker.patch("superset.commands.sql_lab.export.results_backend", None)
    mocker.patch.dict("superset.commands.sql_lab.export.app.config", {"CSV_EXPORT": {}})
    csv_spy = mocker.spy(csv, "df_to_escaped_csv")
    decimal_value = Decimal(value)
    query = MagicMock()
    query.select_sql = "SELECT amount FROM numbers"
    query.database.get_df.return_value = pd.DataFrame(
        {"amount": [decimal_value], "other": ["unchanged"]}, dtype=object
    )
    mock_db = mocker.patch("superset.commands.sql_lab.export.db")
    query_result = mock_db.session.query.return_value.filter_by.return_value
    query_result.one_or_none.return_value = query

    result = SqlResultExportCommand("client_id").run()

    assert result["data"] == f"amount,other\n{expected},unchanged\n".encode()
    assert result["count"] == 1
    query.database.get_df.assert_called_once_with(
        query.select_sql, query.catalog, query.schema
    )
    if not decimal_value.is_finite():
        assert csv_spy.call_args.args[0].at[0, "amount"] is decimal_value


@pytest.mark.parametrize("decimal_separator", [".", ","])
def test_csv_export_mixed_frame_is_byte_identical(
    mocker: MockerFixture, decimal_separator: str
) -> None:
    """Column mapping preserves mixed values and untouched numeric columns."""
    mocker.patch("superset.commands.sql_lab.export.results_backend", None)
    mocker.patch.dict(
        "superset.commands.sql_lab.export.app.config",
        {"CSV_EXPORT": {"sep": ";", "decimal": decimal_separator}},
    )
    query: MagicMock = MagicMock()
    query.select_sql = "SELECT * FROM numbers"
    frame: pd.DataFrame = pd.DataFrame(
        {
            "mixed": [Decimal("12.3400"), 1.25, "=formula", None, Decimal("NaN")],
            "float": [1.25, 2.5, 3.75, 4.0, 5.0],
            "nullable": pd.Series([1, None, 3, 4, 5], dtype=object),
        },
    )
    frame.index = [10, 20, 30, 40, 50]
    query.database.get_df.return_value = frame
    mock_db: MagicMock = mocker.patch("superset.commands.sql_lab.export.db")
    query_result: MagicMock = mock_db.session.query.return_value.filter_by.return_value
    query_result.one_or_none.return_value = query
    formatter: MagicMock = mocker.spy(csv, "format_decimal")

    result = SqlResultExportCommand("client_id").run()

    expected: str = (
        "mixed;float;nullable\n"
        "12.3400;1.25;1\n"
        "1.25;2.5;\n"
        "'=formula;3.75;3\n"
        ";4.0;4\n"
        ";5.0;5\n"
    )
    if decimal_separator == ",":
        # Pandas applies the separator to float columns, not mixed object cells.
        expected = expected.replace(";1.25;", ";1,25;").replace(";2.5;", ";2,5;")
        expected = expected.replace(";3.75;", ";3,75;").replace(";4.0;", ";4,0;")
        expected = expected.replace(";5.0;", ";5,0;")
    assert result["data"] == expected.encode()
    assert result["count"] == 5
    assert formatter.call_count == 5


def test_csv_export_uses_full_sql_for_multi_statement_query(
    mocker: MockerFixture,
) -> None:
    """CSV export must pass query.sql (the full original SQL) to get_df(),
    not query.executed_sql.

    query.executed_sql only holds the last statement executed because
    sql_lab.py overwrites it on every loop iteration.  When a multi-statement
    query uses session variables (e.g. ``SET @var = 'x'; SELECT … WHERE col =
    @var``), those SET statements are absent from executed_sql.  Re-running
    only the SELECT on a fresh connection leaves the variables undefined
    (NULL), so the WHERE clause matches nothing → empty CSV.

    This test would have failed before the fix: SQLScript and get_df would
    each have been called with last_statement_only instead of full_sql.
    """
    mocker.patch("superset.commands.sql_lab.export.results_backend", None)
    mocker.patch.dict("superset.commands.sql_lab.export.app.config", {"CSV_EXPORT": {}})

    full_sql = "SET @val = 'foo';\nSELECT col FROM tbl WHERE col = @val"
    last_statement_only = "SELECT col FROM tbl WHERE col = @val"

    query: MagicMock = MagicMock()
    query.select_sql = None
    query.sql = full_sql
    query.executed_sql = last_statement_only  # only the SELECT — the bug value

    # Mock SQLScript so we control the returned limit without needing a real
    # DB-engine string; the key assertion is what SQL is passed to it.
    mock_script: MagicMock = MagicMock()
    mock_script.statements[-1].get_limit_value.return_value = None
    mock_sql_script = mocker.patch(
        "superset.commands.sql_lab.export.SQLScript", return_value=mock_script
    )

    query.database.get_df.return_value = pd.DataFrame({"col": ["foo"]})

    mock_db: MagicMock = mocker.patch("superset.commands.sql_lab.export.db")
    query_result: MagicMock = mock_db.session.query.return_value.filter_by.return_value
    query_result.one_or_none.return_value = query

    SqlResultExportCommand("client_id").run()

    # Both SQLScript (limit extraction) and get_df (execution) must receive
    # the full SQL including SET statements, not just the final SELECT.
    mock_sql_script.assert_called_once_with(
        full_sql, query.database.db_engine_spec.engine
    )
    query.database.get_df.assert_called_once_with(
        full_sql, query.catalog, query.schema
    )


def test_csv_export_uses_full_sql_for_single_statement_query(
    mocker: MockerFixture,
) -> None:
    """For single-statement queries query.sql equals query.executed_sql, so
    switching to query.sql is transparent and existing behaviour is preserved."""
    mocker.patch("superset.commands.sql_lab.export.results_backend", None)
    mocker.patch.dict("superset.commands.sql_lab.export.app.config", {"CSV_EXPORT": {}})

    sql = "SELECT col FROM tbl"

    query: MagicMock = MagicMock()
    query.select_sql = None
    query.sql = sql
    query.executed_sql = sql  # identical — single statement, no rewrite

    mock_script: MagicMock = MagicMock()
    mock_script.statements[-1].get_limit_value.return_value = None
    mocker.patch(
        "superset.commands.sql_lab.export.SQLScript", return_value=mock_script
    )

    query.database.get_df.return_value = pd.DataFrame({"col": ["a", "b"]})

    mock_db: MagicMock = mocker.patch("superset.commands.sql_lab.export.db")
    query_result: MagicMock = mock_db.session.query.return_value.filter_by.return_value
    query_result.one_or_none.return_value = query

    result = SqlResultExportCommand("client_id").run()

    # Single-statement: sql == executed_sql, so behaviour is unchanged.
    query.database.get_df.assert_called_once_with(sql, query.catalog, query.schema)
    assert result["count"] == 2
