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

from typing import List, Optional

from pytest_mock import MockFixture
from sqlalchemy.engine.reflection import Inspector


def test_get_metrics(mocker: MockFixture) -> None:
    """
    Tests for ``get_metrics``.
    """
    from superset.db_engine_specs.base import MetricType
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.core import Database

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    assert database.get_metrics("table") == [
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
            table_name: str,
            schema: Optional[str],
        ) -> List[MetricType]:
            return [
                {
                    "expression": "COUNT(DISTINCT user_id)",
                    "metric_name": "count_distinct_user_id",
                    "metric_type": "count_distinct",
                    "verbose_name": "COUNT(DISTINCT user_id)",
                },
            ]

    database.get_db_engine_spec = mocker.MagicMock(  # type: ignore
        return_value=CustomSqliteEngineSpec
    )
    assert database.get_metrics("table") == [
        {
            "expression": "COUNT(DISTINCT user_id)",
            "metric_name": "count_distinct_user_id",
            "metric_type": "count_distinct",
            "verbose_name": "COUNT(DISTINCT user_id)",
        },
    ]


def test_get_db_engine_spec(mocker: MockFixture) -> None:
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
