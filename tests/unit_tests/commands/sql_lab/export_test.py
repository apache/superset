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
from typing import Any
from unittest.mock import MagicMock

import pandas as pd
import pytest
from pytest_mock import MockerFixture

from superset.commands.sql_lab.export import SqlResultExportCommand
from superset.sqllab.limiting_factor import LimitingFactor
from superset.utils import csv
from superset.utils.fetch_memory_cap import is_fetch_memory_cap_disabled


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


@pytest.mark.parametrize(
    ("limiting_factor", "uses_results_backend"),
    [
        (LimitingFactor.MEMORY, False),
        (LimitingFactor.DROPDOWN, True),
        (LimitingFactor.NOT_LIMITED, True),
    ],
)
def test_csv_export_reruns_memory_truncated_results_without_cap(
    mocker: MockerFixture,
    limiting_factor: LimitingFactor,
    uses_results_backend: bool,
) -> None:
    """
    Stored SQL Lab results cut short by an engine fetch memory cap are
    incomplete, so the export reruns the query without the cap, keeping the
    row limit. Other stored results are exported as they are.
    """
    results_backend = mocker.patch("superset.commands.sql_lab.export.results_backend")
    results_backend.get.return_value = b"blob"
    mocker.patch(
        "superset.commands.sql_lab.export.utils.zlib_decompress", return_value="{}"
    )
    mocker.patch(
        "superset.commands.sql_lab.export._deserialize_results_payload",
        return_value={"data": [{"n": 1}], "columns": [{"name": "n"}]},
    )
    mocker.patch.dict("superset.commands.sql_lab.export.app.config", {"CSV_EXPORT": {}})
    query = MagicMock()
    query.results_key = "key"
    query.select_sql = None
    query.executed_sql = "SELECT n FROM t LIMIT 4"
    query.limiting_factor = limiting_factor
    query.database.db_engine_spec.engine = "bigquery"
    cap_disabled: list[bool] = []

    def get_df(*_: Any) -> pd.DataFrame:
        cap_disabled.append(is_fetch_memory_cap_disabled())
        return pd.DataFrame({"n": [1, 2, 3, 4]})

    query.database.get_df.side_effect = get_df
    mock_db = mocker.patch("superset.commands.sql_lab.export.db")
    query_result = mock_db.session.query.return_value.filter_by.return_value
    query_result.one_or_none.return_value = query

    result = SqlResultExportCommand("client_id").run()

    if uses_results_backend:
        assert result["count"] == 1
        query.database.get_df.assert_not_called()
    else:
        # LIMIT 4 holds the extra probe row, so 3 rows are exported.
        assert result["count"] == 3
        assert cap_disabled == [True]
    assert is_fetch_memory_cap_disabled() is False


def test_csv_export_never_reruns_mutating_memory_truncated_scripts(
    mocker: MockerFixture,
) -> None:
    """
    Rerunning a memory-truncated script that mutates data would apply the
    mutation again, so its stored rows are exported instead.
    """
    results_backend = mocker.patch("superset.commands.sql_lab.export.results_backend")
    results_backend.get.return_value = b"blob"
    mocker.patch(
        "superset.commands.sql_lab.export.utils.zlib_decompress", return_value="{}"
    )
    mocker.patch(
        "superset.commands.sql_lab.export._deserialize_results_payload",
        return_value={"data": [{"n": 1}], "columns": [{"name": "n"}]},
    )
    mocker.patch.dict("superset.commands.sql_lab.export.app.config", {"CSV_EXPORT": {}})
    query = MagicMock()
    query.results_key = "key"
    query.select_sql = None
    query.executed_sql = "INSERT INTO log VALUES (1);\nSELECT n FROM t LIMIT 4"
    query.limiting_factor = LimitingFactor.MEMORY
    query.database.db_engine_spec.engine = "bigquery"
    mock_db = mocker.patch("superset.commands.sql_lab.export.db")
    query_result = mock_db.session.query.return_value.filter_by.return_value
    query_result.one_or_none.return_value = query

    result = SqlResultExportCommand("client_id").run()

    assert result["count"] == 1
    query.database.get_df.assert_not_called()
