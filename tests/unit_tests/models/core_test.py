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

# pylint: disable=import-outside-toplevel
from datetime import datetime
from typing import Any, Callable

import numpy
import pandas as pd
import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy import (
    Column,
    Integer,
    MetaData,
    select,
    Table as SqlalchemyTable,
)
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import Select

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.errors import SupersetErrorType
from superset.exceptions import OAuth2Error, OAuth2RedirectError
from superset.models.core import Database
from superset.sql.parse import LimitMethod, Table
from superset.utils import json
from tests.unit_tests.conftest import with_feature_flags

# sample config for OAuth2 tests
oauth2_client_info = {
    "oauth2_client_info": {
        "id": "my_client_id",
        "secret": "my_client_secret",
        "authorization_request_uri": "https://abcd1234.snowflakecomputing.com/oauth/authorize",
        "token_request_uri": "https://abcd1234.snowflakecomputing.com/oauth/token-request",
        "scope": "refresh_token session:role:USERADMIN",
    }
}


@pytest.fixture
def query() -> Select:
    """
    A nested query fixture used to test query optimization.
    """
    metadata = MetaData()
    some_table = SqlalchemyTable(
        "some_table",
        metadata,
        Column("a", Integer),
        Column("b", Integer),
        Column("c", Integer),
    )

    inner_select = select(some_table.c.a, some_table.c.b, some_table.c.c)
    outer_select = select(inner_select.c.a, inner_select.c.b).where(
        inner_select.c.a > 1,
        inner_select.c.b == 2,
    )

    return outer_select


def test_get_metrics(mocker: MockerFixture) -> None:
    """
    Tests for ``get_metrics``.
    """
    from superset.db_engine_specs.base import MetricType
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.core import Database

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    assert database.get_metrics(Table("table")) == [
        {
            "expression": "COUNT(*)",
            "metric_name": "count",
            "metric_type": "count",
            "verbose_name": "COUNT(*)",
        }
    ]

    class CustomSqliteEngineSpec(SqliteEngineSpec):
        @classmethod
        def get_metrics(
            cls,
            database: Database,
            inspector: Inspector,
            table: Table,
        ) -> list[MetricType]:
            return [
                {
                    "expression": "COUNT(DISTINCT user_id)",
                    "metric_name": "count_distinct_user_id",
                    "metric_type": "count_distinct",
                    "verbose_name": "COUNT(DISTINCT user_id)",
                },
            ]

    database.get_db_engine_spec = mocker.MagicMock(return_value=CustomSqliteEngineSpec)
    assert database.get_metrics(Table("table")) == [
        {
            "expression": "COUNT(DISTINCT user_id)",
            "metric_name": "count_distinct_user_id",
            "metric_type": "count_distinct",
            "verbose_name": "COUNT(DISTINCT user_id)",
        },
    ]


def test_get_db_engine_spec(mocker: MockerFixture) -> None:
    """
    Tests for ``get_db_engine_spec``.
    """
    from superset.db_engine_specs import BaseEngineSpec
    from superset.models.core import Database

    # pylint: disable=abstract-method
    class PostgresDBEngineSpec(BaseEngineSpec):
        """
        A DB engine spec with drivers and a default driver.
        """

        engine = "postgresql"
        engine_aliases = {"postgres"}
        drivers = {
            "psycopg2": "The default Postgres driver",
            "asyncpg": "An async Postgres driver",
        }
        default_driver = "psycopg2"

    # pylint: disable=abstract-method
    class OldDBEngineSpec(BaseEngineSpec):
        """
        And old DB engine spec without drivers nor a default driver.
        """

        engine = "mysql"

    load_engine_specs = mocker.patch("superset.db_engine_specs.load_engine_specs")
    load_engine_specs.return_value = [
        PostgresDBEngineSpec,
        OldDBEngineSpec,
    ]

    assert (
        Database(database_name="db", sqlalchemy_uri="postgresql://").db_engine_spec
        == PostgresDBEngineSpec
    )
    assert (
        Database(
            database_name="db", sqlalchemy_uri="postgresql+psycopg2://"
        ).db_engine_spec
        == PostgresDBEngineSpec
    )
    assert (
        Database(
            database_name="db", sqlalchemy_uri="postgresql+asyncpg://"
        ).db_engine_spec
        == PostgresDBEngineSpec
    )
    assert (
        Database(
            database_name="db", sqlalchemy_uri="postgresql+fancynewdriver://"
        ).db_engine_spec
        == PostgresDBEngineSpec
    )
    assert (
        Database(database_name="db", sqlalchemy_uri="mysql://").db_engine_spec
        == OldDBEngineSpec
    )
    assert (
        Database(
            database_name="db", sqlalchemy_uri="mysql+mysqlconnector://"
        ).db_engine_spec
        == OldDBEngineSpec
    )
    assert (
        Database(
            database_name="db", sqlalchemy_uri="mysql+fancynewdriver://"
        ).db_engine_spec
        == OldDBEngineSpec
    )


@pytest.mark.parametrize(
    "dttm,col,database,result",
    [
        (
            datetime(2023, 1, 1, 1, 23, 45, 600000),
            TableColumn(python_date_format="epoch_s"),
            Database(),
            "1672536225",
        ),
        (
            datetime(2023, 1, 1, 1, 23, 45, 600000),
            TableColumn(python_date_format="epoch_ms"),
            Database(),
            "1672536225000",
        ),
        (
            datetime(2023, 1, 1, 1, 23, 45, 600000),
            TableColumn(python_date_format="%Y-%m-%d"),
            Database(),
            "'2023-01-01'",
        ),
        (
            datetime(2023, 1, 1, 1, 23, 45, 600000),
            TableColumn(column_name="ds"),
            Database(
                extra=json.dumps(
                    {
                        "python_date_format_by_column_name": {
                            "ds": "%Y-%m-%d",
                        },
                    },
                ),
                sqlalchemy_uri="foo://",
            ),
            "'2023-01-01'",
        ),
        (
            datetime(2023, 1, 1, 1, 23, 45, 600000),
            TableColumn(),
            Database(sqlalchemy_uri="foo://"),
            "'2023-01-01 01:23:45.600000'",
        ),
        (
            datetime(2023, 1, 1, 1, 23, 45, 600000),
            TableColumn(type="TimeStamp"),
            Database(sqlalchemy_uri="trino://"),
            "TIMESTAMP '2023-01-01 01:23:45.600000'",
        ),
    ],
)
def test_dttm_sql_literal(
    dttm: datetime,
    col: TableColumn,
    database: Database,
    result: str,
) -> None:
    assert SqlaTable(database=database).dttm_sql_literal(dttm, col) == result


def test_table_column_database() -> None:
    database = Database(database_name="db")
    assert TableColumn(database=database).database is database


def test_catalog_cache() -> None:
    """
    Test the catalog cache.
    """
    database = Database(
        database_name="db",
        sqlalchemy_uri="sqlite://",
        extra=json.dumps({"metadata_cache_timeout": {"catalog_cache_timeout": 10}}),
    )

    assert database.catalog_cache_enabled
    assert database.catalog_cache_timeout == 10


def test_get_default_catalog() -> None:
    """
    Test the `get_default_catalog` method.
    """
    database = Database(
        database_name="db",
        sqlalchemy_uri="postgresql://user:password@host:5432/examples",
    )

    assert database.get_default_catalog() == "examples"


def test_get_default_schema(mocker: MockerFixture) -> None:
    """
    Test the `get_default_schema` method.
    """
    database = Database(
        database_name="db",
        sqlalchemy_uri="postgresql://user:password@host:5432/examples",
    )

    get_inspector = mocker.patch.object(database, "get_inspector")
    with get_inspector() as inspector:
        inspector.default_schema_name = "public"

    assert database.get_default_schema("examples") == "public"
    get_inspector.assert_called_with(catalog="examples")


def test_get_all_catalog_names(mocker: MockerFixture) -> None:
    """
    Test the `get_all_catalog_names` method.
    """
    database = Database(
        database_name="db",
        sqlalchemy_uri="postgresql://user:password@host:5432/examples",
    )

    get_inspector = mocker.patch.object(database, "get_inspector")
    with get_inspector() as inspector:
        inspector.bind.execute.return_value = [("examples",), ("other",)]

    assert database.get_all_catalog_names(force=True) == {"examples", "other"}
    get_inspector.assert_called_with()


def test_get_all_schema_names_needs_oauth2(mocker: MockerFixture) -> None:
    """
    Test the `get_all_schema_names` method when OAuth2 is needed.
    """
    database = Database(
        database_name="db",
        sqlalchemy_uri="snowflake://:@abcd1234.snowflakecomputing.com/db",
        encrypted_extra=json.dumps(oauth2_client_info),
    )

    class DriverSpecificError(Exception):
        """
        A custom exception that is raised by the Snowflake driver.
        """

    mocker.patch.object(
        database.db_engine_spec,
        "oauth2_exception",
        DriverSpecificError,
    )
    mocker.patch.object(
        database.db_engine_spec,
        "get_schema_names",
        side_effect=DriverSpecificError("User needs to authenticate"),
    )
    mocker.patch.object(database, "get_inspector")
    user = mocker.MagicMock()
    user.id = 42
    mocker.patch("superset.db_engine_specs.base.g", user=user)

    with pytest.raises(OAuth2RedirectError) as excinfo:
        database.get_all_schema_names()

    assert excinfo.value.message == "You don't have permission to access the data."
    assert excinfo.value.error.error_type == SupersetErrorType.OAUTH2_REDIRECT


def test_get_all_catalog_names_needs_oauth2(mocker: MockerFixture) -> None:
    """
    Test the `get_all_catalog_names` method when OAuth2 is needed.
    """
    database = Database(
        database_name="db",
        sqlalchemy_uri="snowflake://:@abcd1234.snowflakecomputing.com/db",
        encrypted_extra=json.dumps(oauth2_client_info),
    )

    class DriverSpecificError(Exception):
        """
        A custom exception that is raised by the Snowflake driver.
        """

    mocker.patch.object(
        database.db_engine_spec,
        "oauth2_exception",
        DriverSpecificError,
    )
    mocker.patch.object(
        database.db_engine_spec,
        "get_catalog_names",
        side_effect=DriverSpecificError("User needs to authenticate"),
    )
    mocker.patch.object(database, "get_inspector")
    user = mocker.MagicMock()
    user.id = 42
    mocker.patch("superset.db_engine_specs.base.g", user=user)

    with pytest.raises(OAuth2RedirectError) as excinfo:
        database.get_all_catalog_names()

    assert excinfo.value.message == "You don't have permission to access the data."
    assert excinfo.value.error.error_type == SupersetErrorType.OAUTH2_REDIRECT


def test_get_all_table_names_in_schema_needs_oauth2(mocker: MockerFixture) -> None:
    """
    Test the `get_all_table_names_in_schema` method when OAuth2 is needed.
    """
    database = Database(
        database_name="db",
        sqlalchemy_uri="snowflake://:@abcd1234.snowflakecomputing.com/db",
        encrypted_extra=json.dumps(oauth2_client_info),
    )

    class DriverSpecificError(Exception):
        """
        A custom exception that is raised by the Snowflake driver.
        """

    mocker.patch.object(
        database.db_engine_spec,
        "oauth2_exception",
        DriverSpecificError,
    )
    mocker.patch.object(
        database.db_engine_spec,
        "get_table_names",
        side_effect=DriverSpecificError("User needs to authenticate"),
    )
    mocker.patch.object(database, "get_inspector")
    user = mocker.MagicMock()
    user.id = 42
    mocker.patch("superset.db_engine_specs.base.g", user=user)

    with pytest.raises(OAuth2RedirectError) as excinfo:
        database.get_all_table_names_in_schema(catalog=None, schema="public")

    assert excinfo.value.message == "You don't have permission to access the data."
    assert excinfo.value.error.error_type == SupersetErrorType.OAUTH2_REDIRECT


def test_get_all_view_names_in_schema_needs_oauth2(mocker: MockerFixture) -> None:
    """
    Test the `get_all_view_names_in_schema` method when OAuth2 is needed.
    """
    database = Database(
        database_name="db",
        sqlalchemy_uri="snowflake://:@abcd1234.snowflakecomputing.com/db",
        encrypted_extra=json.dumps(oauth2_client_info),
    )

    class DriverSpecificError(Exception):
        """
        A custom exception that is raised by the Snowflake driver.
        """

    mocker.patch.object(
        database.db_engine_spec,
        "oauth2_exception",
        DriverSpecificError,
    )
    mocker.patch.object(
        database.db_engine_spec,
        "get_view_names",
        side_effect=DriverSpecificError("User needs to authenticate"),
    )
    mocker.patch.object(database, "get_inspector")
    user = mocker.MagicMock()
    user.id = 42
    mocker.patch("superset.db_engine_specs.base.g", user=user)

    with pytest.raises(OAuth2RedirectError) as excinfo:
        database.get_all_view_names_in_schema(catalog=None, schema="public")

    assert excinfo.value.message == "You don't have permission to access the data."
    assert excinfo.value.error.error_type == SupersetErrorType.OAUTH2_REDIRECT


def test_get_all_materialized_view_names_in_schema_needs_oauth2(
    mocker: MockerFixture,
) -> None:
    """
    Test the `get_all_materialized_view_names_in_schema` method when OAuth2 is needed.
    """
    database = Database(
        database_name="db",
        sqlalchemy_uri="snowflake://:@abcd1234.snowflakecomputing.com/db",
        encrypted_extra=json.dumps(oauth2_client_info),
    )

    class DriverSpecificError(Exception):
        """
        A custom exception that is raised by the Snowflake driver.
        """

    mocker.patch.object(
        database.db_engine_spec,
        "oauth2_exception",
        DriverSpecificError,
    )
    mocker.patch.object(
        database.db_engine_spec,
        "get_materialized_view_names",
        side_effect=DriverSpecificError("User needs to authenticate"),
    )
    mocker.patch.object(database, "get_inspector")
    user = mocker.MagicMock()
    user.id = 42
    mocker.patch("superset.db_engine_specs.base.g", user=user)

    with pytest.raises(OAuth2RedirectError) as excinfo:
        database.get_all_materialized_view_names_in_schema(
            catalog=None, schema="public"
        )

    assert excinfo.value.message == "You don't have permission to access the data."
    assert excinfo.value.error.error_type == SupersetErrorType.OAUTH2_REDIRECT


def test_get_sqla_engine(mocker: MockerFixture) -> None:
    """
    Test `_get_sqla_engine`.
    """
    from superset.models.core import Database

    user = mocker.MagicMock()
    user.email = "alice.doe@example.org"
    mocker.patch(
        "superset.models.core.security_manager.find_user",
        return_value=user,
    )
    mocker.patch("superset.models.core.get_username", return_value="alice")

    create_engine = mocker.patch("superset.models.core.create_engine")

    database = Database(database_name="my_db", sqlalchemy_uri="trino://")
    database._get_sqla_engine(nullpool=False)

    create_engine.assert_called_with(
        make_url("trino:///"),
        connect_args={"source": "Apache Superset"},
    )


def test_get_sqla_engine_caches_engine_per_url(mocker: MockerFixture) -> None:
    """
    Regression for #27897: a single SQLAlchemy ``Engine`` should be created per
    process/URL, not on every ``_get_sqla_engine`` call.

    Per the SQLAlchemy docs (https://docs.sqlalchemy.org/en/20/core/connections.html),
    the engine is meant to be created once and reused so its connection pool
    can do its job. Calling ``create_engine`` repeatedly defeats pooling, so
    user-configured pools (e.g. via ``DB_CONNECTION_MUTATOR``) never persist
    state between requests.

    Exercises the production default path (``nullpool=True``) — every
    in-tree callsite uses it — so the assertion would have caught a fix
    that only engaged under ``nullpool=False``.
    """
    from superset.models.core import _ENGINE_CACHE, Database

    # Clear the process-wide cache so prior tests don't poison this assertion.
    _ENGINE_CACHE.clear()

    mocker.patch(
        "superset.models.core.security_manager.find_user",
        return_value=None,
    )
    create_engine = mocker.patch("superset.models.core.create_engine")

    database = Database(database_name="my_db", sqlalchemy_uri="trino://")
    database.id = 1  # Cache is keyed on id; skipped for unsaved instances.
    database._get_sqla_engine()
    database._get_sqla_engine()

    assert create_engine.call_count == 1, (
        "Database._get_sqla_engine should reuse the engine for the same URL "
        f"(create_engine called {create_engine.call_count} times)"
    )


def test_get_sqla_engine_does_not_cache_unsaved_instances(
    mocker: MockerFixture,
) -> None:
    """
    Two distinct unsaved ``Database`` instances (``id is None``) with the
    same URI must not share a cache entry — they're different in-memory
    objects and may have diverging config that isn't yet persisted.
    """
    from superset.models.core import _ENGINE_CACHE, Database

    _ENGINE_CACHE.clear()
    mocker.patch(
        "superset.models.core.security_manager.find_user",
        return_value=None,
    )
    create_engine = mocker.patch("superset.models.core.create_engine")

    Database(database_name="db_a", sqlalchemy_uri="trino://")._get_sqla_engine()
    Database(database_name="db_b", sqlalchemy_uri="trino://")._get_sqla_engine()

    assert create_engine.call_count == 2
    assert _ENGINE_CACHE == {}


def test_engine_cache_evicted_on_update_and_delete(mocker: MockerFixture) -> None:
    """
    Regression for #27897: engines cached for a database must be evicted when
    that database is updated or deleted so that stale connections (old password,
    old host, old SSH tunnel) do not linger in memory across config changes.
    """
    from unittest.mock import MagicMock

    from superset.models.core import (
        _ENGINE_CACHE,
        _ENGINE_CACHE_LOCK,
        _evict_engine_cache,
    )

    # Seed the cache with two entries for database id=1 and one for id=2.
    with _ENGINE_CACHE_LOCK:
        _ENGINE_CACHE.clear()
        _ENGINE_CACHE[(1, "postgresql://old-host/db", "")] = MagicMock()
        _ENGINE_CACHE[(1, "postgresql://new-host/db", "")] = MagicMock()
        _ENGINE_CACHE[(2, "postgresql://other/db", "")] = MagicMock()

    db_instance = MagicMock()
    db_instance.id = 1
    _evict_engine_cache(mapper=None, connection=None, target=db_instance)

    # Both id=1 entries gone; id=2 entry untouched.
    assert not any(k[0] == 1 for k in _ENGINE_CACHE)
    assert any(k[0] == 2 for k in _ENGINE_CACHE)


def test_get_sqla_engine_user_impersonation(mocker: MockerFixture) -> None:
    """
    Test user impersonation in `_get_sqla_engine`.
    """
    from superset.models.core import Database

    user = mocker.MagicMock()
    user.email = "alice.doe@example.org"
    mocker.patch(
        "superset.models.core.security_manager.find_user",
        return_value=user,
    )
    mocker.patch("superset.models.core.get_username", return_value="alice")

    create_engine = mocker.patch("superset.models.core.create_engine")

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="trino://",
        impersonate_user=True,
    )
    database._get_sqla_engine(nullpool=False)

    create_engine.assert_called_with(
        make_url("trino:///"),
        connect_args={"user": "alice", "source": "Apache Superset"},
    )


def test_add_database_to_signature():
    args = ["param1", "param2"]

    def func_without_db(param1, param2):
        pass

    def func_with_db_start(database, param1, param2):
        pass

    def func_with_db_end(param1, param2, database):
        pass

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="trino://",
        impersonate_user=True,
    )
    args1 = database.add_database_to_signature(func_without_db, args.copy())
    assert args1 == ["param1", "param2"]
    args2 = database.add_database_to_signature(func_with_db_start, args.copy())
    assert args2 == [database, "param1", "param2"]
    args3 = database.add_database_to_signature(func_with_db_end, args.copy())
    assert args3 == ["param1", "param2", database]


@with_feature_flags(IMPERSONATE_WITH_EMAIL_PREFIX=True)
def test_get_sqla_engine_user_impersonation_email(mocker: MockerFixture) -> None:
    """
    Test user impersonation in `_get_sqla_engine` with `username_from_email`.
    """
    from superset.models.core import Database

    user = mocker.MagicMock()
    user.email = "alice.doe@example.org"
    mocker.patch(
        "superset.models.core.security_manager.find_user",
        return_value=user,
    )
    mocker.patch("superset.models.core.get_username", return_value="alice")

    create_engine = mocker.patch("superset.models.core.create_engine")

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="trino://",
        impersonate_user=True,
    )
    database._get_sqla_engine(nullpool=False)

    create_engine.assert_called_with(
        make_url("trino:///"),
        connect_args={"user": "alice.doe", "source": "Apache Superset"},
    )


def test_get_sqla_engine_registers_prequery_event_listener(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    Test that get_sqla_engine registers a connect event listener for prequeries.

    Engines returned by get_sqla_engine must automatically execute prequeries
    (e.g. SET search_path) on every new connection, so that callers don't need
    to remember to call get_prequeries() themselves.
    """

    mock_engine = mocker.MagicMock()
    mocker.patch.object(Database, "_get_sqla_engine", return_value=mock_engine)
    db_engine_spec = mocker.patch.object(Database, "db_engine_spec")
    db_engine_spec.get_prequeries.return_value = ['SET search_path = "my_schema"']
    event_listen = mocker.patch("superset.models.core.sqla.event.listen")
    mocker.patch("superset.models.core.sqla.event.remove")

    database = Database(database_name="my_db", sqlalchemy_uri="postgresql://")
    with database.get_sqla_engine(catalog="my_catalog", schema="my_schema"):
        pass

    db_engine_spec.get_prequeries.assert_called_once_with(
        database=database,
        catalog="my_catalog",
        schema="my_schema",
    )
    event_listen.assert_called_once_with(mock_engine, "connect", mocker.ANY)

    # Call the captured closure directly to verify cursor create → execute → close.
    captured_fn = event_listen.call_args[0][2]
    mock_dbapi_conn = mocker.MagicMock()
    mock_cursor = mocker.MagicMock()
    mock_dbapi_conn.cursor.return_value = mock_cursor
    captured_fn(mock_dbapi_conn, None)
    mock_cursor.execute.assert_called_once_with('SET search_path = "my_schema"')
    mock_cursor.close.assert_called_once()


def test_get_sqla_engine_prequery_cursor_closed_on_exception(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    Test that the cursor is always closed even when a prequery raises.
    """
    mock_engine = mocker.MagicMock()
    mocker.patch.object(Database, "_get_sqla_engine", return_value=mock_engine)
    db_engine_spec = mocker.patch.object(Database, "db_engine_spec")
    db_engine_spec.get_prequeries.return_value = ['SET search_path = "bad_schema"']
    event_listen = mocker.patch("superset.models.core.sqla.event.listen")
    mocker.patch("superset.models.core.sqla.event.remove")

    database = Database(database_name="my_db", sqlalchemy_uri="postgresql://")
    with database.get_sqla_engine(catalog=None, schema="bad_schema"):
        pass

    captured_fn = event_listen.call_args[0][2]
    mock_dbapi_conn = mocker.MagicMock()
    mock_cursor = mocker.MagicMock()
    mock_cursor.execute.side_effect = Exception("invalid schema")
    mock_dbapi_conn.cursor.return_value = mock_cursor

    with pytest.raises(Exception, match="invalid schema"):
        captured_fn(mock_dbapi_conn, None)

    mock_cursor.close.assert_called_once()


def test_get_sqla_engine_no_prequeries_no_event_listener(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    Test that get_sqla_engine does not register an event listener when there
    are no prequeries.
    """
    mock_engine = mocker.MagicMock()
    mocker.patch.object(Database, "_get_sqla_engine", return_value=mock_engine)
    db_engine_spec = mocker.patch.object(Database, "db_engine_spec")
    db_engine_spec.get_prequeries.return_value = []
    event_listen = mocker.patch("superset.models.core.sqla.event.listen")

    database = Database(database_name="my_db", sqlalchemy_uri="postgresql://")
    with database.get_sqla_engine(catalog=None, schema=None):
        pass

    event_listen.assert_not_called()


def test_get_raw_connection_executes_prequeries_exactly_once(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """
    Test that get_raw_connection() runs prequeries exactly once through the
    connect event listener registered by get_sqla_engine().

    Previously get_raw_connection() had its own manual prequery loop AND
    called get_sqla_engine() (which registers the listener), so prequeries
    ran twice.  After removing the manual loop the listener is the sole
    execution point — this test proves exactly-once semantics.
    """
    mock_engine = mocker.MagicMock()
    mocker.patch.object(Database, "_get_sqla_engine", return_value=mock_engine)
    db_engine_spec = mocker.patch.object(Database, "db_engine_spec")
    prequery = 'SET search_path = "my_schema"'
    db_engine_spec.get_prequeries.return_value = [prequery]

    # Capture the closure registered via sqla.event.listen.
    captured_listeners: list[Callable[..., None]] = []
    original_listen = mocker.patch("superset.models.core.sqla.event.listen")
    original_listen.side_effect = lambda engine, event, fn: captured_listeners.append(
        fn
    )
    mocker.patch("superset.models.core.sqla.event.remove")

    # Simulate SQLAlchemy firing the "connect" event when raw_connection() is called.
    mock_dbapi_conn = mocker.MagicMock()
    mock_cursor = mocker.MagicMock()
    mock_dbapi_conn.cursor.return_value = mock_cursor

    def raw_connection_side_effect() -> Any:
        for listener in captured_listeners:
            listener(mock_dbapi_conn, None)
        return mock_dbapi_conn

    mock_engine.raw_connection.side_effect = raw_connection_side_effect

    database = Database(database_name="my_db", sqlalchemy_uri="postgresql://")
    with database.get_raw_connection(schema="my_schema"):
        pass

    # Exactly one prequery, exactly once — not twice, not zero.
    mock_cursor.execute.assert_called_once_with(prequery)
    mock_cursor.close.assert_called_once()


def test_is_oauth2_enabled() -> None:
    """
    Test the `is_oauth2_enabled` method.
    """
    database = Database(
        database_name="db",
        sqlalchemy_uri="postgresql://user:password@host:5432/examples",
    )

    assert not database.is_oauth2_enabled()

    database.encrypted_extra = json.dumps(oauth2_client_info)
    assert database.is_oauth2_enabled()


def test_get_oauth2_config(app_context: None) -> None:
    """
    Test the `get_oauth2_config` method.
    """
    database = Database(
        database_name="db",
        sqlalchemy_uri="postgresql://user:password@host:5432/examples",
    )

    assert database.get_oauth2_config() is None

    database.encrypted_extra = json.dumps(oauth2_client_info)
    assert database.get_oauth2_config() == {
        "id": "my_client_id",
        "secret": "my_client_secret",
        "authorization_request_uri": "https://abcd1234.snowflakecomputing.com/oauth/authorize",
        "token_request_uri": "https://abcd1234.snowflakecomputing.com/oauth/token-request",
        "scope": "refresh_token session:role:USERADMIN",
        "redirect_uri": "http://example.com/api/v1/database/oauth2/",
        "request_content_type": "data",  # Default value from BaseEngineSpec
    }


def test_get_oauth2_config_token_request_type_from_db_engine_specs(
    mocker: MockerFixture, app_context: None
) -> None:
    """
    Test that DB Engine Spec overrides for ``oauth2_token_request_type`` are respected.
    """
    database = Database(
        database_name="db",
        sqlalchemy_uri="postgresql://user:password@host:5432/examples",
    )
    mocker.patch.object(
        database.db_engine_spec,
        "oauth2_token_request_type",
        "json",
    )

    database.encrypted_extra = json.dumps(oauth2_client_info)
    assert database.get_oauth2_config() == {
        "id": "my_client_id",
        "secret": "my_client_secret",
        "authorization_request_uri": "https://abcd1234.snowflakecomputing.com/oauth/authorize",
        "token_request_uri": "https://abcd1234.snowflakecomputing.com/oauth/token-request",
        "scope": "refresh_token session:role:USERADMIN",
        "redirect_uri": "http://example.com/api/v1/database/oauth2/",
        "request_content_type": "json",
    }


def test_get_oauth2_config_custom_token_request_type_extra(app_context: None) -> None:
    """
    Test passing a custom ``token_request_type`` via ``encrypted_extra``
    takes precedence.
    """
    database = Database(
        database_name="db",
        sqlalchemy_uri="postgresql://user:password@host:5432/examples",
    )
    custom_oauth2_client_info = {
        "oauth2_client_info": {
            **oauth2_client_info["oauth2_client_info"],
            "request_content_type": "json",
        }
    }

    database.encrypted_extra = json.dumps(custom_oauth2_client_info)
    assert database.get_oauth2_config() == {
        "id": "my_client_id",
        "secret": "my_client_secret",
        "authorization_request_uri": "https://abcd1234.snowflakecomputing.com/oauth/authorize",
        "token_request_uri": "https://abcd1234.snowflakecomputing.com/oauth/token-request",
        "scope": "refresh_token session:role:USERADMIN",
        "redirect_uri": "http://example.com/api/v1/database/oauth2/",
        "request_content_type": "json",
    }


def test_get_oauth2_config_redirect_uri_from_config(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that ``DATABASE_OAUTH2_REDIRECT_URI`` config takes precedence over
    url_for default.
    """
    custom_redirect_uri = "https://custom.example.com/oauth/callback"
    mocker.patch.dict(
        "superset.utils.oauth2.app.config",
        {"DATABASE_OAUTH2_REDIRECT_URI": custom_redirect_uri},
    )
    database = Database(
        database_name="db",
        sqlalchemy_uri="postgresql://user:password@host:5432/examples",
    )
    database.encrypted_extra = json.dumps(oauth2_client_info)

    config = database.get_oauth2_config()

    assert config is not None
    assert config["redirect_uri"] == custom_redirect_uri


def test_raw_connection_oauth_engine(mocker: MockerFixture) -> None:
    """
    Test that we can start OAuth2 from `raw_connection()` errors.

    With OAuth2, some databases will raise an exception when the engine is first created
    (eg, BigQuery). Others, like, Snowflake, when the connection is created. And
    finally, GSheets will raise an exception when the query is executed.

    This tests verifies that when calling `raw_connection()` the OAuth2 flow is
    triggered when the engine is created.
    """
    g = mocker.patch("superset.db_engine_specs.base.g")
    g.user = mocker.MagicMock()
    g.user.id = 42

    database = Database(
        id=1,
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
        encrypted_extra=json.dumps(oauth2_client_info),
    )
    database.db_engine_spec.oauth2_exception = OAuth2Error
    _get_sqla_engine = mocker.patch.object(database, "_get_sqla_engine")
    _get_sqla_engine.side_effect = OAuth2Error("OAuth2 required")

    with pytest.raises(OAuth2RedirectError) as excinfo:
        with database.get_raw_connection() as conn:
            conn.cursor()
    assert str(excinfo.value) == "You don't have permission to access the data."


def test_raw_connection_oauth_connection(mocker: MockerFixture) -> None:
    """
    Test that we can start OAuth2 from `raw_connection()` errors.

    With OAuth2, some databases will raise an exception when the engine is first created
    (eg, BigQuery). Others, like, Snowflake, when the connection is created. And
    finally, GSheets will raise an exception when the query is executed.

    This tests verifies that when calling `raw_connection()` the OAuth2 flow is
    triggered when the connection is created.
    """
    g = mocker.patch("superset.db_engine_specs.base.g")
    g.user = mocker.MagicMock()
    g.user.id = 42

    database = Database(
        id=1,
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
        encrypted_extra=json.dumps(oauth2_client_info),
    )
    database.db_engine_spec.oauth2_exception = OAuth2Error
    get_sqla_engine = mocker.patch.object(database, "get_sqla_engine")
    get_sqla_engine().__enter__().raw_connection.side_effect = OAuth2Error(
        "OAuth2 required"
    )

    with pytest.raises(OAuth2RedirectError) as excinfo:
        with database.get_raw_connection() as conn:
            conn.cursor()
    assert str(excinfo.value) == "You don't have permission to access the data."


def test_raw_connection_oauth_execute(mocker: MockerFixture) -> None:
    """
    Test that we can start OAuth2 from `raw_connection()` errors.

    With OAuth2, some databases will raise an exception when the engine is first created
    (eg, BigQuery). Others, like, Snowflake, when the connection is created. And
    finally, GSheets will raise an exception when the query is executed.

    This tests verifies that when calling `raw_connection()` the OAuth2 flow is
    triggered when the connection is created.
    """
    g = mocker.patch("superset.db_engine_specs.base.g")
    g.user = mocker.MagicMock()
    g.user.id = 42

    database = Database(
        id=1,
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
        encrypted_extra=json.dumps(oauth2_client_info),
    )
    database.db_engine_spec.oauth2_exception = OAuth2Error
    get_sqla_engine = mocker.patch.object(database, "get_sqla_engine")
    get_sqla_engine().__enter__().raw_connection().cursor().execute.side_effect = (
        OAuth2Error("OAuth2 required")
    )

    with pytest.raises(OAuth2RedirectError) as excinfo:  # noqa: PT012
        with database.get_raw_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
    assert str(excinfo.value) == "You don't have permission to access the data."


def test_get_schema_access_for_file_upload() -> None:
    """
    Test the `get_schema_access_for_file_upload` method.
    """
    # Skip if gsheets dialect is not available (Shillelagh not installed in Docker)
    try:
        from sqlalchemy import create_engine

        create_engine("gsheets://")
    except Exception:
        pytest.skip("gsheets:// dialect not available (Shillelagh not installed)")

    database = Database(
        database_name="first-database",
        sqlalchemy_uri="gsheets://",
        extra=json.dumps(
            {
                "metadata_params": {},
                "engine_params": {},
                "metadata_cache_timeout": {},
                "schemas_allowed_for_file_upload": '["public"]',
            }
        ),
    )

    assert database.get_schema_access_for_file_upload() == {"public"}


def test_engine_context_manager(mocker: MockerFixture, app_context: None) -> None:
    """
    Test the engine context manager.
    """
    from unittest.mock import MagicMock

    engine_context_manager = MagicMock()
    mocker.patch.dict(
        current_app.config,
        {"ENGINE_CONTEXT_MANAGER": engine_context_manager},
    )
    _get_sqla_engine = mocker.patch.object(Database, "_get_sqla_engine")

    database = Database(database_name="my_db", sqlalchemy_uri="trino://")
    with database.get_sqla_engine("catalog", "schema"):
        pass

    engine_context_manager.assert_called_once_with(database, "catalog", "schema")
    engine_context_manager().__enter__.assert_called_once()
    engine_context_manager().__exit__.assert_called_once_with(None, None, None)
    _get_sqla_engine.assert_called_once_with(
        catalog="catalog",
        schema="schema",
        nullpool=True,
        source=None,
        sqlalchemy_uri="trino://",
    )


def test_engine_oauth2(mocker: MockerFixture) -> None:
    """
    Test that we handle OAuth2 when `create_engine` fails.
    """
    database = Database(database_name="my_db", sqlalchemy_uri="trino://")
    mocker.patch.object(database, "_get_sqla_engine", side_effect=Exception)
    mocker.patch.object(database, "is_oauth2_enabled", return_value=True)
    mocker.patch.object(database.db_engine_spec, "needs_oauth2", return_value=True)
    start_oauth2_dance = mocker.patch.object(
        database.db_engine_spec,
        "start_oauth2_dance",
        side_effect=OAuth2Error("OAuth2 required"),
    )

    with pytest.raises(OAuth2Error):
        with database.get_sqla_engine("catalog", "schema"):
            pass

    start_oauth2_dance.assert_called_with(database)


def test_purge_oauth2_tokens(session: Session) -> None:
    """
    Test the `purge_oauth2_tokens` method.
    """
    from flask_appbuilder.security.sqla.models import Role, User  # noqa: F401

    from superset.models.core import Database, DatabaseUserOAuth2Tokens

    Database.metadata.create_all(session.get_bind())  # pylint: disable=no-member

    user = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="adoe",
    )
    session.add(user)
    session.flush()

    database1 = Database(database_name="my_oauth2_db", sqlalchemy_uri="sqlite://")
    database2 = Database(database_name="my_other_oauth2_db", sqlalchemy_uri="sqlite://")
    session.add_all([database1, database2])
    session.flush()

    tokens = [
        DatabaseUserOAuth2Tokens(
            user_id=user.id,
            database_id=database1.id,
            access_token="my_access_token",  # noqa: S106
            access_token_expiration=datetime(2023, 1, 1),
            refresh_token="my_refresh_token",  # noqa: S106
        ),
        DatabaseUserOAuth2Tokens(
            user_id=user.id,
            database_id=database2.id,
            access_token="my_other_access_token",  # noqa: S106
            access_token_expiration=datetime(2024, 1, 1),
            refresh_token="my_other_refresh_token",  # noqa: S106
        ),
    ]
    session.add_all(tokens)
    session.flush()

    assert len(session.query(DatabaseUserOAuth2Tokens).all()) == 2

    token = (
        session.query(DatabaseUserOAuth2Tokens)
        .filter_by(database_id=database1.id)
        .one()
    )
    assert token.user_id == user.id
    assert token.database_id == database1.id
    assert token.access_token == "my_access_token"  # noqa: S105
    assert token.access_token_expiration == datetime(2023, 1, 1)
    assert token.refresh_token == "my_refresh_token"  # noqa: S105

    database1.purge_oauth2_tokens()

    # confirm token was deleted
    token = (
        session.query(DatabaseUserOAuth2Tokens)
        .filter_by(database_id=database1.id)
        .one_or_none()
    )
    assert token is None

    # make sure other DB tokens weren't deleted
    token = (
        session.query(DatabaseUserOAuth2Tokens)
        .filter_by(database_id=database2.id)
        .one()
    )
    assert token is not None

    # make sure database was not deleted... just in case
    database = session.query(Database).filter_by(id=database1.id).one()
    assert database.name == "my_oauth2_db"


def test_compile_sqla_query_no_optimization(query: Select) -> None:
    """
    Test the `compile_sqla_query` method.
    """
    from superset.models.core import Database

    database = Database(
        database_name="db",
        sqlalchemy_uri="sqlite://",
    )

    space = " "
    #
    assert (
        database.compile_sqla_query(query, is_virtual=True)
        == f"""SELECT anon_1.a, anon_1.b{space}
FROM (SELECT some_table.a AS a, some_table.b AS b, some_table.c AS c{space}
FROM some_table) AS anon_1{space}
WHERE anon_1.a > 1 AND anon_1.b = 2"""  # noqa: S608
    )


@with_feature_flags(OPTIMIZE_SQL=True)
def test_compile_sqla_query(query: Select) -> None:
    """
    Test the `compile_sqla_query` method.
    """
    from superset.models.core import Database

    database = Database(
        database_name="db",
        sqlalchemy_uri="sqlite://",
    )

    assert (
        database.compile_sqla_query(query, is_virtual=True)
        == """SELECT
  anon_1.a,
  anon_1.b
FROM (
  SELECT
    some_table.a AS a,
    some_table.b AS b,
    some_table.c AS c
  FROM some_table
  WHERE
    some_table.a > 1 AND some_table.b = 2
) AS anon_1
WHERE
  TRUE AND TRUE"""
    )


def test_get_all_table_names_in_schema(mocker: MockerFixture) -> None:
    """
    Test the `get_all_table_names_in_schema` method.
    """
    database = Database(
        database_name="db",
        sqlalchemy_uri="postgresql://user:password@host:5432/examples",
    )

    mocker.patch.object(database, "get_inspector")
    get_table_names = mocker.patch(
        "superset.db_engine_specs.postgres.PostgresEngineSpec.get_table_names"
    )
    get_table_names.return_value = {"first_table", "second_table", "third_table"}

    tables_list = database.get_all_table_names_in_schema(
        catalog="examples",
        schema="public",
    )
    assert sorted(tables_list) == sorted(
        {
            ("first_table", "public", "examples"),
            ("second_table", "public", "examples"),
            ("third_table", "public", "examples"),
        }
    )


def test_get_all_view_names_in_schema(mocker: MockerFixture) -> None:
    """
    Test the `get_all_view_names_in_schema` method.
    """
    database = Database(
        database_name="db",
        sqlalchemy_uri="postgresql://user:password@host:5432/examples",
    )

    mocker.patch.object(database, "get_inspector")
    get_view_names = mocker.patch(
        "superset.db_engine_specs.base.BaseEngineSpec.get_view_names"
    )
    get_view_names.return_value = {"first_view", "second_view", "third_view"}

    views_list = database.get_all_view_names_in_schema(
        catalog="examples",
        schema="public",
    )
    assert sorted(views_list) == sorted(
        {
            ("first_view", "public", "examples"),
            ("second_view", "public", "examples"),
            ("third_view", "public", "examples"),
        }
    )


@pytest.mark.parametrize(
    "sql, limit, force, method, expected",
    [
        (
            "SELECT * FROM table",
            100,
            False,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM table\nLIMIT 100",
        ),
        (
            "SELECT * FROM table LIMIT 100",
            10,
            False,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM table\nLIMIT 10",
        ),
        (
            "SELECT * FROM table LIMIT 10",
            100,
            False,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM table\nLIMIT 10",
        ),
        (
            "SELECT * FROM table LIMIT 10",
            100,
            True,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM table\nLIMIT 100",
        ),
        (
            "SELECT * FROM a  \t \n   ; \t  \n  ",
            1000,
            False,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM a\nLIMIT 1000",
        ),
        (
            "SELECT 'LIMIT 777'",
            1000,
            False,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  'LIMIT 777'\nLIMIT 1000",
        ),
        (
            "SELECT * FROM table",
            1000,
            False,
            LimitMethod.FETCH_MANY,
            "SELECT\n  *\nFROM table",
        ),
        (
            "SELECT * FROM (SELECT * FROM a LIMIT 10) LIMIT 9999",
            1000,
            False,
            LimitMethod.FORCE_LIMIT,
            """SELECT
  *
FROM (
  SELECT
    *
  FROM a
  LIMIT 10
)
LIMIT 1000""",
        ),
        (
            """
SELECT
    'LIMIT 777' AS a
  , b
FROM
    table
LIMIT 99990""",
            1000,
            None,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  'LIMIT 777' AS a,\n  b\nFROM table\nLIMIT 1000",
        ),
        (
            """
SELECT
    'LIMIT 777' AS a
  , b
FROM
table
LIMIT         99990            ;""",
            1000,
            None,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  'LIMIT 777' AS a,\n  b\nFROM table\nLIMIT 1000",
        ),
        (
            """
SELECT
    'LIMIT 777' AS a
  , b
FROM
table
LIMIT 99990, 999999""",
            1000,
            None,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  'LIMIT 777' AS a,\n  b\nFROM table\nLIMIT 1000\nOFFSET 99990",
        ),
        (
            """
SELECT
    'LIMIT 777' AS a
  , b
FROM
table
LIMIT 99990
OFFSET 999999""",
            1000,
            None,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  'LIMIT 777' AS a,\n  b\nFROM table\nLIMIT 1000\nOFFSET 999999",
        ),
    ],
)
def test_apply_limit_to_sql(
    sql: str,
    limit: int,
    force: bool,
    method: LimitMethod,
    expected: str,
    mocker: MockerFixture,
) -> None:
    """
    Test the `apply_limit_to_sql` method.
    """
    db = Database(database_name="test_database", sqlalchemy_uri="sqlite://")
    db_engine_spec = mocker.MagicMock(limit_method=method)
    db.get_db_engine_spec = mocker.MagicMock(return_value=db_engine_spec)

    limited = db.apply_limit_to_sql(sql, limit, force)
    assert limited == expected


def test_database_execute_delegates_to_sql_executor(mocker: MockerFixture) -> None:
    """Test that Database.execute() delegates to SQLExecutor.execute()."""
    from unittest.mock import MagicMock

    mock_executor_class = mocker.patch("superset.sql.execution.SQLExecutor")
    mock_executor = MagicMock()
    mock_executor_class.return_value = mock_executor

    mock_result = MagicMock()
    mock_executor.execute.return_value = mock_result

    database = Database(database_name="test_db", sqlalchemy_uri="sqlite://")
    mock_options = MagicMock()

    result = database.execute("SELECT 1", mock_options)

    mock_executor_class.assert_called_once_with(database)
    mock_executor.execute.assert_called_once_with("SELECT 1", mock_options)
    assert result == mock_result


def test_database_execute_without_options(mocker: MockerFixture) -> None:
    """Test that Database.execute() works without options."""
    from unittest.mock import MagicMock

    mock_executor_class = mocker.patch("superset.sql.execution.SQLExecutor")
    mock_executor = MagicMock()
    mock_executor_class.return_value = mock_executor

    mock_result = MagicMock()
    mock_executor.execute.return_value = mock_result

    database = Database(database_name="test_db", sqlalchemy_uri="sqlite://")

    result = database.execute("SELECT 1")

    mock_executor_class.assert_called_once_with(database)
    mock_executor.execute.assert_called_once_with("SELECT 1", None)
    assert result == mock_result


def test_database_execute_async_delegates_to_sql_executor(
    mocker: MockerFixture,
) -> None:
    """Test that Database.execute_async() delegates to SQLExecutor.execute_async()."""
    from unittest.mock import MagicMock

    mock_executor_class = mocker.patch("superset.sql.execution.SQLExecutor")
    mock_executor = MagicMock()
    mock_executor_class.return_value = mock_executor

    mock_handle = MagicMock()
    mock_executor.execute_async.return_value = mock_handle

    database = Database(database_name="test_db", sqlalchemy_uri="sqlite://")
    mock_options = MagicMock()

    result = database.execute_async("SELECT 1", mock_options)

    mock_executor_class.assert_called_once_with(database)
    mock_executor.execute_async.assert_called_once_with("SELECT 1", mock_options)
    assert result == mock_handle


def test_database_execute_async_without_options(mocker: MockerFixture) -> None:
    """Test that Database.execute_async() works without options."""
    from unittest.mock import MagicMock

    mock_executor_class = mocker.patch("superset.sql.execution.SQLExecutor")
    mock_executor = MagicMock()
    mock_executor_class.return_value = mock_executor

    mock_handle = MagicMock()
    mock_executor.execute_async.return_value = mock_handle

    database = Database(database_name="test_db", sqlalchemy_uri="sqlite://")

    result = database.execute_async("SELECT 1")

    mock_executor_class.assert_called_once_with(database)
    mock_executor.execute_async.assert_called_once_with("SELECT 1", None)
    assert result == mock_handle


def test_clear_bootstrap_cache_logs_warning_on_failure(
    mocker: MockerFixture,
) -> None:
    """
    Test that clear_bootstrap_cache logs a warning when cache invalidation fails.

    Exercises the ``except Exception`` branch in the event listener so that
    Codecov registers it as covered.  The function must not re-raise the
    exception — callers (SQLAlchemy event dispatch) should be unaffected.
    """
    from superset.models.core import clear_bootstrap_cache

    # Patch cache_manager so delete_memoized raises
    mock_cache = mocker.MagicMock()
    mock_cache.delete_memoized.side_effect = RuntimeError("Redis unavailable")

    mock_cache_manager = mocker.patch("superset.models.core.cache_manager")
    mock_cache_manager.cache = mock_cache

    # Patch cached_common_bootstrap_data so the local import inside
    # clear_bootstrap_cache resolves to our mock.
    mocker.patch(
        "superset.views.base.cached_common_bootstrap_data",
        new=mocker.MagicMock(__name__="cached_common_bootstrap_data"),
    )

    mock_logger = mocker.patch("superset.models.core.logger")

    # Should not raise even though delete_memoized raises
    clear_bootstrap_cache(
        _mapper=mocker.MagicMock(),
        _connection=mocker.MagicMock(),
        _target=mocker.MagicMock(),
    )

    # Verify logger.warning was called with the correct message format
    mock_logger.warning.assert_called_once()
    call_args = mock_logger.warning.call_args
    assert call_args[0][0] == "Failed to clear theme bootstrap cache: %s"


def test_execute_sql_preserves_line_comments_single_statement(
    mocker: MockerFixture,
) -> None:
    """
    A single statement is executed verbatim, so the ``--`` line comments added by
    ``SQL_QUERY_MUTATOR`` are not round-tripped through sqlglot (which would rewrite
    them into ``/* */`` blocks). Regression test for the comment-mangling bug.
    """
    database = Database(database_name="db", sqlalchemy_uri="sqlite://")
    mocker.patch.object(database, "get_sqla_engine")
    mocker.patch.object(database, "get_raw_connection")
    mocker.patch.object(database.db_engine_spec, "fetch_data", return_value=[])
    # Identity mutator so the test isolates whether the SQL got reformatted.
    mocker.patch.object(
        database, "mutate_sql_based_on_config", side_effect=lambda sql, **kwargs: sql
    )
    execute = mocker.patch.object(database.db_engine_spec, "execute")

    sql = "SELECT 1 AS one\n-- user: alice\n-- company: dunder mifflin"
    database._execute_sql_with_mutation_and_logging(sql, fetch_last_result=True)

    executed_sql = execute.call_args.args[1]
    assert executed_sql == sql
    assert "/*" not in executed_sql


def test_post_process_df_non_zero_based_index() -> None:
    """
    post_process_df must not raise when the DataFrame index doesn't contain 0
    as a label (e.g. after filtering).  Regression test for the FutureWarning
    caused by df_series[0] positional-but-label-based access on such Series.
    """
    df = pd.DataFrame({"col": [None, [1, 2], [3, 4]]}, dtype=object)
    df = df[df["col"].notna()]  # index is now [1, 2], not [0, 1, 2]
    result = Database.post_process_df(df)
    assert result["col"].dtype == numpy.object_
    assert result["col"].iloc[0] == "[1, 2]"
    assert result["col"].iloc[1] == "[3, 4]"
