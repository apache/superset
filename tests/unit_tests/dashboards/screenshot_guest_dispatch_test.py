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

"""
The dashboard screenshot task must receive the guest token of an embedded guest,
whatever the token's username claim is, so the task renders as that guest.
"""

# pylint: disable=redefined-outer-name

from typing import Any, cast
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from flask_appbuilder.security.sqla.models import Role
from pytest_mock import MockerFixture

from superset import security_manager
from superset.extensions import feature_flag_manager
from superset.security.guest_token import (
    GuestToken,
    GuestTokenResourceType,
    GuestTokenRlsRule,
)

USERNAMES = ["embedded_viewer", ""]
USERNAME_IDS = ["non-empty-username", "empty-username"]

DASHBOARD_ID = 7
RLS_RULES: list[GuestTokenRlsRule] = [{"dataset": "3", "clause": "region = 'EU'"}]
DATASETS = [3]


@pytest.fixture
def screenshot_task(mocker: MockerFixture, full_api_access: None) -> MagicMock:
    """
    Enable the endpoint and stub everything around the task dispatch (dashboard
    lookup, permalink, cache bookkeeping, lock) so the dispatch arguments are
    the only moving part. Returns the mocked task.
    """
    flags = {
        "THUMBNAILS": True,
        "ENABLE_DASHBOARD_SCREENSHOT_ENDPOINTS": True,
        "EMBEDDED_SUPERSET": True,
    }
    mocker.patch.object(
        feature_flag_manager,
        "get_feature_flags",
        side_effect=lambda: {**(feature_flag_manager._feature_flags or {}), **flags},
    )
    mocker.patch.object(security_manager, "find_role", return_value=Role(name="Public"))
    mocker.patch.object(security_manager, "_is_guest_token_revoked", return_value=False)

    dashboard = MagicMock(id=DASHBOARD_ID, digest="digest")
    mocker.patch(
        "flask_appbuilder.models.sqla.interface.SQLAInterface.get"
    ).return_value = dashboard
    mocker.patch(
        "superset.dashboards.api.is_semantic_image_unavailable", return_value=False
    )
    mocker.patch(
        "superset.dashboards.api.CreateDashboardPermalinkCommand"
    ).return_value.run.return_value = "permalink-key"
    mocker.patch("superset.dashboards.api.DistributedLock")

    screenshot_cls = "superset.dashboards.api.DashboardScreenshot"
    mocker.patch(
        f"{screenshot_cls}.get_api_request_cache_key", return_value="request-key"
    )
    mocker.patch(
        f"{screenshot_cls}.get_current_api_generation_cache_key", return_value=None
    )
    mocker.patch(
        f"{screenshot_cls}.get_next_api_generation_cache_key", return_value="next-key"
    )
    mocker.patch(f"{screenshot_cls}.store_cache_payload")
    mocker.patch(
        f"{screenshot_cls}.set_current_api_generation_cache_key", return_value=True
    )

    return mocker.patch("superset.dashboards.api.cache_dashboard_screenshot")


@pytest.mark.parametrize("username", USERNAMES, ids=USERNAME_IDS)
def test_screenshot_task_receives_guest_token_for_any_username(
    client: Any, screenshot_task: MagicMock, username: str
) -> None:
    raw_token = security_manager.create_guest_access_token(
        user={"username": username},
        resources=[{"type": GuestTokenResourceType.DASHBOARD, "id": str(uuid4())}],
        rls=RLS_RULES,
        datasets=DATASETS,
    )

    response = client.post(
        f"/api/v1/dashboard/{DASHBOARD_ID}/cache_dashboard_screenshot/",
        json={"dataMask": {}, "activeTabs": [], "anchor": "", "urlParams": []},
        headers={client.application.config["GUEST_TOKEN_HEADER_NAME"]: raw_token},
    )

    assert response.status_code == 202, response.json
    screenshot_task.delay.assert_called_once()
    forwarded = screenshot_task.delay.call_args.kwargs["guest_token"]
    assert forwarded is not None
    assert forwarded["user"]["username"] == username
    assert forwarded["rls_rules"] == RLS_RULES
    assert forwarded["datasets"] == DATASETS


@pytest.mark.parametrize("with_guest_token", [True, False], ids=["guest", "no-guest"])
def test_screenshot_task_renders_as_guest_only_when_token_is_forwarded(
    mocker: MockerFixture, with_guest_token: bool
) -> None:
    """
    The task renders as the guest rebuilt from the forwarded token; without one
    it falls back to the executor configured in ``THUMBNAIL_EXECUTORS``.
    """
    from flask import current_app

    from superset.tasks.thumbnails import cache_dashboard_screenshot
    from superset.tasks.types import FixedExecutor

    guest_user, executor_user = MagicMock(name="guest"), MagicMock(name="executor")
    mocker.patch("superset.tasks.thumbnails.thumbnail_cache", MagicMock())
    mocker.patch("superset.tasks.thumbnails.override_user")
    screenshot_cls = mocker.patch("superset.tasks.thumbnails.DashboardScreenshot")
    mocker.patch("superset.models.dashboard.Dashboard.get")
    mocker.patch.dict(
        current_app.config, {"THUMBNAIL_EXECUTORS": [FixedExecutor("executor")]}
    )
    mocker.patch.object(security_manager, "find_user", return_value=executor_user)
    mocker.patch.object(
        security_manager, "get_guest_user_from_token", return_value=guest_user
    )

    cache_dashboard_screenshot(
        username="",
        dashboard_id=DASHBOARD_ID,
        dashboard_url="/dashboard/p/key/",
        force=False,
        cache_key="cache-key",
        guest_token=(
            cast(
                GuestToken,
                {"user": {"username": ""}, "resources": [], "rls_rules": RLS_RULES},
            )
            if with_guest_token
            else None
        ),
    )

    rendered_as = screenshot_cls.return_value.compute_and_cache.call_args.kwargs["user"]
    assert rendered_as is (guest_user if with_guest_token else executor_user)
