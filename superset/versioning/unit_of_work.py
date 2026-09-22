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

    def process_before_flush(self, session: Session) -> None:
        """Decide before Continuum creates its transaction or version session."""
        if session is self.version_session or not capture_enabled(session):
            return
        super().process_before_flush(session)

    def process_after_flush(self, session: Session) -> None:
        """Discard denied operations, including relationship-table statements."""
        if session is self.version_session:
            return
        if not capture_enabled(session):
            self.operations: Operations = Operations()
            self.pending_statements.clear()
            return
        super().process_after_flush(session)
