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
"""Reusable helpers for syncing Subject rows from User/Role/Group models."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import InstrumentedAttribute

from superset.daos.subject import SubjectDAO
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.subjects.utils import get_user_label

logger = logging.getLogger(__name__)


def _fit(value: str | None, column: InstrumentedAttribute[Any]) -> str | None:
    """Truncate ``value`` to the length of a ``Subject`` string column.

    Source fields can be wider than the Subject columns (e.g. FAB allows
    320-char emails and 512-char group descriptions), so values are clipped
    to avoid "value too long" errors on strict databases.
    """
    max_length = getattr(column.type, "length", None)
    if value is None or max_length is None or len(value) <= max_length:
        return value
    return value[:max_length]


def _user_subject_fields(user: Any) -> tuple[str, str | None, str | None]:
    """Compute label, secondary_label, and extra_search for a user Subject."""
    email = getattr(user, "email", None)
    return (
        _fit(get_user_label(user), Subject.label) or "",
        _fit(email, Subject.secondary_label),
        _fit(email, Subject.extra_search),
    )


def sync_user_subject(user: Any) -> None:
    """Create or update the Subject row for a User."""
    if not user or not getattr(user, "id", None):
        return
    subject = SubjectDAO.find_one_or_none(user_id=user.id)
    label, secondary_label, extra_search = _user_subject_fields(user)
    if subject:
        subject.label = label
        subject.secondary_label = secondary_label
        subject.extra_search = extra_search
        subject.active = getattr(user, "active", True)
    else:
        SubjectDAO.create(
            attributes={
                "label": label,
                "secondary_label": secondary_label,
                "extra_search": extra_search,
                "active": getattr(user, "active", True),
                "type": SubjectType.USER,
                "user_id": user.id,
            }
        )
        logger.debug("Created Subject for user %s (id=%s)", user.username, user.id)


def sync_role_subject(role: Any) -> None:
    """Create or update the Subject row for a Role."""
    if not role or not getattr(role, "id", None):
        return
    subject = SubjectDAO.find_one_or_none(role_id=role.id)
    if subject:
        subject.label = role.name
    else:
        SubjectDAO.create(
            attributes={
                "label": role.name,
                "active": True,
                "type": SubjectType.ROLE,
                "role_id": role.id,
            }
        )
        logger.debug("Created Subject for role %s (id=%s)", role.name, role.id)


def _group_subject_fields(group: Any) -> tuple[str, str | None, str | None]:
    """Compute label, secondary_label, and extra_search for a group Subject.

    Rules:
    - Only name provided → label=name, secondary_label=None
    - name + label (different) → label=label, secondary_label=name
    - name + label (identical) → label=label, secondary_label=None
    - name + label + description → label=label, secondary_label=description
    """
    name = group.name
    group_label = getattr(group, "label", None)
    description = getattr(group, "description", None)

    if group_label and group_label != name:
        label = group_label
        if description:
            secondary_label = description
        else:
            secondary_label = name
    else:
        label = name
        secondary_label = description if description else None

    extra_search = name if group_label and group_label != name else None
    return (
        _fit(label, Subject.label) or "",
        _fit(secondary_label, Subject.secondary_label),
        _fit(extra_search, Subject.extra_search),
    )


def sync_group_subject(group: Any) -> None:
    """Create or update the Subject row for a Group."""
    if not group or not getattr(group, "id", None):
        return
    subject = SubjectDAO.find_one_or_none(group_id=group.id)
    label, secondary_label, extra_search = _group_subject_fields(group)
    if subject:
        subject.label = label
        subject.secondary_label = secondary_label
        subject.extra_search = extra_search
    else:
        SubjectDAO.create(
            attributes={
                "label": label,
                "secondary_label": secondary_label,
                "extra_search": extra_search,
                "active": True,
                "type": SubjectType.GROUP,
                "group_id": group.id,
            }
        )
        logger.debug("Created Subject for group %s (id=%s)", group.name, group.id)


def delete_user_subject(user_id: int) -> None:
    """Delete the Subject row for a User."""
    if subject := SubjectDAO.find_one_or_none(user_id=user_id):
        SubjectDAO.delete([subject])
        logger.debug("Deleted Subject for user id=%s", user_id)


def delete_role_subject(role_id: int) -> None:
    """Delete the Subject row for a Role."""
    if subject := SubjectDAO.find_one_or_none(role_id=role_id):
        SubjectDAO.delete([subject])
        logger.debug("Deleted Subject for role id=%s", role_id)


def delete_group_subject(group_id: int) -> None:
    """Delete the Subject row for a Group."""
    if subject := SubjectDAO.find_one_or_none(group_id=group_id):
        SubjectDAO.delete([subject])
        logger.debug("Deleted Subject for group id=%s", group_id)
