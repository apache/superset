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
from __future__ import annotations

import pytest
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.exc import NoResultFound

from superset import db
from superset.daos.user import UserDAO
from superset.extensions import security_manager
from superset.models.user_attributes import UserAttribute
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from tests.unit_tests.fixtures.common import admin_user, after_each  # noqa: F401


def test_get_by_id_found(admin_user: User, after_each: None) -> None:  # noqa: F811
    user = UserDAO.get_by_id(admin_user.id)
    assert user.id == admin_user.id


def test_get_by_id_not_found():
    with pytest.raises(NoResultFound):
        UserDAO.get_by_id(123456)


def test_set_avatar_url_with_existing_attributes(
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    admin_user.extra_attributes = [
        UserAttribute(user_id=admin_user.id, avatar_url="old_url"),
    ]
    db.session.flush()

    new_url = "http://newurl.com"
    UserDAO.set_avatar_url(admin_user, new_url)
    user = UserDAO.get_by_id(admin_user.id)
    assert user.extra_attributes[0].avatar_url == new_url


def test_set_avatar_url_without_existing_attributes(
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    new_url = "http://newurl.com"
    UserDAO.set_avatar_url(admin_user, new_url)

    user = UserDAO.get_by_id(admin_user.id)
    assert len(admin_user.extra_attributes) == 1
    assert user.extra_attributes[0].avatar_url == new_url


def test_get_by_id_custom_user_class(
    monkeypatch: pytest.MonkeyPatch,
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    class CustomUserModel(User):
        __tablename__ = "ab_user"

    monkeypatch.setattr(security_manager, "user_model", CustomUserModel)

    user = UserDAO.get_by_id(admin_user.id)
    assert isinstance(user, CustomUserModel)


def test_create_syncs_subject(after_each: None) -> None:  # noqa: F811
    role = db.session.query(security_manager.role_model).filter_by(name="Admin").one()
    user = UserDAO.create(
        attributes={
            "first_name": "Bob",
            "last_name": "Builder",
            "email": "bob@example.com",
            "username": "bob_builder",
            "roles": [role],
        },
    )
    db.session.flush()

    subject = (
        db.session.query(Subject)
        .filter_by(user_id=user.id, type=SubjectType.USER)
        .one_or_none()
    )
    assert subject is not None
    assert subject.label == "Bob Builder"
    assert subject.secondary_label == "bob@example.com"


def test_update_syncs_subject(
    admin_user: User,  # noqa: F811
    after_each: None,  # noqa: F811
) -> None:
    # Seed a subject for the admin_user first
    UserDAO._sync_subject(admin_user)
    db.session.flush()

    UserDAO.update(item=admin_user, attributes={"first_name": "Updated"})
    db.session.flush()

    subject = (
        db.session.query(Subject)
        .filter_by(user_id=admin_user.id, type=SubjectType.USER)
        .one()
    )
    assert subject.label == "Updated Admin"


def test_delete_removes_subject(after_each: None) -> None:  # noqa: F811
    role = db.session.query(security_manager.role_model).filter_by(name="Admin").one()
    user = UserDAO.create(
        attributes={
            "first_name": "Del",
            "last_name": "Ete",
            "email": "del@example.com",
            "username": "del_ete",
            "roles": [role],
        },
    )
    db.session.flush()
    user_id = user.id

    assert (
        db.session.query(Subject)
        .filter_by(user_id=user_id, type=SubjectType.USER)
        .one_or_none()
    ) is not None

    UserDAO.delete([user])
    db.session.flush()

    assert (
        db.session.query(Subject)
        .filter_by(user_id=user_id, type=SubjectType.USER)
        .one_or_none()
    ) is None
