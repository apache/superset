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
"""
Deleting a user that has history.

Most tables reference ``ab_user.id`` without an ``ON DELETE`` rule, so on
PostgreSQL and MySQL deleting a user who has e.g. a favorite, a log entry or a
dashboard they created fails with an ``IntegrityError``. ``UserDAO`` applies the
deletion policy in the application instead. SQLite does not enforce foreign
keys unless asked to, so these tests turn that on.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from datetime import datetime
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

import pytest
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.sqla.models import User
from sqlalchemy import ForeignKey

from superset import db
from superset.daos.user import (
    classify_user_reference,
    user_foreign_keys,
    UserDAO,
)
from superset.key_value.models import KeyValueEntry
from superset.models.core import Database, FavStar, FavStarClassName, Log
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.sql_lab import Query, SavedQuery, TabState
from superset.models.user_attributes import UserAttribute
from superset.security.manager import SupersetUserApi
from superset.tags.models import Tag, TagType, user_favorite_tag_table
from tests.unit_tests.fixtures.common import after_each  # noqa: F401


@pytest.fixture
def enforce_foreign_keys() -> Iterator[None]:
    """SQLite ignores foreign keys by default; PostgreSQL and MySQL do not."""
    connection = db.session.connection()
    if connection.dialect.name != "sqlite":
        yield
        return
    connection.exec_driver_sql("PRAGMA foreign_keys=ON")
    assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1
    yield
    db.session.rollback()
    db.session.connection().exec_driver_sql("PRAGMA foreign_keys=OFF")


def _make_user(username: str) -> User:
    user = User(
        first_name="Test",
        last_name="User",
        email=f"{username}@example.org",
        username=username,
    )
    db.session.add(user)
    db.session.flush()
    return user


def _count(model: Any, **filters: Any) -> int:
    return db.session.query(model).filter_by(**filters).count()


def _delete(*users: User) -> None:
    UserDAO.delete(list(users))
    db.session.flush()


def _new_query(uid: int) -> Query:
    database = Database(
        database_name=f"db_{uuid.uuid4().hex[:8]}", sqlalchemy_uri="sqlite://"
    )
    db.session.add(database)
    db.session.flush()
    return Query(
        client_id=uuid.uuid4().hex[:11],
        database_id=database.id,
        user_id=uid,
        sql="select 1",
    )


def test_delete_user_without_history(
    enforce_foreign_keys: None,
    after_each: None,  # noqa: F811
) -> None:
    user = _make_user("no_history")
    user_id = user.id

    _delete(user)

    assert _count(User, id=user_id) == 0


# Audit references: the row is kept, the reference to the user is cleared.
@pytest.mark.parametrize(
    "model, column, build",
    [
        (
            KeyValueEntry,
            "created_by_fk",
            lambda uid: KeyValueEntry(resource="t", value=b"x", created_by_fk=uid),
        ),
        (
            KeyValueEntry,
            "changed_by_fk",
            lambda uid: KeyValueEntry(resource="t", value=b"x", changed_by_fk=uid),
        ),
        (Log, "user_id", lambda uid: Log(action="t", user_id=uid)),
        (Query, "user_id", _new_query),
        (
            Slice,
            "last_saved_by_fk",
            lambda uid: Slice(slice_name="t", last_saved_by_fk=uid),
        ),
        (
            Dashboard,
            "created_by_fk",
            lambda uid: Dashboard(dashboard_title="t", created_by_fk=uid),
        ),
        (
            Dashboard,
            "changed_by_fk",
            lambda uid: Dashboard(dashboard_title="t", changed_by_fk=uid),
        ),
    ],
)
def test_delete_user_clears_audit_references(
    model: Any,
    column: str,
    build: Any,
    enforce_foreign_keys: None,
    after_each: None,  # noqa: F811
) -> None:
    user = _make_user(f"audit_{model.__name__}_{column}".lower())
    user_id = user.id
    row = build(user_id)
    db.session.add(row)
    db.session.flush()
    row_id = row.id

    _delete(user)

    assert _count(User, id=user_id) == 0
    db.session.expire_all()
    kept = db.session.get(model, row_id)
    assert kept is not None, "the audit row must survive"
    assert getattr(kept, column) is None


def test_clearing_audit_reference_keeps_other_audit_columns(
    enforce_foreign_keys: None,
    after_each: None,  # noqa: F811
) -> None:
    """Clearing ``created_by`` must not make the row look freshly edited."""
    creator = _make_user("creator_to_delete")
    editor = _make_user("editor_to_keep")
    last_changed = datetime(2020, 1, 2, 3, 4, 5)
    dashboard = Dashboard(
        dashboard_title="t",
        created_by_fk=creator.id,
        changed_by_fk=editor.id,
        changed_on=last_changed,
    )
    db.session.add(dashboard)
    db.session.flush()
    dashboard_id, editor_id = dashboard.id, editor.id

    _delete(creator)

    db.session.expire_all()
    kept = db.session.get(Dashboard, dashboard_id)
    assert kept.created_by_fk is None
    assert kept.changed_by_fk == editor_id
    assert kept.changed_on == last_changed


# Personal state: the user's own rows are deleted with them.
def _add_favstar(uid: int) -> None:
    db.session.add(
        FavStar(user_id=uid, class_name=FavStarClassName.DASHBOARD, obj_id=1)
    )


def _add_tab_state(uid: int) -> None:
    db.session.add(TabState(user_id=uid, label="t"))


def _add_user_attribute(uid: int) -> None:
    db.session.add(UserAttribute(user_id=uid))


def _add_favorite_tag(uid: int) -> None:
    tag = Tag(name=f"tag-{uuid.uuid4().hex[:8]}", type=TagType.custom)
    db.session.add(tag)
    db.session.flush()
    db.session.execute(
        user_favorite_tag_table.insert().values(user_id=uid, tag_id=tag.id)
    )


PERSONAL_STATE_CASES = [
    ("favstar", FavStar, _add_favstar),
    ("tab_state", TabState, _add_tab_state),
    ("user_attribute", UserAttribute, _add_user_attribute),
    ("user_favorite_tag", None, _add_favorite_tag),
]


def _personal_rows(model: Any, uid: int) -> int:
    if model is None:
        return len(
            db.session.execute(
                user_favorite_tag_table.select().where(
                    user_favorite_tag_table.c.user_id == uid
                )
            ).fetchall()
        )
    return _count(model, user_id=uid)


@pytest.mark.parametrize("name, model, add", PERSONAL_STATE_CASES)
def test_delete_user_deletes_personal_state(
    name: str,
    model: Any,
    add: Any,
    enforce_foreign_keys: None,
    after_each: None,  # noqa: F811
) -> None:
    user = _make_user(f"personal_{name}")
    user_id = user.id
    add(user_id)
    db.session.flush()
    assert _personal_rows(model, user_id) == 1

    _delete(user)

    assert _count(User, id=user_id) == 0
    assert _personal_rows(model, user_id) == 0


def test_delete_user_leaves_other_users_rows_alone(
    enforce_foreign_keys: None,
    after_each: None,  # noqa: F811
) -> None:
    doomed = _make_user("doomed")
    other = _make_user("bystander")
    other_id = other.id
    for _name, _model, add in PERSONAL_STATE_CASES:
        add(doomed.id)
        add(other_id)
    other_entry = KeyValueEntry(resource="t", value=b"x", created_by_fk=other_id)
    other_dashboard = Dashboard(dashboard_title="t", created_by_fk=other_id)
    db.session.add_all([other_entry, other_dashboard])
    db.session.flush()
    entry_id, dashboard_id = other_entry.id, other_dashboard.id

    _delete(doomed)

    assert _count(User, id=other_id) == 1
    for _name, model, _add in PERSONAL_STATE_CASES:
        assert _personal_rows(model, other_id) == 1
    db.session.expire_all()
    assert db.session.get(KeyValueEntry, entry_id).created_by_fk == other_id
    assert db.session.get(Dashboard, dashboard_id).created_by_fk == other_id


def test_delete_several_users_in_one_call(
    enforce_foreign_keys: None,
    after_each: None,  # noqa: F811
) -> None:
    users = [_make_user(f"bulk_{i}") for i in range(3)]
    ids = [u.id for u in users]
    for user in users:
        _add_favstar(user.id)
        db.session.add(KeyValueEntry(resource="t", value=b"x", created_by_fk=user.id))
    db.session.flush()

    _delete(*users)

    assert db.session.query(User).filter(User.id.in_(ids)).count() == 0
    assert db.session.query(FavStar).filter(FavStar.user_id.in_(ids)).count() == 0
    assert (
        db.session.query(KeyValueEntry)
        .filter(KeyValueEntry.created_by_fk.in_(ids))
        .count()
        == 0
    )
    assert _count(KeyValueEntry, resource="t") == 3


def test_delete_user_with_saved_query_follows_the_orm_cascade(
    enforce_foreign_keys: None,
    after_each: None,  # noqa: F811
) -> None:
    """Saved queries are not part of the policy yet. This pins what happens
    today: ``User.saved_queries`` cascades, so the ORM deletes them with the
    user. Changing that (e.g. reassigning them) must be a deliberate decision."""
    user = _make_user("saved_query_owner")
    user_id = user.id
    db.session.add(SavedQuery(user_id=user_id, label="t", sql="select 1"))
    db.session.flush()

    _delete(user)

    assert _count(User, id=user_id) == 0
    assert _count(SavedQuery, user_id=user_id) == 0
    assert _count(SavedQuery, label="t") == 0


def test_classified_references_are_handled_even_if_the_model_declares_ondelete(
    monkeypatch: pytest.MonkeyPatch,
    enforce_foreign_keys: None,
    after_each: None,  # noqa: F811
) -> None:
    """A model's ``ondelete`` only says what the model wants. A database built
    by older migrations may lack the rule, so classified references must not
    rely on it."""
    foreign_key = next(iter(KeyValueEntry.__table__.c.created_by_fk.foreign_keys))
    monkeypatch.setattr(foreign_key, "ondelete", "SET NULL")
    user = _make_user("declared_ondelete")
    user_id = user.id
    entry = KeyValueEntry(resource="t", value=b"x", created_by_fk=user_id)
    db.session.add(entry)
    db.session.flush()
    entry_id = entry.id

    _delete(user)

    assert _count(User, id=user_id) == 0
    db.session.expire_all()
    assert db.session.get(KeyValueEntry, entry_id).created_by_fk is None


@pytest.mark.parametrize("column", ["created_by_fk", "changed_by_fk"])
def test_delete_user_that_references_itself(
    column: str,
    enforce_foreign_keys: None,
    after_each: None,  # noqa: F811
) -> None:
    """Existing installs can hold a user whose audit column points at itself."""
    user = _make_user(f"self_ref_dao_{column}")
    user_id = user.id
    setattr(user, column, user_id)
    db.session.flush()

    _delete(user)

    assert _count(User, id=user_id) == 0


def test_release_references_never_commits(
    enforce_foreign_keys: None,
    after_each: None,  # noqa: F811
) -> None:
    """The caller owns the transaction: if the delete fails afterwards, a
    rollback must undo the cleanup too."""
    user = _make_user("never_commits")
    _add_favstar(user.id)
    db.session.add(KeyValueEntry(resource="t", value=b"x", created_by_fk=user.id))
    db.session.flush()

    with patch.object(db.session, "commit") as commit:
        UserDAO.release_references(user)

    assert commit.call_count == 0


def _declares_database_delete_action(foreign_key: ForeignKey) -> bool:
    return (foreign_key.ondelete or "").upper() in {"CASCADE", "SET NULL"}


def test_every_user_reference_is_classified() -> None:
    """
    Adding a table that references the user table needs a decision on what
    happens to its rows when the user is deleted: give the foreign key an
    ``ondelete`` rule, or classify it in ``superset/daos/user.py``.
    """
    unclassified = sorted(
        f"{fk.parent.table.name}.{fk.parent.name}"
        for fk in user_foreign_keys(User.__table__)
        if not _declares_database_delete_action(fk)
        and classify_user_reference(fk.parent.table.name, fk.parent.name) is None
    )
    assert unclassified == []


def _api() -> SupersetUserApi:
    api = SupersetUserApi()
    api.datamodel = SQLAInterface(User, db.session)
    api.appbuilder = SimpleNamespace(
        sm=SimpleNamespace(current_user=SimpleNamespace(id=1))
    )
    return api


def test_user_api_delete_applies_policy(
    enforce_foreign_keys: None,
    after_each: None,  # noqa: F811
) -> None:
    """The Users list calls ``DELETE /api/v1/security/users/<id>``, which runs
    ``SupersetUserApi.pre_delete`` and then FAB's ``datamodel.delete``."""
    user = _make_user("deleted_through_api")
    user_id = user.id
    entry = KeyValueEntry(resource="t", value=b"x", created_by_fk=user_id)
    db.session.add(entry)
    _add_favstar(user_id)
    db.session.flush()
    entry_id = entry.id

    api = _api()
    api.pre_delete(user)
    api.datamodel.delete(user, commit=False)
    db.session.flush()

    assert _count(User, id=user_id) == 0
    assert _count(FavStar, user_id=user_id) == 0
    db.session.expire_all()
    kept = db.session.get(KeyValueEntry, entry_id)
    assert kept is not None
    assert kept.created_by_fk is None


@pytest.mark.parametrize("column", ["created_by_fk", "changed_by_fk"])
def test_user_api_delete_of_user_that_references_itself(
    column: str,
    enforce_foreign_keys: None,
    after_each: None,  # noqa: F811
) -> None:
    user = _make_user(f"self_ref_api_{column}")
    user_id = user.id
    setattr(user, column, user_id)
    db.session.flush()

    api = _api()
    api.pre_delete(user)
    api.datamodel.delete(user, commit=False)
    db.session.flush()

    assert _count(User, id=user_id) == 0
