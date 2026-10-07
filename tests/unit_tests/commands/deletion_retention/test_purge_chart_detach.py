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

from datetime import datetime
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session

from superset.commands.deletion_retention import purge_cascade
from superset.commands.deletion_retention.purge_cascade import (
    cascade_hard_delete,
    CascadeResult,
)
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.slice import Slice
from superset.semantic_layers.models import SemanticLayer, SemanticView


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
    dataset, orphan, other, _ = _trashed_dataset_with_charts(session)
    other_before: tuple[Any, ...] = (
        other.datasource_type,
        other.datasource_id,
        other.perm,
    )
    bystander_id: int = dataset.id + 1
    bystander: Slice = Slice(
        slice_name="bystander",
        datasource_type="table",
        datasource_id=bystander_id,
        viz_type="table",
    )
    session.add(bystander)
    session.commit()

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
    purged, would_purge, failures, blocked = _purge_model(
        SqlaTable, datetime(2021, 1, 1), True
    )
    session.expire_all()

    assert (purged, would_purge, failures, blocked) == (0, 1, 0, 0)
    chart: Slice = session.get(Slice, orphan.id)
    assert (chart.datasource_id, chart.perm, chart.schema_perm) == before
    assert session.get(SqlaTable, dataset.id) is not None
