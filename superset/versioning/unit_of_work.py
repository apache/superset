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

from sqlalchemy.orm import Session
from sqlalchemy_continuum.operation import Operations
from sqlalchemy_continuum.unit_of_work import UnitOfWork

from superset.versioning.utils import capture_enabled


class CaptureUnitOfWork(UnitOfWork):
    """Keep denied mapper/association operations out of later captured flushes."""

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
        super().process_before_flush(session)

    def process_after_flush(self, session: Session) -> None:
        """Discard denied operations, including relationship-table statements."""
        if session is self.version_session:
            return
        if not self._capture_enabled(session):
            self.operations: Operations = Operations()
            self.pending_statements.clear()
            return
        super().process_after_flush(session)
