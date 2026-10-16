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
    ACTION_KIND_KEY,
    ACTION_META_KEY,
    INITIAL_STATES_KEY,
)
from superset.versioning.changes.normalization import NORMALIZATION_CONTEXT_KEY
from superset.versioning.unit_of_work import CaptureCheckpoint, CaptureUnitOfWork

_CHECKPOINTS_KEY: str = "_versioning_savepoints"
_STATE_KEYS: tuple[str, ...] = (
    INITIAL_STATES_KEY,
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
    """Look up state without opening a connection or evaluating capture policy.

    Continuum's connection map assumes one application session per connection;
    independent application sessions sharing a connection are not supported.
    """
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
            if key == INITIAL_STATES_KEY
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
    # SQLAlchemy fires after_commit before SessionTransaction.close(), so the
    # nested transaction is still the savepoint being committed here.
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


def _end_transaction(session: Session, transaction: SessionTransaction) -> None:
    """Release closed descendants without losing the pending rollback checkpoint."""
    if transaction.parent is None:
        session.info.pop(_CHECKPOINTS_KEY, None)
        return
    if not transaction.nested:
        return
    checkpoints: dict[SessionTransaction, SavepointCheckpoint] = session.info.get(
        _CHECKPOINTS_KEY, {}
    )
    descendant: SessionTransaction
    for descendant in list(checkpoints):
        ancestor: SessionTransaction | None = descendant.parent
        while ancestor is not None:
            if ancestor is transaction:
                checkpoints.pop(descendant)
                break
            ancestor = ancestor.parent
    # after_soft_rollback runs after this event and still needs this transaction's
    # own checkpoint. Descendants closed by it receive no such rollback event.


def register_savepoint_listeners() -> None:
    """Register idempotent application-session hooks alongside capture listeners."""
    from superset.extensions import db  # pylint: disable=import-outside-toplevel

    if event.contains(db.session, "after_transaction_create", _checkpoint_savepoint):
        return
    event.listen(db.session, "after_transaction_create", _checkpoint_savepoint)
    event.listen(db.session, "after_soft_rollback", _rollback_savepoint)
    event.listen(db.session, "after_commit", _commit_savepoint)
    event.listen(db.session, "after_transaction_end", _end_transaction)
