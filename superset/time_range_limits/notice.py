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
"""Per-editor acknowledgements of the global time range limits."""

from __future__ import annotations

from typing import Any, TYPE_CHECKING
from uuid import UUID, uuid3

from sqlalchemy.exc import IntegrityError

from superset.extensions import security_manager
from superset.key_value.types import JsonKeyValueCodec, KeyValueResource
from superset.key_value.utils import get_uuid_namespace
from superset.time_range_limits.policy import (
    load_global_limits,
    logger,
    never_longer,
    parse_rule,
    policy_as_dict,
    RULES,
    TimeRangeLimits,
    TimeRangeLimitsInvalidError,
)
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard


def _notice_key(user_id: int) -> UUID:
    return uuid3(get_uuid_namespace("time_range_limits_notice"), str(user_id))


def _acknowledged(value: Any) -> TimeRangeLimits | None:
    """The global policy a notice marker holds, ``None`` when it isn't one."""
    if not isinstance(value, dict) or set(value) != set(RULES):
        return None
    try:
        return TimeRangeLimits(
            **{name: parse_rule(name, value[name], None) for name in RULES}
        )
    except TimeRangeLimitsInvalidError:
        return None


def editor_notice_kind(
    current: TimeRangeLimits | None, acknowledged: TimeRangeLimits | None
) -> str | None:
    """
    ``turned_on`` when the global policy sets a rule and nothing was
    acknowledged; ``tightened`` when a rule it sets was unset in the
    acknowledged policy or can be shorter than the acknowledged one; else
    ``None``.
    """
    rules = [
        (name, rule)
        for name in RULES
        if (rule := getattr(current or TimeRangeLimits(), name)) is not None
    ]
    if not rules:
        return None
    if acknowledged is None:
        return "turned_on"
    for name, rule in rules:
        before = getattr(acknowledged, name)
        if before is None or not never_longer(before, rule):
            return "tightened"
    return None


def _is_dashboard_editor(dashboard: Dashboard, user_id: int) -> bool:
    """
    Whether one of the user's subjects (user, roles, groups) edits the
    dashboard, counting ``EXTRA_EDITORS_RESOLVER`` extras. Unlike
    ``is_editor`` it gives admins no shortcut: an admin is an editor here only
    through a subject the dashboard lists.
    """
    # pylint: disable=import-outside-toplevel
    from superset.security.manager import get_extra_editor_subject_ids
    from superset.subjects.utils import get_user_subject_ids

    editor_ids = {subject.id for subject in dashboard.editors}
    editor_ids.update(get_extra_editor_subject_ids(dashboard))
    return bool(set(get_user_subject_ids(user_id)) & editor_ids)


def editor_notice(
    dashboard: Dashboard, global_limits: TimeRangeLimits | None
) -> dict[str, str] | None:
    """
    The notice the current user gets about the global policy when they edit the
    dashboard; ``None`` for everyone else, and when the marker can't be read.
    """
    from superset.daos.key_value import KeyValueDAO

    if global_limits is None or global_limits == TimeRangeLimits():
        return None
    if security_manager.is_guest_user():
        return None
    user_id = get_user_id()
    if user_id is None or not _is_dashboard_editor(dashboard, user_id):
        return None
    try:
        entry = KeyValueDAO.get_entry(KeyValueResource.APP, _notice_key(user_id))
    except Exception:  # pylint: disable=broad-except
        logger.warning(
            "Time range limits notice of user %s not read",
            user_id,
            exc_info=True,
        )
        return None
    acknowledged = None
    if entry is not None and not entry.is_expired():
        try:
            acknowledged = _acknowledged(JsonKeyValueCodec().decode(entry.value))
        except Exception:  # pylint: disable=broad-except
            acknowledged = None
    kind = editor_notice_kind(global_limits, acknowledged)
    return {"kind": kind} if kind else None


def _already_acknowledged(ex: Exception) -> None:
    if not isinstance(ex, IntegrityError):
        on_error(ex)


@transaction(on_error=_already_acknowledged)
def acknowledge_editor_notice(user_id: int) -> None:
    """
    Store the current global policy as the one ``user_id`` acknowledged. The
    row names no user (its key does), so deleting the user still works. A
    concurrent first acknowledgement that already wrote the row counts as done.
    """
    from superset.daos.key_value import KeyValueDAO

    entry = KeyValueDAO.upsert_entry(
        KeyValueResource.APP,
        policy_as_dict(load_global_limits()),
        JsonKeyValueCodec(),
        _notice_key(user_id),
    )
    entry.created_by_fk = None
    entry.changed_by_fk = None
