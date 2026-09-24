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

import pytest
from pytest_mock import MockerFixture

from superset.constants import TimeGrain
from superset.utils import json
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("text", "'2019-01-02 03:04:05'"),
        ("TEXT", "'2019-01-02 03:04:05'"),
        ("dateTime", "'2019-01-02 03:04:05'"),
        ("DateTime", "'2019-01-02 03:04:05'"),
        ("DATETIME", "'2019-01-02 03:04:05'"),
        ("string", "'2019-01-02 03:04:05'"),
        ("String", "'2019-01-02 03:04:05'"),
        ("STRING", "'2019-01-02 03:04:05'"),
        ("integer", None),
        ("number", None),
        ("unknowntype", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    """Test datetime conversion for various MongoDB column types."""
    from superset.db_engine_specs.mongodb import (
        MongoDBEngineSpec as spec,  # noqa: N813
    )

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_epoch_to_dttm() -> None:
    """Test epoch to datetime conversion."""
    from superset.db_engine_specs.mongodb import (
        MongoDBEngineSpec as spec,  # noqa: N813
    )

    # MongoDB engine just passes through the column expression
    assert spec.epoch_to_dttm() == "datetime({col}, 'unixepoch')"


@pytest.mark.parametrize(
    "grain,expected_expression",
    [
        (None, "{col}"),
        (TimeGrain.SECOND, "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:%S', {col}))"),
        (TimeGrain.MINUTE, "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:00', {col}))"),
        (TimeGrain.HOUR, "DATETIME(STRFTIME('%Y-%m-%dT%H:00:00', {col}))"),
        (TimeGrain.DAY, "DATETIME({col}, 'start of day')"),
        (
            TimeGrain.WEEK,
            "DATETIME({col}, 'start of day', -strftime('%w', {col}) || ' days')",
        ),
        (TimeGrain.MONTH, "DATETIME({col}, 'start of month')"),
        (
            TimeGrain.QUARTER,
            "DATETIME({col}, 'start of month', "
            "printf('-%d month', (strftime('%m', {col}) - 1) % 3))",
        ),
        (TimeGrain.YEAR, "DATETIME({col}, 'start of year')"),
        (
            TimeGrain.WEEK_ENDING_SATURDAY,
            "DATETIME({col}, 'start of day', 'weekday 6')",
        ),
        (
            TimeGrain.WEEK_ENDING_SUNDAY,
            "DATETIME({col}, 'start of day', 'weekday 0')",
        ),
        (
            TimeGrain.WEEK_STARTING_SUNDAY,
            "DATETIME({col}, 'start of day', 'weekday 0', '-7 days')",
        ),
        (
            TimeGrain.WEEK_STARTING_MONDAY,
            "DATETIME({col}, 'start of day', 'weekday 1', '-7 days')",
        ),
    ],
)
def test_time_grain_expressions(
    grain: Optional[TimeGrain],
    expected_expression: str,
) -> None:
    """Test time grain expressions for MongoDB."""
    from superset.db_engine_specs.mongodb import (
        MongoDBEngineSpec as spec,  # noqa: N813
    )

    # pylint: disable=protected-access
    actual = spec._time_grain_expressions.get(grain)
    assert actual == expected_expression


def test_engine_metadata() -> None:
    """Test MongoDB engine specification metadata."""
    from superset.db_engine_specs.mongodb import (
        MongoDBEngineSpec as spec,  # noqa: N813
    )

    assert spec.engine == "mongodb"
    assert spec.engine_name == "MongoDB"
    assert spec.force_column_alias_quotes is False
    assert spec.supports_dynamic_schema is True


@pytest.mark.parametrize(
    "connect_args,schema,expected",
    [
        ({"foo": "bar"}, "dbtwo", {"foo": "bar", "database": "dbtwo"}),
        ({"foo": "bar"}, None, {"foo": "bar"}),
        (
            {"database": "dbone", "authSource": "dbone"},
            "dbtwo",
            {"database": "dbtwo", "authSource": "dbone"},
        ),
    ],
)
def test_adjust_engine_params(
    connect_args: dict[str, Any],
    schema: Optional[str],
    expected: dict[str, Any],
) -> None:
    """
    The selected schema is applied through the ``database`` connect argument and
    the URI is left untouched, since its database is the default ``authSource``.
    """
    from sqlalchemy.engine.url import make_url

    from superset.db_engine_specs.mongodb import MongoDBEngineSpec

    uri = "mongodb://user:pass@host:27017/dbone?mode=superset"
    original = dict(connect_args)

    adjusted, new_connect_args = MongoDBEngineSpec.adjust_engine_params(
        make_url(uri), connect_args, schema=schema
    )

    assert adjusted.render_as_string(hide_password=False) == uri
    assert new_connect_args == expected
    assert connect_args == original


@pytest.mark.parametrize(
    "uri,connect_args,expected_auth_source",
    [
        ("mongodb://user:pass@host:27017/dbone?mode=superset", {}, "dbone"),
        (
            "mongodb://user:pass@host:27017/dbone?mode=superset&authSource=admin",
            {},
            "admin",
        ),
        (
            "mongodb://user:pass@host:27017/dbone?mode=superset",
            {"database": "dbone", "authSource": "dbone"},
            "dbone",
        ),
    ],
)
def test_adjust_engine_params_driver(
    uri: str,
    connect_args: dict[str, Any],
    expected_auth_source: str,
) -> None:
    """
    With the real driver, selecting ``dbtwo`` queries ``dbtwo`` while keeping the
    original authentication database.
    """
    pytest.importorskip("pymongosql")

    from sqlalchemy import create_engine
    from sqlalchemy.engine.url import make_url

    from superset.db_engine_specs.mongodb import MongoDBEngineSpec

    adjusted, new_connect_args = MongoDBEngineSpec.adjust_engine_params(
        make_url(uri), connect_args, schema="dbtwo"
    )
    engine = create_engine(
        adjusted, connect_args={**new_connect_args, "connect": False}
    )
    connection = engine.raw_connection().driver_connection
    try:
        credentials = connection.client.options.pool_options._credentials
        assert connection.database_name == "dbtwo"
        assert credentials.source == expected_auth_source
    finally:
        connection.close()


def test_get_schema_from_engine_params() -> None:
    from sqlalchemy.engine.url import make_url

    from superset.db_engine_specs.mongodb import MongoDBEngineSpec

    assert (
        MongoDBEngineSpec.get_schema_from_engine_params(
            make_url("mongodb://user:pass@host:27017/dbone?mode=superset"), {}
        )
        == "dbone"
    )
    assert (
        MongoDBEngineSpec.get_schema_from_engine_params(
            make_url("mongodb://user:pass@host:27017"), {}
        )
        is None
    )
    assert (
        MongoDBEngineSpec.get_schema_from_engine_params(
            make_url("mongodb://user:pass@host:27017/dbone?mode=superset"),
            {"database": "dbtwo"},
        )
        == "dbtwo"
    )


def test_get_default_schema() -> None:
    from superset.db_engine_specs.mongodb import MongoDBEngineSpec
    from superset.models.core import Database

    database = Database(
        database_name="mongo",
        sqlalchemy_uri="mongodb://user:pass@host:27017/dbone?mode=superset",
    )

    assert MongoDBEngineSpec.get_default_schema(database, None) == "dbone"

    database.extra = json.dumps(
        {"engine_params": {"connect_args": {"database": "dbtwo"}}}
    )
    assert MongoDBEngineSpec.get_default_schema(database, None) == "dbtwo"


def test_get_default_schema_for_query(mocker: MockerFixture) -> None:
    """
    Access checks must resolve unqualified collections against the query schema,
    which is the database the connection is bound to.
    """
    from superset.db_engine_specs.mongodb import MongoDBEngineSpec
    from superset.models.core import Database

    database = Database(
        database_name="mongo",
        sqlalchemy_uri="mongodb://user:pass@host:27017/dbone?mode=superset",
    )
    query = mocker.MagicMock(schema="dbtwo", catalog=None)

    assert MongoDBEngineSpec.get_default_schema_for_query(database, query) == "dbtwo"


def test_select_star_does_not_qualify_collection(mocker: MockerFixture) -> None:
    """
    PyMongoSQL treats ``schema.collection`` as a literal collection name, so the
    preview query must reference the bare collection and rely on the schema
    being applied to the connection instead.
    """
    from sqlalchemy.engine.default import DefaultDialect

    from superset.db_engine_specs.mongodb import MongoDBEngineSpec
    from superset.sql.parse import Table

    database = mocker.MagicMock()
    database.compile_sqla_query.side_effect = lambda qry, catalog, schema: str(
        qry.compile(dialect=DefaultDialect(), compile_kwargs={"literal_binds": True})
    )

    sql = MongoDBEngineSpec.select_star(
        database,
        Table("orders", "testdb"),
        DefaultDialect(),
        limit=10,
        show_cols=False,
        latest_partition=False,
    )

    assert sql == "SELECT\n  *\nFROM orders\nLIMIT 10"
    database.compile_sqla_query.assert_called_once()
    assert database.compile_sqla_query.call_args.args[1:] == (None, "testdb")


def test_get_sqla_engine_applies_selected_schema() -> None:
    """
    The ``database`` connect argument returned by ``adjust_engine_params`` must
    reach the driver when the engine is built through ``Database``.
    """
    pytest.importorskip("pymongosql")

    from superset.models.core import Database

    database = Database(
        database_name="mongo",
        sqlalchemy_uri="mongodb://user:pass@host:27017/dbone?mode=superset",
        extra=json.dumps({"engine_params": {"connect_args": {"connect": False}}}),
    )

    with database.get_sqla_engine(schema="dbtwo") as engine:
        raw_connection = engine.raw_connection()
        try:
            connection = raw_connection.driver_connection
            credentials = connection.client.options.pool_options._credentials
            assert connection.database_name == "dbtwo"
            assert credentials.source == "dbone"
        finally:
            raw_connection.close()
