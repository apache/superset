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

from superset.subjects.models import Subject
from superset.subjects.types import SubjectType


def _make_subject(id_: int, type_: SubjectType = SubjectType.USER) -> Subject:
    s = Subject()
    s.id = id_
    s.type = type_
    return s


def _make_resource(
    editor_ids: list[int] | None = None,
    viewer_ids: list[int] | None = None,
) -> MagicMock:
    """Mock resource; when *_ids is None the corresponding attr is removed."""
    resource = MagicMock()
    if editor_ids is not None:
        resource.editors = [_make_subject(eid) for eid in editor_ids]
    else:
        del resource.editors
    if viewer_ids is not None:
        resource.viewers = [_make_subject(vid) for vid in viewer_ids]
    else:
        del resource.viewers
    return resource


def _make_sm():
    from superset.security.manager import SupersetSecurityManager

    return SupersetSecurityManager.__new__(SupersetSecurityManager)


def test_is_editor_admin_bypass():
    """Admins are always editors, even with an empty editors list."""
    sm = _make_sm()
    with patch.object(sm, "is_admin", return_value=True):
        assert sm.is_editor(_make_resource(editor_ids=[])) is True
        assert sm.is_editor(_make_resource(editor_ids=[99])) is True


def test_is_editor_no_editors_relationship_returns_false():
    """Returns False when the resource lacks an editors relationship."""
    sm = _make_sm()
    with patch.object(sm, "is_admin", return_value=False):
        assert sm.is_editor(_make_resource(editor_ids=None)) is False


@pytest.mark.parametrize(
    "user_id,user_subject_ids,editor_ids,expected",
    [
        (None, [], [10], False),  # anonymous
        (1, [10], [10, 20], True),  # direct user match
        (1, [10], [20, 30], False),  # no match
        (1, [10, 50, 100], [50], True),  # role match
        (1, [10, 50, 100], [100], True),  # group match
        (1, [10], [], False),  # empty editors
    ],
    ids=["anonymous", "direct", "no-match", "role", "group", "empty-editors"],
)
def test_is_editor(user_id, user_subject_ids, editor_ids, expected):
    """Covers direct user, role, group, anonymous, and empty scenarios."""
    sm = _make_sm()
    resource = _make_resource(editor_ids=editor_ids)

    with (
        patch.object(sm, "is_admin", return_value=False),
        patch(
            "superset.security.manager.get_user_id",
            return_value=user_id,
        ),
        patch(
            "superset.subjects.utils.get_user_subject_ids",
            return_value=user_subject_ids,
        ),
    ):
        assert sm.is_editor(resource) is expected


# ---------------------------------------------------------------------------
# is_viewer tests
# ---------------------------------------------------------------------------


def test_is_viewer_admin_bypass():
    """Admins are always viewers."""
    sm = _make_sm()
    with patch.object(sm, "is_admin", return_value=True):
        assert sm.is_viewer(_make_resource(editor_ids=[], viewer_ids=[])) is True


def test_is_viewer_anonymous():
    """Anonymous users are never viewers."""
    sm = _make_sm()
    with (
        patch.object(sm, "is_admin", return_value=False),
        patch("superset.security.manager.get_user_id", return_value=None),
    ):
        assert sm.is_viewer(_make_resource(editor_ids=[10], viewer_ids=[10])) is False


@pytest.mark.parametrize(
    "user_subject_ids,editor_ids,viewer_ids,expected",
    [
        ([10], [10], [], True),  # editor implies viewer
        ([10], [], [10], True),  # direct viewer match
        ([10], [20], [10], True),  # viewer match (not editor)
        ([10, 50], [50], [20], True),  # editor via role subject
        ([10], [20], [30], False),  # no match at all
        ([10], [], [], False),  # empty editors + viewers
    ],
    ids=[
        "editor-implies-viewer",
        "viewer-only",
        "viewer-not-editor",
        "editor-role-match",
        "no-match",
        "empty-both",
    ],
)
def test_is_viewer(user_subject_ids, editor_ids, viewer_ids, expected):
    sm = _make_sm()
    resource = _make_resource(editor_ids=editor_ids, viewer_ids=viewer_ids)

    with (
        patch.object(sm, "is_admin", return_value=False),
        patch("superset.security.manager.get_user_id", return_value=1),
        patch(
            "superset.subjects.utils.get_user_subject_ids",
            return_value=user_subject_ids,
        ),
    ):
        assert sm.is_viewer(resource) is expected


def test_is_viewer_missing_relationships():
    """is_viewer returns False (no raise) when editors/viewers attrs missing."""
    sm = _make_sm()
    resource = _make_resource(editor_ids=None, viewer_ids=None)

    with (
        patch.object(sm, "is_admin", return_value=False),
        patch("superset.security.manager.get_user_id", return_value=1),
        patch(
            "superset.subjects.utils.get_user_subject_ids",
            return_value=[10],
        ),
    ):
        assert sm.is_viewer(resource) is False
