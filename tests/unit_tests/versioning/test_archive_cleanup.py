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
"""Archive-only transaction cleanup and immutable scope identities."""

from collections.abc import Iterator
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session
from sqlalchemy_continuum import versioning_manager

from superset.commands.deletion_retention import purge_cascade
from superset.tasks import version_history_retention as retention
from superset.versioning.lifecycle_table import version_chart_archive_scope_table


@pytest.fixture
def cleanup_db() -> Iterator[tuple[Session, sa.MetaData]]:
    """Use real SQL tables without FK cascades, matching metadata-created schemas."""
    metadata = sa.MetaData()
    sa.Table(
        "version_transaction",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("issued_at", sa.DateTime),
    )
    for name in ("slices_version", "dashboards_version"):
        sa.Table(
            name,
            metadata,
            sa.Column("id", sa.Integer),
            sa.Column("transaction_id", sa.Integer),
            sa.Column("end_transaction_id", sa.Integer),
        )
    sa.Table(
        "version_changes",
        metadata,
        sa.Column("transaction_id", sa.Integer),
        sa.Column("entity_id", sa.Integer),
        sa.Column("entity_kind", sa.String),
        sa.Column("kind", sa.String),
    )
    version_chart_archive_scope_table.to_metadata(metadata)
    engine = sa.create_engine("sqlite://")
    metadata.create_all(engine)
    session = Session(engine)
    with patch.object(
        versioning_manager,
        "transaction_cls",
        SimpleNamespace(__table__=metadata.tables["version_transaction"]),
    ):
        yield session, metadata
    session.close()
    engine.dispose()


def _seed(
    session: Session, metadata: sa.MetaData
) -> tuple[SimpleNamespace, SimpleNamespace, SimpleNamespace]:
    """Create two archives sharing a transaction and dashboard, with no shadows."""
    chart_a = SimpleNamespace(id=1, uuid=uuid4())
    chart_b = SimpleNamespace(id=2, uuid=uuid4())
    dashboard = SimpleNamespace(id=3, uuid=uuid4())
    session.execute(
        metadata.tables["version_transaction"].insert(),
        [{"id": 10, "issued_at": datetime(2020, 1, 1)}],
    )
    for chart in (chart_a, chart_b):
        session.execute(
            metadata.tables["version_changes"].insert(),
            {
                "transaction_id": 10,
                "entity_id": chart.id,
                "entity_kind": "chart",
                "kind": "__archive__",
            },
        )
        session.execute(
            metadata.tables["version_chart_archive_scope"].insert(),
            {
                "id": uuid4(),
                "transaction_id": 10,
                "chart_id": chart.id,
                "chart_uuid": chart.uuid,
                "dashboard_id": dashboard.id,
                "dashboard_uuid": dashboard.uuid,
            },
        )
    session.commit()
    return chart_a, chart_b, dashboard


def _delete(
    session: Session, metadata: sa.MetaData, entity: SimpleNamespace, kind: str
) -> int:
    """Exercise the cleanup against SQL tables while stubbing model registration."""
    model_name, shadow_name = (
        ("Slice", "slices_version")
        if kind == "chart"
        else ("Dashboard", "dashboards_version")
    )
    model = type(model_name, (), {})
    asset = model()
    asset.id, asset.uuid = entity.id, entity.uuid
    policy = SimpleNamespace(
        entity_type=kind, version_shadow_names=[(shadow_name, "id")]
    )
    with (
        patch.object(purge_cascade, "_version_tables_present", return_value=True),
        patch.object(purge_cascade, "get_purge_policy", return_value=policy),
        patch(
            "sqlalchemy_continuum.version_class",
            return_value=SimpleNamespace(__table__=metadata.tables[shadow_name]),
        ),
    ):
        return purge_cascade._delete_version_history(session, asset, asset.id)


def _count(session: Session, metadata: sa.MetaData, name: str) -> int:
    """Return the number of surviving rows in a cleanup table."""
    return session.execute(
        sa.select(sa.func.count()).select_from(metadata.tables[name])
    ).scalar_one()


def test_archive_only_partial_purge_keeps_shared_transaction(
    cleanup_db: tuple[Session, sa.MetaData],
) -> None:
    """Purge counts scopes and changes and sweeps only the last orphan."""
    session, metadata = cleanup_db
    chart_a, chart_b, _ = _seed(session, metadata)
    assert _delete(session, metadata, chart_a, "chart") == 2
    assert _count(session, metadata, "version_transaction") == 1
    assert _count(session, metadata, "version_changes") == 1
    assert _count(session, metadata, "version_chart_archive_scope") == 1
    assert _delete(session, metadata, chart_b, "chart") == 2
    assert _count(session, metadata, "version_transaction") == 0
    assert _count(session, metadata, "version_chart_archive_scope") == 0


def test_dashboard_purge_only_removes_exact_identity_scopes(
    cleanup_db: tuple[Session, sa.MetaData],
) -> None:
    """Same UUID with a different ID and same ID with a different UUID are distinct."""
    session, metadata = cleanup_db
    chart, _, dashboard = _seed(session, metadata)
    scope = metadata.tables["version_chart_archive_scope"]
    for dashboard_id, dashboard_uuid in ((4, dashboard.uuid), (dashboard.id, uuid4())):
        session.execute(
            scope.insert(),
            {
                "id": uuid4(),
                "transaction_id": 10,
                "chart_id": chart.id,
                "chart_uuid": chart.uuid,
                "dashboard_id": dashboard_id,
                "dashboard_uuid": dashboard_uuid,
            },
        )
    assert _delete(session, metadata, dashboard, "dashboard") == 2
    assert _count(session, metadata, "version_chart_archive_scope") == 2
    assert _count(session, metadata, "version_changes") == 2
    assert _count(session, metadata, "version_transaction") == 1


def test_archive_scope_keeps_a_transaction_referenced_during_purge(
    cleanup_db: tuple[Session, sa.MetaData],
) -> None:
    """A remaining scope is a reference even when no change or shadow survives."""
    session, metadata = cleanup_db
    chart, _, dashboard = _seed(session, metadata)
    session.execute(metadata.tables["version_changes"].delete())
    scope = metadata.tables["version_chart_archive_scope"]
    session.execute(scope.delete().where(scope.c.chart_id != chart.id))
    purge_cascade._sweep_orphan_transactions(
        session,
        metadata,
        metadata.tables["version_transaction"],
        metadata.tables["version_changes"],
        {10},
        scope,
    )
    assert _count(session, metadata, "version_transaction") == 1
    assert _delete(session, metadata, dashboard, "dashboard") == 1
    assert _count(session, metadata, "version_transaction") == 0


def test_shadow_closing_endpoint_keeps_shared_transaction(
    cleanup_db: tuple[Session, sa.MetaData],
) -> None:
    """Surviving shadow endpoints remain references after archive scopes disappear."""
    session, metadata = cleanup_db
    chart_a, chart_b, _ = _seed(session, metadata)
    session.execute(metadata.tables["version_transaction"].insert(), {"id": 9})
    session.execute(
        metadata.tables["slices_version"].insert(),
        {"id": 99, "transaction_id": 9, "end_transaction_id": 10},
    )
    _delete(session, metadata, chart_a, "chart")
    _delete(session, metadata, chart_b, "chart")
    assert _count(session, metadata, "version_transaction") == 2


def test_disabled_retention_does_not_disable_managed_purge(
    cleanup_db: tuple[Session, sa.MetaData],
) -> None:
    """Retention=0 skips scheduled history expiry, but managed purge still sweeps."""
    session, metadata = cleanup_db
    chart_a, chart_b, _ = _seed(session, metadata)
    with patch.object(retention, "stats_logger_manager"):
        assert retention._prune_old_versions_impl(retention_days=0) == {"skipped": 1}
    _delete(session, metadata, chart_a, "chart")
    _delete(session, metadata, chart_b, "chart")
    assert _count(session, metadata, "version_transaction") == 0


def test_retention_deletes_scopes_without_using_them_as_live_anchors(
    cleanup_db: tuple[Session, sa.MetaData],
) -> None:
    """Expired archives disappear on metadata schemas even without scope FK cascades."""
    session, metadata = cleanup_db
    _seed(session, metadata)
    tx = metadata.tables["version_transaction"]
    session.execute(tx.insert(), {"id": 11, "issued_at": datetime(2020, 1, 1)})
    parent = metadata.tables["slices_version"]
    session.execute(parent.insert(), {"id": 7, "transaction_id": 11})
    session.commit()
    tables = retention.ShadowTables(
        parent=[parent],
        child=[],
        m2m=None,
        transaction=tx,
        archive_scope=metadata.tables["version_chart_archive_scope"],
    )
    with patch.object(retention, "db", SimpleNamespace(engine=session.get_bind())):
        result = retention._run_prune_pass(datetime(2026, 1, 1), tables)
    assert result["pruned_transactions"] == 1
    assert result["pruned_archive_scopes"] == 2
    assert _count(session, metadata, "version_chart_archive_scope") == 0
    assert session.execute(sa.select(tx.c.id)).scalars().all() == [11]
    assert _count(session, metadata, "slices_version") == 1


def test_reused_chart_id_does_not_strand_deleted_archive_scopes(
    cleanup_db: tuple[Session, sa.MetaData],
) -> None:
    """Purge also removes projections of older canonical events deleted by ID."""
    session, metadata = cleanup_db
    chart, _, dashboard = _seed(session, metadata)
    session.execute(metadata.tables["version_transaction"].insert(), {"id": 9})
    session.execute(
        metadata.tables["version_changes"].insert(),
        {
            "transaction_id": 9,
            "entity_kind": "chart",
            "entity_id": chart.id,
            "kind": "__archive__",
        },
    )
    session.execute(
        metadata.tables["version_chart_archive_scope"].insert(),
        {
            "id": uuid4(),
            "transaction_id": 9,
            "chart_id": chart.id,
            "chart_uuid": uuid4(),
            "dashboard_id": dashboard.id,
            "dashboard_uuid": dashboard.uuid,
        },
    )
    assert _delete(session, metadata, chart, "chart") == 4
    assert _count(session, metadata, "version_chart_archive_scope") == 1
    assert session.execute(
        sa.select(metadata.tables["version_transaction"].c.id)
    ).scalars().all() == [10]


def test_purge_collects_closing_transaction_as_an_orphan_candidate(
    cleanup_db: tuple[Session, sa.MetaData],
) -> None:
    """A transaction referenced only as the purged shadow's end must be swept."""
    session, metadata = cleanup_db
    chart = SimpleNamespace(id=1, uuid=uuid4())
    session.execute(
        metadata.tables["version_transaction"].insert(), [{"id": 10}, {"id": 11}]
    )
    session.execute(
        metadata.tables["slices_version"].insert(),
        {"id": chart.id, "transaction_id": 10, "end_transaction_id": 11},
    )
    assert _delete(session, metadata, chart, "chart") == 1
    assert _count(session, metadata, "version_transaction") == 0
