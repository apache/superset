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

from contextlib import contextmanager

from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.orm.session import Session
from sqlalchemy.pool import StaticPool


def test_values_for_column(mocker: MockerFixture, session: Session) -> None:
    """
    Test the `values_for_column` method.

    NULL values should be returned as `None`, not `np.nan`, since NaN cannot be
    serialized to JSON.
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    database = Database(database_name="db", sqlalchemy_uri="sqlite://")

    connection = engine.raw_connection()
    connection.execute("CREATE TABLE t (c INTEGER)")
    connection.execute("INSERT INTO t VALUES (1)")
    connection.execute("INSERT INTO t VALUES (NULL)")
    connection.commit()

    # since we're using an in-memory SQLite database, make sure we always
    # return the same engine where the table was created
    @contextmanager
    def mock_get_sqla_engine_with_context():
        yield engine

    mocker.patch.object(
        database,
        "get_sqla_engine_with_context",
        new=mock_get_sqla_engine_with_context,
    )

    table = SqlaTable(
        database=database,
        schema=None,
        table_name="t",
        columns=[TableColumn(column_name="c")],
    )
    assert table.values_for_column("c") == [1, None]
