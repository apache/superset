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
"""Authentication audit log entries for AUTH_DB flows."""

from __future__ import annotations

from datetime import datetime

from flask_appbuilder import Model
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON

from superset import security_manager


class AuthAuditLog(Model):
    """
    Append-only audit trail for authentication-related events.

    The physical column name ``metadata`` is mapped to ``event_metadata`` because
    ``metadata`` is reserved on SQLAlchemy declarative models.
    """

    __tablename__ = "auth_audit_log"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    event_type = Column(String(64), nullable=False)
    ip_address = Column(String(256), nullable=True)
    user_agent = Column(Text, nullable=True)
    event_metadata = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship(
        security_manager.user_model,
        foreign_keys=[user_id],
    )

    def __repr__(self) -> str:
        return f"<AuthAuditLog id={self.id} event_type={self.event_type!r}>"
