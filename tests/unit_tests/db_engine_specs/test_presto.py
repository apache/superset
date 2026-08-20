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
from datetime import datetime
from typing import Any, Optional
from unittest import mock

import pytest
import pytz
from pyhive.sqlalchemy_presto import PrestoDialect
from pytest_mock import MockerFixture
from sqlalchemy import column, sql, text, types
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.engine.url import make_url

from superset.models.sql_types.presto_sql_types import (
    Array,
    Interval,
    Map,
    Row,
    TinyInteger,
)
from superset.sql.parse import Table
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)


@pytest.mark.parametrize(
    "target_type,dttm,expected_result",
    [
        ("VARCHAR", datetime(2022, 1, 1), None),
        # Reachable for real: ``jinja_context.py`` calls this with
        # ``target_type or ""`` when no column type is known. Both unmapped and
        # empty types must return ``None`` — every caller branches on that
        # (``if sql:``) rather than on an exception.
        ("", datetime(2022, 1, 1), None),
        ("DATE", datetime(2022, 1, 1), "DATE '2022-01-01'"),
        (
            "TIMESTAMP",
            datetime(2022, 1, 1, 1, 23, 45, 600000),
            "TIMESTAMP '2022-01-01 01:23:45.600'",
        ),
        (
            "TIMESTAMP WITH TIME ZONE",
            datetime(2022, 1, 1, 1, 23, 45, 600000),
            "TIMESTAMP '2022-01-01 01:23:45.600'",
        ),
        (
            "TIMESTAMP WITH TIME ZONE",
            datetime(2022, 1, 1, 1, 23, 45, 600000, tzinfo=pytz.UTC),
            "TIMESTAMP '2022-01-01 01:23:45.600+00:00'",
        ),
    ],
)
def test_convert_dttm(
    target_type: str,
    dttm: datetime,
    expected_result: Optional[str],
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_convert_dttm_presto_spec_truncates_to_milliseconds() -> None:
    """Story 105826: ``PrestoEngineSpec.convert_dttm`` renders TIMESTAMP literals
    with **millisecond** precision, discarding anything finer.

    ``PrestoEngineSpec.convert_dttm`` deliberately overrides
    ``PrestoBaseEngineSpec.convert_dttm``, which uses microseconds. Nothing pinned
    that distinction before, and it is the only silent-failure mode in this file: a
    malformed or wrong-precision literal produces a *valid* query returning the
    wrong rows, with no error. A refactor collapsing the two methods would shift
    every Presto timestamp filter's precision without breaking a single test.

    The 123 trailing microseconds below are dropped, not rounded.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert PrestoEngineSpec.convert_dttm(
        "TIMESTAMP", datetime(2022, 1, 1, 1, 23, 45, 600123)
    ) == ("TIMESTAMP '2022-01-01 01:23:45.600'")


def test_convert_dttm_base_spec_keeps_microseconds() -> None:
    """Story 105826: ``PrestoBaseEngineSpec.convert_dttm`` — shared with Trino and
    the Hive family — keeps **microsecond** precision.

    The other half of the override documented in
    ``test_convert_dttm_presto_spec_truncates_to_milliseconds``. Same input, same
    target type, six fractional digits instead of three.
    """
    from superset.db_engine_specs.presto import PrestoBaseEngineSpec

    assert PrestoBaseEngineSpec.convert_dttm(
        "TIMESTAMP", datetime(2022, 1, 1, 1, 23, 45, 600123)
    ) == ("TIMESTAMP '2022-01-01 01:23:45.600123'")


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        ("varchar(255)", types.VARCHAR, {"length": 255}, GenericDataType.STRING, False),
        ("varchar", types.String, None, GenericDataType.STRING, False),
        ("char(255)", types.CHAR, {"length": 255}, GenericDataType.STRING, False),
        ("char", types.String, None, GenericDataType.STRING, False),
        ("integer", types.Integer, None, GenericDataType.NUMERIC, False),
        ("time", types.Time, None, GenericDataType.TEMPORAL, True),
        ("timestamp", types.TIMESTAMP, None, GenericDataType.TEMPORAL, True),
        # Story 105826 — the rest of ``column_type_mappings``. A column mapped to
        # the wrong generic type is not aggregatable, gets the wrong filter widget
        # and the wrong chart axis, so every row in the mapping needs an assertion.
        ("boolean", types.BOOLEAN, None, GenericDataType.BOOLEAN, False),
        # ``TinyInteger`` is the only genuinely custom numeric type here; it
        # subclasses ``Integer``, so this asserts the specific class, not the base.
        ("tinyint", TinyInteger, None, GenericDataType.NUMERIC, False),
        ("smallint", types.SmallInteger, None, GenericDataType.NUMERIC, False),
        ("bigint", types.BigInteger, None, GenericDataType.NUMERIC, False),
        # ``^real.*`` and ``^double.*`` both map to a bare ``FLOAT()``.
        ("real", types.FLOAT, None, GenericDataType.NUMERIC, False),
        ("double", types.FLOAT, None, GenericDataType.NUMERIC, False),
        # Precision and scale are DISCARDED: the mapping returns a bare
        # ``DECIMAL()`` regardless of what the native type declared. Pinned
        # deliberately — contrast ``varchar(255)`` above, where length survives.
        (
            "decimal(10,2)",
            types.DECIMAL,
            {"precision": None, "scale": None},
            GenericDataType.NUMERIC,
            False,
        ),
        ("varbinary", types.VARBINARY, None, GenericDataType.STRING, False),
        ("json", types.JSON, None, GenericDataType.STRING, False),
        ("date", types.Date, None, GenericDataType.TEMPORAL, True),
        ("interval year to month", Interval, None, GenericDataType.TEMPORAL, True),
        # Nested types keep their custom classes but are treated as STRING, which
        # is what lets the results grid render them at all.
        ("array(varchar)", Array, None, GenericDataType.STRING, False),
        ("map(varchar, integer)", Map, None, GenericDataType.STRING, False),
        ("row(a varchar, b integer)", Row, None, GenericDataType.STRING, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec as spec  # noqa: N813

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert (
        PrestoEngineSpec.get_schema_from_engine_params(
            make_url("presto://localhost:8080/hive/default"),
            {},
        )
        == "default"
    )

    assert (
        PrestoEngineSpec.get_schema_from_engine_params(
            make_url("presto://localhost:8080/hive"),
            {},
        )
        is None
    )


@mock.patch("superset.db_engine_specs.presto.PrestoEngineSpec.latest_partition")
@pytest.mark.parametrize(
    ["column_type", "column_value", "expected_value"],
    [
        ("DATE", "2023-05-01", "DATE '2023-05-01'"),
        ("TIMESTAMP", "2023-05-01", "TIMESTAMP '2023-05-01'"),
        ("VARCHAR", "2023-05-01", "'2023-05-01'"),
        ("INT", 1234, "1234"),
    ],
)
def test_where_latest_partition(
    mock_latest_partition,
    column_type: str,
    column_value: Any,
    expected_value: str,
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    mock_latest_partition.return_value = (["partition_key"], [column_value])

    assert (
        str(
            PrestoEngineSpec.where_latest_partition(  # type: ignore
                database=mock.MagicMock(),
                table=Table("table"),
                query=sql.select(text("* FROM table")),
                columns=[
                    {
                        "column_name": "partition_key",
                        "name": "partition_key",
                        "type": column_type,
                        "is_dttm": False,
                    }
                ],
            ).compile(
                dialect=PrestoDialect(),
                compile_kwargs={"literal_binds": True},
            )
        )
        == f"""SELECT * FROM table \nWHERE "partition_key" = {expected_value}"""  # noqa: S608
    )


def test_adjust_engine_params_fully_qualified() -> None:
    """
    Test the ``adjust_engine_params`` method when the URL has catalog and schema.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    url = make_url("presto://localhost:8080/hive/default")

    uri = PrestoEngineSpec.adjust_engine_params(url, {})[0]
    assert str(uri) == "presto://localhost:8080/hive/default"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        schema="new_schema",
    )[0]
    assert str(uri) == "presto://localhost:8080/hive/new_schema"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
    )[0]
    assert str(uri) == "presto://localhost:8080/new_catalog/default"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
        schema="new_schema",
    )[0]
    assert str(uri) == "presto://localhost:8080/new_catalog/new_schema"


def test_adjust_engine_params_catalog_only() -> None:
    """
    Test the ``adjust_engine_params`` method when the URL has only the catalog.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    url = make_url("presto://localhost:8080/hive")

    uri = PrestoEngineSpec.adjust_engine_params(url, {})[0]
    assert str(uri) == "presto://localhost:8080/hive"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        schema="new_schema",
    )[0]
    assert str(uri) == "presto://localhost:8080/hive/new_schema"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
    )[0]
    assert str(uri) == "presto://localhost:8080/new_catalog"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
        schema="new_schema",
    )[0]
    assert str(uri) == "presto://localhost:8080/new_catalog/new_schema"


def test_get_default_catalog() -> None:
    """
    Test the ``get_default_catalog`` method.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.models.core import Database

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="presto://localhost:8080/hive",
    )
    assert PrestoEngineSpec.get_default_catalog(database) == "hive"

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="presto://localhost:8080/hive/default",
    )
    assert PrestoEngineSpec.get_default_catalog(database) == "hive"


@pytest.mark.parametrize(
    "time_grain,expected_result",
    [
        ("PT1S", "date_trunc('second', CAST(col AS TIMESTAMP))"),
        (
            "PT5S",
            "date_trunc('second', CAST(col AS TIMESTAMP)) - interval '1' second * (second(CAST(col AS TIMESTAMP)) % 5)",  # noqa: E501
        ),
        (
            "PT30S",
            "date_trunc('second', CAST(col AS TIMESTAMP)) - interval '1' second * (second(CAST(col AS TIMESTAMP)) % 30)",  # noqa: E501
        ),
        ("PT1M", "date_trunc('minute', CAST(col AS TIMESTAMP))"),
        (
            "PT5M",
            "date_trunc('minute', CAST(col AS TIMESTAMP)) - interval '1' minute * (minute(CAST(col AS TIMESTAMP)) % 5)",  # noqa: E501
        ),
        (
            "PT10M",
            "date_trunc('minute', CAST(col AS TIMESTAMP)) - interval '1' minute * (minute(CAST(col AS TIMESTAMP)) % 10)",  # noqa: E501
        ),
        (
            "PT15M",
            "date_trunc('minute', CAST(col AS TIMESTAMP)) - interval '1' minute * (minute(CAST(col AS TIMESTAMP)) % 15)",  # noqa: E501
        ),
        (
            "PT0.5H",
            "date_trunc('minute', CAST(col AS TIMESTAMP)) - interval '1' minute * (minute(CAST(col AS TIMESTAMP)) % 30)",  # noqa: E501
        ),
        ("PT1H", "date_trunc('hour', CAST(col AS TIMESTAMP))"),
        (
            "PT6H",
            "date_trunc('hour', CAST(col AS TIMESTAMP)) - interval '1' hour * (hour(CAST(col AS TIMESTAMP)) % 6)",  # noqa: E501
        ),
        ("P1D", "date_trunc('day', CAST(col AS TIMESTAMP))"),
        ("P1W", "date_trunc('week', CAST(col AS TIMESTAMP))"),
        ("P1M", "date_trunc('month', CAST(col AS TIMESTAMP))"),
        ("P3M", "date_trunc('quarter', CAST(col AS TIMESTAMP))"),
        ("P1Y", "date_trunc('year', CAST(col AS TIMESTAMP))"),
        (
            "1969-12-28T00:00:00Z/P1W",
            "date_trunc('week', CAST(col AS TIMESTAMP) + interval '1' day) - interval '1' day",  # noqa: E501
        ),
        ("1969-12-29T00:00:00Z/P1W", "date_trunc('week', CAST(col AS TIMESTAMP))"),
        (
            "P1W/1970-01-03T00:00:00Z",
            "date_trunc('week', CAST(col AS TIMESTAMP) + interval '1' day) + interval '5' day",  # noqa: E501
        ),
        (
            "P1W/1970-01-04T00:00:00Z",
            "date_trunc('week', CAST(col AS TIMESTAMP)) + interval '6' day",
        ),
    ],
)
def test_timegrain_expressions(time_grain: str, expected_result: str) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec as spec  # noqa: N813

    actual = str(
        spec.get_timestamp_expr(col=column("col"), pdf=None, time_grain=time_grain)
    )
    assert actual == expected_result


def test_select_star(mocker: MockerFixture) -> None:
    """
    Test the ``select_star`` method.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec as spec  # noqa: N813

    database = mocker.MagicMock()
    dialect = mocker.MagicMock()

    def quote_table(table: Table, dialect: Dialect) -> str:
        return ".".join(
            part for part in (table.catalog, table.schema, table.table) if part
        )

    mocker.patch.object(spec, "quote_table", quote_table)

    spec.select_star(
        database=database,
        table=Table("my_table", "my_schema", "my_catalog"),
        dialect=dialect,
        limit=100,
        show_cols=False,
        indent=True,
        latest_partition=False,
        cols=None,
    )

    query = database.compile_sqla_query.mock_calls[0][1][0]
    assert (
        str(query)
        == """
SELECT * \nFROM my_catalog.my_schema.my_table
 LIMIT :param_1
    """.strip()
    )


def test_handle_boolean_filter() -> None:
    """
    Test that Presto uses equality operators for boolean filters instead of IS,
    since `col IS TRUE` can fail on computed boolean expressions like
    `(expiration = 1) AS expiration`.
    """
    from sqlalchemy import Boolean, Column

    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.utils.core import FilterOperator

    bool_col = Column("test_col", Boolean)

    result_true = PrestoEngineSpec.handle_boolean_filter(
        bool_col, FilterOperator.IS_TRUE, True
    )
    assert (
        str(result_true.compile(compile_kwargs={"literal_binds": True}))
        == "test_col = true"
    )

    result_false = PrestoEngineSpec.handle_boolean_filter(
        bool_col, FilterOperator.IS_FALSE, False
    )
    assert (
        str(result_false.compile(compile_kwargs={"literal_binds": True}))
        == "test_col = false"
    )

    # Regression: the original bug was on computed boolean columns like
    # `(expiration = 1) AS expiration`. Verify the equality operator also
    # compiles correctly when the "column" is a computed expression.
    from sqlalchemy import literal_column

    computed_col = literal_column("(expiration = 1)")
    result_computed = PrestoEngineSpec.handle_boolean_filter(
        computed_col, FilterOperator.IS_TRUE, True
    )
    assert (
        str(result_computed.compile(compile_kwargs={"literal_binds": True}))
        == "(expiration = 1) = true"
    )


def test_extract_errors_maps_401_to_access_denied() -> None:
    """
    Regression for #33554: Presto 401 errors must surface as
    CONNECTION_ACCESS_DENIED_ERROR rather than a raw GENERIC_DB_ENGINE_ERROR.

    pyhive raises "presto error: Unexpected status code 401 b'Unauthorized'"
    when the Presto server rejects the connection with HTTP 401. SQL Lab
    users see a cryptic raw error instead of an actionable "check your
    credentials" message.

    The custom_errors map has a pattern for "Access Denied: Invalid
    credentials" (PyHive LDAP auth path), but not for the HTTP 401
    status-code message that pyhive raises when the server rejects the
    initial request. Adding the pattern surfaces a user-readable error.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.errors import SupersetErrorType

    msg = "presto error: Unexpected status code 401 b'Unauthorized'"
    result = PrestoEngineSpec.extract_errors(Exception(msg))
    assert len(result) == 1
    assert result[0].error_type == SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR


@pytest.mark.parametrize(
    "raw_message,context,expected_error_type,expected_message",
    [
        pytest.param(
            "line 1:8: Column 'bar' cannot be resolved",
            {},
            "COLUMN_DOES_NOT_EXIST_ERROR",
            'We can\'t seem to resolve the column "bar" at line 1:8.',
            id="column_does_not_exist",
        ),
        pytest.param(
            "Table 'default.foo' does not exist",
            {},
            "TABLE_DOES_NOT_EXIST_ERROR",
            # The regex captures the surrounding single quotes, so the rendered
            # message doubles up the quoting. Pinned as-is: this is what a user
            # sees today, and changing it is a product decision, not a test fix.
            "The table \"'default.foo'\" does not exist. "
            "A valid table must be used to run this query.",
            id="table_does_not_exist",
        ),
        pytest.param(
            "line 1:15: Schema 'bar' does not exist",
            {},
            "SCHEMA_DOES_NOT_EXIST_ERROR",
            'The schema "bar" does not exist. '
            "A valid schema must be used to run this query.",
            id="schema_does_not_exist",
        ),
        pytest.param(
            "Access Denied: Invalid credentials",
            {"username": "bob"},
            "CONNECTION_ACCESS_DENIED_ERROR",
            'Either the username "bob" or the password is incorrect.',
            id="access_denied_invalid_credentials",
        ),
        pytest.param(
            "presto error: Unexpected status code 401 b'Unauthorized'",
            {},
            "CONNECTION_ACCESS_DENIED_ERROR",
            "Unexpected HTTP 401 response. Check your credentials.",
            id="access_denied_http_401",
        ),
        pytest.param(
            "Failed to establish a new connection: [Errno 8] nodename nor "
            "servname provided, or not known",
            {"hostname": "badhost"},
            "CONNECTION_INVALID_HOSTNAME_ERROR",
            'The hostname "badhost" cannot be resolved.',
            id="invalid_hostname",
        ),
        pytest.param(
            "Failed to establish a new connection: [Errno 60] Operation timed out",
            {"hostname": "myhost", "port": 8080},
            "CONNECTION_HOST_DOWN_ERROR",
            'The host "myhost" might be down, and can\'t be reached on port 8080.',
            id="host_down_operation_timed_out",
        ),
        pytest.param(
            "Failed to establish a new connection: [Errno 61] Connection refused",
            {"hostname": "myhost", "port": 8080},
            "CONNECTION_PORT_CLOSED_ERROR",
            'Port 8080 on hostname "myhost" refused the connection.',
            id="port_closed",
        ),
        pytest.param(
            "line 1:8: Catalog 'foo' does not exist",
            {},
            "CONNECTION_UNKNOWN_DATABASE_ERROR",
            'Unable to connect to catalog named "foo".',
            id="unknown_catalog",
        ),
    ],
)
def test_extract_errors_matches_all_custom_error_patterns(
    raw_message: str,
    context: dict[str, Any],
    expected_error_type: str,
    expected_message: str,
) -> None:
    """Story 105825: every pattern in ``PrestoEngineSpec.custom_errors`` maps a raw
    driver message to a typed, user-readable error.

    These nine regexes are the difference between an actionable message and a raw
    pyhive string in a red toast. Before this test only the HTTP 401 pattern was
    covered, so a typo in any of the other eight shipped silently — invisible until
    a user hit that exact error.

    ``context`` is not optional for the four patterns whose message templates
    reference placeholders their regex never captures; see
    ``test_extract_errors_raises_key_error_without_context``.

    Asserts ``error_type`` and the rendered message only — never whole-``extra``
    equality, because ``extract_errors`` mutates the class-level ``custom_errors``
    dicts in place (``base.py`` writes ``extra["engine_name"]``, and
    ``SupersetError.__post_init__`` adds ``issue_codes``), which makes any
    whole-dict assertion order-dependent.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.errors import ErrorLevel, SupersetErrorType

    result = PrestoEngineSpec.extract_errors(Exception(raw_message), context=context)

    assert len(result) == 1
    assert result[0].error_type == getattr(SupersetErrorType, expected_error_type)
    assert result[0].message == expected_message
    assert result[0].level == ErrorLevel.ERROR
    assert result[0].extra is not None
    assert result[0].extra["engine_name"] == "Presto"


@pytest.mark.parametrize(
    "raw_message,missing_placeholder",
    [
        pytest.param(
            "Access Denied: Invalid credentials", "username", id="access_denied"
        ),
        pytest.param(
            "Failed to establish a new connection: [Errno 8] nodename nor "
            "servname provided, or not known",
            "hostname",
            id="invalid_hostname",
        ),
        pytest.param(
            "Failed to establish a new connection: [Errno 60] Operation timed out",
            "hostname",
            id="host_down",
        ),
        pytest.param(
            "Failed to establish a new connection: [Errno 61] Connection refused",
            "port",
            id="port_closed",
        ),
    ],
)
def test_extract_errors_raises_key_error_without_context(
    raw_message: str,
    missing_placeholder: str,
) -> None:
    """Story 105825 — CHARACTERIZATION test, not an endorsement of this behaviour.

    Four of the nine patterns declare message placeholders their own regex never
    captures, so ``base.extract_errors`` builds ``params`` without them and the
    eager-``gettext`` ``str % dict`` raises ``KeyError``. Callers that omit
    ``context`` therefore get a ``KeyError`` instead of a typed Superset error.

    This is pinned as current behaviour so a future fix is a deliberate, visible
    change rather than an accident. If these connection errors should degrade
    gracefully instead — returning a typed error rather than raising — then
    this test inverts and the four patterns move into the matrix above with an
    empty context.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    with pytest.raises(KeyError, match=missing_placeholder):
        PrestoEngineSpec.extract_errors(Exception(raw_message))


def test_extract_errors_returns_first_matching_pattern() -> None:
    """Story 105825: ``extract_errors`` returns on the first matching regex.

    ``custom_errors`` is iterated in insertion order, after any
    ``CUSTOM_DATABASE_ERRORS`` config entries, and the loop returns as soon as one
    regex matches. A message satisfying two patterns therefore resolves to
    whichever is declared first — ``COLUMN_DOES_NOT_EXIST_REGEX`` here, not
    ``TABLE_DOES_NOT_EXIST_REGEX``. Pinning this makes reordering the dict a
    visible behaviour change rather than a silent one.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.errors import SupersetErrorType

    msg = "line 1:8: Table 'x' does not exist and Column 'bar' cannot be resolved"
    result = PrestoEngineSpec.extract_errors(Exception(msg))

    assert len(result) == 1
    assert result[0].error_type == SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR


def test_extract_errors_falls_back_to_generic_error() -> None:
    """Unit-suite mirror of presto_tests.py::test_extract_errors (L1020).

    A message matching none of the nine patterns falls through to
    ``GENERIC_DB_ENGINE_ERROR`` carrying the raw text. The integration original is
    intentionally retained; this mirror only removes the app/DB fixture requirement.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.errors import ErrorLevel, SupersetErrorType

    result = PrestoEngineSpec.extract_errors(Exception("Generic Error"))

    assert len(result) == 1
    assert result[0].error_type == SupersetErrorType.GENERIC_DB_ENGINE_ERROR
    assert result[0].message == "Generic Error"
    assert result[0].level == ErrorLevel.ERROR
    assert result[0].extra is not None
    assert result[0].extra["engine_name"] == "Presto"
    assert result[0].extra["issue_codes"] == [
        {
            "code": 1002,
            "message": "Issue 1002 - The database returned an unexpected error.",
        }
    ]


def test_extract_error_message_from_orig_database_error() -> None:
    """Unit-suite mirror of presto_tests.py::test_extract_error_message_orig (L998).

    Branch 1 of three: a SQLAlchemy wrapper exposing the driver error via ``.orig``,
    whose first element is Presto's error dict. Without this the user would see
    ``<object at 0x...>`` instead of the server's own diagnosis.
    """
    from collections import namedtuple

    from superset.db_engine_specs.presto import PrestoEngineSpec

    DatabaseError = namedtuple("DatabaseError", ["error_dict"])  # noqa: N806
    db_err = DatabaseError(
        {"errorName": "name", "errorLocation": "location", "message": "msg"}
    )
    exception = Exception()
    exception.orig = db_err  # type: ignore[attr-defined]

    assert PrestoEngineSpec._extract_error_message(exception) == "name at location: msg"


def test_extract_error_message_from_database_error_args() -> None:
    """Unit-suite mirror of
    presto_tests.py::test_extract_error_message_db_error (L1008).

    Branch 2 of three: pyhive raises ``DatabaseError`` with the error dict as its
    first arg.
    """
    from pyhive.exc import DatabaseError

    from superset.db_engine_specs.presto import PrestoEngineSpec

    exception = DatabaseError({"message": "Err message"})

    assert PrestoEngineSpec._extract_error_message(exception) == "Err message"


def test_extract_error_message_from_database_error_without_message() -> None:
    """Story 105825: a ``DatabaseError`` whose dict carries no ``message`` key
    degrades to a fixed string rather than raising.

    This is the "malformed error responses are handled gracefully" criterion — the
    one branch of ``_extract_error_message`` with no coverage in either suite.
    ``_`` is ``lazy_gettext``, so the return value is a ``LazyString`` and must be
    coerced before comparison.
    """
    from pyhive.exc import DatabaseError

    from superset.db_engine_specs.presto import PrestoEngineSpec

    exception = DatabaseError({"errorName": "SYNTAX_ERROR"})

    assert str(PrestoEngineSpec._extract_error_message(exception)) == (
        "Unknown Presto Error"
    )


def test_extract_error_message_from_general_exception() -> None:
    """Unit-suite mirror of
    presto_tests.py::test_extract_error_message_general_exception (L1015).

    Branch 3 of three: anything else falls back to
    ``utils.error_msg_from_exception``.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert (
        PrestoEngineSpec._extract_error_message(Exception("Err message"))
        == "Err message"
    )


def test_latest_sub_partition_rejects_unknown_field(
    mocker: MockerFixture,
) -> None:
    """Regression test for #41869.

    ``PrestoBaseEngineSpec.latest_sub_partition`` previously used a chained
    comparison (``k not in k in part_fields``) that Python evaluates as
    ``(k not in k) and (k in part_fields)``. Since ``k not in k`` is always
    ``False`` for strings, the guard was unreachable and unknown kwarg names
    were silently accepted, flowing into ``_partition_query`` and enabling
    SQL injection via the ``latest_sub_partition`` Jinja macro. This test
    locks in that unknown fields are now rejected before reaching the query
    builder.
    """
    from superset.db_engine_specs.presto import PrestoBaseEngineSpec
    from superset.exceptions import SupersetTemplateException

    database: mock.MagicMock = mocker.MagicMock()
    database.get_indexes.return_value = [{"column_names": ["ds", "event_type"]}]
    table: mock.MagicMock = mocker.MagicMock()
    with pytest.raises(SupersetTemplateException) as exc_info:
        PrestoBaseEngineSpec.latest_sub_partition(
            database,
            table,
            unknown_field="anything",
        )

    assert "unknown_field" in str(exc_info.value)
    assert "not part of the partitioning key" in str(exc_info.value)


def test_partition_query_escapes_single_quote_in_filter_value(
    mocker: MockerFixture,
) -> None:
    """Regression test for #41869.

    ``_partition_query`` previously interpolated filter values directly into
    the SQL ``WHERE`` clause with an f-string, allowing SQL injection via any
    caller that let user input reach ``filters``. Values must be escaped
    (single-quote doubling per SQL standard) so a ``'`` in the value cannot
    break out of the string literal.
    """
    from superset.db_engine_specs.presto import PrestoBaseEngineSpec

    database: mock.MagicMock = mocker.MagicMock()
    database.get_extra.return_value = {}
    table: Table = Table("my_table", "my_schema")

    injected: str = "2024-01-01' UNION SELECT secret FROM other_table--"
    sql: str = PrestoBaseEngineSpec._partition_query(
        table,
        indexes=[{"column_names": ["ds", "event_type"]}],
        database=database,
        filters={"ds": injected},
    )

    # The single quote in the value must be doubled so the injection stays
    # inside the SQL string literal — this is the whole payload wrapped in
    # ONE literal, escape sequence and all.
    assert "'2024-01-01'' UNION SELECT secret FROM other_table--'" in sql
    # The pre-escape form (single quote closing the literal early followed
    # by injected SQL) must NOT appear anywhere in the output — that would
    # mean the payload broke out of the literal.
    assert "'2024-01-01' UNION SELECT" not in sql


def test_mask_encrypted_extra() -> None:
    """
    The sensitive `auth_params` values are masked, while `auth_method` and
    non-sensitive fields such as `username` stay visible.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.utils import json

    config = json.dumps(
        {
            "auth_method": "basic",
            "auth_params": {"username": "alice", "password": "my-password"},
        }
    )

    assert PrestoEngineSpec.mask_encrypted_extra(config) == json.dumps(
        {
            "auth_method": "basic",
            "auth_params": {"username": "alice", "password": "XXXXXXXXXX"},
        }
    )


def test_mask_encrypted_extra_jwt_in_connect_args() -> None:
    """
    A JWT passed via `connect_args.requests_kwargs` is masked without touching
    the surrounding connection settings.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.utils import json

    config = json.dumps(
        {
            "connect_args": {
                "protocol": "https",
                "requests_kwargs": {"jwt": "my-secret-token"},
            },
        }
    )

    assert PrestoEngineSpec.mask_encrypted_extra(config) == json.dumps(
        {
            "connect_args": {
                "protocol": "https",
                "requests_kwargs": {"jwt": "XXXXXXXXXX"},
            },
        }
    )


def test_unmask_encrypted_extra() -> None:
    """
    Masked credentials are reused from the previous value; edited ones are kept.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.utils import json

    old = json.dumps({"auth_method": "jwt", "auth_params": {"token": "old-token"}})
    new = json.dumps({"auth_method": "jwt", "auth_params": {"token": "XXXXXXXXXX"}})

    assert PrestoEngineSpec.unmask_encrypted_extra(old, new) == json.dumps(
        {"auth_method": "jwt", "auth_params": {"token": "old-token"}}
    )
