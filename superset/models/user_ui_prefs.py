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
from __future__ import annotations

from flask_appbuilder import Model
from sqlalchemy import Column, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import relationship

from superset import security_manager
from superset.models.helpers import AuditMixinNullable


class UserUiPref(Model, AuditMixinNullable):
    """Per-user UI preference keyed by a short string identifier."""

    __tablename__ = "user_ui_prefs"
    __table_args__ = (UniqueConstraint("user_id", "key", name="uq_user_ui_prefs_user_key"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("ab_user.id", ondelete="CASCADE"), nullable=False)
    user = relationship(
        security_manager.user_model,
        foreign_keys=[user_id],
    )
    key = Column(String(64), nullable=False)
    value = Column(JSON, nullable=False)
