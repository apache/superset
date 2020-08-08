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

import pytest
from sqlalchemy.engine import Engine

from superset.utils.core import get_example_database
from tests.test_app import app

CTAS_SCHEMA_NAME = "sqllab_test_db"


def drop_from_schema(engine: Engine, schema_name: str):
    schemas = engine.execute(f"SHOW SCHEMAS").fetchall()
    if schema_name not in [s[0] for s in schemas]:
        # schema doesn't exist
        return
    tables = engine.execute(
        f"SELECT table_name from information_schema.tables where table_schema = '{schema_name}'"
    ).fetchall()
    views = engine.execute(
        f"SELECT table_name from information_schema.views where table_schema = '{schema_name}'"
    ).fetchall()
    for tv in tables + views:
        engine.execute(f"DROP TABLE IF EXISTS {schema_name}.{tv[0]}")
        engine.execute(f"DROP VIEW IF EXISTS {schema_name}.{tv[0]}")


@pytest.fixture(scope="module", autouse=True)
def setup_presto_if_needed():
    with app.app_context():
        examples_db = get_example_database()
        if examples_db.backend == "presto":
            engine = examples_db.get_sqla_engine()

            drop_from_schema(engine, CTAS_SCHEMA_NAME)
            engine.execute(f"DROP SCHEMA IF EXISTS {CTAS_SCHEMA_NAME}")
            engine.execute(f"CREATE SCHEMA {CTAS_SCHEMA_NAME}")

            drop_from_schema(engine, "admin_database")
            engine.execute("DROP SCHEMA IF EXISTS admin_database")
            engine.execute("CREATE SCHEMA admin_database")
