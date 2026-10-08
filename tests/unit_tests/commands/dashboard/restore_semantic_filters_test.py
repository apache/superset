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
"""Restore archived dashboard controls after their semantic view is deleted."""

from collections.abc import Iterator
from datetime import datetime
from typing import Any
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from flask_appbuilder import Model
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from superset import db
from superset.app import SupersetApp
from superset.commands.dashboard.exceptions import (
    DashboardForbiddenError,
    DashboardRestoreFailedError,
    DashboardSlugConflictError,
)
from superset.commands.dashboard.restore import RestoreDashboardCommand
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.utils import json

pytestmark: pytest.MarkDecorator = pytest.mark.parametrize(
    "app", [{"SQLALCHEMY_DATABASE_URI": "sqlite://"}], indirect=True
)


@pytest.fixture
def restore_session(app: SupersetApp) -> Iterator[Session]:
    """Exercise real restore commits and rollbacks in disposable SQLite."""
    assert db.engine.url.get_backend_name() == "sqlite"
    assert not db.engine.url.database
    Model.metadata.create_all(db.engine)
    try:
        yield db.session()
    finally:
        db.session.remove()
        Model.metadata.drop_all(db.engine)


def archived_dashboard(session: Session, metadata: dict[str, Any]) -> Dashboard:
    """Persist an archived dashboard without involving datasource permission mocks."""
    dashboard: Dashboard = Dashboard(
        dashboard_title="Archived",
        uuid=uuid4(),
        deleted_at=datetime(2026, 1, 1),
        json_metadata=json.dumps(metadata),
    )
    session.add(dashboard)
    session.commit()
    return dashboard


@pytest.mark.parametrize(
    "raw_metadata",
    [
        "{invalid",
        "null",
        "[]",
        pytest.param('{"value": ' + "9" * 5000 + "}", id="oversized-json-integer"),
        '{"native_filter_configuration": {"id": "bad"}}',
        '{"native_filter_configuration": ["bad"]}',
        '{"chart_customization_config": "bad"}',
        '{"chart_customization_config": [null]}',
        '{"native_filter_configuration": [{"targets": {"datasetId": 17}}]}',
        '{"native_filter_configuration": [{"targets": ["bad"]}]}',
        '{"native_filter_configuration": [{"id": [], "targets": '
        '[{"datasourceType": "semantic_view", "datasetId": 17}]}]}',
        '{"native_filter_configuration": [{"cascadeParentIds": {"bad": true}}]}',
        '{"native_filter_configuration": [{"cascadeParentIds": [[]]}]}',
        '{"native_filter_configuration": [{"id": "missing", "targets": '
        '[{"datasetId": 17, "datasourceType": "semantic_view"}]}], '
        '"chart_customization_config": ["bad"]}',
    ],
)
def test_restore_preserves_malformed_metadata_and_warns(
    restore_session: Session,
    raw_metadata: str,
) -> None:
    """Bad legacy JSON must not prevent recovery or allow partial metadata cleanup."""
    dashboard: Dashboard = archived_dashboard(restore_session, {})
    dashboard.json_metadata = raw_metadata
    restore_session.commit()
    command: RestoreDashboardCommand = RestoreDashboardCommand(str(dashboard.uuid))
    with patch("superset.commands.restore.security_manager.raise_for_editorship"):
        command.run()
    restore_session.refresh(dashboard)
    assert dashboard.deleted_at is None
    assert dashboard.json_metadata == raw_metadata
    assert len(command.warnings) == 1
    assert "cleanup was skipped" in command.warnings[0]


@pytest.mark.parametrize(
    "raw_metadata", [None, "", "{}", '{"native_filter_configuration": null}']
)
def test_restore_preserves_empty_metadata_without_warning(
    restore_session: Session,
    raw_metadata: str | None,
) -> None:
    """Absent optional fields are not malformed and do not require cleanup."""
    dashboard: Dashboard = archived_dashboard(restore_session, {})
    dashboard.json_metadata = raw_metadata
    restore_session.commit()
    command: RestoreDashboardCommand = RestoreDashboardCommand(str(dashboard.uuid))
    with patch("superset.commands.restore.security_manager.raise_for_editorship"):
        command.run()
    restore_session.refresh(dashboard)
    assert dashboard.deleted_at is None
    assert dashboard.json_metadata == raw_metadata
    assert command.warnings == []


def test_restore_rejects_unicode_id_even_when_ascii_view_exists(
    restore_session: Session,
) -> None:
    """Identity parsing agrees with deletion checks instead of aliasing Unicode IDs."""
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), name="layer", type="test", configuration="{}"
    )
    view: SemanticView = SemanticView(
        name="view", semantic_layer=layer, configuration="{}"
    )
    restore_session.add(view)
    restore_session.commit()
    fullwidth_id: str = "".join(chr(ord(digit) + 0xFEE0) for digit in str(view.id))
    dashboard: Dashboard = archived_dashboard(
        restore_session,
        {
            "native_filter_configuration": [
                {
                    "id": "invalid",
                    "targets": [
                        {"datasetId": fullwidth_id, "datasourceType": "semantic_view"}
                    ],
                }
            ],
        },
    )
    command: RestoreDashboardCommand = RestoreDashboardCommand(str(dashboard.uuid))
    with patch("superset.commands.restore.security_manager.raise_for_editorship"):
        command.run()
    restore_session.refresh(dashboard)
    assert json.loads(dashboard.json_metadata)["native_filter_configuration"] == []
    assert "invalid" in command.warnings[0]


@pytest.mark.parametrize(
    "key", ["native_filter_configuration", "chart_customization_config"]
)
@pytest.mark.parametrize(
    "target_id",
    [
        17,
        "17",
        True,
        None,
        "invalid",
        2**64,
        pytest.param("9" * 5000, id="oversized-decimal"),
    ],
)
def test_restore_drops_deleted_semantic_control_and_warns(
    restore_session: Session,
    key: str,
    target_id: object,
) -> None:
    """Remove broken controls, not same-ID table targets or unrelated metadata."""
    dashboard: Dashboard = archived_dashboard(
        restore_session,
        {
            key: [
                {
                    "id": "missing",
                    "targets": [
                        {"datasetId": target_id, "datasourceType": "semantic_view"}
                    ],
                },
                {
                    "id": "table",
                    "targets": [{"datasetId": 17}],
                    "cascadeParentIds": ["missing", "retained"],
                },
                {"id": "retained", "targets": [{}]},
            ],
            "color_scheme": "supersetColors",
        },
    )
    command: RestoreDashboardCommand = RestoreDashboardCommand(str(dashboard.uuid))
    with patch("superset.commands.restore.security_manager.raise_for_editorship"):
        command.run()
    restore_session.refresh(dashboard)
    metadata: dict[str, Any] = json.loads(dashboard.json_metadata)
    assert [control["id"] for control in metadata[key]] == ["table", "retained"]
    assert metadata[key][0]["cascadeParentIds"] == ["retained"]
    assert metadata[key][0]["targets"] == [{"datasetId": 17}]
    assert metadata["color_scheme"] == "supersetColors"
    assert dashboard.deleted_at is None
    assert len(command.warnings) == 1
    assert "missing semantic view" in command.warnings[0]


def test_restore_after_deleting_view_preserves_unaffected_semantic_control(
    restore_session: Session,
) -> None:
    """A committed view deletion is detected without removing another live view."""
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), name="layer", type="test", configuration="{}"
    )
    deleted: SemanticView = SemanticView(
        name="deleted", semantic_layer=layer, configuration="{}"
    )
    retained: SemanticView = SemanticView(
        name="retained", semantic_layer=layer, configuration="{}"
    )
    restore_session.add_all([deleted, retained])
    restore_session.commit()
    dashboard: Dashboard = archived_dashboard(
        restore_session,
        {
            "native_filter_configuration": [
                {
                    "id": "missing",
                    "targets": [
                        {"datasetId": deleted.id, "datasourceType": "semantic_view"}
                    ],
                },
                {
                    "id": "existing",
                    "targets": [
                        {"datasetId": retained.id, "datasourceType": "semantic_view"}
                    ],
                },
            ],
        },
    )
    restore_session.delete(deleted)
    restore_session.commit()
    command: RestoreDashboardCommand = RestoreDashboardCommand(str(dashboard.uuid))
    with patch("superset.commands.restore.security_manager.raise_for_editorship"):
        command.run()
    restore_session.refresh(dashboard)
    assert [
        control["id"]
        for control in json.loads(dashboard.json_metadata)[
            "native_filter_configuration"
        ]
    ] == ["existing"]
    assert len(command.warnings) == 1


def test_restore_preserves_existing_semantic_view_without_provider_access(
    restore_session: Session,
) -> None:
    """An unregistered/disabled provider is not evidence that its view was deleted."""
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), name="layer", type="test", configuration="{}"
    )
    view: SemanticView = SemanticView(
        name="view", semantic_layer=layer, configuration="{}"
    )
    restore_session.add(view)
    restore_session.commit()
    dashboard: Dashboard = archived_dashboard(
        restore_session,
        {
            "native_filter_configuration": [
                {
                    "id": "existing",
                    "targets": [
                        {"datasetId": view.id, "datasourceType": "semantic_view"}
                    ],
                }
            ],
        },
    )
    original: str = dashboard.json_metadata
    command: RestoreDashboardCommand = RestoreDashboardCommand(str(dashboard.uuid))
    with (
        patch("superset.commands.restore.security_manager.raise_for_editorship"),
        patch.object(
            SemanticView,
            "raise_for_access",
            side_effect=AssertionError("Not an access check"),
        ),
    ):
        command.run()
    restore_session.refresh(dashboard)
    assert dashboard.json_metadata == original
    assert dashboard.deleted_at is None
    assert command.warnings == []


@pytest.mark.parametrize("failure", ["forbidden", "slug", "commit"])
def test_failed_restore_does_not_persist_control_cleanup(
    restore_session: Session,
    failure: str,
) -> None:
    """Permission, slug and commit failures leave the archive and metadata intact."""
    dashboard: Dashboard = archived_dashboard(
        restore_session,
        {
            "native_filter_configuration": [
                {
                    "id": "missing",
                    "targets": [{"datasetId": 17, "datasourceType": "semantic_view"}],
                }
            ],
        },
    )
    dashboard.slug = "archived"
    restore_session.commit()
    original: str = dashboard.json_metadata
    errors: dict[str, type[Exception]] = {
        "forbidden": DashboardForbiddenError,
        "slug": DashboardSlugConflictError,
        "commit": DashboardRestoreFailedError,
    }
    with (
        patch(
            "superset.commands.restore.security_manager.raise_for_editorship"
        ) as editor,
        patch.object(
            RestoreDashboardCommand,
            "_has_active_slug_twin",
            return_value=failure == "slug",
        ),
        patch.object(restore_session, "commit", wraps=restore_session.commit) as commit,
    ):
        if failure == "forbidden":
            editor.side_effect = SupersetSecurityException(MagicMock())
        if failure == "commit":
            commit.side_effect = SQLAlchemyError("commit failed")
        with pytest.raises(errors[failure]):
            RestoreDashboardCommand(str(dashboard.uuid)).run()
    restore_session.refresh(dashboard)
    assert dashboard.json_metadata == original
    assert dashboard.deleted_at is not None
