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
"""Runtime capture suppression at Continuum's transaction-scoped write boundary."""

from copy import copy
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy_continuum.operation import Operation, Operations
from sqlalchemy_continuum.unit_of_work import UnitOfWork

from superset.versioning.utils import capture_enabled


@dataclass
class CaptureCheckpoint:
    """Continuum state belonging to the work before a savepoint."""

    transaction: Any
    operations: Operations
    version_objs: dict[Any, Any]
    pending_statements: list[Any]


class CaptureUnitOfWork(UnitOfWork):
    """Keep denied mapper/association operations out of later captured flushes."""

    version_session: Session | None
    current_transaction: Any
    operations: Operations
    version_objs: dict[Any, Any]
    pending_statements: list[Any]

    def reset(self, session: Session | None = None) -> None:
        """Clear the transaction's capture decision with Continuum's state."""
        super().reset(session)
        self._capture_allowed: bool | None = None

    def _capture_enabled(self, session: Session) -> bool:
        """Use one decision for every session sharing this connection's unit."""
        if self._capture_allowed is None:
            self._capture_allowed = capture_enabled(session)
        return self._capture_allowed

    def process_before_flush(self, session: Session) -> None:
        """Decide before Continuum creates its transaction or version session."""
        if session is self.version_session or not self._capture_enabled(session):
            return
        if self.version_session is None and self.is_modified(session):
            self._ensure_version_session(session)
        super().process_before_flush(session)

    def _ensure_version_session(self, session: Session) -> None:
        """Join caller-owned work and reattach surviving cached versions."""
        if self.version_session is None:
            # The application session owns savepoints. Continuum's default
            # conditional_savepoint creates an extra savepoint that outlives
            # its parent when the application rolls that parent back.
            # rollback_only prevents auxiliary commit/close from ending caller
            # work; an auxiliary rollback still rolls back the caller boundary,
            # consistent with the application flush failing as well.
            self.version_session = Session(
                bind=session.connection(), join_transaction_mode="rollback_only"
            )
            self.version_session.add_all(self.version_objs.values())

    def checkpoint(self) -> CaptureCheckpoint:
        """Retain processed operations and identities, not rolled-back values."""
        operations: Operations = Operations()
        key: Any
        operation: Operation
        for key, operation in self.operations.items():
            operations[key] = copy(operation)
        return CaptureCheckpoint(
            self.current_transaction,
            operations,
            dict(self.version_objs),
            list(self.pending_statements),
        )

    def release_version_session(self) -> None:
        """Detach cached versions without committing or rolling back caller work."""
        if self.version_session is not None:
            self.version_session.expire_all()
            self.version_session.close()
            self.version_session = None

    def restore_checkpoint(self, checkpoint: CaptureCheckpoint | None) -> None:
        """Discard savepoint-local state while preserving the capture decision."""
        self.release_version_session()
        self.current_transaction = checkpoint.transaction if checkpoint else None
        self.operations = checkpoint.operations if checkpoint else Operations()
        self.version_objs = checkpoint.version_objs if checkpoint else {}
        self.pending_statements = checkpoint.pending_statements if checkpoint else []

    def process_after_flush(self, session: Session) -> None:
        """Discard denied operations, including relationship-table statements."""
        if session is self.version_session:
            return
        if not self._capture_enabled(session):
            self.operations = Operations()
            self.pending_statements.clear()
            return
        if self.current_transaction is not None:
            self._ensure_version_session(session)
        super().process_after_flush(session)
