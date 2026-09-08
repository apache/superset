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

"""Regression tests for the two retention-interaction races (SC-115615).

1. A freshly captured baseline must survive a full retention window from
   CAPTURE time: stamping the baseline transaction with the entity's
   historical ``changed_on`` let the very next prune delete it whenever
   the last pre-versioning edit predated the window.
2. The version snapshot must be fetched by the resolved
   ``transaction_id``: an OFFSET re-fetch silently returns a different
   version's snapshot when a concurrent prune removes rows between
   resolution and fetch.

Shared scaffolding: a minimal in-memory version store (transaction,
version-shadow, and user tables) shaped like Continuum's, driven through
the real production functions.
"""

from __future__ import annotations

import uuid as uuid_lib
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any, Iterator

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker


def _naive_utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@pytest.fixture
def version_store() -> Iterator[SimpleNamespace]:
    """Minimal Continuum-shaped store: transaction + shadow + user tables."""
    engine = sa.create_engine("sqlite://")
    metadata = sa.MetaData()
    tx_table = sa.Table(
        "version_transaction",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("issued_at", sa.DateTime),
        sa.Column("user_id", sa.Integer),
        sa.Column("remote_addr", sa.String(100)),
    )
    ver_table = sa.Table(
        "things_version",
        metadata,
        sa.Column("id", sa.Integer),
        sa.Column("uuid", sa.Uuid),
        sa.Column("value", sa.String(50)),
        sa.Column("transaction_id", sa.Integer),
        sa.Column("end_transaction_id", sa.Integer),
        sa.Column("operation_type", sa.Integer),
    )
    user_table = sa.Table(
        "ab_user",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("first_name", sa.String(64)),
        sa.Column("last_name", sa.String(64)),
    )
    metadata.create_all(engine)
    yield SimpleNamespace(engine=engine, tx=tx_table, ver=ver_table, user=user_table)
    engine.dispose()


# ---------------------------------------------------------------------------
# Race 1: baseline retention timestamp (superset/versioning/baseline/insertion.py)
# ---------------------------------------------------------------------------


class _Owner:
    """Stand-in entity; its live table is never read (the row read is
    patched), only ``type(obj).__table__`` must exist."""

    __table__ = None
    id = 1


def _insert_baseline(
    version_store: SimpleNamespace, mocker: Any, changed_on: datetime
) -> tuple[Any, int]:
    """Drive the real ``_insert_baseline_row`` against the in-memory store
    for an entity whose last pre-versioning edit happened at *changed_on*."""
    # pylint: disable=import-outside-toplevel
    from superset.versioning.baseline import insertion

    conn = version_store.engine.connect()
    outer = conn.begin()
    mocker.patch(
        "sqlalchemy_continuum.versioning_manager",
        SimpleNamespace(transaction_cls=SimpleNamespace(__table__=version_store.tx)),
    )
    mocker.patch(
        "superset.versioning.baseline.insertion.read_row_outside_flush",
        return_value={
            "id": 1,
            "uuid": uuid_lib.uuid4(),
            "value": "pre-edit state",
            "changed_on": changed_on,
            "created_on": changed_on,
            "changed_by_fk": 7,
        },
    )
    session = SimpleNamespace(connection=lambda: conn)
    tx_id = insertion._insert_baseline_row(session, _Owner(), version_store.ver)
    outer.commit()
    assert tx_id is not None
    return conn, tx_id


def test_baseline_survives_a_full_retention_window_from_capture(
    version_store: SimpleNamespace, mocker: Any
) -> None:
    """The retention prune deletes transactions with ``issued_at`` older
    than its cutoff. A baseline captured NOW for an entity last edited 100
    days ago must survive a 90-day window — stamped with capture time, not
    the historical audit timestamp (which the reverted fix would use,
    letting the very next prune erase the entity's only pre-edit
    history)."""
    historical = _naive_utc_now() - timedelta(days=100)
    before = _naive_utc_now()
    conn, tx_id = _insert_baseline(version_store, mocker, historical)
    after = _naive_utc_now()

    issued_at = conn.execute(
        sa.select(version_store.tx.c.issued_at).where(version_store.tx.c.id == tx_id)
    ).scalar_one()

    cutoff = _naive_utc_now() - timedelta(days=90)
    assert issued_at >= cutoff, "freshly captured baseline expired immediately"
    assert before <= issued_at <= after
    assert issued_at != historical
    # One clock: naive-UTC, matching Continuum's storage and the prune's
    # cutoff derivation (no server-local sa.func.now()).
    assert issued_at.tzinfo is None


def test_baseline_keeps_historical_attribution_and_shadow_shape(
    version_store: SimpleNamespace, mocker: Any
) -> None:
    """Only the retention clock moves to capture time: the baseline stays
    attributed to the pre-versioning author, and the shadow row still
    reads as a live op=0 row at the allocated transaction."""
    historical = _naive_utc_now() - timedelta(days=100)
    conn, tx_id = _insert_baseline(version_store, mocker, historical)

    tx_row = (
        conn.execute(sa.select(version_store.tx).where(version_store.tx.c.id == tx_id))
        .mappings()
        .one()
    )
    assert tx_row["user_id"] == 7

    shadow = conn.execute(sa.select(version_store.ver)).mappings().one()
    assert shadow["transaction_id"] == tx_id
    assert shadow["end_transaction_id"] is None
    assert shadow["operation_type"] == 0
    assert shadow["value"] == "pre-edit state"


# ---------------------------------------------------------------------------
# Race 2: snapshot fetch under concurrent prune (superset/versioning/queries.py)
# ---------------------------------------------------------------------------


class _DummyModel:
    """Placeholder model class; every model-derived lookup is patched."""


def _seed_history(version_store: SimpleNamespace, entity_uuid: uuid_lib.UUID) -> None:
    """Three versions of entity id=1: baseline v0 (tx 100), edit v1
    (tx 101), live edit v2 (tx 102)."""
    now = _naive_utc_now()
    with version_store.engine.begin() as conn:
        conn.execute(
            version_store.tx.insert(),
            [
                {"id": 100, "issued_at": now - timedelta(days=3)},
                {"id": 101, "issued_at": now - timedelta(days=2)},
                {"id": 102, "issued_at": now - timedelta(days=1)},
            ],
        )
        conn.execute(
            version_store.ver.insert(),
            [
                {
                    "id": 1,
                    "uuid": entity_uuid,
                    "value": "v0",
                    "transaction_id": 100,
                    "end_transaction_id": 101,
                    "operation_type": 0,
                },
                {
                    "id": 1,
                    "uuid": entity_uuid,
                    "value": "v1",
                    "transaction_id": 101,
                    "end_transaction_id": 102,
                    "operation_type": 1,
                },
                {
                    "id": 1,
                    "uuid": entity_uuid,
                    "value": "v2",
                    "transaction_id": 102,
                    "end_transaction_id": None,
                    "operation_type": 1,
                },
            ],
        )


def _patched_get_version(
    version_store: SimpleNamespace,
    mocker: Any,
    entity_uuid: uuid_lib.UUID,
    resolved: tuple[int, int],
) -> dict[str, Any] | None:
    """Run the real ``get_version`` against the in-memory store with the
    resolution step pinned to *resolved* — the state a request captured
    BEFORE a concurrent prune commits."""
    # pylint: disable=import-outside-toplevel
    from superset.versioning import queries

    session = sessionmaker(bind=version_store.engine)()
    mocker.patch.object(queries, "db", SimpleNamespace(session=session))
    mocker.patch.object(
        queries,
        "_resolve_version_tables",
        return_value=(version_store.ver, version_store.tx, version_store.user),
    )
    mocker.patch.object(queries, "resolve_version", return_value=resolved)
    mocker.patch.object(queries, "_entity_kind_for", return_value=None)
    try:
        return queries.get_version(
            _DummyModel,
            entity_uuid,
            uuid_lib.uuid4(),
            entity=SimpleNamespace(id=1),
        )
    finally:
        session.close()


def test_get_version_returns_resolved_tx_after_concurrent_prune(
    version_store: SimpleNamespace, mocker: Any
) -> None:
    """The request resolved v1 (display index 1, tx 101); a retention prune
    then removes the baseline before the snapshot fetch. Addressed by
    transaction_id the fetch still returns v1 — the reverted OFFSET fetch
    would count index 1 over the shrunken row set and silently return v2's
    snapshot under v1's version uuid."""
    entity_uuid = uuid_lib.uuid4()
    _seed_history(version_store, entity_uuid)

    with version_store.engine.begin() as conn:
        conn.execute(
            version_store.ver.delete().where(version_store.ver.c.transaction_id == 100)
        )
        conn.execute(version_store.tx.delete().where(version_store.tx.c.id == 100))

    result = _patched_get_version(version_store, mocker, entity_uuid, (1, 101))
    assert result is not None
    assert result["_version"]["transaction_id"] == 101
    assert result["value"] == "v1"


def test_get_version_without_prune_is_unchanged(
    version_store: SimpleNamespace, mocker: Any
) -> None:
    """Sanity control: with no concurrent prune, the tx-addressed fetch
    returns the same snapshot the OFFSET fetch used to."""
    entity_uuid = uuid_lib.uuid4()
    _seed_history(version_store, entity_uuid)

    result = _patched_get_version(version_store, mocker, entity_uuid, (1, 101))
    assert result is not None
    assert result["_version"]["transaction_id"] == 101
    assert result["_version"]["version_number"] == 1
    assert result["value"] == "v1"
