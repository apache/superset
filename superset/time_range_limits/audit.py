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
Audit rows for changes of the dashboard and dataset time range limits.

Every committed change of a dashboard's or dataset's ``time_range_limits``
writes one ``Log`` row (Action Log) in the same transaction.
"""

from __future__ import annotations

import logging
from itertools import chain
from typing import Any

from flask import has_request_context, request
from sqlalchemy import event, inspect, select
from sqlalchemy.orm import Session, SessionTransaction

from superset.connectors.sqla.models import SqlaTable
from superset.extensions import feature_flag_manager
from superset.models.core import Log
from superset.models.dashboard import Dashboard
from superset.time_range_limits.policy import (
    FEATURE_FLAG,
    load_level,
    stored_limits,
    TimeRangeLimitsInvalidError,
)
from superset.utils import json
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)

AUDIT_ACTION = "time_range_limits.change"
_PENDING_KEY = "time_range_limits_audit"

_Watched = tuple[str, str, str]
_Pending = dict[int, tuple[Any, _Watched, str | None]]

_WATCHED: dict[type, _Watched] = {
    Dashboard: ("dashboard", "json_metadata", "Dashboard json_metadata"),
    SqlaTable: ("dataset", "extra", "Dataset extra"),
}


def _enabled() -> bool:
    return feature_flag_manager.is_feature_enabled(FEATURE_FLAG)


def _watched(obj: Any) -> _Watched | None:
    for model, watched in _WATCHED.items():
        if isinstance(obj, model):
            return watched
    return None


def _stored_text(session: Session, obj: Any, column: str) -> str | None:
    state = inspect(obj)
    table = state.mapper.local_table
    query = select(table.c[column]).where(table.c.id == state.identity[0])
    return session.connection().execute(query).scalar()


def _before_flush(session: Session, flush_context: Any, instances: Any) -> None:
    if not _enabled():
        return
    pending: _Pending = session.info.setdefault(_PENDING_KEY, {})
    for obj in chain(session.new, session.dirty):
        if id(obj) in pending or (watched := _watched(obj)) is None:
            continue
        if obj in session.new:
            pending[id(obj)] = (obj, watched, None)
            continue
        history = inspect(obj).attrs[watched[1]].history
        if not history.has_changes():
            continue
        if history.deleted:
            old_text = history.deleted[0]
        else:
            # the old value wasn't loaded (e.g. expired), so read the stored one
            old_text = _stored_text(session, obj, watched[1])
        pending[id(obj)] = (obj, watched, old_text)


def _fails_closed(text: str | None, source: str) -> bool:
    try:
        load_level(text, source)
    except TimeRangeLimitsInvalidError:
        return True
    return False


def _audit_row(obj: Any, watched: _Watched, old_text: str | None) -> Log | None:
    level, column, source = watched
    new_text = getattr(obj, column)
    old, new = stored_limits(old_text), stored_limits(new_text)
    old_invalid = _fails_closed(old_text, source)
    if old == new and not (old_invalid and not _fails_closed(new_text, source)):
        return None
    body: dict[str, Any] = {"level": level, f"{level}_id": obj.id, "old": old}
    if old_invalid:
        body["old_invalid"] = True
    body["new"] = new
    body["path"] = request.path if has_request_context() else None
    return Log(
        action=AUDIT_ACTION,
        user_id=get_user_id(),
        dashboard_id=obj.id if level == "dashboard" else None,
        json=json.dumps(body),
    )


def _before_commit(session: Session) -> None:
    if not _enabled():
        return
    session.flush()
    pending: _Pending = session.info.pop(_PENDING_KEY, {})
    for obj, watched, old_text in pending.values():
        try:
            if inspect(obj).deleted:
                continue
            row = _audit_row(obj, watched, old_text)
        except Exception:  # pylint: disable=broad-except
            try:
                logger.exception(
                    "Time range limits: audit row for %s %s not written",
                    watched[0],
                    getattr(obj, "id", None),
                )
            except Exception:  # pylint: disable=broad-except  # noqa: S110
                pass
            continue
        if row is not None:
            session.add(row)


def _after_transaction_end(session: Session, transaction: SessionTransaction) -> None:
    if transaction.parent is None:
        session.info.pop(_PENDING_KEY, None)


_LISTENERS = (
    ("before_flush", _before_flush),
    ("before_commit", _before_commit),
    ("after_transaction_end", _after_transaction_end),
)


def register_audit_listener(session: Any) -> None:
    """Write an audit row for each committed change of the time range limits."""
    for name, listener in _LISTENERS:
        if not event.contains(session, name, listener):
            event.listen(session, name, listener)


def remove_audit_listener(session: Any) -> None:
    for name, listener in _LISTENERS:
        if event.contains(session, name, listener):
            event.remove(session, name, listener)
