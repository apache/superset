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

from typing import Any

import pytest
import sqlalchemy as sa
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.migrations.shared.catalogs import (
    downgrade_catalog_perms,
    upgrade_catalog_perms,
)

metadata = sa.MetaData()

dbs = sa.Table(
    "dbs",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("database_name", sa.String(250)),
    sa.Column("sqlalchemy_uri", sa.String(1024)),
    sa.Column("encrypted_extra", sa.Text),
)
view_menu = sa.Table(
    "ab_view_menu",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("name", sa.String(250)),
)
tables = sa.Table(
    "tables",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("database_id", sa.Integer),
    sa.Column("schema", sa.String(255)),
    sa.Column("schema_perm", sa.String(1000)),
    sa.Column("catalog", sa.String(256)),
    sa.Column("catalog_perm", sa.String(1000)),
)
query = sa.Table(
    "query",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("database_id", sa.Integer),
    sa.Column("catalog", sa.String(256)),
)

# Engine sets passed by the migrations that call these helpers.
MIGRATION_ENGINES = [
    {"postgresql"},
    {"databricks"},
    {"trino", "presto", "bigquery", "snowflake"},
    None,
]


def _snapshot(session: Session) -> dict[str, list[Any]]:
    return {
        table.name: [tuple(row) for row in session.execute(table.select())]
        for table in metadata.sorted_tables
    }


@pytest.fixture
def populated_session(session: Session) -> Session:
    """
    A metadata DB with existing databases (including catalog-capable engines and
    an encrypted ``encrypted_extra``), datasets, queries and schema permissions.
    """
    metadata.create_all(session.get_bind())
    session.execute(
        dbs.insert(),
        [
            {
                "id": 1,
                "database_name": "my_postgres",
                "sqlalchemy_uri": "postgresql://user:pass@unreachable:5432/db",
                "encrypted_extra": None,
            },
            {
                "id": 2,
                "database_name": "my_bigquery",
                "sqlalchemy_uri": "bigquery://my-project",
                # stored encrypted at rest, so not valid JSON
                "encrypted_extra": "gAAAAABlZ2VuY3J5cHRlZA==",
            },
            {
                "id": 3,
                "database_name": "my_trino",
                "sqlalchemy_uri": "trino://unreachable:8080/hive",
                "encrypted_extra": '{"oauth2_client_info": {"id": "x"}}',
            },
        ],
    )
    session.execute(
        view_menu.insert(),
        [
            {"id": 1, "name": "[my_postgres].[public]"},
            {"id": 2, "name": "[my_bigquery].[dataset]"},
        ],
    )
    session.execute(
        tables.insert(),
        [
            {
                "id": 1,
                "database_id": 1,
                "schema": "public",
                "schema_perm": "[my_postgres].[public]",
            },
            {
                "id": 2,
                "database_id": 2,
                "schema": "dataset",
                "schema_perm": "[my_bigquery].[dataset]",
            },
        ],
    )
    session.execute(query.insert(), [{"id": 1, "database_id": 1}])
    return session


@pytest.mark.parametrize("engines", MIGRATION_ENGINES)
def test_catalog_migrations_do_not_touch_existing_databases(
    mocker: MockerFixture,
    populated_session: Session,
    engines: set[str] | None,
) -> None:
    """
    The catalog migrations run cleanly with existing databases, never connect to
    them, and leave the metadata DB unchanged on upgrade and downgrade.
    """
    create_engine = mocker.patch(
        "sqlalchemy.create_engine",
        side_effect=AssertionError("migration must not connect to a database"),
    )
    before = _snapshot(populated_session)

    upgrade_catalog_perms(engines=engines)
    assert _snapshot(populated_session) == before

    downgrade_catalog_perms(engines=engines)
    assert _snapshot(populated_session) == before

    create_engine.assert_not_called()
