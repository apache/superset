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
"""add purge_audit_log

Immutable, content-free audit record for deletion-retention purges. Survives
the entity it names; written write-ahead (pending -> confirmed).

Revision ID: e7d93a524ff6
Revises: d3b9a1f6c204
Create Date: 2026-07-28 09:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    create_index,
    create_table,
    drop_index,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "e7d93a524ff6"
down_revision = "d3b9a1f6c204"


def upgrade() -> None:
    create_table(
        "purge_audit_log",
        sa.Column("id", UUIDType(binary=True), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("trigger", sa.String(length=16), nullable=False),
        sa.Column("actor", sa.String(length=256), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_uuid", sa.String(length=36), nullable=True),
        sa.Column("affected_referrers", sa.Text(), nullable=True),
        sa.Column(
            "removed_dashboard_slices",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column("created_on", sa.DateTime(), nullable=False),
        sa.Column("confirmed_on", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    create_index(
        "purge_audit_log",
        "ix_purge_audit_log_entity_uuid",
        ["entity_uuid"],
    )
    create_index(
        "purge_audit_log",
        "ix_purge_audit_log_status_created_on",
        ["status", "created_on"],
    )
    # Chart purges delete dashboard_slices_version rows by slice_id; the
    # table's PK and existing indexes all lead with other columns, so
    # without this every purged chart full-scans the association shadow
    # history.
    create_index(
        "dashboard_slices_version",
        "ix_dashboard_slices_version_slice_id",
        ["slice_id"],
    )


def downgrade() -> None:
    drop_index("dashboard_slices_version", "ix_dashboard_slices_version_slice_id")
    drop_index("purge_audit_log", "ix_purge_audit_log_status_created_on")
    drop_index("purge_audit_log", "ix_purge_audit_log_entity_uuid")
    drop_table("purge_audit_log")
