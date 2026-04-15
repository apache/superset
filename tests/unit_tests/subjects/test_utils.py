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

from unittest.mock import MagicMock, patch

import pytest

from superset.commands.utils import (
    compute_subject_list,
    compute_subjects,
    owners_from_editors,
    populate_subject_list,
    populate_subjects,
)
from superset.subjects.exceptions import SubjectsNotFoundValidationError
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType


def _make_subject(
    id_: int,
    type_: SubjectType = SubjectType.USER,
    user: MagicMock | None = None,
) -> Subject:
    s = Subject()
    s.id = id_
    s.type = type_
    s.user = user
    return s


def _mock_sm(*, is_admin: bool = False) -> MagicMock:
    sm = MagicMock()
    sm.is_admin = MagicMock(return_value=is_admin)
    return sm


# --------------------------------------------------------------------------
# populate_subject_list
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "subject_ids,default_to_user,user_subject_exists,expected_count",
    [
        ([], True, True, 1),  # empty + default → user's subject
        (None, True, True, 1),  # None + default → user's subject
        ([], True, False, 0),  # empty + default but no subject → empty
    ],
)
@patch("superset.commands.utils.get_user_subject")
@patch("superset.commands.utils.get_user_id")
def test_populate_subject_list_defaults(
    mock_user_id,
    mock_get_user_subject,
    subject_ids,
    default_to_user,
    user_subject_exists,
    expected_count,
):
    """Default-to-user behavior with various combinations of input."""
    mock_user_id.return_value = 1
    mock_get_user_subject.return_value = (
        _make_subject(10) if user_subject_exists else None
    )

    result = populate_subject_list(subject_ids, default_to_user=default_to_user)
    assert len(result) == expected_count


@patch("superset.commands.utils.get_subject")
@patch("superset.commands.utils.security_manager", new_callable=lambda: _mock_sm)
@patch("superset.commands.utils.get_user_id")
def test_populate_subject_list_admin_vs_non_admin(
    mock_user_id,
    mock_sm,
    mock_get_subject,
):
    """Admin can set arbitrary subjects; non-admin without lockout behaves
    the same when they're not removing themselves."""
    subject_a = _make_subject(20)
    mock_user_id.return_value = 1
    mock_get_subject.return_value = subject_a

    # Admin: only the requested subject
    mock_sm.is_admin = MagicMock(return_value=True)
    result = populate_subject_list([20], default_to_user=False)
    assert result == [subject_a]

    # Non-admin without lockout: same result (no prepend)
    mock_sm.is_admin = MagicMock(return_value=False)
    result = populate_subject_list([20], default_to_user=False, ensure_no_lockout=False)
    assert result == [subject_a]

    # Admin with empty list
    mock_sm.is_admin = MagicMock(return_value=True)
    result = populate_subject_list([], default_to_user=False)
    assert result == []


@patch("superset.commands.utils.get_subject")
@patch("superset.commands.utils.get_user_subject_ids")
@patch("superset.commands.utils.get_user_subject")
@patch("superset.commands.utils.security_manager", new_callable=lambda: _mock_sm)
@patch("superset.commands.utils.get_user_id")
def test_populate_subject_list_lockout_prevention(
    mock_user_id,
    mock_sm,
    mock_get_user_subject,
    mock_get_user_subject_ids,
    mock_get_subject,
):
    """Non-admins cannot remove themselves when ensure_no_lockout is True."""
    user_subject = _make_subject(10)
    other_subject = _make_subject(20)
    mock_user_id.return_value = 1
    mock_sm.is_admin = MagicMock(return_value=False)
    mock_get_user_subject.return_value = user_subject
    mock_get_user_subject_ids.return_value = [10]
    mock_get_subject.return_value = other_subject

    result = populate_subject_list(
        [20],
        default_to_user=False,
        ensure_no_lockout=True,
    )
    # user_subject prepended because 10 not in [20]
    assert len(result) == 2
    assert result[0] == user_subject
    assert result[1] == other_subject


@patch("superset.commands.utils.get_subject")
@patch("superset.commands.utils.security_manager", new_callable=lambda: _mock_sm)
@patch("superset.commands.utils.get_user_id")
def test_populate_subject_list_not_found(mock_user_id, mock_sm, mock_get_subject):
    """Raises SubjectsNotFoundValidationError when a subject ID doesn't exist."""
    mock_user_id.return_value = 1
    mock_sm.is_admin = MagicMock(return_value=True)
    mock_get_subject.return_value = None

    with pytest.raises(SubjectsNotFoundValidationError):
        populate_subject_list([999], default_to_user=False)


# --------------------------------------------------------------------------
# compute_subject_list
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "current_ids,new_ids,expected_call_ids",
    [
        ([1, 2], [3, 4], [3, 4]),  # new replaces current
        ([1, 2], None, [1, 2]),  # None preserves current
        ([1, 2], [], []),  # empty clears
        (None, [3, 4], [3, 4]),  # None current + new ids
    ],
    ids=["replace", "preserve", "clear", "none-current"],
)
@patch("superset.commands.utils.populate_subject_list")
def test_compute_subject_list(mock_populate, current_ids, new_ids, expected_call_ids):
    """Delegates to populate_subject_list with the right IDs."""
    current = [_make_subject(i) for i in current_ids] if current_ids else current_ids
    compute_subject_list(current, new_ids)
    mock_populate.assert_called_once_with(
        expected_call_ids,
        default_to_user=False,
        ensure_no_lockout=False,
    )


# --------------------------------------------------------------------------
# populate_subjects / compute_subjects (consolidated helpers)
# --------------------------------------------------------------------------


@patch("superset.commands.utils.populate_subject_list")
def test_populate_subjects_all_variants(mock_populate):
    """Editors + viewers; editors only; include_viewers=False."""
    editor_s = [_make_subject(1)]
    viewer_s = [_make_subject(2)]

    # Both editors and viewers
    mock_populate.side_effect = [editor_s, viewer_s]
    props: dict = {"editors": [1], "viewers": [2]}
    populate_subjects(props, exceptions := [])
    assert props["editors"] == editor_s
    assert props["viewers"] == viewer_s
    assert not exceptions

    # Viewers absent from payload → not populated
    mock_populate.reset_mock(side_effect=True)
    mock_populate.return_value = editor_s
    props2: dict = {"editors": [1]}
    populate_subjects(props2, exceptions := [])
    assert "viewers" not in props2
    assert mock_populate.call_count == 1

    # include_viewers=False → viewers key untouched
    mock_populate.reset_mock(side_effect=True)
    mock_populate.return_value = editor_s
    props3: dict = {"editors": [1], "viewers": [2]}
    populate_subjects(props3, exceptions := [], include_viewers=False)
    assert props3["viewers"] == [2]  # unchanged raw IDs
    assert mock_populate.call_count == 1


@patch("superset.commands.utils.compute_subject_list")
def test_compute_subjects_all_variants(mock_compute):
    """Editors + viewers; no viewers attr; include_viewers=False."""
    model = MagicMock()
    model.editors = [_make_subject(1)]
    model.viewers = [_make_subject(2)]

    # Both editors and viewers
    mock_compute.side_effect = [[_make_subject(10)], [_make_subject(20)]]
    props: dict = {"editors": [10], "viewers": [20]}
    compute_subjects(model, props, exceptions := [])
    assert mock_compute.call_count == 2
    mock_compute.assert_any_call(model.editors, [10], ensure_no_lockout=True)
    mock_compute.assert_any_call(model.viewers, [20])
    assert not exceptions

    # Model without viewers attr → only editors
    mock_compute.reset_mock(side_effect=True)
    mock_compute.return_value = [_make_subject(10)]
    model_no_viewers = MagicMock(spec=["editors"])
    model_no_viewers.editors = [_make_subject(1)]
    compute_subjects(model_no_viewers, {"editors": [10]}, exceptions := [])
    assert mock_compute.call_count == 1

    # include_viewers=False → skip viewers
    mock_compute.reset_mock(side_effect=True)
    mock_compute.return_value = [_make_subject(10)]
    compute_subjects(model, {"editors": [10]}, exceptions := [], include_viewers=False)
    assert mock_compute.call_count == 1


# --------------------------------------------------------------------------
# owners ↔ editors bridge
# --------------------------------------------------------------------------


def _make_user_mock(user_id: int) -> MagicMock:
    """Create a mock User object."""
    user = MagicMock()
    user.id = user_id
    return user


@patch("superset.commands.utils.populate_subject_list")
@patch("superset.commands.utils.get_user_subject")
def test_populate_subjects_bridges_owners_to_editors(
    mock_get_user_subject,
    mock_populate,
):
    """When editors absent but owners present, user IDs are bridged to subject IDs."""
    user_mock = _make_user_mock(1)
    user_subject = _make_subject(10, user=user_mock)
    mock_get_user_subject.return_value = user_subject
    mock_populate.return_value = [user_subject]

    props: dict = {"owners": [1]}  # user ID 1, no editors key
    populate_subjects(props, exceptions := [])

    # Bridge should convert user ID 1 → subject ID 10
    mock_get_user_subject.assert_called_once_with(1)
    # populate_subject_list should be called with the bridged subject IDs
    mock_populate.assert_called_once_with(
        [10], default_to_user=True, ensure_no_lockout=True
    )
    assert not exceptions


@patch("superset.commands.utils.populate_subject_list")
@patch("superset.commands.utils.get_user_subject")
def test_populate_subjects_editors_wins_over_owners(
    mock_get_user_subject,
    mock_populate,
):
    """When both editors and owners present, editors take precedence."""
    mock_populate.return_value = [_make_subject(20)]

    props: dict = {"owners": [1], "editors": [20]}
    populate_subjects(props, exceptions := [])

    # Bridge should NOT activate
    mock_get_user_subject.assert_not_called()
    # populate_subject_list called with the editors, not bridged owners
    mock_populate.assert_called_once_with(
        [20], default_to_user=True, ensure_no_lockout=True
    )
    assert not exceptions


@patch("superset.commands.utils.populate_subject_list")
def test_populate_subjects_removes_owners_from_properties(mock_populate):
    """owners is removed from properties (it's a computed property on models)."""
    user_mock = _make_user_mock(1)
    editor = _make_subject(10, user=user_mock)
    role_editor = _make_subject(20, type_=SubjectType.ROLE)
    mock_populate.return_value = [editor, role_editor]

    props: dict = {"editors": [10, 20], "owners": [1]}
    populate_subjects(props, exceptions := [])

    # owners should be removed from properties dict
    assert "owners" not in props
    assert not exceptions


@patch("superset.commands.utils.compute_subject_list")
@patch("superset.commands.utils.get_user_subject")
def test_compute_subjects_bridges_owners_to_editors(
    mock_get_user_subject,
    mock_compute,
):
    """compute_subjects bridges owner user IDs to editor subject IDs."""
    user_mock = _make_user_mock(1)
    user_subject = _make_subject(10, user=user_mock)
    mock_get_user_subject.return_value = user_subject
    mock_compute.return_value = [user_subject]

    model = MagicMock(spec=["editors"])
    model.editors = []

    props: dict = {"owners": [1]}  # user ID 1, no editors key
    compute_subjects(model, props, exceptions := [])

    # Bridge should convert user ID 1 → subject ID 10
    mock_get_user_subject.assert_called_once_with(1)
    mock_compute.assert_called_once_with(model.editors, [10], ensure_no_lockout=True)
    assert not exceptions


@patch("superset.commands.utils.compute_subject_list")
@patch("superset.commands.utils.get_user_subject")
def test_compute_subjects_editors_wins_over_owners(
    mock_get_user_subject,
    mock_compute,
):
    """When both editors and owners present, editors take precedence in compute."""
    mock_compute.return_value = [_make_subject(20)]

    model = MagicMock(spec=["editors"])
    model.editors = []

    props: dict = {"owners": [1], "editors": [20]}
    compute_subjects(model, props, exceptions := [])

    mock_get_user_subject.assert_not_called()
    mock_compute.assert_called_once_with(model.editors, [20], ensure_no_lockout=True)
    assert not exceptions


@patch("superset.commands.utils.compute_subject_list")
def test_compute_subjects_removes_owners_from_properties(mock_compute):
    """compute_subjects removes owners from properties (computed on model)."""
    user_mock = _make_user_mock(1)
    editor = _make_subject(10, user=user_mock)
    mock_compute.return_value = [editor]

    model = MagicMock(spec=["editors"])
    model.editors = [editor]

    props: dict = {"editors": [10], "owners": [1]}
    compute_subjects(model, props, exceptions := [])

    # owners should be removed from properties dict
    assert "owners" not in props
    assert not exceptions


def test_owners_from_editors_filters_user_type_only():
    """owners_from_editors returns only User objects from USER-type subjects."""
    user1 = _make_user_mock(1)
    user2 = _make_user_mock(2)
    editors = [
        _make_subject(10, type_=SubjectType.USER, user=user1),
        _make_subject(20, type_=SubjectType.ROLE),  # no user
        _make_subject(30, type_=SubjectType.USER, user=user2),
        _make_subject(40, type_=SubjectType.GROUP),  # no user
    ]

    result = owners_from_editors(editors)
    assert result == [user1, user2]


@patch("superset.commands.utils.populate_subject_list")
@patch("superset.commands.utils.get_user_subject")
def test_populate_subjects_bridge_skips_missing_user_subjects(
    mock_get_user_subject,
    mock_populate,
):
    """Bridge skips user IDs that have no corresponding Subject."""
    user_mock = _make_user_mock(1)
    user_subject = _make_subject(10, user=user_mock)
    # User ID 1 has a subject, user ID 2 does not
    mock_get_user_subject.side_effect = lambda uid: user_subject if uid == 1 else None
    mock_populate.return_value = [user_subject]

    props: dict = {"owners": [1, 2]}
    populate_subjects(props, exceptions := [])

    # Only subject ID 10 (from user 1) should be bridged
    mock_populate.assert_called_once_with(
        [10], default_to_user=True, ensure_no_lockout=True
    )
    assert not exceptions
