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
import unittest.mock as mock
from datetime import datetime
from textwrap import dedent
from typing import Any, Optional

import pytest
from sqlalchemy import column, table
from sqlalchemy.dialects import mssql
from sqlalchemy.dialects.mssql import DATE, NTEXT, NVARCHAR, TEXT, VARCHAR
from sqlalchemy.sql import select
from sqlalchemy.types import String, TypeEngine, UnicodeText

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.models.sql_types.mssql_sql_types import GUID
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        ("CHAR", String, None, GenericDataType.STRING, False),
        ("CHAR(10)", String, None, GenericDataType.STRING, False),
        ("VARCHAR", String, None, GenericDataType.STRING, False),
        ("VARCHAR(10)", String, None, GenericDataType.STRING, False),
        ("TEXT", String, None, GenericDataType.STRING, False),
        ("NCHAR(10)", UnicodeText, None, GenericDataType.STRING, False),
        ("NVARCHAR(10)", UnicodeText, None, GenericDataType.STRING, False),
        ("NTEXT", UnicodeText, None, GenericDataType.STRING, False),
        ("uniqueidentifier", GUID, None, GenericDataType.STRING, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.mssql import MssqlEngineSpec as spec  # noqa: N813

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


def test_where_clause_n_prefix() -> None:
    from superset.db_engine_specs.mssql import MssqlEngineSpec

    dialect = mssql.dialect()

    # non-unicode col
    sqla_column_type = MssqlEngineSpec.get_column_types("VARCHAR(10)")
    assert sqla_column_type is not None
    type_, _ = sqla_column_type
    str_col = column("col", type_=type_)

    # unicode col
    sqla_column_type = MssqlEngineSpec.get_column_types("NTEXT")
    assert sqla_column_type is not None
    type_, _ = sqla_column_type
    unicode_col = column("unicode_col", type_=type_)

    tbl = table("tbl")
    sel = (
        select([str_col, unicode_col])
        .select_from(tbl)
        .where(str_col == "abc")
        .where(unicode_col == "abc")
    )

    query = str(sel.compile(dialect=dialect, compile_kwargs={"literal_binds": True}))
    query_expected = (
        "SELECT col, unicode_col \n"
        "FROM tbl \n"
        "WHERE col = 'abc' AND unicode_col = N'abc'"
    )
    assert query == query_expected


def test_time_exp_mixed_case_col_1y() -> None:
    from superset.db_engine_specs.mssql import MssqlEngineSpec

    col = column("MixedCase")
    expr = MssqlEngineSpec.get_timestamp_expr(col, None, "P1Y")
    result = str(expr.compile(None, dialect=mssql.dialect()))
    assert result == "DATEADD(YEAR, DATEDIFF(YEAR, 0, [MixedCase]), 0)"


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        (
            "date",
            "CONVERT(DATE, '2019-01-02', 23)",
        ),
        (
            "datetime",
            "CONVERT(DATETIME, '2019-01-02T03:04:05.678', 126)",
        ),
        (
            "smalldatetime",
            "CONVERT(SMALLDATETIME, '2019-01-02 03:04:05', 20)",
        ),
        ("Other", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.mssql import MssqlEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_extract_error_message() -> None:
    from superset.db_engine_specs.mssql import MssqlEngineSpec

    test_mssql_exception = Exception(
        "(8155, b\"No column name was specified for column 1 of 'inner_qry'."
        "DB-Lib error message 20018, severity 16:\\nGeneral SQL Server error: "
        'Check messages from the SQL Server\\n")'
    )
    error_message = MssqlEngineSpec.extract_error_message(test_mssql_exception)
    expected_message = (
        "mssql error: All your SQL functions need to "
        "have an alias on MSSQL. For example: SELECT COUNT(*) AS C1 FROM TABLE1"
    )
    assert expected_message == error_message

    test_mssql_exception = Exception(
        '(8200, b"A correlated expression is invalid because it is not in a '
        "GROUP BY clause.\\n\")'"
    )
    error_message = MssqlEngineSpec.extract_error_message(test_mssql_exception)
    expected_message = "mssql error: " + MssqlEngineSpec._extract_error_message(
        test_mssql_exception
    )
    assert expected_message == error_message


def test_fetch_data_no_description() -> None:
    from superset.db_engine_specs.mssql import MssqlEngineSpec

    cursor = mock.MagicMock()
    cursor.description = []
    assert MssqlEngineSpec.fetch_data(cursor) == []


def test_fetch_data() -> None:
    from superset.db_engine_specs.base import BaseEngineSpec
    from superset.db_engine_specs.mssql import MssqlEngineSpec

    with mock.patch.object(
        MssqlEngineSpec,
        "pyodbc_rows_to_tuples",
        return_value="converted",
    ) as mock_pyodbc_rows_to_tuples:
        cursor = mock.MagicMock()
        data = [(1, "foo")]
        with mock.patch.object(BaseEngineSpec, "fetch_data", return_value=data):
            result = MssqlEngineSpec.fetch_data(cursor, 0)
            mock_pyodbc_rows_to_tuples.assert_called_once_with(data)
            assert result == "converted"


@pytest.mark.parametrize(
    "original,expected",
    [
        (DATE(), "DATE"),
        (VARCHAR(length=255), "VARCHAR(255)"),
        (VARCHAR(length=255, collation="utf8_general_ci"), "VARCHAR(255)"),
        (NVARCHAR(length=128), "NVARCHAR(128)"),
        (TEXT(), "TEXT"),
        (NTEXT(collation="utf8_general_ci"), "NTEXT"),
    ],
)
def test_column_datatype_to_string(original: TypeEngine, expected: str) -> None:
    from superset.db_engine_specs.mssql import MssqlEngineSpec

    actual = MssqlEngineSpec.column_datatype_to_string(original, mssql.dialect())
    assert actual == expected


@pytest.mark.parametrize(
    "original,expected",
    [
        (
            dedent(
                """
with currency as (
select 'INR' as cur
),
currency_2 as (
select 'EUR' as cur
)
select * from currency union all select * from currency_2
"""
            ),
            dedent(
                """WITH currency as (
select 'INR' as cur
),
currency_2 as (
select 'EUR' as cur
),
__cte AS (
select * from currency union all select * from currency_2
)"""
            ),
        ),
        (
            "SELECT 1 as cnt",
            None,
        ),
        (
            dedent(
                """
select 'INR' as cur
union
select 'AUD' as cur
union
select 'USD' as cur
"""
            ),
            None,
        ),
    ],
)
def test_cte_query_parsing(original: TypeEngine, expected: str) -> None:
    from superset.db_engine_specs.mssql import MssqlEngineSpec

    actual = MssqlEngineSpec.get_cte_query(original)
    assert actual == expected


@pytest.mark.parametrize(
    "original,expected,top",
    [
        ("SEL TOP 1000 * FROM My_table", "SEL TOP 100 * FROM My_table", 100),
        ("SEL TOP 1000 * FROM My_table;", "SEL TOP 100 * FROM My_table", 100),
        ("SEL TOP 1000 * FROM My_table;", "SEL TOP 1000 * FROM My_table", 10000),
        ("SEL TOP 1000 * FROM My_table;", "SEL TOP 1000 * FROM My_table", 1000),
        (
            """with abc as (select * from test union select * from test1)
select TOP 100 * from currency""",
            """WITH abc as (select * from test union select * from test1)
select TOP 100 * from currency""",
            1000,
        ),
        ("SELECT DISTINCT x from tbl", "SELECT DISTINCT TOP 100 x from tbl", 100),
        ("SELECT 1 as cnt", "SELECT TOP 10 1 as cnt", 10),
        (
            "select TOP 1000 * from abc where id=1",
            "select TOP 10 * from abc where id=1",
            10,
        ),
    ],
)
def test_top_query_parsing(original: TypeEngine, expected: str, top: int) -> None:
    from superset.db_engine_specs.mssql import MssqlEngineSpec

    actual = MssqlEngineSpec.apply_top_to_sql(original, top)
    assert actual == expected


def test_extract_errors() -> None:
    """
    Test that custom error messages are extracted correctly.
    """
    from superset.db_engine_specs.mssql import MssqlEngineSpec

    msg = dedent(
        """
DB-Lib error message 20009, severity 9:
Unable to connect: Adaptive Server is unavailable or does not exist (localhost_)
        """
    )
    result = MssqlEngineSpec.extract_errors(Exception(msg))
    assert result == [
        SupersetError(
            error_type=SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
            message='The hostname "localhost_" cannot be resolved.',
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Microsoft SQL Server",
                "issue_codes": [
                    {
                        "code": 1007,
                        "message": "Issue 1007 - The hostname provided can't be resolved.",  # noqa: E501
                    }
                ],
            },
        )
    ]

    msg = dedent(
        """
DB-Lib error message 20009, severity 9:
Unable to connect: Adaptive Server is unavailable or does not exist (localhost)
Net-Lib error during Connection refused (61)
DB-Lib error message 20009, severity 9:
Unable to connect: Adaptive Server is unavailable or does not exist (localhost)
Net-Lib error during Connection refused (61)
        """
    )
    result = MssqlEngineSpec.extract_errors(
        Exception(msg), context={"port": 12345, "hostname": "localhost"}
    )
    assert result == [
        SupersetError(
            error_type=SupersetErrorType.CONNECTION_PORT_CLOSED_ERROR,
            message='Port 12345 on hostname "localhost" refused the connection.',
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Microsoft SQL Server",
                "issue_codes": [
                    {"code": 1008, "message": "Issue 1008 - The port is closed."}
                ],
            },
        )
    ]

    msg = dedent(
        """
DB-Lib error message 20009, severity 9:
Unable to connect: Adaptive Server is unavailable or does not exist (example.com)
Net-Lib error during Operation timed out (60)
DB-Lib error message 20009, severity 9:
Unable to connect: Adaptive Server is unavailable or does not exist (example.com)
Net-Lib error during Operation timed out (60)
        """
    )
    result = MssqlEngineSpec.extract_errors(
        Exception(msg), context={"port": 12345, "hostname": "example.com"}
    )
    assert result == [
        SupersetError(
            error_type=SupersetErrorType.CONNECTION_HOST_DOWN_ERROR,
            message=(
                'The host "example.com" might be down, '
                "and can't be reached on port 12345."
            ),
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Microsoft SQL Server",
                "issue_codes": [
                    {
                        "code": 1009,
                        "message": "Issue 1009 - The host might be down, and can't be reached on the provided port.",  # noqa: E501
                    }
                ],
            },
        )
    ]

    msg = dedent(
        """
DB-Lib error message 20009, severity 9:
Unable to connect: Adaptive Server is unavailable or does not exist (93.184.216.34)
Net-Lib error during Operation timed out (60)
DB-Lib error message 20009, severity 9:
Unable to connect: Adaptive Server is unavailable or does not exist (93.184.216.34)
Net-Lib error during Operation timed out (60)
        """
    )
    result = MssqlEngineSpec.extract_errors(
        Exception(msg), context={"port": 12345, "hostname": "93.184.216.34"}
    )
    assert result == [
        SupersetError(
            error_type=SupersetErrorType.CONNECTION_HOST_DOWN_ERROR,
            message=(
                'The host "93.184.216.34" might be down, '
                "and can't be reached on port 12345."
            ),
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Microsoft SQL Server",
                "issue_codes": [
                    {
                        "code": 1009,
                        "message": "Issue 1009 - The host might be down, and can't be reached on the provided port.",  # noqa: E501
                    }
                ],
            },
        )
    ]

    msg = dedent(
        """
DB-Lib error message 20018, severity 14:
General SQL Server error: Check messages from the SQL Server
DB-Lib error message 20002, severity 9:
Adaptive Server connection failed (mssqldb.cxiotftzsypc.us-west-2.rds.amazonaws.com)
DB-Lib error message 20002, severity 9:
Adaptive Server connection failed (mssqldb.cxiotftzsypc.us-west-2.rds.amazonaws.com)
        """
    )
    result = MssqlEngineSpec.extract_errors(
        Exception(msg), context={"username": "testuser", "database": "testdb"}
    )
    assert result == [
        SupersetError(
            message='Either the username "testuser", password, or database name "testdb" is incorrect.',  # noqa: E501
            error_type=SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Microsoft SQL Server",
                "issue_codes": [
                    {
                        "code": 1014,
                        "message": "Issue 1014 - Either the username or "
                        "the password is wrong.",
                    },
                    {
                        "code": 1015,
                        "message": "Issue 1015 - Either the database is "
                        "spelled incorrectly or does not exist.",
                    },
                ],
            },
        )
    ]


@pytest.mark.parametrize(
    "name,expected_result",
    [
        ("col", "col"),
        ("Col", "Col"),
        ("COL", "COL"),
    ],
)
def test_denormalize_name(name: str, expected_result: str):
    from superset.db_engine_specs.mssql import MssqlEngineSpec as spec  # noqa: N813

    assert spec.denormalize_name(mssql.dialect(), name) == expected_result
