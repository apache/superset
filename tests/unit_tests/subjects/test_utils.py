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
    populate_subject_list,
    populate_subjects,
)
from superset.subjects.exceptions import SubjectsNotFoundValidationError
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.subjects.utils import (
    get_current_user_subject_ids,
    get_user_subject_ids_subquery,
)


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


def test_get_user_subject_ids_subquery_includes_group_roles(app_context):
    """User subjects include roles inherited through group membership."""
    query = get_user_subject_ids_subquery(7)
    sql = str(query.compile(compile_kwargs={"literal_binds": True}))

    assert "ab_group_role" in sql
    assert "ab_user_group" in sql


def test_get_current_user_subject_ids_guest_user(app_context):
    """Guest users resolve subject IDs from their embedded roles."""
    from flask import g

    role_subjects = [
        _make_subject(10, SubjectType.ROLE),
        _make_subject(20, SubjectType.ROLE),
    ]
    guest_user = MagicMock()
    guest_user.is_guest_user = True
    guest_user.roles = [1, 2]
    g.user = guest_user

    with (
        patch(
            "superset.subjects.utils.subjects_from_roles",
            return_value=role_subjects,
        ) as mock_subjects_from_roles,
        patch("superset.utils.core.get_user_id") as mock_get_user_id,
    ):
        assert get_current_user_subject_ids() == [10, 20]

    mock_subjects_from_roles.assert_called_once_with([1, 2])
    mock_get_user_id.assert_not_called()


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


def test_populate_subject_list_extra_editors_resolver_skips_lockout_prevention():
    user_subject = _make_subject(10)
    other_subject = _make_subject(20)
    mock_sm = _mock_sm(is_admin=False)

    with (
        patch("superset.commands.utils.get_user_id", return_value=1),
        patch("superset.commands.utils.security_manager", mock_sm),
        patch("superset.commands.utils.get_user_subject", return_value=user_subject),
        patch("superset.commands.utils.get_user_subject_ids", return_value=[10]),
        patch("superset.commands.utils.get_subject", return_value=other_subject),
        patch(
            "superset.commands.utils._has_extra_editors_resolver",
            return_value=True,
        ),
    ):
        result = populate_subject_list(
            [20],
            default_to_user=False,
            ensure_no_lockout=True,
        )

    assert result == [other_subject]


def test_populate_subject_list_extra_editors_resolver_keeps_default_to_user():
    user_subject = _make_subject(10)

    with (
        patch("superset.commands.utils.get_user_id", return_value=1),
        patch("superset.commands.utils.get_user_subject", return_value=user_subject),
        patch(
            "superset.commands.utils._has_extra_editors_resolver",
            return_value=True,
        ),
    ):
        result = populate_subject_list([], default_to_user=True)

    assert result == [user_subject]


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
        field_name="subjects",
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
    mock_populate.assert_any_call(
        [1],
        default_to_user=True,
        ensure_no_lockout=True,
        field_name="editors",
    )
    mock_populate.assert_any_call(
        [2],
        default_to_user=False,
        field_name="viewers",
    )
    assert not exceptions

    # Viewers absent from payload → not populated
    mock_populate.reset_mock(side_effect=True)
    mock_populate.return_value = editor_s
    props2: dict = {"editors": [1]}
    populate_subjects(props2, exceptions := [])
    assert "viewers" not in props2
    mock_populate.assert_called_once_with(
        [1],
        default_to_user=True,
        ensure_no_lockout=True,
        field_name="editors",
    )

    # include_viewers=False → viewers key untouched
    mock_populate.reset_mock(side_effect=True)
    mock_populate.return_value = editor_s
    props3: dict = {"editors": [1], "viewers": [2]}
    populate_subjects(props3, exceptions := [], include_viewers=False)
    assert props3["viewers"] == [2]  # unchanged raw IDs
    mock_populate.assert_called_once_with(
        [1],
        default_to_user=True,
        ensure_no_lockout=True,
        field_name="editors",
    )


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
    mock_compute.assert_any_call(
        model.editors,
        [10],
        ensure_no_lockout=True,
        field_name="editors",
    )
    mock_compute.assert_any_call(model.viewers, [20], field_name="viewers")
    assert not exceptions

    # Model without viewers attr → only editors
    mock_compute.reset_mock(side_effect=True)
    mock_compute.return_value = [_make_subject(10)]
    model_no_viewers = MagicMock(spec=["editors"])
    model_no_viewers.editors = [_make_subject(1)]
    compute_subjects(model_no_viewers, {"editors": [10]}, exceptions := [])
    mock_compute.assert_called_once_with(
        model_no_viewers.editors,
        [10],
        ensure_no_lockout=True,
        field_name="editors",
    )

    # include_viewers=False → skip viewers
    mock_compute.reset_mock(side_effect=True)
    mock_compute.return_value = [_make_subject(10)]
    compute_subjects(model, {"editors": [10]}, exceptions := [], include_viewers=False)
    mock_compute.assert_called_once_with(
        model.editors,
        [10],
        ensure_no_lockout=True,
        field_name="editors",
    )
