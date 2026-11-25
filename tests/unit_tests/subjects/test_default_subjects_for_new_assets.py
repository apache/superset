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
"""Tests for the configurable default viewers/editors of new assets.

Covers ``DEFAULT_VIEWERS_FOR_NEW_ASSET`` / ``DEFAULT_EDITORS_FOR_NEW_ASSET``,
the creator-always-an-editor guarantee, the explicit-payload merge rule for
editors, fail-closed error handling and the wiring at the dashboard-copy and
importer call sites.
"""

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

from flask import current_app

from superset.commands.utils import populate_subjects
from superset.models.dashboard import Dashboard
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.subjects.utils import (
    creator_groups_as_viewers,
    get_default_editors_for_new_asset,
    get_default_viewers_for_groups,
    get_default_viewers_for_new_asset,
)
from superset.utils import json
from tests.unit_tests.subjects.test_creator_group_call_sites import (  # noqa: F401
    dashboard_copy_source,
)

USER = SimpleNamespace(id=5, groups=[])


def _subject(id_: int, type_: SubjectType = SubjectType.USER) -> Subject:
    subject = Subject()
    subject.id = id_
    subject.type = type_
    subject.label = f"subject-{id_}"
    return subject


CREATOR = _subject(1)
ROLE = _subject(2, SubjectType.ROLE)
GROUP = _subject(3, SubjectType.GROUP)


def _config(**overrides: Any):
    return patch.dict(current_app.config, overrides)


def _patches():
    return (
        patch(
            "superset.subjects.utils.get_or_create_user_subject", return_value=CREATOR
        ),
        patch("superset.subjects.utils.get_user_subject", return_value=CREATOR),
        patch("superset.subjects.utils._resolve_user", return_value=USER),
    )


def _editors(asset_type: str = "chart", **config: Any) -> list[Subject]:
    p1, p2, p3 = _patches()
    with p1, p2, p3, _config(**config):
        return get_default_editors_for_new_asset(5, asset_type)


def test_default_editors_are_just_the_creator(app_context) -> None:
    assert _editors() == [CREATOR]


def test_default_editors_without_a_user_are_empty(app_context) -> None:
    assert get_default_editors_for_new_asset(None, "chart") == []


def test_custom_editors_callable_adds_a_role_and_receives_user_and_type(
    app_context,
) -> None:
    resolver = MagicMock(return_value=[ROLE])

    assert _editors("dataset", DEFAULT_EDITORS_FOR_NEW_ASSET=resolver) == [
        CREATOR,
        ROLE,
    ]
    resolver.assert_called_once_with(USER, "dataset")


def test_creator_is_kept_when_the_callable_omits_or_repeats_them(app_context) -> None:
    assert _editors(DEFAULT_EDITORS_FOR_NEW_ASSET=lambda u, t: [ROLE]) == [
        CREATOR,
        ROLE,
    ]
    assert _editors(
        DEFAULT_EDITORS_FOR_NEW_ASSET=lambda u, t: [ROLE, CREATOR, ROLE]
    ) == [
        CREATOR,
        ROLE,
    ]


def test_raising_editors_callable_fails_closed_to_the_creator(app_context) -> None:
    def boom(user: Any, asset_type: str) -> list[Subject]:
        raise RuntimeError("nope")

    assert _editors(DEFAULT_EDITORS_FOR_NEW_ASSET=boom) == [CREATOR]


def _viewers(viewer_flags: dict[str, bool], **config: Any) -> list[Subject]:
    with (
        patch(
            "superset.is_feature_enabled",
            side_effect=lambda f: viewer_flags.get(f, False),
        ),
        patch("superset.subjects.utils._resolve_user", return_value=USER),
        patch("superset.subjects.utils.get_user_group_subjects", return_value=[GROUP]),
        _config(**config),
    ):
        return get_default_viewers_for_new_asset(5, "chart")


def test_viewers_default_unchanged_when_no_callable(app_context) -> None:
    assert _viewers({"ENABLE_VIEWERS": True}) == []
    assert _viewers(
        {"ENABLE_VIEWERS": True, "ASSIGN_CREATOR_GROUPS_AS_VIEWERS": True}
    ) == [GROUP]
    assert _viewers({"ASSIGN_CREATOR_GROUPS_AS_VIEWERS": True}) == []


def test_custom_viewers_callable_wins_over_the_flag(app_context) -> None:
    resolver = MagicMock(return_value=[ROLE])
    flags = {"ENABLE_VIEWERS": True, "ASSIGN_CREATOR_GROUPS_AS_VIEWERS": True}

    assert _viewers(flags, DEFAULT_VIEWERS_FOR_NEW_ASSET=resolver) == [ROLE]
    resolver.assert_called_once_with(USER, "chart")


def test_custom_viewers_callable_is_ignored_while_viewers_disabled(app_context) -> None:
    assert _viewers({}, DEFAULT_VIEWERS_FOR_NEW_ASSET=lambda u, t: [ROLE]) == []


def test_raising_viewers_callable_yields_no_viewers(app_context) -> None:
    def boom(user: Any, asset_type: str) -> list[Subject]:
        raise RuntimeError("nope")

    assert _viewers({"ENABLE_VIEWERS": True}, DEFAULT_VIEWERS_FOR_NEW_ASSET=boom) == []


def test_creator_groups_as_viewers_returns_the_creators_groups(app_context) -> None:
    with patch("superset.subjects.utils.get_user_group_subjects", return_value=[GROUP]):
        assert creator_groups_as_viewers(USER, "dashboard") == [GROUP]  # type: ignore[arg-type]


def test_in_flush_viewers_use_the_custom_callable_with_the_in_memory_user(
    app_context,
) -> None:
    resolver = MagicMock(return_value=[ROLE])
    with (
        patch("superset.is_feature_enabled", return_value=True),
        _config(DEFAULT_VIEWERS_FOR_NEW_ASSET=resolver),
    ):
        assert get_default_viewers_for_groups([], user=USER) == [ROLE]  # type: ignore[arg-type]
    resolver.assert_called_once_with(USER, "dashboard")


@patch("superset.commands.utils.get_user_id", return_value=5)
def test_populate_subjects_uses_defaults_when_no_editors_requested(
    mock_user_id: MagicMock, app_context
) -> None:
    properties: dict[str, Any] = {}
    p1, p2, p3 = _patches()
    with p1, p2, p3, _config(DEFAULT_EDITORS_FOR_NEW_ASSET=lambda u, t: [ROLE]):
        populate_subjects(properties, [], include_viewers=False, asset_type="chart")

    assert properties["editors"] == [CREATOR, ROLE]


@patch("superset.commands.utils.get_user_id", return_value=5)
@patch("superset.commands.utils.populate_subject_list")
def test_populate_subjects_adds_defaults_to_explicit_editors(
    mock_populate: MagicMock, mock_user_id: MagicMock, app_context
) -> None:
    other = _subject(9)
    mock_populate.return_value = [other]
    properties: dict[str, Any] = {"editors": [9]}
    p1, p2, p3 = _patches()
    with (
        p1,
        p2,
        p3,
        patch("superset.commands.utils.get_user_subject", return_value=CREATOR),
        _config(DEFAULT_EDITORS_FOR_NEW_ASSET=lambda u, t: [ROLE]),
    ):
        populate_subjects(properties, [], include_viewers=False, asset_type="chart")

    # The mandated role is added; the creator is not forced in on top of an
    # explicit list (the existing lockout rule governs that).
    assert properties["editors"] == [other, ROLE]


@patch("superset.commands.utils.get_user_id", return_value=5)
@patch("superset.commands.utils.populate_subject_list")
def test_populate_subjects_without_asset_type_skips_the_editors_hook(
    mock_populate: MagicMock, mock_user_id: MagicMock, app_context
) -> None:
    mock_populate.return_value = [CREATOR]
    properties: dict[str, Any] = {}
    resolver = MagicMock(return_value=[ROLE])
    with _config(DEFAULT_EDITORS_FOR_NEW_ASSET=resolver):
        populate_subjects(properties, [], include_viewers=False)

    assert properties["editors"] == [CREATOR]
    resolver.assert_not_called()


def test_chart_importer_adds_default_editors(app_context) -> None:
    from superset.commands.chart.importers.v1 import utils as chart_utils

    chart = SimpleNamespace(id=1, editors=[], viewers=[])
    with (
        patch.object(chart_utils, "find_existing_for_import", return_value=None),
        patch.object(chart_utils, "get_user", return_value=USER),
        patch.object(chart_utils, "filter_chart_annotations"),
        patch.object(chart_utils, "migrate_chart", side_effect=lambda config: config),
        patch.object(chart_utils.Slice, "import_from_dict", return_value=chart),
        patch(
            "superset.subjects.utils.get_default_editors_for_new_asset",
            return_value=[CREATOR, ROLE],
        ) as mock_editors,
    ):
        result = chart_utils.import_chart(
            {"uuid": "x", "params": {}},
            ignore_permissions=True,
            default_viewers=[],
        )

    assert result.editors == [CREATOR, ROLE]
    mock_editors.assert_called_once_with(5, "chart")


def test_dashboard_importer_adds_default_editors(app_context) -> None:
    from superset.commands.dashboard.importers.v1 import utils as dashboard_utils

    dashboard = SimpleNamespace(id=1, editors=[], viewers=[])
    with (
        patch.object(dashboard_utils, "find_existing_for_import", return_value=None),
        patch.object(dashboard_utils, "get_user", return_value=USER),
        patch.object(
            dashboard_utils.Dashboard, "import_from_dict", return_value=dashboard
        ),
        patch(
            "superset.subjects.utils.get_default_editors_for_new_asset",
            return_value=[CREATOR, ROLE],
        ) as mock_editors,
    ):
        result = dashboard_utils.import_dashboard(
            {"uuid": "x", "metadata": {}},
            ignore_permissions=True,
            default_viewers=[],
        )

    assert result.editors == [CREATOR, ROLE]
    mock_editors.assert_called_once_with(5, "dashboard")


def test_dashboard_copy_dao_uses_default_editors_for_dashboard_and_charts(
    dashboard_copy_source: Dashboard,  # noqa: F811
) -> None:
    from superset.daos import dashboard as dashboard_dao

    with (
        patch.object(dashboard_dao.security_manager, "is_editor", return_value=True),
        patch.object(
            dashboard_dao.security_manager, "can_access_chart", return_value=True
        ),
        patch.object(dashboard_dao.security_manager, "is_admin", return_value=False),
        patch.object(dashboard_dao, "g", MagicMock(user=USER)),
        patch(
            "superset.subjects.utils.get_default_editors_for_new_asset",
            return_value=[CREATOR, ROLE],
        ) as mock_editors,
        patch(
            "superset.subjects.utils.get_default_viewers_for_new_asset",
            return_value=[],
        ),
    ):
        copied = dashboard_dao.DashboardDAO.copy_dashboard(
            dashboard_copy_source,
            {
                "dashboard_title": "copy",
                "json_metadata": json.dumps(
                    {"positions": dashboard_copy_source.position}
                ),
                "duplicate_slices": True,
            },
        )

    assert copied.editors == [CREATOR, ROLE]
    assert all(slc.editors == [CREATOR, ROLE] for slc in copied.slices)
    assert [c.args for c in mock_editors.call_args_list] == [
        (5, "dashboard"),
        (5, "chart"),
    ]


def test_reset_ownership_uses_default_editors_for_the_model_type(app_context) -> None:
    from superset.models.slice import Slice

    chart = Slice()
    with (
        patch("superset.models.helpers.g", MagicMock(user=USER)),
        patch(
            "superset.subjects.utils.get_default_editors_for_new_asset",
            return_value=[CREATOR, ROLE],
        ) as mock_editors,
        patch(
            "superset.subjects.utils.get_default_viewers_for_new_asset", return_value=[]
        ),
    ):
        chart.reset_ownership()

    mock_editors.assert_called_once_with(5, "chart")
    assert chart.editors == [CREATOR, ROLE]
