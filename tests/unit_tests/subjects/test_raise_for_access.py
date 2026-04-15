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

"""Tests for raise_for_access viewer access paths (Phase 4, Step 7)."""

from unittest.mock import MagicMock, patch, PropertyMock

import pytest

from superset.exceptions import SupersetSecurityException


def _make_sm():
    from superset.security.manager import SupersetSecurityManager

    return SupersetSecurityManager.__new__(SupersetSecurityManager)


def _make_dashboard(
    *,
    published: bool = True,
    has_viewers: bool = False,
    has_datasources: bool = True,
):
    dashboard = MagicMock()
    dashboard.published = published
    if has_viewers:
        dashboard.viewers = [MagicMock()]
    else:
        dashboard.viewers = []
    if has_datasources:
        dashboard.datasources = [MagicMock()]
    else:
        dashboard.datasources = []
    dashboard.roles = []
    return dashboard


def test_raise_for_access_editor_allows(app_context):
    """Editor always gets access, regardless of ENABLE_VIEWERS."""
    sm = _make_sm()
    dashboard = _make_dashboard()

    with (
        patch.object(sm, "is_admin", return_value=False),
        patch.object(sm, "is_editor", return_value=True),
        patch.object(sm, "is_guest_user", return_value=False),
        patch("superset.is_feature_enabled", return_value=True),
    ):
        sm.raise_for_access(dashboard=dashboard)


def test_raise_for_access_viewer_published_allows(app_context):
    """Viewer can access a published dashboard with viewers when ENABLE_VIEWERS on."""
    sm = _make_sm()
    dashboard = _make_dashboard(published=True, has_viewers=True)

    with (
        patch.object(sm, "is_admin", return_value=False),
        patch.object(sm, "is_editor", return_value=False),
        patch.object(sm, "is_viewer", return_value=True),
        patch.object(sm, "is_guest_user", return_value=False),
        patch(
            "superset.is_feature_enabled",
            side_effect=lambda flag: flag == "ENABLE_VIEWERS",
        ),
    ):
        sm.raise_for_access(dashboard=dashboard)


def test_raise_for_access_viewer_unpublished_denies(app_context):
    """Viewer cannot access an unpublished dashboard even when ENABLE_VIEWERS on."""
    sm = _make_sm()
    dashboard = _make_dashboard(published=False, has_viewers=True)

    with (
        patch.object(sm, "is_admin", return_value=False),
        patch.object(sm, "is_editor", return_value=False),
        patch.object(sm, "is_viewer", return_value=True),
        patch.object(sm, "is_guest_user", return_value=False),
        patch(
            "superset.is_feature_enabled",
            side_effect=lambda flag: flag == "ENABLE_VIEWERS",
        ),
        patch.object(sm, "get_dashboard_access_error_object", return_value=MagicMock()),
    ):
        with pytest.raises(SupersetSecurityException):
            sm.raise_for_access(dashboard=dashboard)


def test_raise_for_access_no_viewers_dataset_fallback(app_context):
    """When no viewers, falls back to dataset-based access (ENABLE_VIEWERS on)."""
    sm = _make_sm()
    dashboard = _make_dashboard(published=True, has_viewers=False, has_datasources=True)

    with (
        patch.object(sm, "is_admin", return_value=False),
        patch.object(sm, "is_editor", return_value=False),
        patch.object(sm, "is_guest_user", return_value=False),
        patch.object(sm, "can_access_datasource", return_value=True),
        patch(
            "superset.is_feature_enabled",
            side_effect=lambda flag: flag == "ENABLE_VIEWERS",
        ),
    ):
        sm.raise_for_access(dashboard=dashboard)


def test_raise_for_access_no_viewers_no_datasources_allows(app_context):
    """Dashboard with no viewers and no datasources allowed (ENABLE_VIEWERS on)."""
    sm = _make_sm()
    dashboard = _make_dashboard(
        published=True, has_viewers=False, has_datasources=False
    )

    with (
        patch.object(sm, "is_admin", return_value=False),
        patch.object(sm, "is_editor", return_value=False),
        patch.object(sm, "is_guest_user", return_value=False),
        patch(
            "superset.is_feature_enabled",
            side_effect=lambda flag: flag == "ENABLE_VIEWERS",
        ),
    ):
        sm.raise_for_access(dashboard=dashboard)


def test_raise_for_access_legacy_when_viewers_off(app_context):
    """When ENABLE_VIEWERS is off, legacy dataset-based access applies."""
    sm = _make_sm()
    dashboard = _make_dashboard(published=True)

    with (
        patch.object(sm, "is_admin", return_value=False),
        patch.object(sm, "is_editor", return_value=False),
        patch.object(sm, "is_guest_user", return_value=False),
        patch.object(sm, "can_access_datasource", return_value=True),
        patch(
            "superset.is_feature_enabled",
            return_value=False,
        ),
    ):
        sm.raise_for_access(dashboard=dashboard)


# -- Chart access path tests --


def _make_chart(*, has_datasource: bool = True):
    chart = MagicMock()
    if has_datasource:
        chart.datasource = MagicMock()
    else:
        chart.datasource = None
    chart.editors = [MagicMock()]
    chart.viewers = [MagicMock()]
    return chart


def test_raise_for_access_chart_viewer_allows(app_context):
    """Chart viewer gets access when ENABLE_VIEWERS is on."""
    sm = _make_sm()
    chart = _make_chart()

    with (
        patch.object(sm, "is_admin", return_value=False),
        patch.object(sm, "is_editor", return_value=False),
        patch.object(sm, "is_viewer", return_value=True),
        patch(
            "superset.is_feature_enabled",
            side_effect=lambda flag: flag == "ENABLE_VIEWERS",
        ),
    ):
        sm.raise_for_access(chart=chart)


def test_raise_for_access_chart_viewer_denied_when_flag_off(app_context):
    """Chart viewer denied when ENABLE_VIEWERS is off and no datasource access."""
    sm = _make_sm()
    chart = _make_chart()

    with (
        patch.object(sm, "is_admin", return_value=False),
        patch.object(sm, "is_editor", return_value=False),
        patch.object(sm, "can_access_datasource", return_value=False),
        patch.object(sm, "get_chart_access_error_object", return_value=MagicMock()),
        patch("superset.is_feature_enabled", return_value=False),
    ):
        with pytest.raises(SupersetSecurityException):
            sm.raise_for_access(chart=chart)


def test_raise_for_access_chart_editor_allows(app_context):
    """Chart editor always gets access."""
    sm = _make_sm()
    chart = _make_chart()

    with (
        patch.object(sm, "is_admin", return_value=False),
        patch.object(sm, "is_editor", return_value=True),
    ):
        sm.raise_for_access(chart=chart)


# -- Datasource chart-viewer promiscuous mode tests --


def test_raise_for_access_datasource_chart_viewer_promiscuous(app_context):
    """Chart viewer bypasses datasource access when VIEWER_PROMISCUOUS_MODE on."""
    sm = _make_sm()
    datasource = MagicMock()
    datasource.id = 42
    chart = MagicMock()
    chart.datasource_id = 42

    mock_session = MagicMock()
    mock_session.query.return_value.filter.return_value.one_or_none.return_value = chart

    with (
        patch.object(sm, "can_access_schema", return_value=False),
        patch.object(sm, "can_access", return_value=False),
        patch.object(sm, "is_editor", return_value=False),
        patch.object(sm, "is_viewer", return_value=True),
        patch.object(
            type(sm), "session", new_callable=PropertyMock, return_value=mock_session
        ),
        patch("superset.security.manager.current_app") as mock_app,
    ):
        mock_app.config.get = lambda key, default=None: (
            True if key == "VIEWER_PROMISCUOUS_MODE" else default
        )
        sm.raise_for_access(
            datasource=datasource,
            query_context=MagicMock(
                datasource=datasource,
                form_data={"slice_id": 1},
            ),
        )


def test_raise_for_access_datasource_chart_editor_promiscuous(app_context):
    """Chart editor also bypasses datasource access via promiscuous mode."""
    sm = _make_sm()
    datasource = MagicMock()
    datasource.id = 42
    chart = MagicMock()
    chart.datasource_id = 42

    mock_session = MagicMock()
    mock_session.query.return_value.filter.return_value.one_or_none.return_value = chart

    with (
        patch.object(sm, "can_access_schema", return_value=False),
        patch.object(sm, "can_access", return_value=False),
        patch.object(sm, "is_editor", return_value=False),
        patch.object(sm, "is_viewer", return_value=True),
        patch.object(
            type(sm), "session", new_callable=PropertyMock, return_value=mock_session
        ),
        patch("superset.security.manager.current_app") as mock_app,
    ):
        mock_app.config.get = lambda key, default=None: (
            True if key == "VIEWER_PROMISCUOUS_MODE" else default
        )
        sm.raise_for_access(
            datasource=datasource,
            query_context=MagicMock(
                datasource=datasource,
                form_data={"slice_id": 1},
            ),
        )


def test_raise_for_access_datasource_chart_viewer_no_promiscuous_denies(app_context):
    """Chart viewer denied datasource access when VIEWER_PROMISCUOUS_MODE off."""
    sm = _make_sm()
    datasource = MagicMock()

    with (
        patch.object(sm, "can_access_schema", return_value=False),
        patch.object(sm, "can_access", return_value=False),
        patch.object(sm, "is_editor", return_value=False),
        patch.object(
            sm, "get_datasource_access_error_object", return_value=MagicMock()
        ),
        patch("superset.security.manager.current_app") as mock_app,
    ):
        mock_app.config.get = lambda key, default=None: (
            False if key == "VIEWER_PROMISCUOUS_MODE" else default
        )
        with pytest.raises(SupersetSecurityException):
            sm.raise_for_access(
                datasource=datasource,
                query_context=MagicMock(
                    datasource=datasource,
                    form_data={"slice_id": 1},
                ),
            )


# -- GetExploreCommand access check tests --


def test_explore_command_uses_chart_access_when_slice_exists(app_context):
    """GetExploreCommand checks chart access when a chart exists."""
    from superset.commands.explore.get import GetExploreCommand
    from superset.commands.explore.parameters import CommandParameters

    params = CommandParameters(
        permalink_key=None,
        form_data_key=None,
        datasource_id=1,
        datasource_type="table",
        slice_id=1,
    )
    cmd = GetExploreCommand(params)

    mock_slc = MagicMock()
    mock_slc.data = {"slice_id": 1}
    mock_slc.created_on_humanized = "1 day ago"
    mock_slc.changed_on_humanized = "1 day ago"
    mock_slc.owners = []
    mock_slc.dashboards = []
    mock_slc.created_by = None
    mock_slc.changed_by = None

    mock_datasource = MagicMock()
    mock_datasource.name = "test"
    mock_datasource.default_endpoint = None

    mock_request = MagicMock()
    mock_request.args = {}

    with (
        patch(
            "superset.commands.explore.get.get_form_data",
            return_value=({"datasource": "1__table", "viz_type": "table"}, mock_slc),
        ),
        patch(
            "superset.commands.explore.get.get_datasource_info",
            return_value=(1, "table"),
        ),
        patch(
            "superset.commands.explore.get.DatasourceDAO.get_datasource",
            return_value=mock_datasource,
        ),
        patch("superset.commands.explore.get.security_manager") as mock_sm,
        patch("superset.commands.explore.get.sanitize_datasource_data"),
        patch("superset.commands.explore.get.request", mock_request),
    ):
        cmd.run()
        mock_sm.raise_for_access.assert_called_once_with(chart=mock_slc)
