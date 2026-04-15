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

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from flask_appbuilder.security.sqla.models import Role, User

from sqlalchemy import select, union_all

from superset import db
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType

if TYPE_CHECKING:
    from flask_appbuilder.security.sqla.models import User
    from sqlalchemy.sql import CompoundSelect


def get_user_subject_ids_subquery(user_id: int) -> CompoundSelect:
    """Return a SQLAlchemy Select of all Subject IDs for a user (not executed).

    Includes:
    1. The user's own USER-type subject
    2. ROLE-type subjects for all roles the user has
    3. GROUP-type subjects for all groups the user belongs to
    """
    from flask_appbuilder.security.sqla.models import (
        assoc_user_group,
        assoc_user_role,
    )

    user_subj = select(Subject.id).where(Subject.user_id == user_id)

    role_subj = (
        select(Subject.id)
        .join(
            assoc_user_role,
            Subject.role_id == assoc_user_role.c.role_id,
        )
        .where(assoc_user_role.c.user_id == user_id)
    )

    group_subj = (
        select(Subject.id)
        .join(
            assoc_user_group,
            Subject.group_id == assoc_user_group.c.group_id,
        )
        .where(assoc_user_group.c.user_id == user_id)
    )

    return union_all(user_subj, role_subj, group_subj)


def get_user_subject_ids(user_id: int) -> list[int]:
    """Return all Subject IDs that a user represents.

    Includes:
    1. The user's own USER-type subject
    2. ROLE-type subjects for all roles the user has
    3. GROUP-type subjects for all groups the user belongs to
    """
    result = db.session.execute(get_user_subject_ids_subquery(user_id))
    return [row[0] for row in result]


def get_user_subject(user_id: int) -> Subject | None:
    """Get the USER-type Subject for a given user ID."""
    return (
        db.session.query(Subject)
        .filter_by(
            user_id=user_id,
            type=SubjectType.USER,
        )
        .first()
    )


def get_subject(id_: int) -> Subject | None:
    """Look up a Subject by its primary key."""
    return db.session.get(Subject, id_)


def subjects_from_owners(users: list[User | int]) -> list[Subject]:
    """Convert a list of User objects or user IDs to user-type Subjects.

    Bridges the legacy ``owners`` to the Subject model.
    Accepts both User objects and plain integer IDs for flexibility
    (API schemas pass IDs, application code passes User objects).
    Silently skips users without a matching Subject row.
    """
    subjects = []
    for user in users:
        user_id = user if isinstance(user, int) else user.id
        subj = get_user_subject(user_id)
        if subj:
            subjects.append(subj)
    return subjects


def subjects_from_roles(roles: list[Role | int]) -> list[Subject]:
    """Convert a list of Role objects or role IDs to role-type Subjects.

    Bridges the legacy ``roles`` to the Subject model.
    Accepts both Role objects and plain integer IDs.
    Silently skips roles without a matching Subject row.
    """
    subjects = []
    for role in roles:
        role_id = role if isinstance(role, int) else role.id
        subj = (
            db.session.query(Subject)
            .filter_by(role_id=role_id, type=SubjectType.ROLE)
            .first()
        )
        if subj:
            subjects.append(subj)
    return subjects


def get_user_label(user: User) -> str:
    """Return 'First Last' display name, falling back to username."""
    first = getattr(user, "first_name", None) or ""
    last = getattr(user, "last_name", None) or ""
    full = f"{first} {last}".strip()
    return full or user.username
