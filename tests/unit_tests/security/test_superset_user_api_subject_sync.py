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
"""``SupersetUserApi.post``/``put`` commit the FAB user write, then sync the
corresponding ``Subject`` row in a *separate* transaction. These tests show
that when the second commit fails, the already-committed user is left
without a compensating rollback: the ``@safe`` decorator on the endpoint
catches the failure and turns it into a generic 500 response, and nothing
deletes the user or retries the sync -- so the user row exists with no
matching ``Subject`` row, and the only visible trace is a 500.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from flask_appbuilder.security.sqla.apis.user.api import UserApi
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.exc import IntegrityError

from superset import db, security_manager
from superset.security.manager import SupersetUserApi
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from tests.unit_tests.fixtures.common import after_each  # noqa: F401


def _make_user(username: str) -> User:
    role = db.session.query(security_manager.role_model).filter_by(name="Admin").one()
    user = User(
        first_name="New",
        last_name="Guy",
        email=f"{username}@example.org",
        username=username,
        roles=[role],
    )
    db.session.add(user)
    db.session.commit()  # simulate FAB's UserApi.post/put already committing
    return user


def test_post_leaves_user_without_subject_when_sync_commit_fails(
    after_each: None,  # noqa: F811
) -> None:
    """If the subject-sync commit in ``SupersetUserApi.post`` fails, the
    ``@safe`` decorator on the endpoint catches the exception and turns it
    into a generic 500 -- there is no ``except`` clause in ``post`` itself
    that would delete the just-created user or otherwise compensate.
    """
    user = _make_user("new_guy_post")

    fake_response = SimpleNamespace(status_code=201, json={"id": user.id})
    api = SupersetUserApi()
    api.datamodel = SimpleNamespace(session=db.session, obj=User)

    with (
        patch.object(UserApi, "post", return_value=fake_response),
        patch.object(security_manager, "has_access", return_value=True),
        patch.object(
            db.session,
            "commit",
            side_effect=IntegrityError("stmt", {}, Exception("boom")),
        ),
    ):
        response = api.post()

    # The failure is swallowed into a generic 500 by the ``@safe`` decorator
    # -- not surfaced as e.g. a 422 tied to the user that was actually
    # created, and definitely not retried or compensated.
    assert response.status_code == 500

    db.session.rollback()

    # The user row from the (separate, already-succeeded) FAB commit is
    # still there ...
    assert db.session.query(User).filter_by(id=user.id).one_or_none() is not None
    # ... but the Subject row the failed commit was supposed to persist is
    # not, since nothing compensates for the failed sync.
    assert (
        db.session.query(Subject)
        .filter_by(user_id=user.id, type=SubjectType.USER)
        .one_or_none()
        is None
    )


def test_put_leaves_user_without_subject_when_sync_commit_fails(
    after_each: None,  # noqa: F811
) -> None:
    """Same gap as ``post``, for ``SupersetUserApi.put``."""
    user = _make_user("new_guy_put")

    fake_response = SimpleNamespace(status_code=200)
    api = SupersetUserApi()
    api.datamodel = SimpleNamespace(
        session=db.session,
        obj=User,
        get=lambda pk, base_filters=None: user,
    )
    api._base_filters = None

    with (
        patch.object(UserApi, "put", return_value=fake_response),
        patch.object(security_manager, "has_access", return_value=True),
        patch.object(
            db.session,
            "commit",
            side_effect=IntegrityError("stmt", {}, Exception("boom")),
        ),
    ):
        response = api.put(user.id)

    assert response.status_code == 500

    db.session.rollback()

    assert db.session.query(User).filter_by(id=user.id).one_or_none() is not None
    assert (
        db.session.query(Subject)
        .filter_by(user_id=user.id, type=SubjectType.USER)
        .one_or_none()
        is None
    )


def test_post_success_path_still_syncs_subject_in_a_second_commit(
    after_each: None,  # noqa: F811
) -> None:
    """Baseline/control: on the happy path the subject row is created, via a
    ``self.datamodel.session.commit()`` distinct from the one FAB's
    ``UserApi.post`` already issued for the user row -- i.e. two commits, not
    one atomic transaction.
    """
    user = _make_user("new_guy_ok")
    fake_response = SimpleNamespace(status_code=201, json={"id": user.id})
    api = SupersetUserApi()
    api.datamodel = SimpleNamespace(session=db.session, obj=User)

    real_commit = db.session.commit
    commit_calls = MagicMock(wraps=real_commit)

    with (
        patch.object(UserApi, "post", return_value=fake_response),
        patch.object(security_manager, "has_access", return_value=True),
        patch.object(db.session, "commit", commit_calls),
    ):
        response = api.post()

    assert response is fake_response
    assert commit_calls.call_count == 1  # the sync's own, separate commit
    subject = (
        db.session.query(Subject)
        .filter_by(user_id=user.id, type=SubjectType.USER)
        .one_or_none()
    )
    assert subject is not None
