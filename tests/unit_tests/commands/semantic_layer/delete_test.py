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

from unittest.mock import MagicMock

import pytest
import sqlalchemy as sa
from pytest_mock import MockerFixture
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session

from superset.commands.semantic_layer.delete import DeleteSemanticLayerCommand
from superset.commands.semantic_layer.exceptions import (
    SemanticDeleteDependentsError,
    SemanticLayerForbiddenError,
    SemanticLayerNotFoundError,
)
from superset.exceptions import SupersetSecurityException


def test_delete_semantic_layer_success(mocker: MockerFixture) -> None:
    """Test successful deletion of a semantic layer."""
    mock_model = MagicMock()
    mock_model.uuid = "00000000-0000-0000-0000-000000000001"
    mocker.patch(
        "superset.commands.semantic_layer.delete._dependent_assets",
        return_value=(0, [], 0),
    )

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model

    mocker.patch(
        "superset.commands.semantic_layer.delete.current_user_can_modify_object",
        return_value=True,
    )

    DeleteSemanticLayerCommand("some-uuid").run()

    dao.find_by_uuid.assert_called_once_with("some-uuid")
    dao.delete.assert_called_once_with([mock_model])


def test_delete_semantic_layer_refuses_dependents(mocker: MockerFixture) -> None:
    """A layer delete must not cascade away a view still used by a chart."""
    model: MagicMock = MagicMock()
    model.uuid = "00000000-0000-0000-0000-000000000001"
    dao: MagicMock = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticLayerDAO"
    )
    dao.find_by_uuid.return_value = model
    mocker.patch(
        "superset.commands.semantic_layer.delete.current_user_can_modify_object",
        return_value=True,
    )
    mocker.patch(
        "superset.commands.semantic_layer.delete._dependent_assets",
        return_value=(1, [{"type": "chart", "id": 7, "name": "Revenue"}], 0),
    )

    exc_info: pytest.ExceptionInfo[SemanticDeleteDependentsError]
    with pytest.raises(SemanticDeleteDependentsError) as exc_info:
        DeleteSemanticLayerCommand("layer-uuid").run()

    dao.delete.assert_not_called()
    assert exc_info.value.total == 1
    assert exc_info.value.dependents == [{"type": "chart", "id": 7, "name": "Revenue"}]


def test_delete_semantic_layer_not_found(mocker: MockerFixture) -> None:
    """Test that SemanticLayerNotFoundError is raised when model is missing."""
    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = None

    with pytest.raises(SemanticLayerNotFoundError):
        DeleteSemanticLayerCommand("missing-uuid").run()


def test_delete_semantic_layer_requires_access(mocker: MockerFixture) -> None:
    """A user without access to the layer cannot delete it."""
    mock_model = MagicMock()
    mock_model.raise_for_access.side_effect = SupersetSecurityException(MagicMock())

    dao = mocker.patch("superset.commands.semantic_layer.delete.SemanticLayerDAO")
    dao.find_by_uuid.return_value = mock_model

    with pytest.raises(SemanticLayerForbiddenError):
        DeleteSemanticLayerCommand("not-mine-uuid").run()

    dao.delete.assert_not_called()


def test_delete_semantic_layer_forbidden(mocker: MockerFixture) -> None:
    """Test that SemanticLayerForbiddenError is raised for non-editors."""
    mock_model = MagicMock()

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model

    mocker.patch(
        "superset.commands.semantic_layer.delete.current_user_can_modify_object",
        return_value=False,
    )

    with pytest.raises(SemanticLayerForbiddenError):
        DeleteSemanticLayerCommand("some-uuid").run()

    dao.delete.assert_not_called()


def test_delete_semantic_layer_creator_allowed(mocker: MockerFixture) -> None:
    """A non-admin who created the layer, but holds no explicit editorship
    on it, can still delete it."""
    mock_model = MagicMock()
    mock_model.uuid = "00000000-0000-0000-0000-000000000001"
    mocker.patch(
        "superset.commands.semantic_layer.delete._dependent_assets",
        return_value=(0, [], 0),
    )

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model

    sm = mocker.patch("superset.commands.utils.security_manager")
    sm.raise_for_editorship = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )
    mock_model.created_by = sm.current_user

    DeleteSemanticLayerCommand("some-uuid").run()

    dao.delete.assert_called_once_with([mock_model])


def test_delete_semantic_layer_non_creator_non_editor_forbidden(
    mocker: MockerFixture,
) -> None:
    """A non-admin who neither created the layer nor is an editor of it is
    rejected."""
    mock_model = MagicMock()

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticLayerDAO",
    )
    dao.find_by_uuid.return_value = mock_model

    sm = mocker.patch("superset.commands.utils.security_manager")
    sm.raise_for_editorship = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )
    mock_model.created_by = MagicMock(name="someone_else")

    with pytest.raises(SemanticLayerForbiddenError):
        DeleteSemanticLayerCommand("some-uuid").run()

    dao.delete.assert_not_called()


def test_delete_semantic_view_success(mocker: MockerFixture) -> None:
    """Test successful deletion of a semantic view."""
    mock_model = MagicMock()
    mock_model.id = 42
    mocker.patch(
        "superset.commands.semantic_layer.delete._dependent_assets",
        return_value=(0, [], 0),
    )

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_id.return_value = mock_model

    # Admin (or an editor) can modify anything — no exception raised.
    mocker.patch(
        "superset.commands.semantic_layer.delete.current_user_can_modify_object",
        return_value=True,
    )

    from superset.commands.semantic_layer.delete import DeleteSemanticViewCommand

    DeleteSemanticViewCommand(42).run()

    dao.find_by_id.assert_called_once_with(42, id_column="id")
    dao.delete.assert_called_once_with([mock_model])


def test_delete_semantic_view_refuses_dependents(mocker: MockerFixture) -> None:
    """A view still used by a chart must not be hard-deleted."""
    from superset.commands.semantic_layer.delete import DeleteSemanticViewCommand

    model: MagicMock = MagicMock()
    model.id = 42
    dao: MagicMock = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO"
    )
    dao.find_by_id.return_value = model
    mocker.patch(
        "superset.commands.semantic_layer.delete.current_user_can_modify_object",
        return_value=True,
    )
    mocker.patch(
        "superset.commands.semantic_layer.delete._dependent_assets",
        return_value=(1, [{"type": "chart", "id": 7, "name": "Revenue"}], 0),
    )

    exc_info: pytest.ExceptionInfo[SemanticDeleteDependentsError]
    with pytest.raises(SemanticDeleteDependentsError) as exc_info:
        DeleteSemanticViewCommand(42).run()

    dao.delete.assert_not_called()
    assert exc_info.value.total == 1
    assert exc_info.value.dependents == [{"type": "chart", "id": 7, "name": "Revenue"}]


def test_bulk_delete_semantic_views_refuses_all_on_one_dependency(
    mocker: MockerFixture,
) -> None:
    """A blocked view prevents every member of the bulk hard delete."""
    from superset.commands.semantic_layer.delete import BulkDeleteSemanticViewCommand

    models: list[MagicMock] = [MagicMock(id=42), MagicMock(id=43)]
    dao: MagicMock = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO"
    )
    dao.find_by_ids.return_value = models
    mocker.patch(
        "superset.commands.semantic_layer.delete.current_user_can_modify_object",
        return_value=True,
    )
    mocker.patch(
        "superset.commands.semantic_layer.delete._dependent_assets",
        return_value=(1, [{"type": "chart", "id": 7, "name": "Revenue"}], 0),
    )

    with pytest.raises(SemanticDeleteDependentsError):
        BulkDeleteSemanticViewCommand([42, 43]).run()

    dao.delete.assert_not_called()


def test_semantic_delete_lists_live_dependents_only(
    session: Session, mocker: MockerFixture
) -> None:
    """Charts, dashboard membership and active schedules form the dependency set."""
    from datetime import datetime

    from superset.commands.semantic_layer.delete import _dependent_assets
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.reports.models import ReportSchedule

    Slice.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    connection: Connection = session.get_bind().connect()
    connection.execute(
        Slice.__table__.insert().values(  # pylint: disable=no-member
            id=711,
            slice_name="Live chart",
            datasource_type="semantic_view",
            datasource_id=42,
        )
    )
    connection.execute(
        Slice.__table__.insert().values(  # pylint: disable=no-member
            id=712,
            slice_name="Deleted chart",
            datasource_type="semantic_view",
            datasource_id=42,
            deleted_at=datetime(2026, 1, 1),
        )
    )
    connection.execute(
        Slice.__table__.insert().values(  # pylint: disable=no-member
            id=717,
            slice_name=None,
            datasource_type="semantic_view",
            datasource_id=42,
        )
    )
    connection.execute(
        Dashboard.__table__.insert().values(  # pylint: disable=no-member
            id=713, dashboard_title="Live dashboard"
        )
    )
    connection.exec_driver_sql(
        "INSERT INTO dashboard_slices (dashboard_id, slice_id) VALUES (713, 711)"
    )
    connection.execute(
        ReportSchedule.__table__.insert(),  # pylint: disable=no-member
        [
            {
                "id": 714,
                "type": "Alert",
                "name": "Live alert",
                "crontab": "* * * * *",
                "chart_id": 711,
                "dashboard_id": None,
                "active": True,
            },
            {
                "id": 715,
                "type": "Report",
                "name": "Live report",
                "crontab": "* * * * *",
                "dashboard_id": 713,
                "chart_id": None,
                "active": True,
            },
            {
                "id": 716,
                "type": "Report",
                "name": "Inactive report",
                "crontab": "* * * * *",
                "chart_id": 711,
                "dashboard_id": None,
                "active": False,
            },
        ],
    )
    mocker.patch("superset.db.session.scalar", side_effect=connection.scalar)
    mocker.patch("superset.db.session.execute", side_effect=connection.execute)
    mocker.patch("superset.security_manager.can_access", return_value=True)
    mocker.patch(
        "superset.security_manager.can_access_all_datasources", return_value=True
    )
    mocker.patch("superset.security_manager.is_admin", return_value=True)

    total: int
    dependents: list[dict[str, str | int]]
    inaccessible_count: int
    total, dependents, inaccessible_count = _dependent_assets(sa.select(sa.literal(42)))

    assert total == 5
    assert inaccessible_count == 0
    assert {item["name"] for item in dependents} == {
        "Live chart",
        "Live dashboard",
        "Live alert",
        "Live report",
        "Untitled",
    }
    mocker.patch("superset.commands.semantic_layer.delete._DEPENDENT_LIMIT", 2)
    capped_total: int
    capped_dependents: list[dict[str, str | int]]
    capped_inaccessible_count: int
    capped_total, capped_dependents, capped_inaccessible_count = _dependent_assets(
        sa.select(sa.literal(42))
    )
    assert capped_total == 5
    assert len(capped_dependents) == 2
    assert capped_inaccessible_count == 0
    mocker.patch(
        "superset.commands.semantic_layer.delete.ChartFilter.apply",
        return_value=session.query(Slice.id).filter(sa.false()),
    )
    hidden_total: int
    hidden_dependents: list[dict[str, str | int]]
    hidden_count: int
    hidden_total, hidden_dependents, hidden_count = _dependent_assets(
        sa.select(sa.literal(42))
    )
    assert hidden_total == 5
    assert hidden_count == 2
    assert all(dependent["type"] != "chart" for dependent in hidden_dependents)
    connection.close()


def test_semantic_delete_hides_unreadable_dependent(
    session: Session, mocker: MockerFixture
) -> None:
    """A source editor gets a 409 without an unreadable chart's identity."""
    import uuid

    from superset.commands.semantic_layer.delete import DeleteSemanticViewCommand
    from superset.models.slice import Slice
    from superset.semantic_layers.models import SemanticLayer, SemanticView

    Slice.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    connection: Connection = session.get_bind().connect()
    try:
        layer_uuid: uuid.UUID = uuid.uuid4()
        connection.execute(
            SemanticLayer.__table__.insert().values(  # pylint: disable=no-member
                uuid=layer_uuid, name="Source", type="test"
            )
        )
        connection.execute(
            SemanticView.__table__.insert().values(  # pylint: disable=no-member
                id=42, name="View", semantic_layer_uuid=layer_uuid
            )
        )
        connection.execute(
            Slice.__table__.insert().values(  # pylint: disable=no-member
                id=721,
                slice_name="Private chart",
                datasource_type="semantic_view",
                datasource_id=42,
            )
        )
        mocker.patch("superset.db.session.scalar", side_effect=connection.scalar)
        mocker.patch("superset.db.session.execute", side_effect=connection.execute)
        mocker.patch(
            "superset.security_manager.can_access",
            return_value=False,
        )
        dao: MagicMock = mocker.patch(
            "superset.commands.semantic_layer.delete.SemanticViewDAO"
        )
        model: MagicMock = MagicMock()
        model.id = 42
        dao.find_by_id.return_value = model
        mocker.patch(
            "superset.commands.semantic_layer.delete.current_user_can_modify_object",
            return_value=True,
        )

        exc_info: pytest.ExceptionInfo[SemanticDeleteDependentsError]
        with pytest.raises(SemanticDeleteDependentsError) as exc_info:
            DeleteSemanticViewCommand(42).run()

        dao.delete.assert_not_called()
        assert exc_info.value.status == 409
        assert exc_info.value.total == 1
        assert exc_info.value.dependents == []
        assert exc_info.value.inaccessible_count == 1
    finally:
        connection.close()


def test_semantic_delete_counts_use_one_snapshot(
    session: Session, mocker: MockerFixture
) -> None:
    """A concurrent insertion cannot make the hidden count negative."""
    from superset.commands.semantic_layer.delete import _dependent_assets

    stale_scalar: MagicMock = mocker.patch(
        "superset.db.session.scalar", side_effect=[1, 2]
    )
    rows: MagicMock = mocker.patch("superset.db.session.execute")
    rows.return_value.one.return_value = (1, 0)
    rows.return_value.all.return_value = []
    mocker.patch("superset.security_manager.can_access", return_value=False)

    total: int
    dependents: list[dict[str, str | int]]
    inaccessible_count: int
    total, dependents, inaccessible_count = _dependent_assets(sa.select(sa.literal(42)))

    assert (total, dependents, inaccessible_count) == (1, [], 1)
    stale_scalar.assert_not_called()


def test_delete_semantic_view_forbidden(mocker: MockerFixture) -> None:
    """Test that SemanticViewForbiddenError is raised for non-owners."""
    from superset.commands.semantic_layer.delete import DeleteSemanticViewCommand
    from superset.commands.semantic_layer.exceptions import SemanticViewForbiddenError

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    model = MagicMock()
    model.created_by = None
    dao.find_by_id.return_value = model

    mocker.patch(
        "superset.security_manager.raise_for_editorship",
        side_effect=SupersetSecurityException(MagicMock()),
    )

    with pytest.raises(SemanticViewForbiddenError):
        DeleteSemanticViewCommand(42).run()


def test_delete_semantic_view_creator_allowed(mocker: MockerFixture) -> None:
    """A non-admin who created the view, but holds no explicit editorship on
    it, can still delete it."""
    from superset.commands.semantic_layer.delete import DeleteSemanticViewCommand

    mock_model = MagicMock()
    mock_model.id = 42
    mocker.patch(
        "superset.commands.semantic_layer.delete._dependent_assets",
        return_value=(0, [], 0),
    )

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_id.return_value = mock_model

    sm = mocker.patch("superset.commands.utils.security_manager")
    sm.raise_for_editorship = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )
    mock_model.created_by = sm.current_user

    DeleteSemanticViewCommand(42).run()

    dao.delete.assert_called_once_with([mock_model])


def test_delete_semantic_view_non_creator_non_editor_forbidden(
    mocker: MockerFixture,
) -> None:
    """A non-admin who neither created the view nor is an editor of it is
    rejected."""
    from superset.commands.semantic_layer.delete import DeleteSemanticViewCommand
    from superset.commands.semantic_layer.exceptions import SemanticViewForbiddenError

    mock_model = MagicMock()

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_id.return_value = mock_model

    sm = mocker.patch("superset.commands.utils.security_manager")
    sm.raise_for_editorship = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )
    mock_model.created_by = MagicMock(name="someone_else")

    with pytest.raises(SemanticViewForbiddenError):
        DeleteSemanticViewCommand(42).run()

    dao.delete.assert_not_called()


def test_delete_semantic_view_not_found(mocker: MockerFixture) -> None:
    """Test that SemanticViewNotFoundError is raised when view is missing."""
    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_id.return_value = None

    from superset.commands.semantic_layer.delete import DeleteSemanticViewCommand
    from superset.commands.semantic_layer.exceptions import (
        SemanticViewNotFoundError,
    )

    with pytest.raises(SemanticViewNotFoundError):
        DeleteSemanticViewCommand(999).run()


def test_bulk_delete_semantic_view_success(mocker: MockerFixture) -> None:
    """Test successful bulk deletion of semantic views."""
    mock_models = [MagicMock(), MagicMock()]
    mocker.patch(
        "superset.commands.semantic_layer.delete._dependent_assets",
        return_value=(0, [], 0),
    )

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_ids.return_value = mock_models

    mocker.patch(
        "superset.commands.semantic_layer.delete.current_user_can_modify_object",
        return_value=True,
    )

    from superset.commands.semantic_layer.delete import BulkDeleteSemanticViewCommand

    BulkDeleteSemanticViewCommand([1, 2]).run()

    dao.find_by_ids.assert_called_once_with([1, 2], id_column="id")
    dao.delete.assert_called_once_with(mock_models)


def test_bulk_delete_semantic_view_forbidden(mocker: MockerFixture) -> None:
    """Test that SemanticViewForbiddenError is raised for non-owners."""
    from superset.commands.semantic_layer.delete import BulkDeleteSemanticViewCommand
    from superset.commands.semantic_layer.exceptions import SemanticViewForbiddenError

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_ids.return_value = [MagicMock(), MagicMock()]

    mocker.patch(
        "superset.commands.semantic_layer.delete.current_user_can_modify_object",
        return_value=False,
    )

    with pytest.raises(SemanticViewForbiddenError):
        BulkDeleteSemanticViewCommand([1, 2]).run()


def test_bulk_delete_semantic_view_creator_allowed(mocker: MockerFixture) -> None:
    """A non-admin who created every view in the batch, but holds no
    explicit editorship on them, can still bulk-delete them."""
    from superset.commands.semantic_layer.delete import BulkDeleteSemanticViewCommand

    mock_models = [MagicMock(), MagicMock()]
    mocker.patch(
        "superset.commands.semantic_layer.delete._dependent_assets",
        return_value=(0, [], 0),
    )

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_ids.return_value = mock_models

    sm = mocker.patch("superset.commands.utils.security_manager")
    sm.raise_for_editorship = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )
    for model in mock_models:
        model.created_by = sm.current_user

    BulkDeleteSemanticViewCommand([1, 2]).run()

    dao.delete.assert_called_once_with(mock_models)


def test_bulk_delete_semantic_view_non_creator_non_editor_forbidden(
    mocker: MockerFixture,
) -> None:
    """A non-admin who is neither the creator of, nor an editor for, one of
    the views in the batch is rejected."""
    from superset.commands.semantic_layer.delete import BulkDeleteSemanticViewCommand
    from superset.commands.semantic_layer.exceptions import SemanticViewForbiddenError

    mock_models = [MagicMock(), MagicMock()]

    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    dao.find_by_ids.return_value = mock_models

    sm = mocker.patch("superset.commands.utils.security_manager")
    sm.raise_for_editorship = MagicMock(
        side_effect=SupersetSecurityException(MagicMock()),
    )
    # The first view belongs to the current user, the second doesn't.
    mock_models[0].created_by = sm.current_user
    mock_models[1].created_by = MagicMock(name="someone_else")

    with pytest.raises(SemanticViewForbiddenError):
        BulkDeleteSemanticViewCommand([1, 2]).run()

    dao.delete.assert_not_called()


def test_bulk_delete_semantic_view_not_found(mocker: MockerFixture) -> None:
    """Test that SemanticViewNotFoundError is raised when any id is missing."""
    dao = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO",
    )
    # Only one model returned for two requested ids
    dao.find_by_ids.return_value = [MagicMock()]

    from superset.commands.semantic_layer.delete import BulkDeleteSemanticViewCommand
    from superset.commands.semantic_layer.exceptions import SemanticViewNotFoundError

    with pytest.raises(SemanticViewNotFoundError):
        BulkDeleteSemanticViewCommand([1, 2]).run()
