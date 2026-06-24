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
"""Per-user stamp used to invalidate browser sessions after password changes."""

from __future__ import annotations

from flask_appbuilder import Model
from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from superset import security_manager


class UserSessionAuthStamp(Model):
    """
    One row per ``ab_user`` holding a stamp copied into the Flask session at login.

    Bumping ``stamp`` invalidates every session that still carries an older value.
    """

    __tablename__ = "user_session_auth_stamp"

    user_id = Column(
        Integer, ForeignKey("ab_user.id", ondelete="CASCADE"), primary_key=True
    )
    stamp = Column(String(36), nullable=False)

    user = relationship(
        security_manager.user_model,
        foreign_keys=[user_id],
    )

    def __repr__(self) -> str:
        return f"<UserSessionAuthStamp user_id={self.user_id}>"
