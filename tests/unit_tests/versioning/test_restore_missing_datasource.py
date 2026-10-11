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
"""Chart version restore when the snapshot's datasource no longer exists."""

from collections.abc import Iterator
from datetime import datetime
from typing import Any
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy.orm import Session
from sqlalchemy_continuum import version_class

from superset import security_manager
from superset.app import SupersetApp
from superset.commands.chart.restore_version import RestoreChartVersionCommand
from superset.connectors.sqla.models import SqlaTable
from superset.extensions import db
from superset.models.core import Database
from superset.models.slice import Slice
from superset.models.sql_lab import Query, SavedQuery
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.versioning.queries import derive_version_uuid
from superset.versioning.restore import MissingDatasourceError

pytestmark: pytest.MarkDecorator = pytest.mark.parametrize(
    "app", [{"SQLALCHEMY_DATABASE_URI": "sqlite://"}], indirect=True
)


@pytest.fixture
def capture_session(app: SupersetApp) -> Iterator[Session]:
    """Keep native listeners while all metadata lives in disposable SQLite."""
    assert db.engine.url.get_backend_name() == "sqlite"
    assert not db.engine.url.database
    Model.metadata.create_all(db.engine)
    session: Session = db.session()
    yield session
    db.session.remove()
    Model.metadata.drop_all(db.engine)


def latest_version(session: Session, entity: Any) -> UUID:
    """Resolve the latest persisted snapshot through its public UUID."""
    shadow: Any = version_class(type(entity))
    transaction_id: int = session.scalar(
        sa.select(sa.func.max(shadow.transaction_id)).where(shadow.id == entity.id)
    )
    return derive_version_uuid(entity.uuid, transaction_id)


def _table(session: Session, name: str) -> SqlaTable:
    dataset: SqlaTable = SqlaTable(
        table_name=name,
        schema=f"{name}_schema",
        catalog=f"{name}_catalog",
        database=Database(database_name=f"{name}_db", sqlalchemy_uri="sqlite://"),
    )
    session.add(dataset)
    session.commit()
    return dataset


def _rebind(session: Session, chart: Slice, dataset: SqlaTable) -> None:
    chart.datasource_type = "table"
    chart.datasource_id = dataset.id
    chart.slice_name = "working table chart"
    session.commit()


def test_restore_refuses_snapshot_of_deleted_semantic_view(
    capture_session: Session,
) -> None:
    """sc-123446: restoring a version whose semantic view was deleted is refused
    with a clear message, and the chart keeps its working datasource."""
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), name="layer", type="test", configuration="{}"
    )
    capture_session.add(layer)
    capture_session.flush()
    view: SemanticView = SemanticView(
        name="view", semantic_layer_uuid=layer.uuid, configuration="{}"
    )
    capture_session.add(view)
    capture_session.flush()
    chart: Slice = Slice(
        slice_name="semantic chart",
        datasource_type="semantic_view",
        datasource_id=view.id,
        viz_type="table",
    )
    capture_session.add(chart)
    capture_session.commit()
    semantic_version: UUID = latest_version(capture_session, chart)
    _rebind(capture_session, chart, _table(capture_session, "working"))
    working_id: int = chart.datasource_id
    capture_session.delete(view)
    capture_session.commit()
    chart_uuid: UUID = chart.uuid

    with (
        patch.object(security_manager, "raise_for_editorship"),
        pytest.raises(MissingDatasourceError) as excinfo,
    ):
        RestoreChartVersionCommand(chart_uuid, semantic_version).run()

    assert "semantic view it used has been permanently deleted" in str(excinfo.value)
    assert "recreate the chart" in str(excinfo.value)
    capture_session.expire_all()
    restored: Slice = capture_session.query(Slice).filter_by(uuid=chart_uuid).one()
    assert (restored.datasource_type, restored.datasource_id) == ("table", working_id)
    assert restored.slice_name == "working table chart"


def test_restore_refuses_snapshot_with_unknown_datasource_type(
    capture_session: Session,
) -> None:
    """An unsupported chart source must not restore as a success."""
    chart: Slice = Slice(
        slice_name="unknown chart",
        datasource_type="nonexistent",
        datasource_id=123,
        viz_type="table",
    )
    capture_session.add(chart)
    capture_session.commit()
    unknown_version: UUID = latest_version(capture_session, chart)
    _rebind(capture_session, chart, _table(capture_session, "working"))
    working_id: int = chart.datasource_id
    chart_uuid: UUID = chart.uuid

    with (
        patch.object(security_manager, "raise_for_editorship"),
        pytest.raises(MissingDatasourceError),
    ):
        RestoreChartVersionCommand(chart_uuid, unknown_version).run()

    capture_session.expire_all()
    restored: Slice = capture_session.query(Slice).filter_by(uuid=chart_uuid).one()
    assert (restored.datasource_type, restored.datasource_id) == ("table", working_id)


@pytest.mark.parametrize("source_type", ["query", "saved_query"])
def test_restore_chart_with_query_source_optional_permission_fields(
    capture_session: Session, source_type: str
) -> None:
    """Query-backed sources need not define every denormalized chart perm."""
    database: Database = Database(database_name="query_db", sqlalchemy_uri="sqlite://")
    capture_session.add(database)
    capture_session.flush()
    source: Query | SavedQuery
    if source_type == "query":
        source = Query(client_id="abc1234567", database=database, sql="select 1")
    else:
        source = SavedQuery(label="saved", sql="select 1", db_id=database.id)
    capture_session.add(source)
    capture_session.flush()

    chart: Slice = Slice(
        slice_name="query-backed chart",
        datasource_type=source_type,
        datasource_id=source.id,
        viz_type="table",
    )
    capture_session.add(chart)
    capture_session.commit()
    source_version: UUID = latest_version(capture_session, chart)
    _rebind(capture_session, chart, _table(capture_session, "working"))
    chart_uuid: UUID = chart.uuid

    with patch.object(security_manager, "raise_for_editorship"):
        RestoreChartVersionCommand(chart_uuid, source_version).run()

    capture_session.expire_all()
    restored: Slice = capture_session.query(Slice).filter_by(uuid=chart_uuid).one()
    assert (restored.datasource_type, restored.datasource_id) == (
        source_type,
        source.id,
    )
    assert (restored.perm, restored.catalog_perm, restored.schema_perm) == (
        getattr(source, "perm", None),
        getattr(source, "catalog_perm", None),
        getattr(source, "schema_perm", None),
    )


def test_restore_allows_snapshot_of_soft_deleted_dataset(
    capture_session: Session,
) -> None:
    """A soft-deleted dataset is restorable from trash, so it is not missing:
    the chart restore proceeds, and its permission fields follow the restored
    dataset rather than keeping the previous one."""
    from tests.unit_tests.charts.semantic_view_chart_filter_test import (
        _apply_chart_filter,
    )

    trashed: SqlaTable = _table(capture_session, "trashed")
    chart: Slice = Slice(
        slice_name="trashed chart",
        datasource_type="table",
        datasource_id=trashed.id,
        viz_type="table",
    )
    capture_session.add(chart)
    capture_session.commit()
    trashed_version: UUID = latest_version(capture_session, chart)
    working: SqlaTable = _table(capture_session, "working")
    _rebind(capture_session, chart, working)
    working_perm: str = working.perm
    assert chart.perm == working_perm
    # Non-null optional fields, so the copy of every field below is checked.
    assert trashed.schema_perm
    assert trashed.catalog_perm
    assert trashed.schema_perm != working.schema_perm
    assert trashed.catalog_perm != working.catalog_perm
    trashed.deleted_at = datetime(2026, 1, 1)
    capture_session.commit()
    chart_uuid: UUID = chart.uuid

    with patch.object(security_manager, "raise_for_editorship"):
        RestoreChartVersionCommand(chart_uuid, trashed_version).run()

    capture_session.expire_all()
    restored: Slice = capture_session.query(Slice).filter_by(uuid=chart_uuid).one()
    assert restored.datasource_id == trashed.id
    assert restored.slice_name == "trashed chart"
    assert (restored.perm, restored.schema_perm, restored.catalog_perm) == (
        trashed.perm,
        trashed.schema_perm,
        trashed.catalog_perm,
    )
    assert "trashed chart" not in _apply_chart_filter(
        datasource_perms={working_perm}, accessible_databases=[]
    )


def test_restore_locks_snapshot_datasource_before_chart(
    capture_session: Session,
) -> None:
    """The snapshot's datasource row is locked before the chart row, the same
    order a datasource rename takes when it updates the datasource and then
    its charts, so the two cannot deadlock."""
    from sqlalchemy.orm import Query

    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), name="layer", type="test", configuration="{}"
    )
    capture_session.add(layer)
    capture_session.flush()
    view: SemanticView = SemanticView(
        name="view", semantic_layer_uuid=layer.uuid, configuration="{}"
    )
    capture_session.add(view)
    capture_session.flush()
    chart: Slice = Slice(
        slice_name="semantic chart",
        datasource_type="semantic_view",
        datasource_id=view.id,
        viz_type="table",
    )
    capture_session.add(chart)
    capture_session.commit()
    semantic_version: UUID = latest_version(capture_session, chart)
    _rebind(capture_session, chart, _table(capture_session, "working"))
    chart_uuid: UUID = chart.uuid

    locked: list[Any] = []
    original: Any = Query.with_for_update

    def recording_with_for_update(self: Query, *args: Any, **kwargs: Any) -> Query:
        locked.append(self.column_descriptions[0]["entity"])
        return original(self, *args, **kwargs)

    with (
        patch.object(security_manager, "raise_for_editorship"),
        patch.object(Query, "with_for_update", recording_with_for_update),
    ):
        RestoreChartVersionCommand(chart_uuid, semantic_version).run()

    assert Slice in locked
    assert SemanticView in locked
    assert locked.index(SemanticView) < locked.index(Slice)
