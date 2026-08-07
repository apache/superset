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
"""The ``purge_audit_log`` table: content-free purge audit records.

The write-ahead audit protocol that populates this table lives in
:mod:`superset.commands.deletion_retention.audit`; the model is defined
here so it registers with ``Model.metadata`` at app init like every other
Superset model (Alembic autogenerate and metadata-driven tooling would
otherwise not see the table). Completed outcomes are immutable; a current
provisional record may be discarded when it is proven redundant.
"""

from uuid import uuid4

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.dialects import mysql
from sqlalchemy_utils import UUIDType

STATUS_PENDING = "pending"
STATUS_CONFIRMED = "confirmed"
STATUS_FAILED = "failed"
STATUS_BLOCKED = "blocked"
#: (13 chars -- the status column is String(16); SQLite does not enforce
#: that, so an over-length value passes locally and fails only on
#: Postgres/MySQL.)
#: Reconciliation found the target durably gone but cannot prove THIS attempt
#: removed it -- a concurrent purge or an unrelated deletion is equally
#: consistent with the evidence. Deliberately distinct from ``confirmed`` so
#: the compliance record never attributes a success it did not witness.
STATUS_TARGET_ABSENT = "target_absent"


class PurgeAuditLog(Model):
    """Content-free provisional record or immutable retained purge outcome."""

    __tablename__ = "purge_audit_log"
    __table_args__ = (
        # Backs reconcile_pending()'s stale-pending scan; mirrors the
        # index created by migration e7d93a524ff6.
        sa.Index("ix_purge_audit_log_status_created_on", "status", "created_on"),
        sa.Index(
            "ix_purge_audit_log_retention_predecessor",
            "entity_uuid",
            "entity_type",
            "trigger",
            "created_on",
        ),
    )

    id = Column(UUIDType(binary=True), primary_key=True, default=uuid4)
    status = Column(String(16), nullable=False, default=STATUS_PENDING)
    trigger = Column(String(16), nullable=False)
    actor = Column(String(256), nullable=False)
    entity_type = Column(String(64), nullable=False)
    entity_uuid = Column(String(36), nullable=True, index=True)
    # Comma-joined UUIDs of charts left dangling / dashboards that lost a join
    # row (force-purge visibility). Free text, content-free.
    affected_referrers = Column(Text, nullable=True)
    removed_dashboard_slices = Column(Integer, nullable=False, default=0)
    created_on = Column(
        DateTime()
        .with_variant(mysql.DATETIME(fsp=6), "mysql")
        .with_variant(mysql.DATETIME(fsp=6), "mariadb"),
        nullable=False,
    )
    confirmed_on = Column(DateTime, nullable=True)
