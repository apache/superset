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
"""Keep in-memory history bookkeeping aligned with application savepoints."""

from copy import copy, deepcopy
from dataclasses import dataclass
from typing import Any

from sqlalchemy import event
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session, SessionTransaction
from sqlalchemy_continuum import versioning_manager

from superset.versioning.changes.listener import (
    _INITIAL_STATES_KEY,
    ACTION_KIND_KEY,
    ACTION_META_KEY,
)
from superset.versioning.changes.normalization import NORMALIZATION_CONTEXT_KEY
from superset.versioning.unit_of_work import CaptureCheckpoint, CaptureUnitOfWork

_CHECKPOINTS_KEY: str = "_versioning_savepoints"
_STATE_KEYS: tuple[str, ...] = (
    _INITIAL_STATES_KEY,
    ACTION_KIND_KEY,
    ACTION_META_KEY,
    NORMALIZATION_CONTEXT_KEY,
)


@dataclass
class SavepointCheckpoint:
    """Capture state present when the application opens a savepoint."""

    unit: CaptureCheckpoint | None
    info: dict[str, Any]


def _existing_unit(session: Session) -> CaptureUnitOfWork | None:
    """Look up state without opening a connection or evaluating capture policy."""
    connection: Connection | None = versioning_manager.session_connection_map.get(
        session
    )
    unit: Any = versioning_manager.units_of_work.get(connection)
    return unit if isinstance(unit, CaptureUnitOfWork) else None


def _checkpoint_savepoint(session: Session, transaction: SessionTransaction) -> None:
    """Snapshot history intent after the mandatory pre-savepoint flush."""
    if not transaction.nested:
        return
    unit: CaptureUnitOfWork | None = _existing_unit(session)
    checkpoints: dict[SessionTransaction, SavepointCheckpoint] = (
        session.info.setdefault(_CHECKPOINTS_KEY, {})
    )
    checkpoints[transaction] = SavepointCheckpoint(
        unit.checkpoint() if unit else None,
        {
            key: copy(session.info[key])
            if key == _INITIAL_STATES_KEY
            else deepcopy(session.info[key])
            for key in _STATE_KEYS
            if key in session.info
        },
    )


def _rollback_savepoint(session: Session, transaction: SessionTransaction) -> None:
    """Restore pre-savepoint state after SQLAlchemy restores live ORM objects."""
    checkpoints: dict[SessionTransaction, SavepointCheckpoint] = session.info.get(
        _CHECKPOINTS_KEY, {}
    )
    checkpoint: SavepointCheckpoint | None = checkpoints.pop(transaction, None)
    if checkpoint is None:
        return
    unit: CaptureUnitOfWork | None = _existing_unit(session)
    if unit is not None:
        unit.restore_checkpoint(checkpoint.unit)
    for key in _STATE_KEYS:
        session.info.pop(key, None)
    session.info.update(checkpoint.info)


def _commit_savepoint(session: Session) -> None:
    """Keep successful nested history, dropping only the rollback checkpoint."""
    transaction: SessionTransaction | None = session.get_nested_transaction()
    if transaction is None:
        return
    checkpoints: dict[SessionTransaction, SavepointCheckpoint] = session.info.get(
        _CHECKPOINTS_KEY, {}
    )
    checkpoints.pop(transaction, None)
    unit: CaptureUnitOfWork | None = _existing_unit(session)
    if unit is not None:
        unit.release_version_session()


def _end_outer_transaction(session: Session, transaction: SessionTransaction) -> None:
    """Release checkpoints even when a caller closes an unfinished session."""
    if transaction.parent is None:
        session.info.pop(_CHECKPOINTS_KEY, None)


def register_savepoint_listeners() -> None:
    """Register idempotent application-session hooks alongside capture listeners."""
    from superset.extensions import db  # pylint: disable=import-outside-toplevel

    if event.contains(db.session, "after_transaction_create", _checkpoint_savepoint):
        return
    event.listen(db.session, "after_transaction_create", _checkpoint_savepoint)
    event.listen(db.session, "after_soft_rollback", _rollback_savepoint)
    event.listen(db.session, "after_commit", _commit_savepoint)
    event.listen(db.session, "after_transaction_end", _end_outer_transaction)
