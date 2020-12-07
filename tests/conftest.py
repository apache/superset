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
# isort:skip_file
from typing import Any

import pytest
from sqlalchemy.engine import Engine

from tests.test_app import app

from superset import db
from superset.utils.core import get_example_database


CTAS_SCHEMA_NAME = "sqllab_test_db"
ADMIN_SCHEMA_NAME = "admin_database"


@pytest.fixture(autouse=True, scope="session")
def setup_sample_data() -> Any:
    with app.app_context():
        setup_presto_if_needed()

        from superset.cli import load_test_users_run

        load_test_users_run()

        from superset import examples

        examples.load_css_templates()
        examples.load_energy(sample=True)
        examples.load_world_bank_health_n_pop(sample=True)
        examples.load_birth_names(sample=True)

    yield

    with app.app_context():
        engine = get_example_database().get_sqla_engine()
        engine.execute("DROP TABLE energy_usage")
        engine.execute("DROP TABLE wb_health_population")
        engine.execute("DROP TABLE birth_names")

        # drop sqlachemy tables

        db.session.commit()
        from sqlalchemy.ext import declarative

        sqla_base = declarative.declarative_base()
        # uses sorted_tables to drop in proper order without violating foreign constrains
        for table in sqla_base.metadata.sorted_tables:
            table.__table__.drop()
        db.session.commit()


def drop_from_schema(engine: Engine, schema_name: str):
    schemas = engine.execute(f"SHOW SCHEMAS").fetchall()
    if schema_name not in [s[0] for s in schemas]:
        # schema doesn't exist
        return
    tables_or_views = engine.execute(f"SHOW TABLES in {schema_name}").fetchall()
    for tv in tables_or_views:
        engine.execute(f"DROP TABLE IF EXISTS {schema_name}.{tv[0]}")
        engine.execute(f"DROP VIEW IF EXISTS {schema_name}.{tv[0]}")


def setup_presto_if_needed():
    backend = app.config["SQLALCHEMY_EXAMPLES_URI"].split("://")[0]
    if backend == "presto":
        # decrease poll interval for tests
        presto_poll_interval = app.config["PRESTO_POLL_INTERVAL"]
        extra = f'{{"engine_params": {{"connect_args": {{"poll_interval": {presto_poll_interval}}}}}}}'
        database = get_example_database()
        database.extra = extra
        db.session.commit()

    if backend in {"presto", "hive"}:
        database = get_example_database()
        engine = database.get_sqla_engine()
        drop_from_schema(engine, CTAS_SCHEMA_NAME)
        engine.execute(f"DROP SCHEMA IF EXISTS {CTAS_SCHEMA_NAME}")
        engine.execute(f"CREATE SCHEMA {CTAS_SCHEMA_NAME}")

        drop_from_schema(engine, ADMIN_SCHEMA_NAME)
        engine.execute(f"DROP SCHEMA IF EXISTS {ADMIN_SCHEMA_NAME}")
        engine.execute(f"CREATE SCHEMA {ADMIN_SCHEMA_NAME}")
