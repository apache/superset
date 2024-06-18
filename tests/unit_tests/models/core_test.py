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

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import make_url

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.exceptions import OAuth2Error, OAuth2RedirectError
from superset.models.core import Database
from superset.sql_parse import Table
from superset.utils import json
from tests.unit_tests.conftest import with_feature_flags

# sample config for OAuth2 tests
oauth2_client_info = {
    "oauth2_client_info": {
        "id": "my_client_id",
        "secret": "my_client_secret",
        "authorization_request_uri": "https://abcd1234.snowflakecomputing.com/oauth/authorize",
        "token_request_uri": "https://abcd1234.snowflakecomputing.com/oauth/token-request",
        "scope": "refresh_token session:role:SYSADMIN",
    }
}


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


def test_get_prequeries(mocker: MockerFixture) -> None:
    """
    Tests for ``get_prequeries``.
    """
    mocker.patch.object(
        Database,
        "get_sqla_engine",
    )
    db_engine_spec = mocker.patch.object(Database, "db_engine_spec")
    db_engine_spec.get_prequeries.return_value = ["set a=1", "set b=2"]

    database = Database(database_name="db")
    with database.get_raw_connection() as conn:
        conn.cursor().execute.assert_has_calls(
            [mocker.call("set a=1"), mocker.call("set b=2")]
        )


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
    get_inspector.assert_called_with(ssh_tunnel=None)


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

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="trino://",
    )
    database._get_sqla_engine(nullpool=False)

    create_engine.assert_called_with(
        make_url("trino:///"),
        connect_args={"source": "Apache Superset"},
    )


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
        "scope": "refresh_token session:role:SYSADMIN",
        "redirect_uri": "http://example.com/api/v1/database/oauth2/",
    }


def test_raw_connection_oauth(mocker: MockerFixture) -> None:
    """
    Test that we can start OAuth2 from `raw_connection()` errors.

    Some databases that use OAuth2 need to trigger the flow when the connection is
    created, rather than when the query runs. This happens when the SQLAlchemy engine
    URI cannot be built without the user personal token.

    This test verifies that the exception is captured and raised correctly so that the
    frontend can trigger the OAuth2 dance.
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
    database.db_engine_spec.oauth2_exception = OAuth2Error  # type: ignore
    get_sqla_engine = mocker.patch.object(database, "get_sqla_engine")
    get_sqla_engine().__enter__().raw_connection.side_effect = OAuth2Error(
        "OAuth2 required"
    )

    with pytest.raises(OAuth2RedirectError) as excinfo:
        with database.get_raw_connection() as conn:
            conn.cursor()
    assert str(excinfo.value) == "You don't have permission to access the data."
