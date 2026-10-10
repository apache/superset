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
        select(str_col, unicode_col)
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
            """WITH currency AS (
  SELECT
    'INR' AS cur
), currency_2 AS (
  SELECT
    'EUR' AS cur
), __cte AS (
  SELECT
    *
  FROM currency
  UNION ALL
  SELECT
    *
  FROM currency_2
)""",
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


def test_identifier_quote_uses_square_brackets() -> None:
    """SQL Server quotes identifiers with square brackets."""
    from superset.db_engine_specs.mssql import MssqlEngineSpec

    assert MssqlEngineSpec.get_public_information()["identifier_quote"] == {
        "start": "[",
        "end": "]",
        "escape_by_doubling": True,
    }


def test_get_catalog_from_engine_params_url_path() -> None:
    """
    The database is resolved from the URL's own path segment when present --
    this is the form used by ``MssqlEngineSpec``'s own recommended connection
    string (``mssql+pymssql://...@host:port/{database}``).
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url("mssql+pymssql://user:pw@host:1433/abcm")
    assert url.database == "abcm"
    assert MssqlEngineSpec.get_catalog_from_engine_params(url, {}) == "abcm"


def test_get_catalog_from_engine_params_connect_args() -> None:
    """
    The database is resolved from an explicit ``connect_args["database"]``
    when the URL itself has no path segment (e.g. a host/DSN-only URI where
    the admin configured the database separately, via the "Extra" field).
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url("mssql+pyodbc://user:pw@host")
    assert url.database is None
    assert (
        MssqlEngineSpec.get_catalog_from_engine_params(url, {"database": "abcm"})
        == "abcm"
    )


def test_get_catalog_from_engine_params_odbc_connect() -> None:
    """
    The non-default pyodbc driver bundles the entire ODBC connection string
    -- including ``Database=...`` -- into a single opaque ``odbc_connect``
    query parameter that SQLAlchemy's URL parser doesn't decompose. Note this
    is also the case where ``url.database`` comes back as an empty string,
    not ``None`` -- the hook must treat both as "not statically present" and
    keep looking rather than short-circuiting on the empty string.
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url(
        "mssql+pyodbc:///?odbc_connect="
        "Driver%3D%7BODBC+Driver+17+for+SQL+Server%7D%3B"
        "Server%3Dtcp%3Amyhost%2C1433%3B"
        "Database%3Dabcm%3B"
        "Uid%3DSuperSet%3BPwd%3Dpw%3BEncrypt%3Dyes"
    )
    assert url.database == ""
    assert MssqlEngineSpec.get_catalog_from_engine_params(url, {}) == "abcm"


def test_get_catalog_from_engine_params_odbc_connect_no_database() -> None:
    """
    An ``odbc_connect`` string with no ``Database=`` entry resolves to None,
    same as if the parameter weren't present at all.
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url(
        "mssql+pyodbc:///?odbc_connect="
        "Driver%3D%7BODBC+Driver+17+for+SQL+Server%7D%3B"
        "Server%3Dtcp%3Amyhost%2C1433%3B"
        "Uid%3DSuperSet%3BPwd%3Dpw%3BEncrypt%3Dyes"
    )
    assert url.database == ""
    assert MssqlEngineSpec.get_catalog_from_engine_params(url, {}) is None


def test_get_catalog_from_engine_params_reporter_uri_returns_none() -> None:
    """
    Regression test for GH #31406: the literal reporter connection string --
    a bare host/DSN with no path, no connect_args, and no odbc_connect -- has
    no statically-determinable database anywhere in it. The actual database
    is only known to SQL Server itself, via the login's server-side default,
    at connect time. This method deliberately does not perform a live query
    to resolve it, so it must return None here, not guess.
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url("mssql+pyodbc://SuperSet:pw@abcm")
    assert url.host == "abcm"
    assert url.database is None
    assert MssqlEngineSpec.get_catalog_from_engine_params(url, {}) is None


def test_get_catalog_from_engine_params_odbc_connect_braced_semicolon() -> None:
    """
    A brace-quoted Database value may itself contain a literal ';' -- the
    parser must not split on it.
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url(
        "mssql+pyodbc:///?odbc_connect="
        "Driver%3D%7BODBC+Driver+17+for+SQL+Server%7D%3B"
        "Server%3Dtcp%3Amyhost%2C1433%3B"
        "Database%3D%7Bmy%3Bdb%7D%3B"
        "Uid%3DSuperSet%3BPwd%3Dpw"
    )
    assert MssqlEngineSpec.get_catalog_from_engine_params(url, {}) == "my;db"


def test_get_catalog_from_engine_params_odbc_connect_duplicate_database_keeps_first() -> (  # noqa: E501
    None
):
    """
    Per the ODBC specification, a driver resolves a repeated keyword to its
    first occurrence -- verified empirically against a real SQL Server and
    the actual Microsoft ODBC Driver 18 for SQL Server. A literal duplicate
    Database= inside a single odbc_connect string must resolve to the first
    value, not the last.
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url(
        "mssql+pyodbc:///?odbc_connect="
        "Driver%3D%7BODBC+Driver+17+for+SQL+Server%7D%3B"
        "Database%3DA%3B"
        "Uid%3DSuperSet%3BPwd%3Dpw%3B"
        "Database%3DB%3B"
    )
    assert MssqlEngineSpec.get_catalog_from_engine_params(url, {}) == "A"


def test_get_catalog_from_engine_params_initial_catalog_not_recognized() -> None:
    """
    "Initial Catalog=" is an OLEDB/ADO.NET connection-string keyword, not an
    ODBC one -- the Microsoft ODBC Driver for SQL Server's own keyword
    reference does not list it, and empirically (verified against a real
    SQL Server + msodbcsql18) it is silently ignored, falling back to the
    login's default database. Treating it as equivalent to Database= would
    report a catalog the real connection never actually uses, so the parser
    must not recognize it.
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url(
        "mssql+pyodbc:///?odbc_connect="
        "Driver%3D%7BODBC+Driver+17+for+SQL+Server%7D%3B"
        "Server%3Dtcp%3Amyhost%2C1433%3B"
        "Initial+Catalog%3Dabcm%3B"
        "Uid%3DSuperSet%3BPwd%3Dpw"
    )
    assert MssqlEngineSpec.get_catalog_from_engine_params(url, {}) is None


def test_get_catalog_from_engine_params_database_wins_regardless_of_initial_catalog() -> (  # noqa: E501
    None
):
    """
    Database= is the only keyword the driver actually recognizes, so its
    value is used regardless of whether an (inert) Initial Catalog= entry
    is also present, and regardless of the order the two appear in --
    verified empirically for both orderings against the real driver.
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    # Database= before Initial Catalog=
    url_database_first = make_url(
        "mssql+pyodbc:///?odbc_connect="
        "Driver%3D%7BODBC+Driver+17+for+SQL+Server%7D%3B"
        "Database%3Dabcm%3B"
        "Initial+Catalog%3Dother%3B"
        "Uid%3DSuperSet%3BPwd%3Dpw"
    )
    assert (
        MssqlEngineSpec.get_catalog_from_engine_params(url_database_first, {}) == "abcm"
    )

    # Initial Catalog= before Database=
    url_initial_catalog_first = make_url(
        "mssql+pyodbc:///?odbc_connect="
        "Driver%3D%7BODBC+Driver+17+for+SQL+Server%7D%3B"
        "Initial+Catalog%3Dother%3B"
        "Database%3Dabcm%3B"
        "Uid%3DSuperSet%3BPwd%3Dpw"
    )
    assert (
        MssqlEngineSpec.get_catalog_from_engine_params(url_initial_catalog_first, {})
        == "abcm"
    )


def test_get_catalog_from_engine_params_odbc_connect_wins_over_connect_args() -> None:
    """
    Verified against a real SQL Server + the actual Microsoft ODBC Driver 18
    for SQL Server: pyodbc appends connect_args onto whatever connection
    string SQLAlchemy already built, and per the ODBC specification a driver
    resolves a repeated keyword to its *first* occurrence -- so
    odbc_connect's own embedded Database= (baked into the string first)
    wins over a conflicting connect_args["database"] (appended after), not
    the other way around.
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url(
        "mssql+pyodbc:///?odbc_connect="
        "Driver%3D%7BODBC+Driver+17+for+SQL+Server%7D%3B"
        "Database%3Dodbc_connect_db%3B"
        "Uid%3DSuperSet%3BPwd%3Dpw"
    )
    assert (
        MssqlEngineSpec.get_catalog_from_engine_params(
            url, {"database": "connect_args_db"}
        )
        == "odbc_connect_db"
    )


def test_get_catalog_from_engine_params_odbc_connect_and_connect_args_agree() -> None:
    """
    When odbc_connect's Database= and connect_args["database"] agree, the
    result is unambiguous regardless of which one "wins".
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url(
        "mssql+pyodbc:///?odbc_connect="
        "Driver%3D%7BODBC+Driver+17+for+SQL+Server%7D%3B"
        "Database%3Dabcm%3B"
        "Uid%3DSuperSet%3BPwd%3Dpw"
    )
    assert (
        MssqlEngineSpec.get_catalog_from_engine_params(url, {"database": "abcm"})
        == "abcm"
    )


def test_get_catalog_from_engine_params_connect_args_fallback_when_odbc_connect_has_no_database() -> (  # noqa: E501
    None
):
    """
    Verified empirically: when odbc_connect has no Database= entry at all,
    the built connection string has no such keyword for pyodbc's appended
    connect_args to conflict with -- so connect_args["database"] is
    genuinely what the driver connects to.
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url(
        "mssql+pyodbc:///?odbc_connect="
        "Driver%3D%7BODBC+Driver+17+for+SQL+Server%7D%3B"
        "Server%3Dtcp%3Amyhost%2C1433%3B"
        "Uid%3DSuperSet%3BPwd%3Dpw"
    )
    assert (
        MssqlEngineSpec.get_catalog_from_engine_params(url, {"database": "abcm"})
        == "abcm"
    )


def test_get_catalog_from_engine_params_odbc_connect_empty_database_fails_closed() -> (  # noqa: E501
    None
):
    """
    Verified empirically: an odbc_connect string with an explicit but empty
    Database=; still counts as the driver's first occurrence of the
    keyword, so it connects to the login's default database and silently
    ignores connect_args entirely -- the hook must not fall back to
    connect_args["database"] here, since that would report a database the
    real connection doesn't use. Fails closed to None instead.
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url(
        "mssql+pyodbc:///?odbc_connect="
        "Driver%3D%7BODBC+Driver+17+for+SQL+Server%7D%3B"
        "Server%3Dtcp%3Amyhost%2C1433%3B"
        "Database%3D%3B"
        "Uid%3DSuperSet%3BPwd%3Dpw"
    )
    assert (
        MssqlEngineSpec.get_catalog_from_engine_params(url, {"database": "abcm"})
        is None
    )


def test_get_catalog_from_engine_params_odbc_connect_wins_over_url_path() -> None:
    """
    When odbc_connect is present, SQLAlchemy's pyodbc dialect uses it as the
    *entire* connection string and never looks at the URL's own host/database
    segments at all -- so odbc_connect's Database= must take precedence over
    a (structurally unusual, but possible) database also present in the
    URL's path.
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url(
        "mssql+pyodbc://user:pw@host/path_db"
        "?odbc_connect="
        "Driver%3D%7BODBC+Driver+17+for+SQL+Server%7D%3B"
        "Database%3Dodbc_connect_db%3B"
        "Uid%3DSuperSet%3BPwd%3Dpw"
    )
    assert url.database == "path_db"
    assert MssqlEngineSpec.get_catalog_from_engine_params(url, {}) == "odbc_connect_db"


def test_get_catalog_from_engine_params_url_path_wins_over_connect_args() -> None:
    """
    The plain (non-odbc_connect) host path bakes the URL's own database into
    the positional connection string the same way odbc_connect does --
    SQLAlchemy's PyODBCConnector.create_connect_args always emits
    "Database=<url.database>" there -- so it wins over connect_args for the
    identical structural reason, verified against the real driver.
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url("mssql+pyodbc://user:pw@host/url_db")
    assert (
        MssqlEngineSpec.get_catalog_from_engine_params(
            url, {"database": "connect_args_db"}
        )
        == "url_db"
    )


def test_get_catalog_from_engine_params_database_query_param_only() -> None:
    """
    SQLAlchemy also accepts "database" as a URL query parameter, not just as
    the path segment. Verified against SQLAlchemy 2.0.52:
    mssql+pyodbc://u:p@host?database=realdb&driver=... builds
    "Database=realdb" into the positional connection string even though
    url.database itself is None -- so the query parameter must be checked,
    not just the path segment.
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url(
        "mssql+pyodbc://user:pw@host"
        "?database=realdb&driver=ODBC+Driver+18+for+SQL+Server"
    )
    assert url.database is None
    assert MssqlEngineSpec.get_catalog_from_engine_params(url, {}) == "realdb"


def test_get_catalog_from_engine_params_database_query_param_wins_over_connect_args() -> (  # noqa: E501
    None
):
    """
    A "database" query parameter is baked into the positional connection
    string the same way odbc_connect's Database= is, so it wins over a
    conflicting connect_args["database"] for the identical structural
    reason (pyodbc appends connect_args after, and the driver resolves a
    repeated keyword to its first occurrence).
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url(
        "mssql+pyodbc://user:pw@host"
        "?database=realdb&driver=ODBC+Driver+18+for+SQL+Server"
    )
    assert (
        MssqlEngineSpec.get_catalog_from_engine_params(url, {"database": "otherdb"})
        == "realdb"
    )


def test_get_catalog_from_engine_params_database_query_param_wins_over_url_path() -> (  # noqa: E501
    None
):
    """
    Verified against SQLAlchemy 2.0.52: when both a path-segment database
    and a "database" query parameter are present with different values,
    PyODBCConnector.create_connect_args merges the query parameter into its
    working options *after* the path segment, so the query parameter -- not
    url.database -- is what actually ends up in the built connection
    string. This holds even with no connect_args involved at all.
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url(
        "mssql+pyodbc://user:pw@host/path_db"
        "?database=query_db&driver=ODBC+Driver+18+for+SQL+Server"
    )
    assert url.database == "path_db"
    assert MssqlEngineSpec.get_catalog_from_engine_params(url, {}) == "query_db"


def test_get_catalog_from_engine_params_empty_database_query_param_falls_back_to_url_path() -> (  # noqa: E501
    None
):
    """
    Verified against SQLAlchemy 2.0.52: unlike an explicit but empty
    Database= inside odbc_connect (which is "present" and fails closed), an
    empty "database" query parameter (?database=) is dropped entirely by
    SQLAlchemy's URL parser -- it never even appears in url.query -- so this
    is NOT equivalent to an explicit empty value. The path-segment database
    is used, matching what SQLAlchemy actually builds.
    """
    from sqlalchemy.engine import make_url

    from superset.db_engine_specs.mssql import MssqlEngineSpec

    url = make_url(
        "mssql+pyodbc://user:pw@host/path_db"
        "?database=&driver=ODBC+Driver+18+for+SQL+Server"
    )
    assert "database" not in url.query
    assert MssqlEngineSpec.get_catalog_from_engine_params(url, {}) == "path_db"
