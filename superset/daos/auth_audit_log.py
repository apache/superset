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
"""DAO for authentication audit log rows."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from superset.extensions import db
from superset.models.auth_audit_log import AuthAuditLog


class AuthAuditLogDAO:
    """Persist authentication audit events."""

    @staticmethod
    def create(
        *,
        event_type: str,
        user_id: int | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> AuthAuditLog:
        """
        Insert an audit row and flush so ``id`` is populated.

        The caller is responsible for committing the surrounding transaction.
        """
        entry = AuthAuditLog(
            user_id=user_id,
            event_type=event_type,
            ip_address=ip_address,
            user_agent=user_agent,
            event_metadata=metadata,
            created_at=datetime.utcnow(),
        )
        db.session.add(entry)
        db.session.flush()
        return entry
