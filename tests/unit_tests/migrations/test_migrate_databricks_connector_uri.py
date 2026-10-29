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
"""Round-trip coverage for saved legacy Databricks connection URIs."""

from collections.abc import Iterator
from importlib import import_module
from unittest.mock import patch

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy.engine import Engine

from superset.utils import json

migration = import_module(
    "superset.migrations.versions."
    "2026-10-29_00-00_b8f3a2c91d64_migrate_databricks_connector_uri"
)
LEGACY = migration.LEGACY_PREFIX
NATIVE = migration.NATIVE_PREFIX
MASKED_SUFFIX = "token:XXXXXXXXXX@example.cloud.databricks.com:443/default"


@pytest.fixture
def engine() -> Iterator[Engine]:
    """Use actual encrypted column types but only the migration's local table."""
    from superset.models.core import Database

    engine = sa.create_engine("sqlite://")
    metadata = sa.MetaData()
    sa.Table(
        "dbs",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("sqlalchemy_uri", sa.String(1024)),
        sa.Column("extra", sa.Text),
        sa.Column("password", Database.__table__.c.password.type),
        sa.Column("encrypted_extra", Database.__table__.c.encrypted_extra.type),
    )
    metadata.create_all(engine)
    yield engine
    engine.dispose()


def _run(engine: Engine, upgrading: bool) -> None:
    """Execute with real Alembic operations and deliberately small batches."""
    with engine.begin() as conn, patch.object(migration, "BATCH_SIZE", 2):
        with Operations.context(MigrationContext.configure(conn)):
            (migration.upgrade if upgrading else migration.downgrade)()


@pytest.mark.parametrize(
    "suffix",
    [
        MASKED_SUFFIX,
        MASKED_SUFFIX + "?z=%2f&catalog=main&http_path=%2Fsql%2F1.0&a=two+words",
        "token:p%40ss%2fword@HOST:443/a%2Fb?duplicate=1&duplicate=2",
    ],
)
def test_upgrade_preserves_uri_suffix_and_encrypted_credentials(
    engine: Engine,
    suffix: str,
) -> None:
    """The prefix alone changes; separate encrypted credentials survive."""
    from superset.models.core import Database

    table = sa.Table("dbs", sa.MetaData(), autoload_with=engine)
    typed_table = sa.table(
        "dbs",
        sa.column("id", sa.Integer),
        sa.column("sqlalchemy_uri", sa.String),
        sa.column("extra", sa.Text),
        sa.column("password", Database.__table__.c.password.type),
        sa.column("encrypted_extra", Database.__table__.c.encrypted_extra.type),
    )
    original_extra = {
        "engine_params": {
            "connect_args": {
                "http_path": "/sql/1.0/warehouses/example",
                "catalog": "main",
            }
        }
    }
    with engine.begin() as conn:
        conn.execute(
            typed_table.insert().values(
                id=1,
                sqlalchemy_uri=LEGACY + suffix,
                extra=json.dumps(original_extra),
                password="migration-test-password",  # noqa: S106
                encrypted_extra='{"other":"test-value"}',
            )
        )
        before = conn.execute(
            sa.select(table.c.password, table.c.encrypted_extra)
        ).one()
    _run(engine, True)
    _run(engine, True)
    with engine.connect() as conn:
        row = conn.execute(sa.select(table)).one()
        assert row.sqlalchemy_uri == NATIVE + suffix
        assert json.loads(row.extra) == {**original_extra, migration.MARKER: True}
        assert (row.password, row.encrypted_extra) == tuple(before)
        decrypted = conn.execute(sa.select(typed_table)).one()
        database = Database(
            sqlalchemy_uri=decrypted.sqlalchemy_uri, password=decrypted.password
        )
        assert database.url_object.password == "migration-test-password"  # noqa: S105
    _run(engine, False)
    with engine.connect() as conn:
        row = conn.execute(sa.select(table)).one()
        assert row.sqlalchemy_uri == LEGACY + suffix
        assert json.loads(row.extra) == original_extra
        assert (row.password, row.encrypted_extra) == tuple(before)


def test_upgrade_batches_and_downgrade_only_converted_rows(engine: Engine) -> None:
    """Shrinking the matching set must not skip rows or convert native URIs."""
    table = migration.databases
    originals = [
        {"id": i, "sqlalchemy_uri": LEGACY + MASKED_SUFFIX, "extra": "{}"}
        for i in range(1, 8)
    ] + [
        {"id": 8, "sqlalchemy_uri": NATIVE + MASKED_SUFFIX, "extra": "{}"},
        {"id": 9, "sqlalchemy_uri": "postgresql://localhost/db", "extra": "{}"},
        {"id": 10, "sqlalchemy_uri": "databricks+pyodbc://localhost/db", "extra": "{}"},
    ]
    with engine.begin() as conn:
        conn.execute(table.insert(), originals)
    _run(engine, True)
    with engine.connect() as conn:
        rows = conn.execute(sa.select(table).order_by(table.c.id)).all()
        assert all(row.sqlalchemy_uri == NATIVE + MASKED_SUFFIX for row in rows[:8])
        assert all(
            json.loads(row.extra).get(migration.MARKER) is True for row in rows[:7]
        )
        assert all(row.extra == "{}" for row in rows[7:])
    _run(engine, False)
    _run(engine, False)
    with engine.connect() as conn:
        assert [
            dict(row._mapping)
            for row in conn.execute(sa.select(table).order_by(table.c.id))
        ] == originals


def test_downgrade_does_not_rewrite_a_subsequently_changed_engine(
    engine: Engine,
) -> None:
    """Remove the marker without overriding a user's later engine change."""
    table = migration.databases
    with engine.begin() as conn:
        conn.execute(
            table.insert().values(
                id=1, sqlalchemy_uri=LEGACY + MASKED_SUFFIX, extra="{}"
            )
        )
    _run(engine, True)
    with engine.begin() as conn:
        assert (
            json.loads(conn.execute(sa.select(table.c.extra)).scalar_one())[
                migration.MARKER
            ]
            is True
        )
        conn.execute(table.update().values(sqlalchemy_uri="postgresql://localhost/db"))
    _run(engine, False)
    with engine.connect() as conn:
        row = conn.execute(sa.select(table)).one()
        assert row.sqlalchemy_uri == "postgresql://localhost/db"
        assert json.loads(row.extra) == {}


@pytest.mark.parametrize("extra", ["not json", "[]", "null"])
def test_upgrade_rejects_invalid_extra_without_losing_settings(
    engine: Engine, extra: str
) -> None:
    """Invalid extra must not be overwritten to make room for the marker."""
    table = migration.databases
    with engine.begin() as conn:
        conn.execute(
            table.insert().values(
                id=1, sqlalchemy_uri=LEGACY + MASKED_SUFFIX, extra=extra
            )
        )
    with pytest.raises(ValueError, match="Invalid extra for database 1"):
        _run(engine, True)
    with engine.connect() as conn:
        row = conn.execute(sa.select(table)).one()
        assert row.sqlalchemy_uri == LEGACY + MASKED_SUFFIX
        assert row.extra == extra
