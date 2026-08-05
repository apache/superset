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
"""Tests that asset-creation paths attach the creator's default viewers.

``get_default_viewers_for_new_asset`` is covered on its own elsewhere; these
tests pin the wiring at the call sites that build an asset outside the create
commands, so removing one fails the suite. Covered here: both v1 importers,
the template copy, ``/dashboard/new/``, the dashboard-copy DAO (including its
cloned charts), the legacy explore save paths, and ``reset_ownership`` (used
by the v0 importers). The MCP ``generate_dashboard`` tool is covered by
``tests/unit_tests/mcp_service/dashboard/tool/test_dashboard_generation.py``.
"""

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from superset.subjects.models import Subject
from superset.subjects.types import SubjectType


def _group_subject(id_: int = 11) -> Subject:
    subject = Subject()
    subject.id = id_
    subject.type = SubjectType.GROUP
    return subject


def _user(user_id: int = 5) -> SimpleNamespace:
    return SimpleNamespace(id=user_id)


def test_chart_importer_attaches_default_viewers(app_context) -> None:
    from superset.commands.chart.importers.v1 import utils as chart_utils

    viewer = _group_subject()
    chart = SimpleNamespace(id=1, editors=[], viewers=[])

    with (
        patch.object(chart_utils, "find_existing_for_import", return_value=None),
        patch.object(chart_utils, "get_user", return_value=_user()),
        patch.object(chart_utils, "filter_chart_annotations"),
        patch.object(chart_utils, "migrate_chart", side_effect=lambda config: config),
        patch.object(chart_utils.Slice, "import_from_dict", return_value=chart),
        patch("superset.subjects.utils.get_user_subject", return_value=None),
        patch(
            "superset.subjects.utils.get_default_viewers_for_new_asset",
            return_value=[viewer],
        ),
    ):
        result = chart_utils.import_chart(
            {"uuid": "x", "params": {}}, ignore_permissions=True
        )

    assert result.viewers == [viewer]


def test_chart_importer_adds_missing_viewers_without_duplicating_present_ones(
    app_context,
) -> None:
    from superset.commands.chart.importers.v1 import utils as chart_utils

    already_there = _group_subject(11)
    newly_added = _group_subject(12)
    chart = SimpleNamespace(id=1, editors=[], viewers=[already_there])

    with (
        patch.object(chart_utils, "find_existing_for_import", return_value=None),
        patch.object(chart_utils, "get_user", return_value=_user()),
        patch.object(chart_utils, "filter_chart_annotations"),
        patch.object(chart_utils, "migrate_chart", side_effect=lambda config: config),
        patch.object(chart_utils.Slice, "import_from_dict", return_value=chart),
        patch("superset.subjects.utils.get_user_subject", return_value=None),
        patch(
            "superset.subjects.utils.get_default_viewers_for_new_asset",
            return_value=[already_there, newly_added],
        ),
    ):
        result = chart_utils.import_chart(
            {"uuid": "x", "params": {}}, ignore_permissions=True
        )

    assert result.viewers == [already_there, newly_added]


def test_chart_importer_skips_default_viewers_on_reimport(app_context) -> None:
    """Re-importing over an existing chart must not grant the importer's groups.

    Unlike a fresh import, an overwrite / soft-delete restore falls through to
    an in-place update; applying "new asset" defaults there would silently
    widen an existing chart's read access.
    """
    from superset.commands.chart.importers.v1 import utils as chart_utils

    chart = SimpleNamespace(id=1, editors=[], viewers=[])

    with (
        # A matching row that falls through to an in-place update (return None).
        patch.object(chart_utils, "find_existing_for_import", return_value=MagicMock()),
        patch.object(
            chart_utils, "_prepare_existing_chart_for_import", return_value=None
        ),
        patch.object(chart_utils, "get_user", return_value=_user()),
        patch.object(chart_utils, "filter_chart_annotations"),
        patch.object(chart_utils, "migrate_chart", side_effect=lambda config: config),
        patch.object(chart_utils.Slice, "import_from_dict", return_value=chart),
        patch("superset.subjects.utils.get_user_subject", return_value=None),
        patch(
            "superset.subjects.utils.get_default_viewers_for_new_asset",
            return_value=[_group_subject()],
        ) as mock_viewers,
    ):
        result = chart_utils.import_chart(
            {"uuid": "x", "params": {}}, overwrite=True, ignore_permissions=True
        )

    assert result.viewers == []
    mock_viewers.assert_not_called()


def test_chart_importer_uses_passed_default_viewers_without_recomputing(
    app_context,
) -> None:
    """Bulk importers resolve the creator's viewers once and pass them down;
    a per-asset call must reuse that list rather than re-query membership."""
    from superset.commands.chart.importers.v1 import utils as chart_utils

    passed = _group_subject(7)
    chart = SimpleNamespace(id=1, editors=[], viewers=[])

    with (
        patch.object(chart_utils, "find_existing_for_import", return_value=None),
        patch.object(chart_utils, "get_user", return_value=_user()),
        patch.object(chart_utils, "filter_chart_annotations"),
        patch.object(chart_utils, "migrate_chart", side_effect=lambda config: config),
        patch.object(chart_utils.Slice, "import_from_dict", return_value=chart),
        patch("superset.subjects.utils.get_user_subject", return_value=None),
        patch(
            "superset.subjects.utils.get_default_viewers_for_new_asset",
        ) as mock_compute,
    ):
        result = chart_utils.import_chart(
            {"uuid": "x", "params": {}},
            ignore_permissions=True,
            default_viewers=[passed],
        )

    assert result.viewers == [passed]
    mock_compute.assert_not_called()


def test_copy_dashboard_attaches_viewers_from_the_users_in_memory_groups(
    app_context,
) -> None:
    """The template copy runs in ``after_insert``, before ``ab_user_group`` exists."""
    from superset.models import dashboard as dashboard_module

    viewer = _group_subject()
    group = MagicMock()
    new_user = MagicMock()
    new_user.id = 5
    new_user.groups = [group]
    session = MagicMock()
    # Both lookups (the user, then the template dashboard) go through the same
    # mocked chain; a MagicMock stands in for either.
    session.query.return_value.filter_by.return_value.first.return_value = new_user

    created: dict[str, Any] = {}

    def _capture(**kwargs):
        created.update(kwargs)
        return MagicMock()

    with (
        patch.dict(dashboard_module.app.config, {"DASHBOARD_TEMPLATE_ID": 1}),
        patch.object(
            dashboard_module.sqla, "inspect", return_value=MagicMock(session=session)
        ),
        patch.object(dashboard_module, "Dashboard", side_effect=_capture),
        patch("superset.subjects.utils.get_user_subject", return_value=None),
        patch(
            "superset.subjects.utils.get_default_viewers_for_groups",
            return_value=[viewer],
        ) as mock_for_groups,
    ):
        dashboard_module.copy_dashboard(
            MagicMock(),
            MagicMock(),
            SimpleNamespace(id=5),  # type: ignore[arg-type]
        )

    assert created["viewers"] == [viewer]
    # Resolved from the in-memory collection, never by querying membership.
    mock_for_groups.assert_called_once_with([group])


def test_dashboard_importer_attaches_default_viewers(app_context) -> None:
    from superset.commands.dashboard.importers.v1 import utils as dashboard_utils

    viewer = _group_subject()
    dashboard = SimpleNamespace(id=1, editors=[], viewers=[])

    with (
        patch.object(dashboard_utils, "find_existing_for_import", return_value=None),
        patch.object(dashboard_utils, "get_user", return_value=_user()),
        patch.object(
            dashboard_utils.Dashboard, "import_from_dict", return_value=dashboard
        ),
        patch("superset.subjects.utils.get_user_subject", return_value=None),
        patch(
            "superset.subjects.utils.get_default_viewers_for_new_asset",
            return_value=[viewer],
        ),
    ):
        result = dashboard_utils.import_dashboard(
            {"uuid": "x", "metadata": {}}, ignore_permissions=True
        )

    assert result.viewers == [viewer]


def test_new_dashboard_view_attaches_default_viewers(app_context) -> None:
    from superset.views.dashboard import views as dashboard_views

    viewer = _group_subject()
    created: dict[str, Any] = {}

    def _capture(**kwargs):
        created.update(kwargs)
        return MagicMock(id=1)

    # Strip ``@has_access``/``@expose`` so the handler body runs directly.
    handler = dashboard_views.Dashboard.new
    while hasattr(handler, "__wrapped__"):
        handler = handler.__wrapped__

    with (
        patch.object(dashboard_views, "DashboardModel", side_effect=_capture),
        patch.object(dashboard_views, "db"),
        patch.object(dashboard_views, "redirect"),
        patch.object(dashboard_views, "url_for"),
        patch.object(dashboard_views, "g", MagicMock(user=_user())),
        patch("superset.subjects.utils.get_user_subject", return_value=None),
        patch(
            "superset.subjects.utils.get_default_viewers_for_new_asset",
            return_value=[viewer],
        ),
    ):
        handler(MagicMock())

    assert created["viewers"] == [viewer]


def test_dashboard_copy_dao_attaches_default_viewers(app_context) -> None:
    from superset.daos import dashboard as dashboard_dao

    viewer = _group_subject()
    original = MagicMock()
    original.slices = []
    created: list[Any] = []

    with (
        patch.object(dashboard_dao.security_manager, "is_editor", return_value=True),
        patch.object(dashboard_dao, "g", MagicMock(user=_user())),
        patch.object(dashboard_dao, "db"),
        patch.object(dashboard_dao.DashboardDAO, "set_dash_metadata"),
        patch.object(
            dashboard_dao,
            "Dashboard",
            side_effect=lambda: created.append(MagicMock())  # type: ignore[func-returns-value]
            or created[-1],
        ),
        patch("superset.subjects.utils.get_user_subject", return_value=None),
        patch(
            "superset.subjects.utils.get_default_viewers_for_new_asset",
            return_value=[viewer],
        ),
    ):
        dashboard_dao.DashboardDAO.copy_dashboard(
            original, {"dashboard_title": "copy", "json_metadata": "{}"}
        )

    assert created[-1].viewers == [viewer]


def test_dashboard_copy_dao_attaches_default_viewers_to_cloned_charts(
    app_context,
) -> None:
    from superset.daos import dashboard as dashboard_dao

    viewer = _group_subject()
    clone = MagicMock()
    source_slice = MagicMock()
    source_slice.clone.return_value = clone
    original = MagicMock()
    original.slices = [source_slice]

    with (
        patch.object(dashboard_dao.security_manager, "is_editor", return_value=True),
        patch.object(dashboard_dao, "g", MagicMock(user=_user())),
        patch.object(dashboard_dao, "db"),
        patch.object(dashboard_dao.DashboardDAO, "set_dash_metadata"),
        patch.object(dashboard_dao, "Dashboard", return_value=MagicMock()),
        patch("superset.subjects.utils.get_user_subject", return_value=None),
        patch(
            "superset.subjects.utils.get_default_viewers_for_new_asset",
            return_value=[viewer],
        ),
    ):
        dashboard_dao.DashboardDAO.copy_dashboard(
            original,
            {
                "dashboard_title": "copy",
                "json_metadata": '{"positions": {}}',
                "duplicate_slices": True,
            },
        )

    assert clone.viewers == [viewer]


def test_reset_ownership_attaches_default_viewers(app_context) -> None:
    """Used by the v0 importers, which never went through the v1 wiring."""
    from superset.models.helpers import ImportExportMixin

    viewer = _group_subject()

    class _Asset(ImportExportMixin):
        def __init__(self) -> None:
            self.editors: list[Any] = []
            self.viewers: list[Any] = []

    asset = _Asset()

    with (
        patch("superset.models.helpers.g", MagicMock(user=_user())),
        patch("superset.subjects.utils.get_user_subject", return_value=None),
        patch(
            "superset.subjects.utils.get_default_viewers_for_new_asset",
            return_value=[viewer],
        ),
    ):
        asset.reset_ownership()

    assert asset.viewers == [viewer]


def test_reset_ownership_preserves_explicitly_set_viewers(app_context) -> None:
    """A viewer list already on the instance is not replaced by group defaults."""
    from superset.models.helpers import ImportExportMixin

    explicit = _group_subject(99)

    class _Asset(ImportExportMixin):
        def __init__(self) -> None:
            self.editors: list[Any] = []
            self.viewers: list[Any] = [explicit]

    asset = _Asset()

    with (
        patch("superset.models.helpers.g", MagicMock(user=_user())),
        patch("superset.subjects.utils.get_user_subject", return_value=None),
        patch(
            "superset.subjects.utils.get_default_viewers_for_new_asset",
            return_value=[_group_subject(11)],
        ) as mock_viewers,
    ):
        asset.reset_ownership()

    assert asset.viewers == [explicit]
    mock_viewers.assert_not_called()


class _ConstructedError(Exception):
    """Raised once the asset under test has been constructed."""


def _capturing(store: dict[str, Any]):
    """Record constructor kwargs, then abort the surrounding request handler.

    ``save_or_overwrite_slice`` does a lot of work after building the asset;
    stopping at construction keeps these tests focused on the wiring.
    """

    def _factory(**kwargs):
        store.update(kwargs)
        raise _ConstructedError

    return _factory


def test_legacy_explore_saveas_attaches_default_viewers(app_context) -> None:
    """The ``@deprecated`` explore save route is still mounted and reachable."""
    from superset.views import core as core_views

    viewer = _group_subject()
    created: dict[str, Any] = {}
    request = MagicMock()
    request.args.get.side_effect = lambda key, *a: {
        "slice_name": "n",
        "action": "saveas",
    }.get(key)

    with (
        patch.object(core_views, "request", request),
        patch.object(
            core_views, "get_form_data", return_value=({"viz_type": "table"}, None)
        ),
        patch.object(core_views, "Slice", side_effect=_capturing(created)),
        patch.object(core_views, "g", MagicMock(user=_user())),
        patch("superset.subjects.utils.get_user_subject", return_value=None),
        patch(
            "superset.subjects.utils.get_default_viewers_for_new_asset",
            return_value=[viewer],
        ),
        pytest.raises(_ConstructedError),
    ):
        core_views.Superset.save_or_overwrite_slice(
            None, True, False, False, 1, "table", "t"
        )

    assert created["viewers"] == [viewer]


def test_legacy_explore_new_dashboard_attaches_default_viewers(app_context) -> None:
    """Saving a chart to a brand new dashboard from legacy explore."""
    from superset.views import core as core_views

    viewer = _group_subject()
    created: dict[str, Any] = {}
    request = MagicMock()
    request.args.get.side_effect = lambda key, *a: {
        "slice_name": "n",
        "new_dashboard_name": "d",
    }.get(key)

    with (
        patch.object(core_views, "request", request),
        patch.object(
            core_views, "get_form_data", return_value=({"viz_type": "table"}, None)
        ),
        patch.object(core_views, "Dashboard", side_effect=_capturing(created)),
        patch.object(core_views, "g", MagicMock(user=_user())),
        patch.object(core_views.security_manager, "can_access", return_value=True),
        patch.object(core_views.utils, "remove_extra_adhoc_filters"),
        patch("superset.subjects.utils.get_user_subject", return_value=None),
        patch(
            "superset.subjects.utils.get_default_viewers_for_new_asset",
            return_value=[viewer],
        ),
        pytest.raises(_ConstructedError),
    ):
        core_views.Superset.save_or_overwrite_slice(
            MagicMock(), False, False, False, 1, "table", "t"
        )

    assert created["viewers"] == [viewer]


def test_dashboard_copy_dao_resolves_creator_subjects_once(app_context) -> None:
    """Both lookups are loop-invariant: N cloned charts must not mean N queries."""
    from superset.daos import dashboard as dashboard_dao

    original = MagicMock()
    original.slices = [MagicMock(), MagicMock(), MagicMock()]

    with (
        patch.object(dashboard_dao.security_manager, "is_editor", return_value=True),
        patch.object(dashboard_dao, "g", MagicMock(user=_user())),
        patch.object(dashboard_dao, "db"),
        patch.object(dashboard_dao.DashboardDAO, "set_dash_metadata"),
        patch.object(dashboard_dao, "Dashboard", return_value=MagicMock()),
        patch(
            "superset.subjects.utils.get_user_subject", return_value=None
        ) as mock_user_subject,
        patch(
            "superset.subjects.utils.get_default_viewers_for_new_asset",
            return_value=[_group_subject()],
        ) as mock_viewers,
    ):
        dashboard_dao.DashboardDAO.copy_dashboard(
            original,
            {
                "dashboard_title": "copy",
                "json_metadata": '{"positions": {}}',
                "duplicate_slices": True,
            },
        )

    assert mock_user_subject.call_count == 1
    assert mock_viewers.call_count == 1
