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
from typing import Any
from unittest.mock import MagicMock, patch

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
        sa.Column("changed_on", sa.DateTime),
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
            for row in conn.execute(
                sa.select(table.c.id, table.c.sqlalchemy_uri, table.c.extra).order_by(
                    table.c.id
                )
            )
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


@pytest.mark.parametrize(
    "extra",
    [
        "not json",
        "",
        None,
        "[]",
        "null",
        '{"' + migration.MARKER,
        '{"' + migration.MARKER + '":false}',
        json.dumps({migration.MARKER: True}),
        "[" * 1100,
    ],
)
def test_upgrade_preserves_invalid_extra_and_downgrades_only_unchanged_rows(
    engine: Engine, extra: str | None
) -> None:
    """A bad row must not block later batches or lose its original text."""
    from datetime import datetime

    table = sa.Table("dbs", sa.MetaData(), autoload_with=engine)
    originals = [
        {"id": i, "sqlalchemy_uri": LEGACY + MASKED_SUFFIX, "extra": extra}
        for i in range(1, 7)
    ] + [
        {"id": 7, "sqlalchemy_uri": NATIVE + MASKED_SUFFIX, "extra": "not json"},
        {"id": 8, "sqlalchemy_uri": LEGACY + MASKED_SUFFIX, "extra": "{}"},
    ]
    with engine.begin() as conn:
        conn.execute(table.insert(), originals)
    _run(engine, True)
    _run(engine, True)
    with engine.begin() as conn:
        rows = conn.execute(sa.select(table).order_by(table.c.id)).all()
        assert all(row.sqlalchemy_uri == NATIVE + MASKED_SUFFIX for row in rows)
        assert [row.extra for row in rows[:6]] == [extra] * 6
        assert rows[6].extra == "not json"
        assert json.loads(rows[7].extra)[migration.MARKER] is True
        conn.execute(table.update().where(table.c.id == 2).values(extra="{}"))
        conn.execute(
            table.update()
            .where(table.c.id == 3)
            .values(sqlalchemy_uri=NATIVE + MASKED_SUFFIX + "?catalog=edited")
        )
        conn.execute(
            table.update()
            .where(table.c.id == 4)
            .values(sqlalchemy_uri="postgresql://localhost/db")
        )
        conn.execute(
            table.update()
            .where(table.c.id == 5)
            .values(changed_on=datetime(2026, 1, 1))
        )
        conn.execute(table.delete().where(table.c.id == 6))
    _run(engine, False)
    _run(engine, False)
    with engine.connect() as conn:
        rows = {row.id: row for row in conn.execute(sa.select(table))}
        assert rows[1].sqlalchemy_uri == LEGACY + MASKED_SUFFIX
        if extra == json.dumps({migration.MARKER: True}):
            assert json.loads(rows[1].extra) == {}
        else:
            assert rows[1].extra == extra
        assert rows[2].sqlalchemy_uri == NATIVE + MASKED_SUFFIX
        assert rows[2].extra == "{}"
        assert rows[3].sqlalchemy_uri == NATIVE + MASKED_SUFFIX + "?catalog=edited"
        assert rows[4].sqlalchemy_uri == "postgresql://localhost/db"
        assert rows[5].sqlalchemy_uri == NATIVE + MASKED_SUFFIX
        assert rows[7].sqlalchemy_uri == NATIVE + MASKED_SUFFIX
        assert rows[7].extra == "not json"
        assert rows[8].sqlalchemy_uri == LEGACY + MASKED_SUFFIX
        assert json.loads(rows[8].extra) == {}


def test_converted_connection_extra_can_be_imported(engine: Engine) -> None:
    """Exports of converted connections carry the marker; import must accept it."""
    from superset.databases.schemas import ImportV1DatabaseExtraSchema

    table = migration.databases
    original_extra = {"engine_params": {"connect_args": {"http_path": "/sql/1.0"}}}
    with engine.begin() as conn:
        conn.execute(
            table.insert().values(
                id=1,
                sqlalchemy_uri=LEGACY + MASKED_SUFFIX,
                extra=json.dumps(original_extra),
            )
        )
    _run(engine, True)
    with engine.connect() as conn:
        exported_extra = json.loads(conn.execute(sa.select(table.c.extra)).scalar_one())
    assert ImportV1DatabaseExtraSchema().load(exported_extra) == {
        **original_extra,
        migration.MARKER: True,
    }


@pytest.mark.parametrize("edit", ["uri", "extra", "changed_on", "malformed_extra"])
def test_downgrade_preserves_edits_to_converted_native_connection(
    engine: Engine, edit: str
) -> None:
    """An edited Databricks row must not be reverted merely due to its marker."""
    from datetime import datetime

    table = sa.Table("dbs", sa.MetaData(), autoload_with=engine)
    with engine.begin() as conn:
        conn.execute(
            table.insert().values(
                id=1, sqlalchemy_uri=LEGACY + MASKED_SUFFIX, extra="{}"
            )
        )
    _run(engine, True)
    with engine.begin() as conn:
        changes = {
            "uri": {"sqlalchemy_uri": NATIVE + MASKED_SUFFIX + "?catalog=edited"},
            "extra": {"extra": json.dumps({migration.MARKER: True, "edited": True})},
            "changed_on": {"changed_on": datetime(2026, 1, 1)},
            "malformed_extra": {"extra": "not json"},
        }
        conn.execute(table.update().values(**changes[edit]))
        expected_uri = conn.execute(sa.select(table.c.sqlalchemy_uri)).scalar_one()
    _run(engine, False)
    with engine.connect() as conn:
        row = conn.execute(sa.select(table)).one()
        assert row.sqlalchemy_uri == expected_uri
        if edit == "malformed_extra":
            assert row.extra == "not json"
            return
        assert migration.MARKER not in json.loads(row.extra)
        if edit == "extra":
            assert json.loads(row.extra)["edited"] is True


def test_downgrade_imported_marker_and_unmarked_native_rows(engine: Engine) -> None:
    """Imported markers retain their meaning, unlike unmarked native rows."""
    table = migration.databases
    _run(engine, True)
    rows = [
        {
            "id": 1,
            "sqlalchemy_uri": NATIVE + MASKED_SUFFIX,
            "extra": json.dumps({migration.MARKER: True}),
        },
        {"id": 2, "sqlalchemy_uri": NATIVE + MASKED_SUFFIX, "extra": "{}"},
        {"id": 3, "sqlalchemy_uri": NATIVE + MASKED_SUFFIX, "extra": "not json"},
    ]
    with engine.begin() as conn:
        conn.execute(table.insert(), rows)
    _run(engine, False)
    _run(engine, False)
    with engine.connect() as conn:
        converted, native, malformed = conn.execute(
            sa.select(table).order_by(table.c.id)
        )
        assert converted.sqlalchemy_uri == LEGACY + MASKED_SUFFIX
        assert json.loads(converted.extra) == {}
        assert native.sqlalchemy_uri == NATIVE + MASKED_SUFFIX
        assert native.extra == "{}"
        assert malformed.sqlalchemy_uri == NATIVE + MASKED_SUFFIX
        assert malformed.extra == "not json"
    assert not sa.inspect(engine).has_table("databricks_uri_migration")
    _run(engine, True)
    with engine.connect() as conn:
        assert all(
            row.sqlalchemy_uri == NATIVE + MASKED_SUFFIX
            for row in conn.execute(sa.select(table))
        )


@pytest.mark.parametrize("upgrading", [True, False])
def test_migration_preserves_edit_after_batch_read(
    engine: Engine, upgrading: bool
) -> None:
    """A concurrent edit must win over the batch's stale connection settings."""
    table = migration.databases
    with engine.begin() as conn:
        conn.execute(
            table.insert().values(
                id=1, sqlalchemy_uri=LEGACY + MASKED_SUFFIX, extra="{}"
            )
        )
    if not upgrading:
        _run(engine, True)
    with engine.begin() as conn:
        original_execute = conn.execute
        edited = False

        def execute(
            statement: sa.sql.Executable, *args: object, **kwargs: object
        ) -> Any:
            """Materialize a batch, then edit the row before the migration writes."""
            nonlocal edited
            result = original_execute(statement, *args, **kwargs)
            if isinstance(statement, sa.sql.Select) and not edited:
                rows = result.fetchall()
                original_execute(
                    table.update()
                    .where(table.c.id == 1)
                    .values(
                        sqlalchemy_uri="postgresql://edited/db",
                        extra='{"edited":true}',
                    )
                )
                edited = True
                result = MagicMock()
                result.fetchall.return_value = rows
            return result

        with (
            Operations.context(MigrationContext.configure(conn)),
            patch.object(conn, "execute", side_effect=execute),
        ):
            if upgrading:
                migration.upgrade()
            else:
                migration.downgrade()
        row = original_execute(sa.select(table)).one()
        assert row.sqlalchemy_uri == "postgresql://edited/db"
        assert row.extra == '{"edited":true}'
        if upgrading:
            assert original_execute(sa.select(migration.records)).fetchall() == []
