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

import sqlite3
from contextlib import closing

import pytest
from sqlalchemy import create_engine, text

from superset.db_engine_specs.shillelagh import ShillelaghEngineSpec
from superset.models.core import Database


@pytest.fixture
def local_sqlite_file(tmp_path):
    """A standalone SQLite file that ATTACH would otherwise be able to open."""
    path = tmp_path / "other.db"
    with closing(sqlite3.connect(str(path))) as conn, conn:
        conn.execute("CREATE TABLE t (x TEXT)")
        conn.execute("INSERT INTO t VALUES ('value')")
    return path


def test_register_engine_events_disables_attach(local_sqlite_file) -> None:
    """
    After ``register_engine_events``, ``ATTACH DATABASE`` is rejected on a
    shillelagh connection while ordinary queries keep working.
    """
    engine = create_engine("shillelagh://")
    ShillelaghEngineSpec.register_engine_events(engine)

    with engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar() == 1

        with pytest.raises(Exception, match="attached databases"):
            connection.execute(text(f"ATTACH DATABASE '{local_sqlite_file}' AS other"))


def test_attach_enabled_without_registration(local_sqlite_file) -> None:
    """
    Control: without ``register_engine_events`` the driver still permits ATTACH,
    so the test above exercises a real capability.
    """
    engine = create_engine("shillelagh://")
    with engine.connect() as connection:
        connection.execute(text(f"ATTACH DATABASE '{local_sqlite_file}' AS other"))
        assert connection.execute(text("SELECT x FROM other.t")).scalar() == "value"


def test_database_engine_disables_attach(app_context: None, local_sqlite_file) -> None:
    """
    A database built the normal way, on the reachable ``gsheets://`` dialect that
    inherits the hook, has ATTACH disabled without any explicit registration.
    """
    engine = Database(
        database_name="database",
        sqlalchemy_uri="gsheets://",
    )._get_sqla_engine(nullpool=False)

    with engine.connect() as connection:
        with pytest.raises(Exception, match="attached databases"):
            connection.execute(text(f"ATTACH DATABASE '{local_sqlite_file}' AS other"))
