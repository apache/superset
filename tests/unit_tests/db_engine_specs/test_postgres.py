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

from datetime import datetime, timedelta
from typing import Any, Optional
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import column, types
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import DOUBLE_PRECISION, ENUM, INTERVAL, JSON
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.engine.url import make_url

from superset.db_engine_specs.postgres import (
    _check_not_redshift,
    PostgresEngineSpec as spec,  # noqa: N813
)
from superset.errors import SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.sql.parse import Table
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "unit",
    [
        "SECOND",
        "MINUTE",
        "HOUR",
        "DAY",
        "WEEK",
        "MONTH",
        "QUARTER",
        "YEAR",
        "quarter",
        "QuArTeR",
    ],
)
def test_normalize_custom_sql_metric_date_trunc_unit(unit: str) -> None:
    """DATE_TRUNC unit casing matches PostgreSQL time-grain templates."""
    expression: str = (
        f"CASE WHEN DATE_TRUNC('{unit}', created_at) = '2024-01-01' "
        "THEN COUNT(*) / 1000 END"
    )

    assert spec.normalize_custom_sql_metric(expression) == (
        f"CASE WHEN DATE_TRUNC('{unit.lower()}', created_at) = '2024-01-01' "
        "THEN COUNT(*) / 1000 END"
    )


@pytest.mark.parametrize(
    "expression",
    [
        "'QUARTER'",
        "OTHER_DATE_TRUNC('QUARTER', created_at)",
        "custom.DATE_TRUNC('QUARTER', created_at)",
        "DATE_TRUNC(grain, created_at)",
        "DATE_TRUNC('FISCAL_QUARTER', created_at)",
        'DATE_TRUNC("QUARTER", created_at)',
        "'DATE_TRUNC(''QUARTER'', created_at)'",
    ],
)
def test_normalize_custom_sql_metric_does_not_rewrite_unrelated_sql(
    expression: str,
) -> None:
    assert spec.normalize_custom_sql_metric(expression) == expression


def test_normalize_custom_sql_metric_preserves_source_around_multiple_calls() -> None:
    expression: str = (
        "/* lead */ CASE WHEN DATE_TRUNC('QUARTER', created_at) = start_date\n"
        "THEN DATE_TRUNC('MONTH', created_at) END /* tail */"
    )

    assert spec.normalize_custom_sql_metric(expression) == (
        "/* lead */ CASE WHEN DATE_TRUNC('quarter', created_at) = start_date\n"
        "THEN DATE_TRUNC('month', created_at) END /* tail */"
    )


def test_normalize_custom_sql_metric_normalizes_pg_catalog_date_trunc() -> None:
    expression: str = "pg_catalog.DATE_TRUNC('QUARTER', created_at)"

    assert spec.normalize_custom_sql_metric(expression) == (
        "pg_catalog.DATE_TRUNC('quarter', created_at)"
    )


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "TO_DATE('2019-01-02', 'YYYY-MM-DD')"),
        (
            "DateTime",
            "TO_TIMESTAMP('2019-01-02 03:04:05.678900', 'YYYY-MM-DD HH24:MI:SS.US')",
        ),
        (
            "TimeStamp",
            "TO_TIMESTAMP('2019-01-02 03:04:05.678900', 'YYYY-MM-DD HH24:MI:SS.US')",
        ),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        ("SMALLINT", types.SmallInteger, None, GenericDataType.NUMERIC, False),
        ("INTEGER", types.Integer, None, GenericDataType.NUMERIC, False),
        ("BIGINT", types.BigInteger, None, GenericDataType.NUMERIC, False),
        ("DECIMAL", types.Numeric, None, GenericDataType.NUMERIC, False),
        ("NUMERIC", types.Numeric, None, GenericDataType.NUMERIC, False),
        ("REAL", types.REAL, None, GenericDataType.NUMERIC, False),
        ("DOUBLE PRECISION", DOUBLE_PRECISION, None, GenericDataType.NUMERIC, False),
        ("MONEY", types.Numeric, None, GenericDataType.NUMERIC, False),
        # String
        ("CHAR", types.String, None, GenericDataType.STRING, False),
        ("VARCHAR", types.String, None, GenericDataType.STRING, False),
        ("TEXT", types.String, None, GenericDataType.STRING, False),
        ("ARRAY", types.String, None, GenericDataType.STRING, False),
        ("ENUM", ENUM, None, GenericDataType.STRING, False),
        ("JSON", JSON, None, GenericDataType.STRING, False),
        # Temporal
        ("DATE", types.Date, None, GenericDataType.TEMPORAL, True),
        ("TIMESTAMP", types.TIMESTAMP, None, GenericDataType.TEMPORAL, True),
        ("TIME", types.Time, None, GenericDataType.TEMPORAL, True),
        # Boolean
        ("BOOLEAN", types.Boolean, None, GenericDataType.BOOLEAN, False),
        # Interval (mapped to NUMERIC for chart rendering)
        ("INTERVAL", INTERVAL, None, GenericDataType.NUMERIC, False),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """

    assert (
        spec.get_schema_from_engine_params(
            make_url("postgresql://user:password@host/db1"), {}
        )
        is None
    )

    assert (
        spec.get_schema_from_engine_params(
            make_url("postgresql://user:password@host/db1"),
            {"options": "-csearch_path=secret"},
        )
        == "secret"
    )

    assert (
        spec.get_schema_from_engine_params(
            make_url("postgresql://user:password@host/db1"),
            {"options": "-c search_path = secret -cfoo=bar -c debug"},
        )
        == "secret"
    )

    with pytest.raises(Exception) as excinfo:  # noqa: PT011
        spec.get_schema_from_engine_params(
            make_url("postgresql://user:password@host/db1"),
            {"options": "-csearch_path=secret,public"},
        )
    assert str(excinfo.value) == (
        "Multiple schemas are configured in the search path, which means "
        "Superset is unable to determine the schema of unqualified table "
        "names and enforce permissions."
    )


def test_get_prequeries(mocker: MockerFixture) -> None:
    """
    Test the ``get_prequeries`` method.
    """
    database = mocker.MagicMock()

    assert spec.get_prequeries(database) == []
    assert spec.get_prequeries(database, schema="test") == ['set search_path = "test"']
    assert spec.get_prequeries(database, schema='evil"; SELECT 1--') == [
        'set search_path = "evil""; SELECT 1--"'
    ]


def test_get_default_schema_for_query(mocker: MockerFixture) -> None:
    """
    Test the ``get_default_schema_for_query`` method.
    """

    database = mocker.MagicMock()
    query = mocker.MagicMock()

    query.sql = "SELECT * FROM some_table"
    query.schema = "foo"
    assert spec.get_default_schema_for_query(database, query) == "foo"

    query.sql = """
set
-- this is a tricky comment
search_path -- another one
= bar;
SELECT * FROM some_table;
    """
    with pytest.raises(SupersetSecurityException) as excinfo:
        spec.get_default_schema_for_query(database, query)
    assert (
        str(excinfo.value)
        == "Users are not allowed to set a search path for security reasons."
    )


def test_get_default_schema_for_query_set_config(mocker: MockerFixture) -> None:
    """
    A ``set_config('search_path', ...)`` call rebinds unqualified-name
    resolution on the shared cursor just like ``SET search_path``, so it
    must be rejected too.
    """
    database = mocker.MagicMock()
    query = mocker.MagicMock()
    query.schema = "foo"
    query.sql = (
        "SELECT set_config('search_path', 'tenant_b', false); SELECT * FROM orders"
    )

    with pytest.raises(SupersetSecurityException) as excinfo:
        spec.get_default_schema_for_query(database, query)
    assert (
        str(excinfo.value)
        == "Users are not allowed to set a search path for security reasons."
    )


def test_adjust_engine_params() -> None:
    """
    Test `adjust_engine_params`.

    The method can be used to adjust the catalog (database) dynamically.
    """

    adjusted = spec.adjust_engine_params(
        make_url("postgresql://user:password@host:5432/dev"),
        {},
        catalog="prod",
    )
    assert adjusted == (make_url("postgresql://user:password@host:5432/prod"), {})


def test_get_default_catalog() -> None:
    """
    Test `get_default_catalog`.
    """
    from superset.models.core import Database

    database = Database(
        database_name="postgres",
        sqlalchemy_uri="postgresql://user:password@host:5432/dev",
    )
    assert spec.get_default_catalog(database) == "dev"


@pytest.mark.parametrize(
    "time_grain,expected_result",
    [
        ("PT1S", "DATE_TRUNC('second', col)"),
        (
            "PT5S",
            "DATE_TRUNC('minute', col) + INTERVAL '5 seconds' * FLOOR(EXTRACT(SECOND FROM col) / 5)",  # noqa: E501
        ),
        (
            "PT30S",
            "DATE_TRUNC('minute', col) + INTERVAL '30 seconds' * FLOOR(EXTRACT(SECOND FROM col) / 30)",  # noqa: E501
        ),
        ("PT1M", "DATE_TRUNC('minute', col)"),
        (
            "PT5M",
            "DATE_TRUNC('hour', col) + INTERVAL '5 minutes' * FLOOR(EXTRACT(MINUTE FROM col) / 5)",  # noqa: E501
        ),
        (
            "PT10M",
            "DATE_TRUNC('hour', col) + INTERVAL '10 minutes' * FLOOR(EXTRACT(MINUTE FROM col) / 10)",  # noqa: E501
        ),
        (
            "PT15M",
            "DATE_TRUNC('hour', col) + INTERVAL '15 minutes' * FLOOR(EXTRACT(MINUTE FROM col) / 15)",  # noqa: E501
        ),
        (
            "PT30M",
            "DATE_TRUNC('hour', col) + INTERVAL '30 minutes' * FLOOR(EXTRACT(MINUTE FROM col) / 30)",  # noqa: E501
        ),
        ("PT1H", "DATE_TRUNC('hour', col)"),
        ("P1D", "DATE_TRUNC('day', col)"),
        ("P1W", "DATE_TRUNC('week', col)"),
        ("P1M", "DATE_TRUNC('month', col)"),
        ("P3M", "DATE_TRUNC('quarter', col)"),
        ("P1Y", "DATE_TRUNC('year', col)"),
    ],
)
def test_timegrain_expressions(time_grain: str, expected_result: str) -> None:
    """
    DB Eng Specs (postgres): Test time grain expressions
    """
    actual = str(
        spec.get_timestamp_expr(col=column("col"), pdf=None, time_grain=time_grain)
    )
    assert actual == expected_result


def test_select_star(mocker: MockerFixture) -> None:
    """
    Test the ``select_star`` method.
    """
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
SELECT * \nFROM my_schema.my_table
 LIMIT :param_1
    """.strip()
    )


class TestRedshiftDetection:
    """
    Tests for detecting Redshift connections via the PostgreSQL dialect.
    """

    def test_check_not_redshift_detects_redshift(self) -> None:
        """
        Pool connect event raises for a Redshift version string.
        """
        cursor = MagicMock()
        cursor.fetchone.return_value = (
            "PostgreSQL 8.0.2 on i686-pc-linux-gnu, compiled by GCC gcc (GCC) "
            "3.4.2 20041017 (Red Hat 3.4.2-6.fc3), Redshift 1.0.77467",
        )
        dbapi_conn = MagicMock()
        dbapi_conn.cursor.return_value = cursor

        with pytest.raises(ValueError, match="Redshift"):
            _check_not_redshift(dbapi_conn, None)

    def test_check_not_redshift_allows_postgres(self) -> None:
        """
        Pool connect event allows a regular PostgreSQL version string.
        """
        cursor = MagicMock()
        cursor.fetchone.return_value = (
            "PostgreSQL 15.2 on x86_64-pc-linux-gnu, compiled by gcc",
        )
        dbapi_conn = MagicMock()
        dbapi_conn.cursor.return_value = cursor

        _check_not_redshift(dbapi_conn, None)  # should not raise

    def test_check_not_redshift_fails_open(self) -> None:
        """
        If SELECT version() errors, the connection is still allowed.
        """
        cursor = MagicMock()
        cursor.execute.side_effect = Exception("permission denied")
        dbapi_conn = MagicMock()
        dbapi_conn.cursor.return_value = cursor

        _check_not_redshift(dbapi_conn, None)  # should not raise

    def test_mutate_db_sets_flag(self) -> None:
        """
        mutate_db_for_connection_test sets the check flag.
        """
        database = MagicMock()
        spec.mutate_db_for_connection_test(database)
        assert database._check_redshift_version is True

    def test_pool_event_injected_when_flag_set(self, mocker: MockerFixture) -> None:
        """
        Pool event is added during test_connection.
        """
        database = mocker.MagicMock(
            encrypted_extra=None,
            _check_redshift_version=True,
        )
        params: dict[str, Any] = {}
        spec.update_params_from_encrypted_extra(database, params)

        assert "pool_events" in params
        fns = [fn for fn, _ in params["pool_events"]]
        assert _check_not_redshift in fns

    def test_pool_event_not_injected_without_flag(self, mocker: MockerFixture) -> None:
        """
        Pool event is NOT added during normal operation.
        """
        database = mocker.MagicMock(encrypted_extra=None)
        database._check_redshift_version = False
        params: dict[str, Any] = {}
        spec.update_params_from_encrypted_extra(database, params)

        assert "pool_events" not in params


def _compile(expr: Any) -> str:
    return str(expr.compile(None, dialect=postgresql.dialect()))


def test_get_timestamp_expr_date_column_casts_back_to_date() -> None:
    """
    DB Eng Specs (postgres): a time grain on a pure DATE column casts the
    ``DATE_TRUNC`` result back to DATE to avoid timezone-driven date shifts.

    See https://github.com/apache/superset/issues/42254.
    """
    col = column("event_date", type_=types.Date())
    expr = spec.get_timestamp_expr(col, None, "P1D")
    assert _compile(expr) == "CAST(DATE_TRUNC('day', event_date) AS DATE)"


def test_get_timestamp_expr_datetime_column_not_cast() -> None:
    """
    DB Eng Specs (postgres): DATETIME/TIMESTAMP columns keep their timestamp
    semantics and are not cast back to DATE.
    """
    col = column("event_ts", type_=types.DateTime())
    expr = spec.get_timestamp_expr(col, None, "P1D")
    assert _compile(expr) == "DATE_TRUNC('day', event_ts)"


def test_get_timestamp_expr_date_column_without_grain_not_cast() -> None:
    """
    DB Eng Specs (postgres): without a time grain there is no DATE_TRUNC, so the
    column is left untouched.
    """
    col = column("event_date", type_=types.Date())
    expr = spec.get_timestamp_expr(col, None, None)
    assert _compile(expr) == "event_date"


def test_get_timestamp_expr_untyped_column_not_cast() -> None:
    """
    DB Eng Specs (postgres): columns without a known type (e.g. raw expressions)
    are not cast to DATE.
    """
    col = column("some_expr")
    expr = spec.get_timestamp_expr(col, None, "P1Y")
    assert _compile(expr) == "DATE_TRUNC('year', some_expr)"


def test_interval_type_mutator() -> None:
    """
    DB Eng Specs (postgres): Test INTERVAL type mutator

    INTERVAL values are converted to milliseconds so users can apply
    the built-in "DURATION" number format for human-readable display.
    """
    mutator = spec.column_type_mutators[INTERVAL]

    # Timedelta conversion — the only path psycopg2/psycopg3 actually
    # exercises. Result is in milliseconds for compatibility with the
    # DURATION formatter.
    td = timedelta(days=1, hours=2, minutes=30, seconds=45)
    assert mutator(td) == 95445000.0  # (1*86400 + 2*3600 + 30*60 + 45) * 1000

    # Zero duration
    assert mutator(timedelta(0)) == 0.0

    # Negative interval
    assert mutator(timedelta(days=-1)) == -86400000.0

    # None preserves NULL semantics (not converted to 0)
    assert mutator(None) is None

    # Unexpected non-timedelta types fall through to the defensive
    # `return None` (and emit a warning) rather than producing a
    # mixed-type column.
    assert mutator("1 day 02:30:45") is None
    assert mutator("P1DT2H30M45S") is None
    assert mutator(12345) is None
    assert mutator(True) is None
    assert mutator([1, 2, 3]) is None
    assert mutator({"days": 1}) is None


def test_get_schema_names_excludes_only_actual_system_schemas(
    mocker: MockerFixture,
) -> None:
    """
    DB Eng Specs (postgres): Test ``get_schema_names``

    User-defined schemas that merely start with ``pg`` (but are not
    actual Postgres system schemas, which always start with the literal
    ``pg_``) must not be filtered out. See issue #30678.
    """
    inspector = mocker.MagicMock()
    inspector.engine.connect().__enter__().execute.return_value = [
        ("public",),
        ("pgsql",),
        ("pgstats",),
        ("pg_catalog",),
        ("pg_toast",),
        ("information_schema",),
    ]

    schemas = spec.get_schema_names(inspector)

    assert schemas == {
        "public",
        "pgsql",
        "pgstats",
        "information_schema",
    }


def _basic_parameters(**overrides: Any) -> dict[str, Any]:
    parameters: dict[str, Any] = {
        "username": "user",
        "password": "pwd",
        "host": "localhost",
        "port": 5432,
        "database": "db",
        "query": {},
    }
    parameters.update(overrides)
    return parameters


def test_build_sqlalchemy_uri_defaults_missing_port_to_5432() -> None:
    """
    DB Eng Specs (postgres): ``build_sqlalchemy_uri`` defaults a missing
    ``port`` key to the class's own declared default (5432) instead of
    raising a ``KeyError``, so the dynamic form can connect without a port.
    """
    parameters = _basic_parameters()
    del parameters["port"]

    uri = spec.build_sqlalchemy_uri(parameters)  # type: ignore[arg-type]

    assert make_url(uri).port == 5432
    assert spec.metadata["default_port"] == 5432


def test_build_sqlalchemy_uri_defaults_blank_port_to_5432() -> None:
    """
    DB Eng Specs (postgres): ``build_sqlalchemy_uri`` defaults a blank
    (``None``) ``port`` value to 5432 rather than emitting ``port=None``.
    """
    parameters = _basic_parameters(port=None)

    uri = spec.build_sqlalchemy_uri(parameters)  # type: ignore[arg-type]

    assert make_url(uri).port == 5432


def test_build_sqlalchemy_uri_respects_explicit_port() -> None:
    """
    DB Eng Specs (postgres): an explicitly provided port is still honored
    and not overridden by the default.
    """
    parameters = _basic_parameters(port=5433)

    uri = spec.build_sqlalchemy_uri(parameters)  # type: ignore[arg-type]

    assert make_url(uri).port == 5433


def test_build_sqlalchemy_uri_preserves_explicit_port_zero() -> None:
    """
    DB Eng Specs (postgres): an explicitly supplied port of ``0`` (a value
    the schema's ``Range(min=0, ...)`` validator accepts) must not be
    silently overwritten by the default port. A truthiness check like
    ``port or default`` would incorrectly replace ``0`` with 5432.
    """
    parameters = _basic_parameters(port=0)

    uri = spec.build_sqlalchemy_uri(parameters)  # type: ignore[arg-type]

    assert make_url(uri).port == 0


def test_build_sqlalchemy_uri_defaults_empty_string_port_to_5432() -> None:
    """
    DB Eng Specs (postgres): ``build_sqlalchemy_uri`` may be called directly
    with raw, non-schema-loaded parameters (see
    ``ValidateDatabaseParametersCommand``), where a cleared number input
    submits ``""`` rather than ``null``. That must default to 5432 rather
    than raising when SQLAlchemy tries to parse ``""`` as a port.
    """
    parameters = _basic_parameters(port="")

    uri = spec.build_sqlalchemy_uri(parameters)  # type: ignore[arg-type]

    assert make_url(uri).port == 5432


def test_parameters_schema_blank_port_string_loads_as_none() -> None:
    """
    DB Eng Specs (postgres): the Connect Database form's Port field is a
    number input; clearing it submits ``""`` (HTML input values are always
    strings), not ``null``. The schema must normalize that to ``None``
    instead of rejecting it with "Not a valid integer.", so the dynamic
    form's CONNECT flow (which loads through ``parameters_schema`` before
    calling ``build_sqlalchemy_uri``) succeeds with a blank port.
    """
    loaded = spec.parameters_schema.load(_basic_parameters(port=""))

    assert loaded["port"] is None


def test_validate_parameters_blank_port_is_not_a_missing_parameter(
    mocker: MockerFixture,
) -> None:
    """
    DB Eng Specs (postgres): a blank/missing ``port`` must not trigger
    ``CONNECTION_MISSING_PARAMETERS_ERROR``, since ``build_sqlalchemy_uri``
    falls back to the default Postgres port.
    """
    mocker.patch("superset.db_engine_specs.base.is_hostname_valid", return_value=True)

    properties = {"parameters": _basic_parameters(port=None)}
    errors = spec.validate_parameters(properties)  # type: ignore[arg-type]

    for error in errors:
        assert "port" not in (error.extra or {}).get("missing", [])
        assert error.error_type != SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR


def test_validate_parameters_missing_host_still_errors(
    mocker: MockerFixture,
) -> None:
    """
    DB Eng Specs (postgres): omitting ``host`` still reports it as missing;
    only ``port`` was made optional.
    """
    properties = {"parameters": _basic_parameters(host="", port=None)}
    errors = spec.validate_parameters(properties)  # type: ignore[arg-type]

    assert len(errors) == 1
    assert errors[0].error_type == SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR
    assert (errors[0].extra or {})["missing"] == ["host"]


def test_validate_parameters_missing_other_required_field_still_errors(
    mocker: MockerFixture,
) -> None:
    """
    DB Eng Specs (postgres): omitting a still-required field (``database``)
    continues to be reported, even though ``port`` is blank too.
    """
    mocker.patch("superset.db_engine_specs.base.is_hostname_valid", return_value=True)

    properties = {"parameters": _basic_parameters(database="", port=None)}
    errors = spec.validate_parameters(properties)  # type: ignore[arg-type]

    missing_errors = [
        error
        for error in errors
        if error.error_type == SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR
    ]
    assert len(missing_errors) == 1
    assert (missing_errors[0].extra or {})["missing"] == ["database"]


def test_validate_parameters_explicit_valid_port_checks_open(
    mocker: MockerFixture,
) -> None:
    """
    DB Eng Specs (postgres): when a port IS supplied, format/range/open
    validation is preserved unchanged.
    """
    mocker.patch("superset.db_engine_specs.base.is_hostname_valid", return_value=True)
    is_port_open = mocker.patch(
        "superset.db_engine_specs.base.is_port_open", return_value=True
    )

    properties = {"parameters": _basic_parameters(port=5432)}
    errors = spec.validate_parameters(properties)  # type: ignore[arg-type]

    assert errors == []
    is_port_open.assert_called_once_with("localhost", 5432)


def test_validate_parameters_invalid_port_still_errors(
    mocker: MockerFixture,
) -> None:
    """
    DB Eng Specs (postgres): an out-of-range port supplied by the user
    still produces ``CONNECTION_INVALID_PORT_ERROR``, exactly as before.
    """
    mocker.patch("superset.db_engine_specs.base.is_hostname_valid", return_value=True)

    properties = {"parameters": _basic_parameters(port=70000)}
    errors = spec.validate_parameters(properties)  # type: ignore[arg-type]

    assert len(errors) == 1
    assert errors[0].error_type == SupersetErrorType.CONNECTION_INVALID_PORT_ERROR


def test_validate_parameters_explicit_zero_port_is_validated(
    mocker: MockerFixture,
) -> None:
    """
    DB Eng Specs (postgres): an explicit ``port=0`` must not be silently
    treated as blank. ``0`` is falsy in Python, so a naive ``if not port``
    short-circuit (the base method's original bug, inherited by Postgres)
    would skip the int/range/``is_port_open`` checks entirely for a real,
    explicitly-supplied port value of ``0`` -- which the schema's own
    ``Range(min=0, ...)`` validator accepts as valid. This confirms
    ``is_port_open`` is actually called (i.e. validation ran) for ``port=0``.
    """
    mocker.patch("superset.db_engine_specs.base.is_hostname_valid", return_value=True)
    is_port_open = mocker.patch(
        "superset.db_engine_specs.base.is_port_open", return_value=True
    )

    properties = {"parameters": _basic_parameters(port=0)}
    errors = spec.validate_parameters(properties)  # type: ignore[arg-type]

    is_port_open.assert_called_once_with("localhost", 0)
    assert errors == []


def test_validate_parameters_explicit_zero_port_reports_closed(
    mocker: MockerFixture,
) -> None:
    """
    DB Eng Specs (postgres): the other side of the ``port=0`` fix above --
    when the (now-actually-run) open-port check for an explicit ``port=0``
    fails, ``CONNECTION_PORT_CLOSED_ERROR`` is reported like it would be for
    any other supplied port.
    """
    mocker.patch("superset.db_engine_specs.base.is_hostname_valid", return_value=True)
    is_port_open = mocker.patch(
        "superset.db_engine_specs.base.is_port_open", return_value=False
    )

    properties = {"parameters": _basic_parameters(port=0)}
    errors = spec.validate_parameters(properties)  # type: ignore[arg-type]

    is_port_open.assert_called_once_with("localhost", 0)
    assert len(errors) == 1
    assert errors[0].error_type == SupersetErrorType.CONNECTION_PORT_CLOSED_ERROR


@pytest.mark.parametrize("blank_port", [None, ""])
def test_validate_parameters_blank_port_never_calls_is_port_open(
    blank_port: Optional[str],
    mocker: MockerFixture,
) -> None:
    """
    DB Eng Specs (postgres): regression lock for the blank-port UX this
    whole ticket exists to fix -- ``None`` (an omitted/null port) and ``""``
    (what a cleared HTML number input submits) must both keep
    short-circuiting ``validate_parameters`` with zero errors *before* any
    port validation runs, and must not be conflated with the ``port=0`` fix
    above: ``is_port_open`` must never be called for either blank form.
    """
    mocker.patch("superset.db_engine_specs.base.is_hostname_valid", return_value=True)
    is_port_open = mocker.patch("superset.db_engine_specs.base.is_port_open")

    properties = {"parameters": _basic_parameters(port=blank_port)}
    errors = spec.validate_parameters(properties)  # type: ignore[arg-type]

    assert errors == []
    is_port_open.assert_not_called()


def test_validate_parameters_non_integer_port_matches_base_parity(
    mocker: MockerFixture,
) -> None:
    """
    DB Eng Specs (postgres): a non-integer port must produce BOTH errors
    that ``BasicParametersMixin.validate_parameters`` produces -- the
    "Port must be a valid integer." error from the failed ``int()``
    conversion, AND the "must be an integer between 0 and 65535" range
    error, since the base method does not return early after the former
    and falls through to the range check (which is also False for a
    non-int value). ``PostgresEngineSpec`` inherits ``validate_parameters``
    directly from the base (it only overrides ``required_parameters``), so
    this guards that the inherited behavior keeps producing both errors.
    """
    mocker.patch("superset.db_engine_specs.base.is_hostname_valid", return_value=True)

    properties = {"parameters": _basic_parameters(port="not-a-port")}
    errors = spec.validate_parameters(properties)  # type: ignore[arg-type]

    assert len(errors) == 2
    assert errors[0].message == "Port must be a valid integer."
    assert errors[0].error_type == SupersetErrorType.CONNECTION_INVALID_PORT_ERROR
    assert (
        errors[1].message
        == "The port must be an integer between 0 and 65535 (inclusive)."
    )
    assert errors[1].error_type == SupersetErrorType.CONNECTION_INVALID_PORT_ERROR


def test_parameters_schema_port_is_not_required() -> None:
    """
    DB Eng Specs (postgres): the JSON schema exposed to the frontend for the
    Connect Database dynamic form must not mark ``port`` as required, so the
    modal doesn't block client-side submission when the field is left blank.
    """
    json_schema = spec.parameters_json_schema()

    assert "port" not in json_schema.get("required", [])
    assert "host" in json_schema.get("required", [])
    assert "database" in json_schema.get("required", [])


@pytest.mark.parametrize(
    ("aggregate", "expected_sql"),
    [
        ("MEDIAN", "percentile_cont(0.5) WITHIN GROUP (ORDER BY sales)"),
        ("STDDEV_SAMP", "stddev_samp(sales)"),
        ("VAR_SAMP", "var_samp(sales)"),
    ],
)
def test_extended_aggregation_func_compiles_expected_sql(
    aggregate: str, expected_sql: str
) -> None:
    """
    Verified against a live postgres:16 instance (including under GROUPING
    SETS): these expressions compute the correct database-wide statistic, not
    an aggregate-of-per-group-aggregates.
    """
    func = spec.get_extended_aggregation_func(aggregate)
    assert func is not None

    compiled = str(
        func(column("sales")).compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    )
    assert compiled == expected_sql
