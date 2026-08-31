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
"""Tests for defaulting a new asset's viewers to its creator's groups.

Assigning the creator's groups as *viewers* (rather than editors) shares the
asset read-only, and is gated behind ``ASSIGN_CREATOR_GROUPS_AS_VIEWERS``
because populating ``viewers`` changes how access is enforced: once an asset
has any viewer, the datasource-permission fallback no longer applies to it.
"""

from typing import Any
from unittest.mock import MagicMock, patch

from superset.commands.utils import populate_subjects
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.subjects.utils import (
    _assigns_creator_groups_as_viewers,
    get_default_viewers_for_groups,
    get_default_viewers_for_new_asset,
    get_user_group_subject_ids_subquery,
)


def _group_subject(id_: int) -> Subject:
    subject = Subject()
    subject.id = id_
    subject.type = SubjectType.GROUP
    return subject


def test_gate_resolves_the_assign_creator_groups_feature_flag(app_context) -> None:
    """The gate is a feature flag read via ``is_feature_enabled`` and additionally
    requires ``ENABLE_VIEWERS``."""
    with patch("superset.is_feature_enabled", return_value=True) as mock_flag:
        assert _assigns_creator_groups_as_viewers() is True
    mock_flag.assert_any_call("ENABLE_VIEWERS")
    mock_flag.assert_any_call("ASSIGN_CREATOR_GROUPS_AS_VIEWERS")

    with patch("superset.is_feature_enabled", return_value=False):
        assert _assigns_creator_groups_as_viewers() is False

    # ASSIGN on but ENABLE_VIEWERS off → the gate stays closed.
    with patch(
        "superset.is_feature_enabled",
        side_effect=lambda flag: flag != "ENABLE_VIEWERS",
    ):
        assert _assigns_creator_groups_as_viewers() is False


def test_user_group_subject_ids_subquery_joins_group_membership(app_context) -> None:
    sql = str(
        get_user_group_subject_ids_subquery(7).compile(
            compile_kwargs={"literal_binds": True}
        )
    )

    assert "ab_user_group" in sql
    assert "user_id = 7" in sql


@patch("superset.commands.utils.get_user_id", return_value=5)
@patch("superset.commands.utils.populate_subject_list")
@patch("superset.subjects.utils.get_user_group_subjects")
def test_new_asset_viewers_default_to_creator_groups_when_enabled(
    mock_groups: MagicMock,
    mock_populate: MagicMock,
    mock_user_id: MagicMock,
    app_context,
) -> None:
    groups = [_group_subject(11), _group_subject(12)]
    mock_groups.return_value = groups
    mock_populate.return_value = [_group_subject(1)]
    properties: dict[str, Any] = {}

    with patch(
        "superset.subjects.utils._assigns_creator_groups_as_viewers",
        return_value=True,
    ):
        populate_subjects(properties, [])

    assert properties["viewers"] == groups


@patch("superset.commands.utils.get_user_id", return_value=5)
@patch("superset.commands.utils.populate_subject_list")
@patch("superset.subjects.utils.get_user_group_subjects")
def test_new_asset_gets_no_default_viewers_when_disabled(
    mock_groups: MagicMock,
    mock_populate: MagicMock,
    mock_user_id: MagicMock,
    app_context,
) -> None:
    mock_groups.return_value = [_group_subject(11)]
    mock_populate.return_value = [_group_subject(1)]
    properties: dict[str, Any] = {}

    with patch(
        "superset.subjects.utils._assigns_creator_groups_as_viewers",
        return_value=False,
    ):
        populate_subjects(properties, [])

    assert "viewers" not in properties


@patch("superset.subjects.utils.get_user_group_subjects")
def test_default_viewers_are_empty_for_an_anonymous_creator(
    mock_groups: MagicMock,
    app_context,
) -> None:
    with patch(
        "superset.subjects.utils._assigns_creator_groups_as_viewers",
        return_value=True,
    ):
        assert get_default_viewers_for_new_asset(None) == []

    mock_groups.assert_not_called()


@patch("superset.subjects.utils.get_user_group_subjects")
def test_default_viewers_are_empty_when_the_setting_is_off(
    mock_groups: MagicMock,
    app_context,
) -> None:
    with patch(
        "superset.subjects.utils._assigns_creator_groups_as_viewers",
        return_value=False,
    ):
        assert get_default_viewers_for_new_asset(5) == []

    mock_groups.assert_not_called()


@patch("superset.subjects.utils.get_user_group_subjects")
def test_default_viewers_are_the_creators_groups_when_enabled(
    mock_groups: MagicMock,
    app_context,
) -> None:
    groups = [_group_subject(11)]
    mock_groups.return_value = groups

    with patch(
        "superset.subjects.utils._assigns_creator_groups_as_viewers",
        return_value=True,
    ):
        assert get_default_viewers_for_new_asset(5) == groups


@patch("superset.commands.utils.get_user_id", return_value=5)
@patch("superset.commands.utils.populate_subject_list")
@patch("superset.subjects.utils.get_user_group_subjects")
def test_explicit_viewers_are_not_replaced_by_creator_groups(
    mock_groups: MagicMock,
    mock_populate: MagicMock,
    mock_user_id: MagicMock,
    app_context,
) -> None:
    chosen = [_group_subject(99)]
    mock_groups.return_value = [_group_subject(11)]
    mock_populate.side_effect = [[_group_subject(1)], chosen]
    properties: dict[str, Any] = {"viewers": [99]}

    with patch(
        "superset.subjects.utils._assigns_creator_groups_as_viewers",
        return_value=True,
    ):
        populate_subjects(properties, [])

    assert properties["viewers"] == chosen
    mock_groups.assert_not_called()


@patch("superset.subjects.utils.subjects_from_groups")
def test_default_viewers_for_groups_resolves_in_memory_groups(
    mock_from_groups: MagicMock,
    app_context,
) -> None:
    """Flush-time callers hold groups in memory before ab_user_group is written."""
    group = MagicMock()
    group.id = 11
    subject = _group_subject(11)
    subject.group_id = 11
    mock_from_groups.return_value = [subject]

    with patch(
        "superset.subjects.utils._assigns_creator_groups_as_viewers",
        return_value=True,
    ):
        assert get_default_viewers_for_groups([group]) == [subject]


@patch("superset.subjects.utils.subjects_from_groups")
def test_default_viewers_for_groups_is_empty_when_the_setting_is_off(
    mock_from_groups: MagicMock,
    app_context,
) -> None:
    with patch(
        "superset.subjects.utils._assigns_creator_groups_as_viewers",
        return_value=False,
    ):
        assert get_default_viewers_for_groups([MagicMock()]) == []

    mock_from_groups.assert_not_called()


@patch("superset.subjects.utils.get_user_group_subjects")
def test_user_id_zero_is_treated_as_a_real_principal(
    mock_groups: MagicMock,
    app_context,
) -> None:
    """A falsy-but-valid id must not be conflated with 'no user'."""
    groups = [_group_subject(11)]
    mock_groups.return_value = groups

    with patch(
        "superset.subjects.utils._assigns_creator_groups_as_viewers",
        return_value=True,
    ):
        assert get_default_viewers_for_new_asset(0) == groups


def test_user_group_subject_ids_subquery_restricts_to_group_subjects(
    app_context,
) -> None:
    """Defense in depth: don't rely on ``group_id`` alone to imply the type."""
    sql = str(
        get_user_group_subject_ids_subquery(7).compile(
            compile_kwargs={"literal_binds": True}
        )
    )

    assert "subjects.type = 3" in sql


def test_subjects_from_groups_issues_a_single_query(app_context) -> None:
    """One query for the whole list, not one per group."""
    from superset.subjects import utils as subjects_utils

    with patch.object(subjects_utils, "db") as mock_db:
        mock_db.session.query.return_value.filter.return_value.all.return_value = []
        subjects_utils.subjects_from_groups([MagicMock(id=1), MagicMock(id=2)])

    assert mock_db.session.query.call_count == 1


@patch("superset.commands.utils.get_user_id", return_value=5)
@patch("superset.commands.utils.populate_subject_list", return_value=[])
@patch("superset.subjects.utils.get_user_group_subjects")
def test_an_explicit_empty_viewers_list_suppresses_the_group_default(
    mock_groups: MagicMock,
    mock_populate: MagicMock,
    mock_user_id: MagicMock,
    app_context,
) -> None:
    """``viewers: []`` means "no viewers", not "fall back to my groups"."""
    properties: dict[str, Any] = {"viewers": []}

    with patch(
        "superset.subjects.utils._assigns_creator_groups_as_viewers",
        return_value=True,
    ):
        populate_subjects(properties, [])

    assert properties["viewers"] == []
    mock_groups.assert_not_called()


@patch("superset.subjects.utils.get_user_group_subjects", return_value=[])
def test_a_creator_without_groups_leaves_the_dataset_fallback_intact(
    mock_groups: MagicMock,
    app_context,
) -> None:
    """No groups means no viewers, so the asset keeps dataset-based access."""
    with patch(
        "superset.subjects.utils._assigns_creator_groups_as_viewers",
        return_value=True,
    ):
        assert get_default_viewers_for_new_asset(5) == []
