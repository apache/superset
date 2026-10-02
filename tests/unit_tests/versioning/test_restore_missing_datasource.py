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
        pytest.raises(MissingDatasourceError, match="semantic view") as excinfo,
    ):
        RestoreChartVersionCommand(chart_uuid, semantic_version).run()

    assert "left unchanged" in str(excinfo.value)
    capture_session.expire_all()
    restored: Slice = capture_session.query(Slice).filter_by(uuid=chart_uuid).one()
    assert (restored.datasource_type, restored.datasource_id) == ("table", working_id)
    assert restored.slice_name == "working table chart"


def test_restore_allows_snapshot_of_soft_deleted_dataset(
    capture_session: Session,
) -> None:
    """A soft-deleted dataset is restorable from trash, so it is not missing:
    the chart restore proceeds."""
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
    _rebind(capture_session, chart, _table(capture_session, "working"))
    trashed.deleted_at = datetime(2026, 1, 1)
    capture_session.commit()
    chart_uuid: UUID = chart.uuid

    with patch.object(security_manager, "raise_for_editorship"):
        RestoreChartVersionCommand(chart_uuid, trashed_version).run()

    capture_session.expire_all()
    restored: Slice = capture_session.query(Slice).filter_by(uuid=chart_uuid).one()
    assert restored.datasource_id == trashed.id
    assert restored.slice_name == "trashed chart"
