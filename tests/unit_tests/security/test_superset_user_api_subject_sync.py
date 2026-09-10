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
"""``SupersetUserApi`` syncs the ``Subject`` row that mirrors each ``User``.

``UserApi.post``/``put`` call ``self.pre_add``/``self.pre_update`` *before*
the write that actually commits (``self.datamodel.add``/``edit``). Overriding
those hooks -- instead of syncing after the fact, in a second commit issued
once ``post``/``put`` have already returned -- means the subject sync rides
the same transaction as the user write: one commit persists both, and a
failure of that commit rolls both back together instead of leaving an
orphaned user with no matching ``Subject`` row.

These tests exercise ``pre_add``/``pre_update`` directly, plus the exact call
pairs FAB's ``UserApi.post``/``put`` make (``pre_add``/``pre_update`` followed
by the real ``SQLAInterface.add``/``edit``), to confirm that pairing shares a
single commit and a single rollback.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.sqla.models import User

from superset import db, security_manager
from superset.security.manager import SupersetUserApi
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from tests.unit_tests.fixtures.common import after_each  # noqa: F401


def _admin_role() -> object:
    return db.session.query(security_manager.role_model).filter_by(name="Admin").one()


def _make_pending_user(username: str) -> User:
    """A transient ``User``, not yet added to the session.

    Mirrors what FAB's ``UserApi.post()`` builds (``model = User()``, with
    attributes set from the request payload) just before it calls
    ``self.pre_add(model)`` and then ``self.datamodel.add(model)``.
    """
    return User(
        first_name="New",
        last_name="Guy",
        email=f"{username}@example.org",
        username=username,
        roles=[_admin_role()],
        password="irrelevant-pre-hash-value",  # noqa: S106
    )


def _make_persisted_user(username: str) -> User:
    """A ``User`` already committed, standing in for one an earlier request
    created -- the starting point for a ``put``/``pre_update`` flow.
    """
    user = User(
        first_name="New",
        last_name="Guy",
        email=f"{username}@example.org",
        username=username,
        roles=[_admin_role()],
    )
    db.session.add(user)
    db.session.commit()
    return user


def _api_for(session=db.session) -> SupersetUserApi:  # noqa: ANN001
    api = SupersetUserApi()
    api.datamodel = SQLAInterface(User, session)
    # FAB's own ``pre_update`` (which ``SupersetUserApi.pre_update`` calls via
    # ``super()``) reads ``self.appbuilder.sm.current_user.id`` to stamp
    # ``changed_by_fk`` -- stand in for the acting admin so that lookup
    # succeeds outside of a real request/login context.
    api.appbuilder = SimpleNamespace(
        sm=SimpleNamespace(current_user=SimpleNamespace(id=1))
    )
    return api


def _subject_for(user_id: int) -> Subject | None:
    return (
        db.session.query(Subject)
        .filter_by(user_id=user_id, type=SubjectType.USER)
        .one_or_none()
    )


def test_pre_add_syncs_subject_without_committing(
    after_each: None,  # noqa: F811
) -> None:
    """``pre_add`` flushes the new user (to obtain its id) and syncs its
    ``Subject`` row, but does not commit -- that's still FAB's job, in
    ``self.datamodel.add``, which runs right after.
    """
    user = _make_pending_user("new_guy_pre_add")
    api = _api_for()

    real_commit = db.session.commit
    commit_calls = MagicMock(wraps=real_commit)
    with patch.object(db.session, "commit", commit_calls):
        api.pre_add(user)

    assert commit_calls.call_count == 0
    assert user.id is not None
    assert _subject_for(user.id) is not None


def test_pre_add_and_datamodel_add_share_a_single_commit(
    after_each: None,  # noqa: F811
) -> None:
    """The exact pair of calls FAB's ``UserApi.post()`` makes --
    ``self.pre_add(model)`` then ``self.datamodel.add(model)`` -- persist the
    user and its ``Subject`` row together, via exactly one commit.
    """
    user = _make_pending_user("new_guy_shared_commit")
    api = _api_for()

    real_commit = db.session.commit
    commit_calls = MagicMock(wraps=real_commit)
    with patch.object(db.session, "commit", commit_calls):
        api.pre_add(user)
        api.datamodel.add(user)

    assert commit_calls.call_count == 1
    subject = _subject_for(user.id)
    assert subject is not None


def test_pre_add_failure_rolls_back_user_and_subject_together(
    after_each: None,  # noqa: F811
) -> None:
    """If the commit that follows ``pre_add`` fails (standing in: FAB's own
    ``self.datamodel.add`` raising), the new user and the ``Subject`` row
    flushed alongside it roll back together -- there is no window where the
    user persists without a matching ``Subject``.
    """
    user = _make_pending_user("new_guy_pre_add_fail")
    api = _api_for()

    api.pre_add(user)
    user_id = user.id
    assert user_id is not None
    assert _subject_for(user_id) is not None  # flushed, visible pre-rollback

    db.session.rollback()  # stands in for the follow-up commit failing

    assert db.session.query(User).filter_by(id=user_id).one_or_none() is None
    assert _subject_for(user_id) is None


def test_pre_update_syncs_subject_without_committing(
    after_each: None,  # noqa: F811
) -> None:
    """Same reasoning as ``pre_add``, for an edit: ``pre_update`` syncs the
    ``Subject`` row without committing, ahead of FAB's own
    ``self.datamodel.edit``.
    """
    user = _make_persisted_user("new_guy_pre_update")
    api = _api_for()

    real_commit = db.session.commit
    commit_calls = MagicMock(wraps=real_commit)
    with patch.object(db.session, "commit", commit_calls):
        api.pre_update(user, {})

    assert commit_calls.call_count == 0
    assert _subject_for(user.id) is not None


def test_pre_update_and_datamodel_edit_share_a_single_commit(
    after_each: None,  # noqa: F811
) -> None:
    """The exact pair of calls FAB's ``UserApi.put()`` makes --
    ``self.pre_update(model, item)`` then ``self.datamodel.edit(model)`` --
    persist the edit and the ``Subject`` sync together, via exactly one
    commit.
    """
    user = _make_persisted_user("new_guy_shared_commit_put")
    api = _api_for()

    real_commit = db.session.commit
    commit_calls = MagicMock(wraps=real_commit)
    with patch.object(db.session, "commit", commit_calls):
        api.pre_update(user, {})
        api.datamodel.edit(user)

    assert commit_calls.call_count == 1
    assert _subject_for(user.id) is not None


def test_pre_update_failure_rolls_back_subject_sync_without_orphaning(
    after_each: None,  # noqa: F811
) -> None:
    """If the commit that follows ``pre_update`` fails, the ``Subject`` row it
    flushed rolls back too -- the previously-persisted user row (created by
    an earlier, already-successful request) is left exactly as it was, with
    no half-applied sync attached to it.
    """
    user = _make_persisted_user("new_guy_pre_update_fail")
    user_id = user.id
    api = _api_for()

    api.pre_update(user, {})
    assert _subject_for(user_id) is not None  # flushed, visible pre-rollback

    db.session.rollback()  # stands in for the follow-up commit failing

    # The user itself predates this (failed) request and survives.
    assert db.session.query(User).filter_by(id=user_id).one_or_none() is not None
    # But the subject sync this request attempted never landed.
    assert _subject_for(user_id) is None
