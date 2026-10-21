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
"""Exercise the native registered routes, retaining their authorization wrappers."""

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from werkzeug.test import TestResponse

from superset import security_manager
from superset.app import SupersetApp
from superset.daos.version import VersionDAO
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.extensions import event_logger, feature_flag_manager

ENTITY_UUID: str = "8b8c9f00-0000-4000-8000-000000000001"
VERSION_UUID: str = "8b8c9f00-0000-4000-8000-000000000002"

pytestmark: list[pytest.MarkDecorator] = [
    pytest.mark.usefixtures("full_api_access", "version_api_context"),
    pytest.mark.parametrize("resource", ["chart", "dashboard", "dataset"]),
    pytest.mark.parametrize(
        "method,suffix",
        [
            ("GET", "versions/"),
            ("GET", f"versions/{VERSION_UUID}/"),
            ("GET", "activity/"),
            ("POST", f"versions/{VERSION_UUID}/restore"),
        ],
    ),
]


@pytest.fixture
def version_api_context(mocker: MockerFixture, app: SupersetApp) -> None:
    """Keep capture on independently of the request's history flag."""
    mocker.patch.dict(app.config, {"ENABLE_VERSIONING_CAPTURE": True})
    mocker.patch.object(event_logger, "log")
    mocker.patch.object(security_manager, "is_guest_user", return_value=False)


@pytest.mark.parametrize("enabled", [False, True])
def test_history_flag_gates_registered_routes(
    client: FlaskClient,
    mocker: MockerFixture,
    resource: str,
    method: str,
    suffix: str,
    enabled: bool,
) -> None:
    """Off denies before history reads or restore execution; on reaches the body.

    DAO results and the successful restore command are boundary doubles; route
    registration, protect, safe, the feature gate and response helpers are real.
    """
    mocker.patch.dict(feature_flag_manager._feature_flags, {"VERSION_HISTORY": enabled})
    entity: SimpleNamespace = SimpleNamespace(id=1, uuid=UUID(ENTITY_UUID))
    lookup: MagicMock = mocker.patch.object(
        VersionDAO, "find_active_by_uuid", return_value=entity
    )
    listing: MagicMock = mocker.patch.object(
        VersionDAO, "list_versions", return_value=[]
    )
    snapshot: MagicMock = mocker.patch.object(
        VersionDAO, "get_version", return_value={"id": 1}
    )
    mocker.patch.object(VersionDAO, "current_live_version_uuid", return_value=None)
    mocker.patch.object(security_manager, "is_editor", return_value=True)
    activity: MagicMock = mocker.patch(
        "superset.versioning.activity.orchestrator.get_activity",
        return_value=([], 0, False),
    )
    restore: MagicMock = mocker.patch(
        "superset.commands.version_restore.BaseRestoreVersionCommand.run",
        return_value=SimpleNamespace(entity=entity, skipped_slice_ids=[]),
    )

    response: TestResponse = client.open(
        f"/api/v1/{resource}/{ENTITY_UUID}/{suffix}", method=method
    )

    assert response.status_code == (200 if enabled else 404), response.json
    if not enabled:
        lookup.assert_not_called()
        listing.assert_not_called()
        snapshot.assert_not_called()
        activity.assert_not_called()
        restore.assert_not_called()
        assert response.json == {"message": "Not found"}


def test_enabled_history_retains_object_editorship(
    client: FlaskClient,
    mocker: MockerFixture,
    resource: str,
    method: str,
    suffix: str,
) -> None:
    """An enabled feature cannot authorize a non-editor's read or restore."""
    mocker.patch.dict(feature_flag_manager._feature_flags, {"VERSION_HISTORY": True})
    entity: SimpleNamespace = SimpleNamespace(id=1, uuid=UUID(ENTITY_UUID))
    mocker.patch.object(VersionDAO, "find_active_by_uuid", return_value=entity)
    mocker.patch(
        "superset.commands.version_restore.find_active_by_uuid", return_value=entity
    )
    mocker.patch.object(security_manager, "is_editor", return_value=False)
    mocker.patch.object(
        security_manager,
        "raise_for_editorship",
        side_effect=SupersetSecurityException(
            SupersetError(
                message="Not an editor",
                error_type=SupersetErrorType.DASHBOARD_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        ),
    )
    restore: MagicMock = mocker.patch(
        "superset.commands.version_restore.restore_version"
    )

    response: TestResponse = client.open(
        f"/api/v1/{resource}/{ENTITY_UUID}/{suffix}", method=method
    )

    assert response.status_code == 403, response.json
    restore.assert_not_called()


@pytest.mark.parametrize("enabled", [False, True])
def test_history_flag_does_not_replace_route_permissions(
    client: FlaskClient,
    mocker: MockerFixture,
    resource: str,
    method: str,
    suffix: str,
    enabled: bool,
) -> None:
    """The existing protect decorator still rejects missing model permissions."""
    mocker.patch.dict(feature_flag_manager._feature_flags, {"VERSION_HISTORY": enabled})
    mocker.patch.object(security_manager, "is_item_public", return_value=False)
    mocker.patch.object(security_manager, "has_access", return_value=False)

    response: TestResponse = client.open(
        f"/api/v1/{resource}/{ENTITY_UUID}/{suffix}", method=method
    )

    assert response.status_code == 403, response.json
