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
"""Exercise metadata timeout migration against stored SQLite rows and cachelib."""

from collections.abc import Callable, Iterator
from decimal import Decimal
from importlib import import_module
from typing import Any

import pytest

# The project wrapper cannot decode exact decimals for this preservation assertion.
import simplejson  # noqa: TID251
from alembic.migration import MigrationContext
from alembic.operations import Operations
from flask import current_app
from flask_caching.backends import SimpleCache
from pytest_mock import MockerFixture
from sqlalchemy import (
    Column,
    create_engine,
    event,
    Integer,
    MetaData,
    select,
    Table,
    Text,
)
from sqlalchemy.engine import Connection, Engine

from superset.extensions import cache_manager
from superset.models.core import Database
from superset.utils import json

migration = import_module(
    "superset.migrations.versions."
    "2026-10-27_00-00_9670ab7f6bc6_normalize_metadata_cache_timeouts"
)
dbs = Table(
    "dbs", MetaData(), Column("id", Integer, primary_key=True), Column("extra", Text)
)


@pytest.fixture
def engine() -> Iterator[Engine]:
    """Create the migration's database columns without unrelated schema setup."""
    engine = create_engine("sqlite:///:memory:")
    dbs.metadata.create_all(engine)
    yield engine
    engine.dispose()


def _run(
    migrate: Callable[[], None], connection: Connection, mocker: MockerFixture
) -> None:
    """Use real Alembic operations bound to the test database transaction."""
    mocker.patch.object(
        migration, "op", Operations(MigrationContext.configure(connection))
    )
    migrate()


def _seed(engine: Engine, extra: str | None) -> None:
    """Persist a historical database configuration."""
    with engine.begin() as connection:
        connection.execute(dbs.insert().values(id=1, extra=extra))


def _read_extra(engine: Engine) -> str | None:
    """Read the persisted configuration through a new connection."""
    with engine.connect() as connection:
        return connection.execute(select(dbs.c.extra).where(dbs.c.id == 1)).scalar_one()


@pytest.mark.parametrize("cache_type", ["catalog", "schema", "table"])
@pytest.mark.parametrize("timeout", ["600", "0"])
def test_upgrade_restores_metadata_cache(
    engine: Engine, mocker: MockerFixture, cache_type: str, timeout: str
) -> None:
    """The same real cached model method fails before migration and works after it."""
    key = f"{cache_type}_cache_timeout"
    _seed(engine, json.dumps({"metadata_cache_timeout": {key: timeout}}))
    database = Database(
        id=1, database_name="db", sqlalchemy_uri="sqlite://", extra=_read_extra(engine)
    )
    backend = SimpleCache()
    mocker.patch.dict(current_app.extensions["cache"], {cache_manager.cache: backend})
    mocker.patch.object(database, "get_inspector")
    methods: dict[str, tuple[str, str, dict[str, Any], str, Any]] = {
        "catalog": (
            "get_all_catalog_names",
            "get_catalog_names",
            {},
            "db:1:catalog_list",
            {"public"},
        ),
        "schema": (
            "get_all_schema_names",
            "get_schema_names",
            {"catalog": None},
            "db:1:catalog:None:schema_list",
            {"public"},
        ),
        "table": (
            "get_all_table_names_in_schema",
            "get_table_names",
            {"catalog": None, "schema": "public"},
            "db:1:catalog:None:schema:public:table_list",
            {("public", "public", None)},
        ),
    }
    method_name, spec_method, options, cache_key, expected = methods[cache_type]
    mocker.patch.object(database.db_engine_spec, spec_method, return_value={"public"})
    get_metadata = getattr(database, method_name)
    assert getattr(database, f"{cache_type}_cache_enabled")

    with pytest.raises(TypeError, match="timeout must be an int"):
        get_metadata(**options, cache_timeout=getattr(database, key))

    with engine.begin() as connection:
        _run(migration.upgrade, connection, mocker)
    database.extra = _read_extra(engine)

    assert type(getattr(database, key)) is int
    assert getattr(database, key) == int(timeout)
    assert get_metadata(**options, cache_timeout=getattr(database, key)) == expected
    assert backend.get(cache_key) == expected


def test_upgrade_preserves_other_configuration(
    engine: Engine, mocker: MockerFixture
) -> None:
    """Only recognized non-negative integer strings are converted."""
    extra: dict[str, Any] = {
        "metadata_cache_timeout": {
            "catalog_cache_timeout": "3600",
            "schema_cache_timeout": "-1",
            "table_cache_timeout": "0010",
            "future_cache_timeout": "900",
        },
        "cache_timeout": "1200",
        "precise": Decimal("0.12345678901234567890123456789"),
        "large": Decimal("1e500"),
        "engine_params": {"connect_args": {"enabled": True, "timeout": None}},
    }
    unchanged = ' { "metadata_cache_timeout": {"schema_cache_timeout": 0} } '
    with engine.begin() as connection:
        connection.execute(
            dbs.insert(),
            [
                {"id": 1, "extra": json.dumps(extra)},
                {"id": 2, "extra": "{invalid"},
                {"id": 3, "extra": unchanged},
                {
                    "id": 4,
                    "extra": json.dumps(
                        {
                            "metadata_cache_timeout": {"schema_cache_timeout": "42"},
                            "other": "row4",
                        }
                    ),
                },
            ],
        )

    with engine.begin() as connection:
        _run(migration.upgrade, connection, mocker)

    extra["metadata_cache_timeout"]["catalog_cache_timeout"] = 3600
    extra["metadata_cache_timeout"]["table_cache_timeout"] = 10
    with engine.connect() as connection:
        migrated = dict(connection.execute(select(dbs.c.id, dbs.c.extra)).all())
    assert simplejson.loads(migrated[1], use_decimal=True) == extra
    assert migrated[2] == "{invalid"
    assert migrated[3] == unchanged
    assert json.loads(migrated[4]) == {
        "metadata_cache_timeout": {"schema_cache_timeout": 42},
        "other": "row4",
    }


@pytest.mark.parametrize(
    "extra",
    [
        None,
        "",
        "{invalid",
        "null",
        "[]",
        "42",
        "true",
        "{}",
        '{"metadata_cache_timeout": null}',
        '{"metadata_cache_timeout": []}',
        '{"metadata_cache_timeout": "600"}',
        (
            '{ "metadata_cache_timeout": {"catalog_cache_timeout": 0, '
            '"schema_cache_timeout": 600} }'
        ),
        (
            '{"metadata_cache_timeout": {"schema_cache_timeout": -1, '
            '"table_cache_timeout": "-5"}}'
        ),
        (
            '{"metadata_cache_timeout": {"schema_cache_timeout": 1.5, '
            '"table_cache_timeout": true, "catalog_cache_timeout": null}}'
        ),
        (
            '{"metadata_cache_timeout": {"schema_cache_timeout": [], '
            '"table_cache_timeout": {}, "catalog_cache_timeout": ""}}'
        ),
        (
            '{"metadata_cache_timeout": {"schema_cache_timeout": "invalid", '
            '"table_cache_timeout": "1.5", "future": "600"}}'
        ),
        '{"metadata_cache_timeout": {"schema_cache_timeout": "600"}, "other": NaN}',
        (
            '{"metadata_cache_timeout": {"schema_cache_timeout": "600"}, '
            '"other": Infinity}'
        ),
        (
            '{"metadata_cache_timeout": {"schema_cache_timeout": "600"}, '
            '"other": 1e99999999999999999999}'
        ),
    ],
)
def test_upgrade_leaves_unconverted_rows_untouched(
    engine: Engine, mocker: MockerFixture, extra: str | None
) -> None:
    """Malformed, unrelated, invalid and already typed data retain their exact text."""
    _seed(engine, extra)

    with engine.begin() as connection:
        _run(migration.upgrade, connection, mocker)

    assert _read_extra(engine) == extra


def test_upgrade_is_idempotent(engine: Engine, mocker: MockerFixture) -> None:
    """Repeated upgrade does not rewrite rows that have already been converted."""
    _seed(engine, '{"metadata_cache_timeout": {"schema_cache_timeout": "600"}}')
    updates = []

    def track_updates(
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        """Count writes without replacing the database execution path."""
        if statement.lstrip().upper().startswith("UPDATE"):
            updates.append(statement)

    event.listen(engine, "before_cursor_execute", track_updates)
    with engine.begin() as connection:
        _run(migration.upgrade, connection, mocker)
    first_result = _read_extra(engine)
    assert len(updates) == 1

    with engine.begin() as connection:
        _run(migration.upgrade, connection, mocker)

    assert _read_extra(engine) == first_result
    assert len(updates) == 1


def test_upgrade_uses_alembic_transaction(
    engine: Engine, mocker: MockerFixture
) -> None:
    """Alembic can roll back all data changes; the migration does not commit itself."""
    extra = '{"metadata_cache_timeout": {"schema_cache_timeout": "600"}}'
    _seed(engine, extra)

    with engine.connect() as connection:
        transaction = connection.begin()
        _run(migration.upgrade, connection, mocker)
        migrated = connection.execute(select(dbs.c.extra)).scalar_one()
        assert (
            json.loads(migrated)["metadata_cache_timeout"]["schema_cache_timeout"]
            == 600
        )
        transaction.rollback()

    assert _read_extra(engine) == extra


def test_upgrade_refuses_stale_configuration(
    engine: Engine, mocker: MockerFixture
) -> None:
    """A row changed after the read must not be overwritten by the old snapshot."""
    original = '{"metadata_cache_timeout": {"schema_cache_timeout": "600"}}'
    edited = json.dumps(
        {"metadata_cache_timeout": {"schema_cache_timeout": "600"}, "other": "edited"}
    )
    _seed(engine, original)
    injected = False

    def edit_before_update(
        conn: Connection,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        """Change the actual stored row between its SELECT and the migration UPDATE."""
        nonlocal injected
        if not injected and statement.lstrip().upper().startswith("UPDATE"):
            injected = True
            conn.execute(dbs.update().where(dbs.c.id == 1).values(extra=edited))

    event.listen(engine, "before_cursor_execute", edit_before_update)
    with engine.begin() as connection:
        with pytest.raises(RuntimeError, match="configuration changed"):
            _run(migration.upgrade, connection, mocker)
        assert connection.execute(select(dbs.c.extra)).scalar_one() == edited


def test_conflict_rolls_back_preceding_updates(
    engine: Engine, mocker: MockerFixture
) -> None:
    """A conflict after one real update rolls back both rows to their original text."""
    originals = {
        1: '{"metadata_cache_timeout": {"schema_cache_timeout": "600"}}',
        2: ' { "metadata_cache_timeout": {"schema_cache_timeout": "0"} } ',
    }
    with engine.begin() as connection:
        connection.execute(
            dbs.insert(),
            [
                {"id": database_id, "extra": extra}
                for database_id, extra in originals.items()
            ],
        )
    updates_started = 0
    first_update_seen = False
    injected = False

    def edit_before_second_update(
        conn: Connection,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        """Observe the earlier update, then change the remaining row before its CAS."""
        nonlocal updates_started, first_update_seen, injected
        if injected or not statement.lstrip().upper().startswith("UPDATE"):
            return
        updates_started += 1
        if updates_started != 2:
            return
        rows = dict(conn.execute(select(dbs.c.id, dbs.c.extra)).all())
        converted = [
            database_id
            for database_id, extra in rows.items()
            if type(json.loads(extra)["metadata_cache_timeout"]["schema_cache_timeout"])
            is int
        ]
        assert len(converted) == 1
        first_id = converted[0]
        assert rows[first_id] != originals[first_id]
        first_update_seen = True
        target_id = next(
            database_id for database_id in originals if database_id != first_id
        )
        assert rows[target_id] == originals[target_id]
        injected = True
        conn.execute(
            dbs.update().where(dbs.c.id == target_id).values(extra='{"edited": true}')
        )

    event.listen(engine, "before_cursor_execute", edit_before_second_update)
    with pytest.raises(RuntimeError, match="configuration changed"):
        with engine.begin() as connection:
            _run(migration.upgrade, connection, mocker)

    assert updates_started == 2
    assert first_update_seen
    assert injected
    with engine.connect() as connection:
        assert (
            dict(connection.execute(select(dbs.c.id, dbs.c.extra)).all()) == originals
        )


def test_downgrade_keeps_integer_timeouts(
    engine: Engine, mocker: MockerFixture
) -> None:
    """Downgrade cannot infer which integers were originally strings."""
    _seed(
        engine,
        (
            '{"metadata_cache_timeout": {"schema_cache_timeout": "0", '
            '"table_cache_timeout": 600}}'
        ),
    )
    with engine.begin() as connection:
        _run(migration.upgrade, connection, mocker)
    migrated = _read_extra(engine)
    assert migrated is not None
    assert json.loads(migrated)["metadata_cache_timeout"]["schema_cache_timeout"] == 0

    with engine.begin() as connection:
        _run(migration.downgrade, connection, mocker)

    assert _read_extra(engine) == migrated
