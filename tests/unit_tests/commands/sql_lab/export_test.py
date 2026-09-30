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
