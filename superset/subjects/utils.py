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
    from flask_appbuilder.security.sqla.models import Group, Role, User
    from sqlalchemy.sql import CompoundSelect, Select

from flask import has_app_context
from sqlalchemy import select, union_all

from superset import db
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType


def get_user_subject_ids_subquery(user_id: int) -> CompoundSelect:
    """Return a SQLAlchemy Select of all Subject IDs for a user (not executed).

    Includes:
    1. The user's own USER-type subject
    2. ROLE-type subjects for all direct and group-derived roles the user has
    3. GROUP-type subjects for all groups the user belongs to
    """
    from flask_appbuilder.security.sqla.models import (
        assoc_group_role,
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

    group_role_subj = (
        select(Subject.id)
        .join(
            assoc_group_role,
            Subject.role_id == assoc_group_role.c.role_id,
        )
        .join(
            assoc_user_group,
            assoc_group_role.c.group_id == assoc_user_group.c.group_id,
        )
        .where(assoc_user_group.c.user_id == user_id)
    )

    return union_all(user_subj, role_subj, group_subj, group_role_subj)


def get_user_group_subject_ids_subquery(user_id: int) -> Select:
    """Return a Select of GROUP-type Subject IDs for a user's groups.

    Unlike :func:`get_user_subject_ids_subquery` this covers group membership
    only — it excludes the user's own subject and any roles.
    """
    from flask_appbuilder.security.sqla.models import assoc_user_group

    return (
        select(Subject.id)
        .join(assoc_user_group, Subject.group_id == assoc_user_group.c.group_id)
        .where(
            assoc_user_group.c.user_id == user_id,
            Subject.type == SubjectType.GROUP,
        )
    )


def get_user_group_subjects(user_id: int) -> list[Subject]:
    """Return the GROUP-type Subjects for every group a user belongs to.

    Any group whose Subject row is missing is backfilled on demand (see
    :func:`get_or_create_group_subject`) rather than skipped: a single viewer
    disables an asset's datasource-access fallback, so a partial viewer set
    would silently lock out the members of an unsynced group.
    """
    from flask_appbuilder.security.sqla.models import assoc_user_group

    subjects = (
        db.session.query(Subject)
        .filter(Subject.id.in_(get_user_group_subject_ids_subquery(user_id)))
        .all()
    )
    member_group_ids = {
        row[0]
        for row in db.session.execute(
            select(assoc_user_group.c.group_id).where(
                assoc_user_group.c.user_id == user_id
            )
        )
    }
    for group_id in member_group_ids - {subject.group_id for subject in subjects}:
        if subject := get_or_create_group_subject(group_id):
            subjects.append(subject)
    return subjects


def _assigns_creator_groups_as_viewers() -> bool:
    from superset import is_feature_enabled

    # Also requires ENABLE_VIEWERS. ``raise_for_access`` enforces any non-empty
    # ``viewers`` relationship regardless of that flag (a viewer list removes the
    # datasource fallback), so assigning viewers while the viewers feature is off
    # would silently restrict new assets to their editors/viewers.
    return (
        has_app_context()
        and is_feature_enabled("ENABLE_VIEWERS")
        and is_feature_enabled("ASSIGN_CREATOR_GROUPS_AS_VIEWERS")
    )


def get_default_viewers_for_new_asset(user_id: int | None) -> list[Subject]:
    """Return the viewers a newly created asset should default to.

    The single place deciding how a creator's group membership propagates to a
    new asset, so the paths that build assets outside the create commands
    (save-as, importers, MCP tools) stay consistent with them. Empty unless
    ``ASSIGN_CREATOR_GROUPS_AS_VIEWERS`` is enabled.

    Only assets with a ``viewers`` relationship apply — datasets have editors
    only. Callers inside a flush event use
    :func:`get_default_viewers_for_groups` instead.
    """
    if user_id is None or not _assigns_creator_groups_as_viewers():
        return []
    return get_user_group_subjects(user_id)


def get_default_viewers_for_groups(groups: list[Group]) -> list[Subject]:
    """Like :func:`get_default_viewers_for_new_asset`, for in-memory groups.

    Callers inside a SQLAlchemy flush event cannot resolve membership by
    querying ``ab_user_group``: for a user being inserted, the association rows
    are written *after* the user's own INSERT, so the query returns nothing.
    Those callers already hold the group objects on the instance and pass them
    here instead.

    Resolution is all-or-nothing: if any group lacks a Subject row (an unsynced
    group is a real deployment state — see the ``superset sync-subjects`` CLI),
    the whole result is discarded and ``[]`` returned. A *partial* viewer set
    would switch off the asset's datasource-access fallback
    (``security_manager.raise_for_access``) while granting the unsynced group's
    members nothing, locking them out; no viewers keeps the fallback intact and
    is strictly safer. On-demand backfill isn't an option here — this runs in a
    flush event, where :func:`get_or_create_group_subject`'s flush is unsafe.
    """
    if not groups or not _assigns_creator_groups_as_viewers():
        return []
    subjects = subjects_from_groups(groups)
    if {subject.group_id for subject in subjects} != {group.id for group in groups}:
        return []
    return subjects


def get_default_viewers_for_current_user() -> list[Subject]:
    """Default viewers for the acting user, resolved once for bulk callers.

    The v1 importers create many assets in a single request; resolving the
    creator's groups once here and passing the result down avoids one
    membership query per imported asset. Mirrors the ``user = get_user()``
    lookup the importers do internally, so the result is identical to letting
    each call resolve it. Returns ``[]`` when there is no request user.
    """
    from superset.utils.core import get_user

    user = get_user()
    return get_default_viewers_for_new_asset(user.id) if user else []


def get_user_subject_ids(user_id: int) -> list[int]:
    """Return all Subject IDs that a user represents.

    Includes:
    1. The user's own USER-type subject
    2. ROLE-type subjects for all direct and group-derived roles the user has
    3. GROUP-type subjects for all groups the user belongs to
    """
    result = db.session.execute(get_user_subject_ids_subquery(user_id))
    return [row[0] for row in result]


def get_current_user_subject_ids() -> list[int]:
    """Return Subject IDs represented by the current request principal."""
    from flask import g

    from superset.utils.core import get_user_id

    user = getattr(g, "user", None)
    if getattr(user, "is_guest_user", False):
        return [
            subject.id for subject in subjects_from_roles(getattr(user, "roles", []))
        ]

    user_id = get_user_id()
    return get_user_subject_ids(user_id) if user_id else []


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


def get_or_create_user_subject(user_id: int) -> Subject | None:
    """Get or create the USER-type Subject for a given user ID."""
    if subject := get_user_subject(user_id):
        return subject

    from superset import security_manager
    from superset.subjects.sync import sync_user_subject

    user = db.session.get(security_manager.user_model, user_id)
    if not user:
        return None

    sync_user_subject(user)
    db.session.flush()
    return get_user_subject(user_id)


def get_subject(id_: int) -> Subject | None:
    """Look up a Subject by its primary key."""
    return db.session.get(Subject, id_)


def get_role_subject(role_id: int) -> Subject | None:
    """Get the ROLE-type Subject for a given role ID."""
    return (
        db.session.query(Subject)
        .filter_by(
            role_id=role_id,
            type=SubjectType.ROLE,
        )
        .first()
    )


def get_or_create_role_subject(role_id: int) -> Subject | None:
    """Get or create the ROLE-type Subject for a given role ID.

    Mirrors ``get_or_create_user_subject``: a role that exists but has no
    Subject row yet (e.g. created before the sync hooks were installed and
    not yet backfilled) is synced on demand rather than treated as
    nonexistent. Returns ``None`` only when no such role exists.
    """
    if subject := get_role_subject(role_id):
        return subject

    from superset import security_manager
    from superset.subjects.sync import sync_role_subject

    role = db.session.get(security_manager.role_model, role_id)
    if not role:
        return None

    sync_role_subject(role)
    db.session.flush()
    return get_role_subject(role_id)


def get_group_subject(group_id: int) -> Subject | None:
    """Get the GROUP-type Subject for a given group ID."""
    return (
        db.session.query(Subject)
        .filter_by(
            group_id=group_id,
            type=SubjectType.GROUP,
        )
        .first()
    )


def get_or_create_group_subject(group_id: int) -> Subject | None:
    """Get or create the GROUP-type Subject for a given group ID.

    Mirrors ``get_or_create_role_subject``: a group that exists but has no
    Subject row yet (e.g. created before the sync hooks were installed and not
    yet backfilled) is synced on demand rather than skipped. Returns ``None``
    only when no such group exists.

    The insert runs inside a SAVEPOINT. ``Subject.group_id`` is unique, so a
    concurrent request backfilling the same group would otherwise fail this
    flush with an ``IntegrityError`` and poison the surrounding transaction. On
    that conflict the savepoint rolls back and the row the other request wrote
    is reloaded. Any ``IntegrityError`` that did *not* leave a matching row is
    re-raised rather than swallowed — it isn't the expected unique-key race, so
    masking it would silently drop the group from the resulting viewer set.

    Unrelated pending work is flushed *before* the SAVEPOINT, so entering it
    doesn't flush the caller's other objects into the ``except`` below where an
    unrelated integrity failure could be mistaken for this group's conflict.
    """
    if subject := get_group_subject(group_id):
        return subject

    from sqlalchemy.exc import IntegrityError

    from superset import security_manager
    from superset.subjects.sync import sync_group_subject

    group = db.session.get(security_manager.group_model, group_id)
    if not group:
        return None

    # Surface any unrelated pending failure here, outside the SAVEPOINT, so the
    # savepoint's own flush carries only the Subject insert and the ``except``
    # sees only this group's uniqueness conflict.
    db.session.flush()
    try:
        with db.session.begin_nested():
            sync_group_subject(group)
    except IntegrityError:
        if subject := get_group_subject(group_id):
            return subject
        raise
    return get_group_subject(group_id)


def subjects_from_groups(groups: list[Group | int]) -> list[Subject]:
    """Convert a list of Group objects or group IDs to GROUP-type Subjects.

    Mirrors :func:`subjects_from_roles`, but resolves the whole list in one
    query rather than one per group. Groups without a matching Subject row are
    omitted from the result; the viewer-defaulting caller
    (:func:`get_default_viewers_for_groups`) detects that shortfall and discards
    the partial result rather than applying it, so no partial viewer set leaks
    out. On-demand backfill happens instead in :func:`get_user_group_subjects`,
    the path that does not run inside a flush event.
    """
    group_ids = [group if isinstance(group, int) else group.id for group in groups]
    if not group_ids:
        return []
    return (
        db.session.query(Subject)
        .filter(
            Subject.group_id.in_(group_ids),
            Subject.type == SubjectType.GROUP,
        )
        .all()
    )


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
