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
"""Who may approve a change.

SOW 5.4: any *other* editor of the asset may approve it, given access, edit
permission for that asset type, and the approval permission. The submitter
may not, and neither may anyone who touched the draft.

Visa Q1 / SOW 9.3: **no admin bypass in V1**. An administrator who is not an
editor of the asset cannot approve it. That is why nothing here calls
``security_manager.is_editor``, which returns ``True`` for admins
unconditionally -- using it would hand every admin an approval right the
customer explicitly refused. :func:`is_strict_editor` mirrors that method's
subject-intersection logic and omits only the administrator shortcut.
"""

from __future__ import annotations

import logging
from typing import Any

from flask_appbuilder.security.sqla.models import Role, User
from sqlalchemy import or_

from superset import db, security_manager
from asset_approval.models import ChangeRequest
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType

logger = logging.getLogger(__name__)

#: The permission that separates approving from editing (SOW 5.4, S-05).
#: FAB creates it from ``ChangeRequestRestApi.method_permission_name``, which
#: maps ``approve`` and ``request_changes`` to it and leaves ``submit``,
#: ``withdraw`` and ``discard`` on ``can_write``.
APPROVAL_PERMISSION = ("can_approve", "ChangeRequest")

#: Config key naming the roles whose members are service accounts. Superset
#: has no notion of a machine user, so the instance names one: whichever role
#: it puts its service accounts in. Empty by default, which is the behaviour
#: this had before (SOW 5.4, S-07).
MACHINE_USER_ROLES_CONFIG = "ASSET_APPROVAL_MACHINE_USER_ROLES"


def machine_user_roles() -> set[str]:
    """Role names whose members may never approve anything."""
    from flask import current_app  # pylint: disable=import-outside-toplevel

    try:
        configured = current_app.config.get(MACHINE_USER_ROLES_CONFIG) or []
    except RuntimeError:
        # No application context: a CLI or a worker that never reaches an
        # approval anyway. Treat it as unconfigured rather than failing.
        return set()
    return {str(name).strip() for name in configured if str(name).strip()}


def is_eligible_approver(user: Any) -> bool:
    """Whether this account may ever be an approver, whatever the asset.

    Two properties of the account itself: it has to be active, and it must
    not be a service account.

    Shared by the list the request dialog shows and the check the approve
    route makes, which used to disagree. ``active`` was filtered out of the
    list and not out of the check, so a deactivated editor never appeared as
    an option yet could still approve through the API (S-07).
    """
    # A null column is not active; see ``only_eligible_accounts``.
    if not getattr(user, "active", True):
        return False
    machine_roles = machine_user_roles()
    if not machine_roles:
        return True
    return not any(
        role.name in machine_roles for role in getattr(user, "roles", []) or []
    )


def load_user(user_id: int) -> Any | None:
    """The user, from the request where that is who is asking.

    ``can_approve`` is called for the current user on every path today, so
    the common case costs nothing. It still takes a user id rather than a
    user, because the question "could this person approve" is also asked
    about other people.
    """
    from superset.extensions import (  # pylint: disable=import-outside-toplevel
        security_manager,
    )

    user = security_manager.current_user
    if user is not None and getattr(user, "id", None) == user_id:
        return user
    return security_manager.get_user_by_id(user_id)


def holds_approval_permission(user_id: int) -> bool:
    """Whether this user's roles carry the approval right at all.

    The REST routes enforce this themselves, through the permission mapping.
    It is re-checked here because the same answer drives the UI: a role
    without the right must not be told that a change "needs your review",
    offered an Approve button, or counted in the bell. What the API
    advertises and what it would allow have to come from one place.

    Fails open on one case only -- the permission not existing yet, on an
    instance that has not run ``superset init`` since this shipped. There
    every role keeps exactly the approval rights it had before the
    permission was introduced, rather than the feature quietly stopping.
    """
    from superset.extensions import (  # pylint: disable=import-outside-toplevel
        security_manager,
    )

    pvm = security_manager.find_permission_view_menu(*APPROVAL_PERMISSION)
    if pvm is None:
        return True
    role_ids = {role.id for role in pvm.role}
    if not role_ids:
        return False
    user = load_user(user_id)
    if user is None:
        return False
    return bool(role_ids & {role.id for role in user.roles})


def asset_editor_subject_ids(model: Any) -> set[int]:
    """The subject ids granted editorship of this asset."""
    from superset.security.manager import (  # pylint: disable=import-outside-toplevel
        get_extra_editor_subject_ids,
    )

    subject_ids = set(get_extra_editor_subject_ids(model))
    if hasattr(model, "editors"):
        subject_ids.update(s.id for s in model.editors)
    return subject_ids


def is_strict_editor(model: Any, user_id: int) -> bool:
    """Is this user an editor of this asset *on the merits*?

    No administrator shortcut and no guest path: a guest token principal is
    never an editor for approval purposes, whatever roles it carries.
    """
    from superset.subjects.utils import (  # pylint: disable=import-outside-toplevel
        get_user_subject_ids,
    )

    user_subject_ids = set(get_user_subject_ids(user_id))
    if not user_subject_ids:
        return False
    return bool(user_subject_ids & asset_editor_subject_ids(model))


def can_approve(
    change_request: ChangeRequest, model: Any, user_id: int | None
) -> bool:
    """Whether this user may approve this specific change request."""
    if user_id is None:
        return False
    if security_manager.is_guest_user():
        return False
    # The submitter can never approve their own change (SOW 5.4). This is
    # the separation of duties the whole feature exists for, so it is
    # checked before anything else and is not overridable.
    if change_request.author_fk == user_id:
        return False
    # Then what is true of the account itself, whatever the asset: active,
    # not a service account (S-07), and holding the approval right the
    # operator granted (S-05).
    user = load_user(user_id)
    if user is None or not is_eligible_approver(user):
        return False
    if not holds_approval_permission(user_id):
        return False
    return is_strict_editor(model, user_id)


def eligible_approvers(model: Any, exclude_user_id: int | None = None) -> list[User]:
    """Users who could approve a change to this asset.

    Used for two things the SOW asks for: naming who can approve in the
    request dialog, and warning the author when the answer is nobody
    (SOW 5.4 -- never auto-approve, offer to add an editor instead).

    Editorship may be granted to a user, a role or a group, so all three
    are expanded to the users they stand for.
    """
    subject_ids = asset_editor_subject_ids(model)
    if not subject_ids:
        return []

    subjects = db.session.query(Subject).filter(Subject.id.in_(subject_ids)).all()
    user_ids = {s.user_id for s in subjects if s.type == SubjectType.USER and s.user_id}
    role_ids = {s.role_id for s in subjects if s.type == SubjectType.ROLE and s.role_id}
    group_ids = {
        s.group_id for s in subjects if s.type == SubjectType.GROUP and s.group_id
    }

    clauses = []
    if user_ids:
        clauses.append(User.id.in_(user_ids))
    if role_ids:
        clauses.append(User.roles.any(Role.id.in_(role_ids)))
    if group_ids and hasattr(User, "groups"):
        # Group membership is only expandable where this FAB build models
        # it; without it, group-granted editorship still *works* at approval
        # time (is_strict_editor intersects subject ids directly), it simply
        # cannot be listed ahead of time.
        clauses.append(User.groups.any(id_in_groups(group_ids)))

    if not clauses:
        return []

    query = db.session.query(User).filter(or_(*clauses))
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)
    return only_eligible_accounts(query).all()


def only_eligible_accounts(query: Any) -> Any:
    """:func:`is_eligible_approver` as a filter on a ``User`` query.

    The same two conditions, expressed in SQL so the work happens in the
    database and so the list and the check cannot answer differently.

    A ``NULL`` ``active`` is not active. FAB writes the column when it
    creates an account, so a null is a row that came from somewhere else,
    and an approval right is the wrong place to guess in the account's
    favour. It is also what the Python predicate already said.
    """
    query = query.filter(User.active.is_(True))
    machine_roles = machine_user_roles()
    if machine_roles:
        query = query.filter(~User.roles.any(Role.name.in_(machine_roles)))
    return query


def id_in_groups(group_ids: set[int]) -> Any:
    """``Group.id IN (...)`` built lazily, so a FAB without Groups imports."""
    from flask_appbuilder.security.sqla.models import (  # pylint: disable=import-outside-toplevel
        Group,
    )

    return Group.id.in_(group_ids)
