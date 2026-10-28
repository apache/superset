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
"""Archive page and menu fallback must share the same admission rule."""

from unittest.mock import MagicMock, patch

import pytest
from flask import g, Response
from werkzeug.exceptions import HTTPException

from superset.app import SupersetApp
from superset.superset_typing import FlaskResponse


@pytest.mark.parametrize("resource", ["Chart", "Dashboard", "Dataset", None])
@pytest.mark.parametrize("enabled", [True, False])
@pytest.mark.parametrize("anonymous", [True, False])
def test_archive_bootstrap_matches_page(
    app: SupersetApp, resource: str | None, enabled: bool, anonymous: bool
) -> None:
    """Readers see a fallback hint only when the page would admit them."""
    from superset.views import archived_assets, base

    user: MagicMock = MagicMock(is_anonymous=anonymous)
    expected: bool = enabled and not anonymous and resource is not None
    manager: MagicMock
    builder: MagicMock
    base_manager: MagicMock
    status: int
    response: FlaskResponse

    def can_read(permission: str, name: str) -> bool:
        """Model a reader of exactly one archived type without menu grants."""
        return permission == "can_read" and name == resource

    with (
        app.test_request_context("/archived/"),
        patch.object(archived_assets, "is_feature_enabled", return_value=enabled),
        patch.object(
            archived_assets, "security_manager", new_callable=MagicMock
        ) as manager,
        patch.object(base, "appbuilder") as builder,
        patch.object(base, "security_manager", new_callable=MagicMock) as base_manager,
        patch.object(base, "get_environment_tag", return_value={}),
        patch.object(
            archived_assets.BaseSupersetView,
            "render_app_template",
            return_value="shell",
        ),
        patch.object(
            archived_assets, "redirect_to_login", return_value=Response(status=302)
        ),
    ):
        g.user = user
        manager.can_access.side_effect = can_read
        base_manager.is_admin.return_value = False
        builder.languages = {}
        builder.menu.get_data.return_value = []
        builder.app_icon = "superset-logo-horiz"
        assert archived_assets.can_access_recently_archived() is expected
        try:
            response = archived_assets.ArchivedAssetsView().list()
            status = response.status_code if isinstance(response, Response) else 200
        except HTTPException as error:
            status = error.code or 500
        assert status == (
            404 if not enabled else 302 if anonymous else 200 if expected else 403
        )
        assert (
            base.menu_data(user)["navbar_right"]["can_access_recently_archived"]
            is expected
        )
