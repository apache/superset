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
"""Exercise the cleanup index migration against a real metadata table."""

from importlib import import_module

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_cleanup_index_round_trip_preserves_queries() -> None:
    """Match the model index and preserve executed and hidden rows on rollback."""
    from superset.models.sql_lab import Query

    migration = import_module(
        "superset.migrations.versions."
        "2026-11-16_12-30_9a7d3b6e21c4_index_query_preparation_cleanup"
    )
    engine = sa.create_engine("sqlite://")
    table = sa.Table(
        "query",
        sa.MetaData(),
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("status", sa.String(16)),
        sa.Column("start_time", sa.Numeric(20, 6)),
    )
    try:
        with engine.begin() as connection:
            table.create(connection)
            connection.execute(
                table.insert(),
                [
                    {"id": 1, "status": "success", "start_time": 1},
                    {"id": 2, "status": "prepared", "start_time": 2},
                ],
            )
            before = connection.execute(sa.select(table).order_by(table.c.id)).all()
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
                index = sa.inspect(connection).get_indexes("query")
                assert len(index) == 1
                assert index[0]["name"] == "ix_query_status_start_time"
                assert index[0]["column_names"] == ["status", "start_time"]
                assert not index[0]["unique"]
                model_index = next(
                    item
                    for item in Query.__table__.indexes
                    if item.name == index[0]["name"]
                )
                assert list(model_index.columns.keys()) == index[0]["column_names"]
                assert (
                    connection.execute(sa.select(table).order_by(table.c.id)).all()
                    == before
                )
                migration.downgrade()
                assert sa.inspect(connection).get_indexes("query") == []
                assert (
                    connection.execute(sa.select(table).order_by(table.c.id)).all()
                    == before
                )
    finally:
        engine.dispose()
