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
from __future__ import annotations

import contextlib
import functools
import os
from textwrap import dedent
from typing import Any, Callable, TYPE_CHECKING
from unittest.mock import patch

import pytest
from flask.ctx import AppContext
from flask_appbuilder.security.sqla import models as ab_models
from sqlalchemy.engine import Engine

from superset import db, security_manager
from superset.extensions import feature_flag_manager
from superset.utils.database import get_example_database, remove_database
from superset.utils.json import json_dumps_w_dates
from tests.integration_tests.test_app import app, login

if TYPE_CHECKING:
    from flask.testing import FlaskClient

    from superset.connectors.sqla.models import Database

CTAS_SCHEMA_NAME = "sqllab_test_db"
ADMIN_SCHEMA_NAME = "admin_database"


@pytest.fixture
def app_context():
    with app.app_context() as ctx:
        yield ctx


@pytest.fixture
def test_client(app_context: AppContext):
    with app.test_client() as client:
        yield client


@pytest.fixture
def login_as(test_client: FlaskClient[Any]):
    """Fixture with app context and logged in admin user."""

    def _login_as(username: str, password: str = "general"):
        login(test_client, username=username, password=password)

    yield _login_as
    # no need to log out as both app_context and test_client are
    # function level fixtures anyway


@pytest.fixture
def login_as_admin(login_as: Callable[..., None]):
    yield login_as("admin")


@pytest.fixture
def create_user(app_context: AppContext):
    def _create_user(username: str, role: str = "Admin", password: str = "general"):
        security_manager.add_user(
            username,
            "firstname",
            "lastname",
            "email@exaple.com",
            security_manager.find_role(role),
            password,
        )
        return security_manager.find_user(username)

    return _create_user


@pytest.fixture
def get_user(app_context: AppContext):
    def _get_user(username: str) -> ab_models.User:
        return (
            db.session.query(security_manager.user_model)
            .filter_by(username=username)
            .one_or_none()
        )

    return _get_user


@pytest.fixture
def get_or_create_user(get_user, create_user) -> ab_models.User:
    @contextlib.contextmanager
    def _get_user(username: str) -> ab_models.User:
        user = get_user(username)
        if not user:
            # if user is created by test, remove it after done
            user = create_user(username)
            yield user
            db.session.delete(user)
        else:
            yield user

    return _get_user


@pytest.fixture(autouse=True, scope="session")
def setup_sample_data() -> Any:
    # TODO(john-bodley): Determine a cleaner way of setting up the sample data without
    # relying on `tests.integration_tests.test_app.app` leveraging an `app` fixture
    # which is purposely scoped to the function level to ensure tests remain idempotent.
    with app.app_context():
        setup_presto_if_needed()

        from superset.examples.css_templates import load_css_templates

        load_css_templates()

    yield

    with app.app_context():
        # drop sqlalchemy tables
        db.session.commit()
        from sqlalchemy.ext import declarative

        sqla_base = declarative.declarative_base()
        # uses sorted_tables to drop in proper order without violating foreign constrains
        for table in sqla_base.metadata.sorted_tables:
            table.__table__.drop()
        db.session.commit()


def drop_from_schema(engine: Engine, schema_name: str):
    schemas = engine.execute(f"SHOW SCHEMAS").fetchall()  # noqa: F541
    if schema_name not in [s[0] for s in schemas]:
        # schema doesn't exist
        return
    tables_or_views = engine.execute(f"SHOW TABLES in {schema_name}").fetchall()
    for tv in tables_or_views:
        engine.execute(f"DROP TABLE IF EXISTS {schema_name}.{tv[0]}")
        engine.execute(f"DROP VIEW IF EXISTS {schema_name}.{tv[0]}")


@pytest.fixture(scope="session")
def example_db_provider() -> Callable[[], Database]:  # type: ignore
    class _example_db_provider:
        _db: Database | None = None

        def __call__(self) -> Database:
            if self._db is None:
                with app.app_context():
                    self._db = get_example_database()
                    self._load_lazy_data_to_decouple_from_session()

            return self._db

        def _load_lazy_data_to_decouple_from_session(self) -> None:
            self._db._get_sqla_engine()  # type: ignore
            self._db.backend  # type: ignore

        def remove(self) -> None:
            if self._db:
                with app.app_context():
                    remove_database(self._db)

    _instance = _example_db_provider()

    yield _instance

    # TODO - can not use it until referenced objects will be deleted.
    # _instance.remove()


def setup_presto_if_needed():
    db_uri = (
        app.config.get("SQLALCHEMY_EXAMPLES_URI")
        or app.config["SQLALCHEMY_DATABASE_URI"]
    )
    backend = db_uri.split("://")[0]
    database = get_example_database()
    extra = database.get_extra()

    if backend == "presto":
        # decrease poll interval for tests
        extra = {
            **extra,
            "engine_params": {
                "connect_args": {"poll_interval": app.config["PRESTO_POLL_INTERVAL"]}
            },
        }
    else:
        # remove `poll_interval` from databases that do not support it
        extra = {**extra, "engine_params": {}}
    database.extra = json_dumps_w_dates(extra)
    db.session.commit()

    if backend in {"presto", "hive"}:
        database = get_example_database()
        with database.get_sqla_engine() as engine:
            drop_from_schema(engine, CTAS_SCHEMA_NAME)
            engine.execute(f"DROP SCHEMA IF EXISTS {CTAS_SCHEMA_NAME}")
            engine.execute(f"CREATE SCHEMA {CTAS_SCHEMA_NAME}")

            drop_from_schema(engine, ADMIN_SCHEMA_NAME)
            engine.execute(f"DROP SCHEMA IF EXISTS {ADMIN_SCHEMA_NAME}")
            engine.execute(f"CREATE SCHEMA {ADMIN_SCHEMA_NAME}")


def with_feature_flags(**mock_feature_flags):
    """
    Use this decorator to mock feature flags in tests.integration_tests.

    Usage:

        class TestYourFeature(SupersetTestCase):

            @with_feature_flags(YOUR_FEATURE=True)
            def test_your_feature_enabled(self):
                self.assertEqual(is_feature_enabled("YOUR_FEATURE"), True)

            @with_feature_flags(YOUR_FEATURE=False)
            def test_your_feature_disabled(self):
                self.assertEqual(is_feature_enabled("YOUR_FEATURE"), False)
    """

    def mock_get_feature_flags():
        feature_flags = feature_flag_manager._feature_flags or {}
        return {**feature_flags, **mock_feature_flags}

    def decorate(test_fn):
        def wrapper(*args, **kwargs):
            with patch.object(
                feature_flag_manager,
                "get_feature_flags",
                side_effect=mock_get_feature_flags,
            ):
                test_fn(*args, **kwargs)

        return functools.update_wrapper(wrapper, test_fn)

    return decorate


def with_config(override_config: dict[str, Any]):
    """
    Use this decorator to mock specific config keys.

    Usage:

        class TestYourFeature(SupersetTestCase):

            @with_config({"SOME_CONFIG": True})
            def test_your_config(self):
                self.assertEqual(curren_app.config["SOME_CONFIG"), True)

    """

    def decorate(test_fn):
        config_backup = {}

        def wrapper(*args, **kwargs):
            from flask import current_app

            for key, value in override_config.items():
                config_backup[key] = current_app.config[key]
                current_app.config[key] = value
            test_fn(*args, **kwargs)
            for key, value in config_backup.items():
                current_app.config[key] = value

        return functools.update_wrapper(wrapper, test_fn)

    return decorate


@pytest.fixture
def virtual_dataset():
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn

    dataset = SqlaTable(
        table_name="virtual_dataset",
        sql=(
            dedent("""\
            SELECT 0 as col1, 'a' as col2, 1.0 as col3, NULL as col4, '2000-01-01 00:00:00' as col5, 1 as col6
            UNION ALL
            SELECT 1, 'b', 1.1, NULL, '2000-01-02 00:00:00', NULL
            UNION ALL
            SELECT 2 as col1, 'c' as col2, 1.2, NULL, '2000-01-03 00:00:00', 3
            UNION ALL
            SELECT 3 as col1, 'd' as col2, 1.3, NULL, '2000-01-04 00:00:00', 4
            UNION ALL
            SELECT 4 as col1, 'e' as col2, 1.4, NULL, '2000-01-05 00:00:00', 5
            UNION ALL
            SELECT 5 as col1, 'f' as col2, 1.5, NULL, '2000-01-06 00:00:00', 6
            UNION ALL
            SELECT 6 as col1, 'g' as col2, 1.6, NULL, '2000-01-07 00:00:00', 7
            UNION ALL
            SELECT 7 as col1, 'h' as col2, 1.7, NULL, '2000-01-08 00:00:00', 8
            UNION ALL
            SELECT 8 as col1, 'i' as col2, 1.8, NULL, '2000-01-09 00:00:00', 9
            UNION ALL
            SELECT 9 as col1, 'j' as col2, 1.9, NULL, '2000-01-10 00:00:00', 10
        """)
        ),
        database=get_example_database(),
    )
    TableColumn(column_name="col1", type="INTEGER", table=dataset)
    TableColumn(column_name="col2", type="VARCHAR(255)", table=dataset)
    TableColumn(column_name="col3", type="DECIMAL(4,2)", table=dataset)
    TableColumn(column_name="col4", type="VARCHAR(255)", table=dataset)
    # Different database dialect datetime type is not consistent, so temporarily use varchar
    TableColumn(column_name="col5", type="VARCHAR(255)", table=dataset)
    TableColumn(column_name="col6", type="INTEGER", table=dataset)

    SqlMetric(metric_name="count", expression="count(*)", table=dataset)
    db.session.add(dataset)
    db.session.commit()

    yield dataset

    db.session.delete(dataset)
    db.session.commit()


@pytest.fixture
def virtual_dataset_with_comments():
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn

    dataset = SqlaTable(
        table_name="virtual_dataset_with_comments",
        sql=(
            dedent("""\
            --COMMENT
            /*COMMENT*/
            WITH cte as (--COMMENT
                SELECT 2 as col1, /*COMMENT*/'j' as col2, 1.9, NULL, '2000-01-10 00:00:00', 10
            )
            SELECT 0 as col1, 'a' as col2, 1.0 as col3, NULL as col4, '2000-01-01 00:00:00' as col5, 1 as col6
            \n /*  COMMENT */ \n
            UNION ALL/*COMMENT*/
            SELECT 1 as col1, 'f' as col2, 1.5, NULL, '2000-01-06 00:00:00', 6 --COMMENT
            UNION ALL--COMMENT
            SELECT * FROM cte --COMMENT""")
        ),
        database=get_example_database(),
    )
    TableColumn(column_name="col1", type="INTEGER", table=dataset)
    TableColumn(column_name="col2", type="VARCHAR(255)", table=dataset)
    TableColumn(column_name="col3", type="DECIMAL(4,2)", table=dataset)
    TableColumn(column_name="col4", type="VARCHAR(255)", table=dataset)
    # Different database dialect datetime type is not consistent, so temporarily use varchar
    TableColumn(column_name="col5", type="VARCHAR(255)", table=dataset)
    TableColumn(column_name="col6", type="INTEGER", table=dataset)

    SqlMetric(metric_name="count", expression="count(*)", table=dataset)
    db.session.add(dataset)
    db.session.commit()

    yield dataset

    db.session.delete(dataset)
    db.session.commit()


@pytest.fixture
def physical_dataset():
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.connectors.sqla.utils import get_identifier_quoter

    example_database = get_example_database()

    with example_database.get_sqla_engine() as engine:
        quoter = get_identifier_quoter(engine.name)
        # sqlite can only execute one statement at a time
        engine.execute(
            f"""
            CREATE TABLE IF NOT EXISTS physical_dataset(
            col1 INTEGER,
            col2 VARCHAR(255),
            col3 DECIMAL(4,2),
            col4 VARCHAR(255),
            col5 TIMESTAMP DEFAULT '1970-01-01 00:00:01',
            col6 TIMESTAMP DEFAULT '1970-01-01 00:00:01',
            {quoter('time column with spaces')} TIMESTAMP DEFAULT '1970-01-01 00:00:01'
            );
            """
        )
        engine.execute(
            """
            INSERT INTO physical_dataset values
            (0, 'a', 1.0, NULL, '2000-01-01 00:00:00', '2002-01-03 00:00:00', '2002-01-03 00:00:00'),
            (1, 'b', 1.1, NULL, '2000-01-02 00:00:00', '2002-02-04 00:00:00', '2002-02-04 00:00:00'),
            (2, 'c', 1.2, NULL, '2000-01-03 00:00:00', '2002-03-07 00:00:00', '2002-03-07 00:00:00'),
            (3, 'd', 1.3, NULL, '2000-01-04 00:00:00', '2002-04-12 00:00:00', '2002-04-12 00:00:00'),
            (4, 'e', 1.4, NULL, '2000-01-05 00:00:00', '2002-05-11 00:00:00', '2002-05-11 00:00:00'),
            (5, 'f', 1.5, NULL, '2000-01-06 00:00:00', '2002-06-13 00:00:00', '2002-06-13 00:00:00'),
            (6, 'g', 1.6, NULL, '2000-01-07 00:00:00', '2002-07-15 00:00:00', '2002-07-15 00:00:00'),
            (7, 'h', 1.7, NULL, '2000-01-08 00:00:00', '2002-08-18 00:00:00', '2002-08-18 00:00:00'),
            (8, 'i', 1.8, NULL, '2000-01-09 00:00:00', '2002-09-20 00:00:00', '2002-09-20 00:00:00'),
            (9, 'j', 1.9, NULL, '2000-01-10 00:00:00', '2002-10-22 00:00:00', '2002-10-22 00:00:00');
        """
        )

    dataset = SqlaTable(
        table_name="physical_dataset",
        database=example_database,
    )
    TableColumn(column_name="col1", type="INTEGER", table=dataset)
    TableColumn(column_name="col2", type="VARCHAR(255)", table=dataset)
    TableColumn(column_name="col3", type="DECIMAL(4,2)", table=dataset)
    TableColumn(column_name="col4", type="VARCHAR(255)", table=dataset)
    TableColumn(column_name="col5", type="TIMESTAMP", is_dttm=True, table=dataset)
    TableColumn(column_name="col6", type="TIMESTAMP", is_dttm=True, table=dataset)
    TableColumn(
        column_name="time column with spaces",
        type="TIMESTAMP",
        is_dttm=True,
        table=dataset,
    )
    SqlMetric(metric_name="count", expression="count(*)", table=dataset)
    db.session.add(dataset)
    db.session.commit()

    yield dataset

    engine.execute(
        """
        DROP TABLE physical_dataset;
    """
    )
    dataset = db.session.query(SqlaTable).filter_by(table_name="physical_dataset").all()
    for ds in dataset:
        db.session.delete(ds)
    db.session.commit()


@pytest.fixture
def virtual_dataset_comma_in_column_value():
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn

    dataset = SqlaTable(
        table_name="virtual_dataset",
        sql=(
            "SELECT 'col1,row1' as col1, 'col2, row1' as col2 "
            "UNION ALL "
            "SELECT 'col1,row2' as col1, 'col2, row2' as col2 "
            "UNION ALL "
            "SELECT 'col1,row3' as col1, 'col2, row3' as col2 "
        ),
        database=get_example_database(),
    )
    TableColumn(column_name="col1", type="VARCHAR(255)", table=dataset)
    TableColumn(column_name="col2", type="VARCHAR(255)", table=dataset)

    SqlMetric(metric_name="count", expression="count(*)", table=dataset)
    db.session.add(dataset)
    db.session.commit()

    yield dataset

    db.session.delete(dataset)
    db.session.commit()


only_postgresql = pytest.mark.skipif(
    "postgresql" not in os.environ.get("SUPERSET__SQLALCHEMY_DATABASE_URI", ""),
    reason="Only run test case in Postgresql",
)

only_sqlite = pytest.mark.skipif(
    "sqlite" not in os.environ.get("SUPERSET__SQLALCHEMY_DATABASE_URI", ""),
    reason="Only run test case in SQLite",
)

only_mysql = pytest.mark.skipif(
    "mysql" not in os.environ.get("SUPERSET__SQLALCHEMY_DATABASE_URI", ""),
    reason="Only run test case in MySQL",
)
