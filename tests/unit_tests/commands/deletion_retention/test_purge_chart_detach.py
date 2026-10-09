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
"""SC-119912: purging a dataset detaches the charts that reference it."""

from collections.abc import Iterator
from datetime import datetime
from pathlib import Path
from typing import Any
from unittest.mock import patch
from uuid import UUID

import pytest
import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session
from sqlalchemy_continuum import version_class

from superset.app import SupersetApp
from superset.commands.deletion_retention import purge_cascade
from superset.commands.deletion_retention.purge_cascade import (
    cascade_hard_delete,
    CascadeResult,
)
from superset.connectors.sqla.models import SqlaTable
from superset.extensions import db
from superset.models.core import Database
from superset.models.slice import Slice
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.versioning.api_helpers import current_entity_etag_uuid


@pytest.fixture(scope="module", autouse=True)
def file_metadata_database(
    tmp_path_factory: pytest.TempPathFactory,
) -> Iterator[None]:
    """Give app capture a separate connection for the purge table probe."""
    metadata_path: Path = tmp_path_factory.mktemp("purge-history") / "metadata.db"
    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setenv(
            "SUPERSET__SQLALCHEMY_DATABASE_URI", f"sqlite:///{metadata_path}"
        )
        yield


@pytest.fixture
def session_engine(tmp_path: Path) -> Engine:
    """File-backed SQLite with working SAVEPOINTs, as the purge needs.

    The purge's ``begin_nested`` needs real savepoints, which pysqlite's
    implicit transaction handling breaks; SQLAlchemy's documented workaround
    disables it and emits ``BEGIN``. A file database gives the purge's
    ``has_table`` check its own connection instead of the test's.
    """
    engine: Engine = create_engine(f"sqlite:///{tmp_path / 'purge.db'}")

    @event.listens_for(engine, "connect")
    def _disable_pysqlite_transactions(dbapi_connection: Any, _: Any) -> None:
        dbapi_connection.isolation_level = None

    @event.listens_for(engine, "begin")
    def _emit_begin(connection: Any) -> None:
        connection.exec_driver_sql("BEGIN")

    return engine


@pytest.fixture
def versioned_session(app: SupersetApp) -> Iterator[Session]:
    """Use the app's capture listeners with disposable metadata tables."""
    Model.metadata.create_all(db.engine)
    capture_session: Session = db.session()
    yield capture_session
    db.session.remove()
    Model.metadata.drop_all(db.engine)


def _trashed_dataset_with_charts(
    session: Session,
) -> tuple[SqlaTable, Slice, Slice, Database]:
    """A soft-deleted dataset with one chart on it, and a semantic-view chart
    whose datasource id equals the dataset's."""
    SqlaTable.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    database: Database = Database(database_name="examples", sqlalchemy_uri="sqlite://")
    dataset: SqlaTable = SqlaTable(
        table_name="purged", database=database, schema="public"
    )
    session.add(dataset)
    session.flush()
    layer: SemanticLayer = SemanticLayer(name="layer", type="test", configuration="{}")
    session.add(layer)
    session.flush()
    view: SemanticView = SemanticView(
        id=dataset.id, name="view", semantic_layer_uuid=layer.uuid, configuration="{}"
    )
    session.add(view)
    session.flush()
    orphan: Slice = Slice(
        slice_name="orphan",
        datasource_type="table",
        datasource_id=dataset.id,
        viz_type="table",
    )
    other: Slice = Slice(
        slice_name="semantic",
        datasource_type="semantic_view",
        datasource_id=view.id,
        viz_type="table",
    )
    session.add_all([orphan, other])
    session.flush()
    assert orphan.perm == dataset.perm
    assert other.perm == view.perm
    dataset.deleted_at = datetime(2020, 1, 1)
    # Production commits before the cascade (the task writes an audit row).
    session.commit()
    return dataset, orphan, other, database


def _purge(session: Session, dataset: SqlaTable) -> CascadeResult:
    result: CascadeResult = cascade_hard_delete(
        session, dataset, enforce_window=False, require_archived=True
    )
    session.commit()
    session.expire_all()
    return result


def test_purge_detaches_dataset_charts(session: Session, app_context: None) -> None:
    """The purged dataset's chart is kept with its datasource id and
    permission fields cleared; a chart on another datasource is untouched."""
    dataset: SqlaTable
    orphan: Slice
    other: Slice
    database: Database
    dataset, orphan, other, database = _trashed_dataset_with_charts(session)
    other_before: tuple[Any, ...] = (
        other.datasource_type,
        other.datasource_id,
        other.perm,
    )
    bystander_dataset: SqlaTable = SqlaTable(
        table_name="bystander", database=database, schema="public"
    )
    session.add(bystander_dataset)
    session.flush()
    bystander_id: int = bystander_dataset.id
    bystander: Slice = Slice(
        slice_name="bystander",
        datasource_type="table",
        datasource_id=bystander_id,
        viz_type="table",
    )
    session.add(bystander)
    session.commit()
    bystander_perm: str | None = bystander.perm
    assert bystander_perm is not None
    assert bystander_perm == bystander_dataset.perm

    assert _purge(session, dataset).purged

    kept: Slice = session.get(Slice, orphan.id)
    assert (kept.datasource_id, kept.perm, kept.schema_perm, kept.catalog_perm) == (
        None,
        None,
        None,
        None,
    )
    untouched: Slice = session.get(Slice, other.id)
    assert (
        untouched.datasource_type,
        untouched.datasource_id,
        untouched.perm,
    ) == other_before
    assert session.get(Slice, bystander.id).datasource_id == bystander_id
    assert session.get(Slice, bystander.id).perm == bystander_perm


def test_purge_detach_keeps_chart_history_and_etag(
    versioned_session: Session,
) -> None:
    """The purge audit, not a new chart version, records detachment."""
    dataset: SqlaTable
    chart: Slice
    dataset, chart, _, _ = _trashed_dataset_with_charts(versioned_session)
    chart_id: int = chart.id
    dataset_id: int = dataset.id
    chart_uuid: UUID = chart.uuid
    shadow: Any = version_class(Slice)
    latest_before: Any = versioned_session.scalars(
        sa.select(shadow)
        .where(shadow.id == chart_id)
        .order_by(shadow.transaction_id.desc())
    ).first()
    assert latest_before.datasource_id == dataset_id
    etag_before: str | None = current_entity_etag_uuid(Slice, chart_id, chart_uuid)
    assert etag_before is not None

    assert _purge(versioned_session, dataset).purged

    kept: Slice = versioned_session.get(Slice, chart_id)
    latest_after: Any = versioned_session.scalars(
        sa.select(shadow)
        .where(shadow.id == chart_id)
        .order_by(shadow.transaction_id.desc())
    ).first()
    assert kept.datasource_id is None
    assert latest_after.transaction_id == latest_before.transaction_id
    assert latest_after.datasource_id == dataset_id
    assert current_entity_etag_uuid(Slice, chart_id, chart_uuid) == etag_before


def test_purged_dataset_id_reuse_cannot_rebind_chart(
    session: Session, app_context: None
) -> None:
    """A new dataset that reuses the purged id does not adopt the chart."""
    dataset: SqlaTable
    orphan: Slice
    database: Database
    dataset, orphan, _, database = _trashed_dataset_with_charts(session)
    dataset_id: int = dataset.id
    assert _purge(session, dataset).purged
    stranger: SqlaTable = SqlaTable(
        id=dataset_id, table_name="stranger", database=database, schema="public"
    )
    session.add(stranger)
    session.flush()

    chart: Slice = session.get(Slice, orphan.id)
    chart.slice_name = "orphan renamed"
    session.flush()

    assert chart.datasource_id is None
    assert chart.perm is None
    assert chart.resolved_datasource is None


def test_failed_purge_rolls_back_chart_detach(
    session: Session, app_context: None
) -> None:
    """A failure later in the cascade leaves the chart and dataset unchanged."""
    dataset: SqlaTable
    orphan: Slice
    dataset, orphan, _, _ = _trashed_dataset_with_charts(session)
    before: tuple[Any, ...] = (orphan.datasource_id, orphan.perm, orphan.schema_perm)

    with (
        patch.object(
            purge_cascade,
            "_delete_version_history",
            side_effect=RuntimeError("boom"),
        ),
        pytest.raises(RuntimeError, match="boom"),
    ):
        cascade_hard_delete(
            session, dataset, enforce_window=False, require_archived=True
        )
    session.rollback()
    session.expire_all()

    chart: Slice = session.get(Slice, orphan.id)
    assert (chart.datasource_id, chart.perm, chart.schema_perm) == before
    assert session.get(SqlaTable, dataset.id) is not None


def test_dry_run_purge_changes_no_chart(session: Session, app_context: None) -> None:
    """A dry run counts eligible datasets and never touches their charts."""
    from superset.tasks.deletion_retention import _purge_model

    dataset: SqlaTable
    orphan: Slice
    dataset, orphan, _, _ = _trashed_dataset_with_charts(session)
    before: tuple[Any, ...] = (orphan.datasource_id, orphan.perm, orphan.schema_perm)

    purged: int
    would_purge: int
    failures: int
    blocked: int
    scan_failures: int
    purged, would_purge, failures, blocked, scan_failures = _purge_model(
        SqlaTable, datetime(2021, 1, 1), True
    )
    session.expire_all()

    assert (purged, would_purge, failures, blocked, scan_failures) == (0, 1, 0, 0, 0)
    chart: Slice = session.get(Slice, orphan.id)
    assert (chart.datasource_id, chart.perm, chart.schema_perm) == before
    assert session.get(SqlaTable, dataset.id) is not None
