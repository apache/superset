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
"""Write paths beyond the main updates: restore, bundle import, embedding,
dataset column/metric deletes and datetime detection, and the refresh an
``override_columns`` save performs."""

from __future__ import annotations

from io import BytesIO
from typing import Any
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from asset_approval import gate
from asset_approval.exceptions import (
    ChangeRequestCreated,
    ImportOverwriteRefusedError,
    ReplayFailedError,
    UnreviewableWriteRefusedError,
)
from asset_approval.models import ChangeRequest
from asset_approval.replay import build_command
from asset_approval.types import AssetType


@pytest.fixture
def capture(mocker: MockerFixture) -> MagicMock:
    """Review on, no open request, and the insert recorded."""
    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "get_user_id", return_value=5)
    mocker.patch.object(gate, "find_open_request", return_value=None)
    return mocker.patch.object(gate, "_insert_request", return_value=7)


@pytest.fixture
def review_off(mocker: MockerFixture) -> MagicMock:
    mocker.patch.object(gate, "is_enabled", return_value=False)
    return mocker.patch.object(gate, "_insert_request")


def _change_request(
    asset_type: str, body: dict[str, Any], args: dict[str, Any]
) -> ChangeRequest:
    return ChangeRequest(
        id=1,
        asset_type=asset_type,
        asset_id=1,
        operation="update",
        payload=ChangeRequest.serialize_payload(body, args),
    )


# ------------------------------------------------------------ version restore


@pytest.fixture
def restore(mocker: MockerFixture) -> tuple[Any, MagicMock]:
    from superset.commands.dashboard.restore_version import (
        RestoreDashboardVersionCommand,
    )
    from superset.models.dashboard import Dashboard

    dashboard = Dashboard(id=1, uuid=uuid4())
    mocker.patch.object(
        RestoreDashboardVersionCommand, "validate", return_value=dashboard
    )
    mocker.patch(
        "superset.commands.version_restore.resolve_version", return_value=(4, 99)
    )
    applied = mocker.patch(
        "superset.commands.version_restore.restore_version",
        return_value=MagicMock(entity=dashboard, skipped_slice_ids=[]),
    )
    return RestoreDashboardVersionCommand(dashboard.uuid, uuid4()), applied


def test_version_restore_is_captured(
    session: Session, restore: tuple[Any, MagicMock], capture: MagicMock
) -> None:
    command, applied = restore

    with pytest.raises(ChangeRequestCreated):
        command.run()

    applied.assert_not_called()
    args = capture.call_args.args
    assert args[0] is AssetType.DASHBOARD
    assert args[2] == {"version_uuid": str(command._version_uuid)}
    assert args[5] == {
        gate.COMMAND_KEY: gate.RESTORE_VERSION_COMMAND,
        "version_number": 4,
    }


def test_version_restore_unchanged_with_flag_off(
    callable_db_session: Session,
    restore: tuple[Any, MagicMock],
    review_off: MagicMock,
) -> None:
    # Needs callable_db_session, not session: with review off the restore
    # runs for real, so it reaches db.session() and goes looking for the
    # row it is restoring, which has to be there.
    from superset.models.dashboard import Dashboard

    command, applied = restore
    Dashboard.metadata.create_all(callable_db_session.get_bind())
    callable_db_session.add(Dashboard(id=1, uuid=command._uuid))
    callable_db_session.commit()

    command.run()
    applied.assert_called_once()
    review_off.assert_not_called()


@pytest.mark.parametrize("asset_type", ["dashboard", "chart", "dataset"])
def test_version_restore_replays_through_restore_command(
    mocker: MockerFixture, asset_type: str
) -> None:
    from superset.commands.version_restore import BaseRestoreVersionCommand

    asset_uuid, version_uuid = uuid4(), uuid4()
    mocker.patch(
        "asset_approval.replay.load_asset",
        return_value=MagicMock(uuid=asset_uuid),
    )
    command = build_command(
        _change_request(
            asset_type,
            {"version_uuid": str(version_uuid)},
            {gate.COMMAND_KEY: gate.RESTORE_VERSION_COMMAND, "version_number": 4},
        )
    )

    assert isinstance(command, BaseRestoreVersionCommand)
    assert (
        command.model_cls.__name__
        == {
            "dashboard": "Dashboard",
            "chart": "Slice",
            "dataset": "SqlaTable",
        }[asset_type]
    )
    assert (command._uuid, command._version_uuid) == (asset_uuid, version_uuid)


def test_restore_endpoint_answers_capture_with_202(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    from superset.commands.dashboard.restore_version import (
        RestoreDashboardVersionCommand,
    )

    # Only ``run`` is replaced. The endpoint's own handler list includes
    # ``except command_cls.not_found_exc``, so a mocked command class
    # raises a TypeError on the way out and the signal is never seen.
    mocker.patch.object(
        RestoreDashboardVersionCommand,
        "run",
        side_effect=ChangeRequestCreated(7, "dashboard", 1),
    )

    response = client.post(f"/api/v1/dashboard/{uuid4()}/versions/{uuid4()}/restore")

    assert response.status_code == 202
    assert response.json["review_required"] is True


# --------------------------------------------------------------- bundle import


def _assets_command(mocker: MockerFixture, uuid: str) -> Any:
    from superset.commands.importers.v1.assets import ImportAssetsCommand

    command = ImportAssetsCommand({})
    mocker.patch.object(command, "validate")
    mocker.patch.object(command, "_import")
    command._configs = {"dashboards/d.yaml": {"uuid": uuid}}
    return command


def test_bundle_overwrite_of_existing_asset_is_refused(
    mocker: MockerFixture, session: Session
) -> None:
    from superset.models.dashboard import Dashboard

    Dashboard.metadata.create_all(session.get_bind())
    existing = Dashboard(dashboard_title="d", uuid=uuid4())
    session.add(existing)
    session.flush()
    mocker.patch.object(gate, "is_enabled", return_value=True)
    command = _assets_command(mocker, str(existing.uuid))

    # Re-raised as itself, not folded into ImportFailedError.
    with pytest.raises(ImportOverwriteRefusedError) as excinfo:
        command.run()

    assert str(excinfo.value).startswith(
        "Importing over an existing dashboard needs review"
    )
    command._import.assert_not_called()


@pytest.mark.parametrize("enabled,overwrite", [(True, True), (False, True)])
def test_bundle_import_of_new_assets_proceeds(
    mocker: MockerFixture, session: Session, enabled: bool, overwrite: bool
) -> None:
    from superset.models.dashboard import Dashboard

    Dashboard.metadata.create_all(session.get_bind())
    mocker.patch.object(gate, "is_enabled", return_value=enabled)
    command = _assets_command(mocker, str(uuid4()))
    command.overwrite = overwrite

    command.run()

    command._import.assert_called_once()


def test_assets_import_api_answers_refusal_with_422(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    mocker.patch("superset.importexport.api.is_zipfile", return_value=True)
    # See test_import_refusal: the upload is read through open_import_bundle.
    mocker.patch("superset.importexport.api.open_import_bundle")
    mocker.patch(
        "superset.importexport.api.get_contents_from_bundle",
        return_value={"metadata.yaml": "x"},
    )
    command = mocker.patch("superset.importexport.api.ImportAssetsCommand")
    command.return_value.run.side_effect = ImportOverwriteRefusedError("dashboard")

    response = client.post(
        "/api/v1/assets/import/",
        data={"bundle": (BytesIO(b"test"), "test.zip")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 422
    assert response.json["message"].startswith(
        "Importing over an existing dashboard needs review"
    )


# ----------------------------------------------------------------- embedding
#
# Setting a dashboard's embedded config has no command of its own in the
# host build: the API loads the dashboard and calls the DAO inline. The DAO
# is therefore the seam the gate binds to, and these tests exercise it
# where the others exercise a command.


# The DAO method is the gate's binding point, so these cannot mock it out
# to prove it was not reached -- that would remove the gate along with it.
# What the DAO body does instead is replace ``dashboard.embedded`` with a
# one-item list, which is observable either way.


def test_embedding_change_is_captured(session: Session, capture: MagicMock) -> None:
    from superset.daos.dashboard import EmbeddedDashboardDAO

    dashboard = MagicMock(id=1)
    with pytest.raises(ChangeRequestCreated):
        EmbeddedDashboardDAO.upsert(dashboard, ["a.com"])

    assert not isinstance(dashboard.embedded, list)
    assert capture.call_args.args[2] == {"allowed_domains": ["a.com"]}
    assert capture.call_args.args[5] == {
        gate.COMMAND_KEY: gate.UPSERT_EMBEDDED_COMMAND
    }


def test_embedding_change_unchanged_with_flag_off(
    session: Session, review_off: MagicMock
) -> None:
    from superset.daos.dashboard import EmbeddedDashboardDAO

    dashboard = MagicMock(id=1)
    embedded = EmbeddedDashboardDAO.upsert(dashboard, ["a.com"])

    assert dashboard.embedded == [embedded]
    assert embedded.allow_domain_list == "a.com"


def test_embedding_delete_is_captured(
    mocker: MockerFixture, session: Session, capture: MagicMock
) -> None:
    from superset.commands.dashboard.delete import DeleteEmbeddedDashboardCommand

    mocker.patch("superset.commands.dashboard.delete.security_manager")
    dao = mocker.patch("superset.commands.dashboard.delete.EmbeddedDashboardDAO")

    with pytest.raises(ChangeRequestCreated):
        DeleteEmbeddedDashboardCommand(MagicMock(id=1, embedded=[MagicMock()])).run()

    dao.delete.assert_not_called()
    assert capture.call_args.args[5] == {gate.COMMAND_KEY: "delete_embedded"}


def test_embedded_upsert_replays_through_the_dao(mocker: MockerFixture) -> None:
    """An approved embedded change re-applies the reviewed domain list."""
    from asset_approval.replay import EmbeddedUpsertReplay

    dashboard = MagicMock(id=1)
    mocker.patch("asset_approval.replay.load_asset", return_value=dashboard)
    command = build_command(
        _change_request(
            "dashboard",
            {"allowed_domains": ["a.com"]},
            {gate.COMMAND_KEY: gate.UPSERT_EMBEDDED_COMMAND},
        )
    )

    assert type(command) is EmbeddedUpsertReplay
    assert command._dashboard is dashboard
    assert command._allowed_domains == ["a.com"]

    upsert = mocker.patch("superset.daos.dashboard.EmbeddedDashboardDAO.upsert")
    mocker.patch("superset.db.session.commit")
    command.run()
    upsert.assert_called_once_with(dashboard, ["a.com"])


def test_embedding_delete_replays_through_its_command(
    mocker: MockerFixture,
) -> None:
    from superset.commands.dashboard.delete import DeleteEmbeddedDashboardCommand

    dashboard = MagicMock(id=1)
    mocker.patch("asset_approval.replay.load_asset", return_value=dashboard)
    command = build_command(
        _change_request("dashboard", {}, {gate.COMMAND_KEY: "delete_embedded"})
    )

    assert type(command) is DeleteEmbeddedDashboardCommand
    assert command._dashboard is dashboard


def test_set_embedded_api_answers_capture_with_202(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    mocker.patch(
        "superset.dashboards.api.DashboardDAO.get_by_id_or_slug",
        return_value=MagicMock(id=1),
    )
    mocker.patch(
        "superset.daos.dashboard.EmbeddedDashboardDAO.upsert",
        side_effect=ChangeRequestCreated(7, "dashboard", 1),
    )

    response = client.put(
        "/api/v1/dashboard/1/embedded", json={"allowed_domains": ["a.com"]}
    )

    assert response.status_code == 202
    assert response.json["review_required"] is True


# ------------------------------------------- dataset column / metric / formats


@pytest.mark.parametrize("noun", ["column", "metric"])
def test_dataset_child_delete_refused_under_review(
    mocker: MockerFixture, session: Session, noun: str
) -> None:
    if noun == "column":
        from superset.commands.dataset.columns.delete import (
            DeleteDatasetColumnCommand as Command,
        )

        dao_path = "superset.commands.dataset.columns.delete.DatasetColumnDAO"
    else:
        from superset.commands.dataset.metrics.delete import (
            DeleteDatasetMetricCommand as Command,
        )

        dao_path = "superset.commands.dataset.metrics.delete.DatasetMetricDAO"

    def validate(self: Any) -> None:
        self._model = MagicMock()

    mocker.patch.object(Command, "validate", validate)
    dao = mocker.patch(dao_path)

    mocker.patch.object(gate, "is_enabled", return_value=True)
    with pytest.raises(UnreviewableWriteRefusedError) as excinfo:
        Command(1, 2).run()
    assert str(excinfo.value).startswith(f"Deleting a dataset {noun} needs review")
    dao.delete.assert_not_called()

    mocker.patch.object(gate, "is_enabled", return_value=False)
    Command(1, 2).run()
    dao.delete.assert_called_once()


@pytest.mark.parametrize("noun", ["column", "metric"])
def test_dataset_child_delete_api_answers_refusal_with_422(
    mocker: MockerFixture, client: Any, full_api_access: None, noun: str
) -> None:
    name = "Column" if noun == "column" else "Metric"
    command = mocker.patch(f"superset.datasets.{noun}s.api.DeleteDataset{name}Command")
    command.return_value.run.side_effect = UnreviewableWriteRefusedError(
        f"Deleting a dataset {noun}", "Save instead."
    )

    response = client.delete(f"/api/v1/dataset/1/{noun}/2")

    assert response.status_code == 422
    assert "needs review" in response.json["message"]


def _detect_datetime_formats(app: Any, pk: int = 1, *, gated: bool = True) -> Any:
    """Call the endpoint, with or without the gate in front of it.

    The route is not in ``DatasetRestApi.include_route_methods`` and so is
    not served over HTTP; the refusal guards it for whenever it is. There
    is no command here either, so the gate wraps the view method itself:
    ``gated`` calls that wrapper, and the refusal is raised out of it,
    which over HTTP is the same 422 every other refusal answers with.
    Without it, ``unwrap`` reaches the host's own body past both the gate
    and Flask-AppBuilder's decorators.
    """
    import inspect

    from superset.datasets.api import DatasetRestApi

    method = DatasetRestApi.detect_datetime_formats
    body = method if gated else inspect.unwrap(method)
    view = MagicMock()
    with app.test_request_context(f"/api/v1/dataset/{pk}/detect_datetime_formats"):
        body(view, pk)
    return view


def test_detect_datetime_formats_refused_under_review(
    mocker: MockerFixture, app: Any
) -> None:
    mocker.patch(
        "superset.datasets.api.DatasetDAO.find_by_id", return_value=MagicMock()
    )
    mocker.patch("superset.datasets.api.security_manager.raise_for_editorship")
    detector = mocker.patch(
        "superset.datasets.datetime_format_detector.DatetimeFormatDetector"
    )
    mocker.patch.object(gate, "is_enabled", return_value=True)

    with pytest.raises(UnreviewableWriteRefusedError) as excinfo:
        _detect_datetime_formats(app)

    assert excinfo.value.status == 422
    assert str(excinfo.value).startswith(
        "Detecting and storing datetime formats needs review"
    )
    detector.assert_not_called()


def test_detect_datetime_formats_unchanged_with_flag_off(
    mocker: MockerFixture, app: Any
) -> None:
    mocker.patch(
        "superset.datasets.api.DatasetDAO.find_by_id", return_value=MagicMock()
    )
    mocker.patch("superset.datasets.api.security_manager.raise_for_editorship")
    detector = mocker.patch(
        "superset.datasets.datetime_format_detector.DatetimeFormatDetector"
    )
    detector.return_value.detect_all_formats.return_value = {"ds": "%Y"}
    mocker.patch.object(gate, "is_enabled", return_value=False)

    view = _detect_datetime_formats(app, gated=False)

    assert view.response.call_args.args[0] == 200
    assert view.response.call_args.kwargs["formats"] == {"ds": "%Y"}


# ------------------------------------------- override_columns save + refresh


def test_override_columns_replay_also_refreshes(mocker: MockerFixture) -> None:
    from asset_approval.replay import DatasetSaveWithRefresh

    update = mocker.patch("superset.commands.dataset.update.UpdateDatasetCommand")
    refresh = mocker.patch("superset.commands.dataset.refresh.RefreshDatasetCommand")
    command = build_command(
        _change_request("dataset", {"sql": "x"}, {"override_columns": True})
    )

    assert isinstance(command, DatasetSaveWithRefresh)
    assert command.run() is update.return_value.run.return_value
    update.assert_called_once_with(1, {"sql": "x"}, override_columns=True)
    refresh.assert_called_once_with(1)
    refresh.return_value.run.assert_called_once()


def test_plain_dataset_replay_does_not_refresh(mocker: MockerFixture) -> None:
    update = mocker.patch("superset.commands.dataset.update.UpdateDatasetCommand")
    refresh = mocker.patch("superset.commands.dataset.refresh.RefreshDatasetCommand")

    command = build_command(
        _change_request("dataset", {"sql": "x"}, {"override_columns": False})
    )

    assert command is update.return_value
    refresh.assert_not_called()


def test_override_columns_replay_refresh_failure_fails_approval(
    mocker: MockerFixture,
) -> None:
    mocker.patch("superset.commands.dataset.update.UpdateDatasetCommand")
    refresh = mocker.patch("superset.commands.dataset.refresh.RefreshDatasetCommand")
    refresh.return_value.run.side_effect = RuntimeError("source unreachable")

    command = build_command(
        _change_request("dataset", {"sql": "x"}, {"override_columns": True})
    )
    with pytest.raises(ReplayFailedError):
        command.run()
