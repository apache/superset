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
"""Direct-call coverage for dashboard chart label authorization."""

from unittest.mock import MagicMock, patch, PropertyMock

import pytest
from flask import current_app

from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.security.manager import SupersetSecurityManager
from superset.subjects.models import Subject


@pytest.mark.parametrize("is_guest", [False, True])
@pytest.mark.parametrize(
    "is_member,datasource_type",
    [(False, "table"), (True, "semantic_view"), (True, "table")],
)
def test_chart_labels_require_sql_member_chart(
    is_guest: bool, is_member: bool, datasource_type: str
) -> None:
    """The public hook enforces its scope even without the dataset serializer."""
    chart = Slice(id=11, datasource_id=7, datasource_type=datasource_type)
    dashboard = Dashboard(id=17, slices=[chart] if is_member else [])
    manager = MagicMock(spec=SupersetSecurityManager)
    manager.is_guest_user.return_value = is_guest
    manager.can_access_chart.return_value = True
    manager._guest_token_allows_dataset.return_value = True

    expected = is_member and datasource_type == "table"
    assert (
        SupersetSecurityManager.can_access_dashboard_chart_labels(
            manager, dashboard, chart, guest_dashboard_access=True
        )
        is expected
    )
    if expected:
        manager.can_access_chart.assert_called_once_with(chart)
    else:
        manager.can_access_chart.assert_not_called()
        manager._guest_token_allows_dataset.assert_not_called()


@pytest.mark.parametrize("overridden_method", ["can_access_chart", "raise_for_access"])
@pytest.mark.parametrize("is_guest", [False, True])
def test_chart_labels_honor_base_class_access_wrappers(
    overridden_method: str, is_guest: bool
) -> None:
    """Replacing a stock method in place must not bypass operator restrictions."""
    chart = Slice(id=11, datasource_id=7, datasource_type="table")
    dashboard = Dashboard(id=17, slices=[chart])
    manager = object.__new__(SupersetSecurityManager)
    custom_check = MagicMock()

    def can_access_chart(self: SupersetSecurityManager, chart: Slice) -> bool:
        """Deny the chart through an operator-installed wrapper."""
        custom_check(chart)
        return False

    def raise_for_access(self: SupersetSecurityManager, *, chart: Slice) -> None:
        """Deny the chart through an operator-installed wrapper."""
        custom_check(chart)
        raise SupersetSecurityException(
            self.get_dashboard_access_error_object(dashboard)
        )

    replacement = (
        can_access_chart
        if overridden_method == "can_access_chart"
        else raise_for_access
    )
    with (
        patch.object(manager, "is_guest_user", return_value=is_guest),
        patch.object(manager, "is_editor", return_value=True),
        patch.object(manager, "_guest_token_allows_dataset", return_value=True),
        patch.object(SupersetSecurityManager, overridden_method, replacement),
    ):
        assert not manager.can_access_dashboard_chart_labels(
            dashboard, chart, guest_dashboard_access=True, datasource_access=False
        )
    custom_check.assert_called_once_with(chart)


@pytest.mark.parametrize(
    "is_admin,is_editor,has_viewers,is_viewer,expected",
    [
        pytest.param(True, False, False, False, True, id="admin"),
        pytest.param(False, True, False, False, True, id="editor"),
        pytest.param(False, False, True, True, True, id="viewer"),
        pytest.param(False, False, True, False, False, id="other-viewer"),
        pytest.param(False, False, False, False, False, id="no-grant"),
        pytest.param(False, False, False, True, False, id="no-viewer-list"),
    ],
)
def test_chart_labels_reuse_denied_datasource_access(
    app_context: None,
    is_admin: bool,
    is_editor: bool,
    has_viewers: bool,
    is_viewer: bool,
    expected: bool,
) -> None:
    """Stock chart grants need no repeated datasource permission queries."""
    chart = Slice(
        id=11,
        datasource_id=7,
        datasource_type="table",
        viewers=[Subject(id=23)] if has_viewers else [],
    )
    dashboard = Dashboard(id=17, slices=[chart])
    manager = object.__new__(SupersetSecurityManager)
    with (
        patch.dict(current_app.config, {"EXTRA_RAISE_FOR_ACCESS_BYPASS": None}),
        patch.object(manager, "is_guest_user", return_value=False),
        patch.object(manager, "is_admin", return_value=is_admin),
        patch.object(manager, "is_editor", return_value=is_editor),
        patch.object(manager, "is_viewer", return_value=is_viewer),
        patch.object(
            Slice, "resolved_datasource", new_callable=PropertyMock
        ) as resolved,
        patch.object(manager, "can_access_datasource") as datasource_check,
    ):
        assert (
            manager.can_access_dashboard_chart_labels(
                dashboard, chart, datasource_access=False
            )
            is expected
        )
        resolved.assert_not_called()
        datasource_check.assert_not_called()


@pytest.mark.parametrize("datasource_access", [None, True])
def test_chart_labels_keep_full_check_without_denied_datasource_hint(
    app_context: None, datasource_access: bool | None
) -> None:
    """Only an explicitly denied dataset decision enables the shortcut."""
    table = SqlaTable(id=7)
    chart = Slice(id=11, datasource_id=7, datasource_type="table")
    dashboard = Dashboard(id=17, slices=[chart])
    manager = object.__new__(SupersetSecurityManager)
    with (
        patch.dict(current_app.config, {"EXTRA_RAISE_FOR_ACCESS_BYPASS": None}),
        patch.object(manager, "is_guest_user", return_value=False),
        patch.object(manager, "is_admin", return_value=False),
        patch.object(manager, "is_editor", return_value=False),
        patch.object(
            Slice, "resolved_datasource", new_callable=PropertyMock, return_value=table
        ),
        patch.object(manager, "can_access_datasource", return_value=True) as check,
    ):
        assert manager.can_access_dashboard_chart_labels(
            dashboard, chart, datasource_access=datasource_access
        )
        check.assert_called_once_with(table)


@pytest.mark.parametrize("bypass_grants_access", [False, True])
def test_chart_labels_preserve_configured_access_bypass(
    app_context: None, bypass_grants_access: bool
) -> None:
    """An operator bypass may grant a chart despite denied datasource access."""
    table = SqlaTable(id=7)
    chart = Slice(id=11, datasource_id=7, datasource_type="table")
    dashboard = Dashboard(id=17, slices=[chart])
    manager = object.__new__(SupersetSecurityManager)
    bypass = MagicMock(return_value=bypass_grants_access)
    with (
        patch.dict(current_app.config, {"EXTRA_RAISE_FOR_ACCESS_BYPASS": bypass}),
        patch.object(manager, "is_guest_user", return_value=False),
        patch.object(manager, "is_admin", return_value=False),
        patch.object(manager, "is_editor", return_value=False),
        patch.object(
            Slice, "resolved_datasource", new_callable=PropertyMock, return_value=table
        ),
        patch.object(manager, "can_access_datasource", return_value=False) as check,
    ):
        assert (
            manager.can_access_dashboard_chart_labels(
                dashboard, chart, datasource_access=False
            )
            is bypass_grants_access
        )
        bypass.assert_called_once()
        assert bypass.call_args.kwargs["chart"] is chart
        if bypass_grants_access:
            check.assert_not_called()
        else:
            check.assert_called_once_with(table)
