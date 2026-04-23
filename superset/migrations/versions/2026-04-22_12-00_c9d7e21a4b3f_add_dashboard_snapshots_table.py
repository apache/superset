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
"""add_dashboard_snapshots_table

Companion to ``dataset_snapshots``. Captures the set of chart IDs attached
to a dashboard at each Continuum transaction, so that a version restore
can re-attach charts that were later detached. Tags, owners, and roles
are intentionally out of scope for v1 (see ADR-005).

Revision ID: c9d7e21a4b3f
Revises: 8b2a1c3d4e5f
Create Date: 2026-04-22 12:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "c9d7e21a4b3f"
down_revision = "8b2a1c3d4e5f"


def upgrade() -> None:
    op.create_table(
        "dashboard_snapshots",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "dashboard_id",
            sa.Integer(),
            sa.ForeignKey("dashboards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "transaction_id",
            sa.BigInteger(),
            sa.ForeignKey("version_transaction.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("snapshot_version", sa.Integer(), nullable=False, server_default="1"),
        # JSON array of integer slice IDs ordered for stability.
        sa.Column("slice_ids_json", sa.JSON(), nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column(
            "created_by_fk",
            sa.Integer(),
            sa.ForeignKey("ab_user.id"),
            nullable=True,
        ),
        sa.UniqueConstraint(
            "dashboard_id",
            "transaction_id",
            name="uq_dashboard_snapshots_dashboard_tx",
        ),
    )
    op.create_index(
        "ix_dashboard_snapshots_dashboard_id",
        "dashboard_snapshots",
        ["dashboard_id"],
    )
    op.create_index(
        "ix_dashboard_snapshots_transaction_id",
        "dashboard_snapshots",
        ["transaction_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_dashboard_snapshots_transaction_id", "dashboard_snapshots")
    op.drop_index("ix_dashboard_snapshots_dashboard_id", "dashboard_snapshots")
    op.drop_table("dashboard_snapshots")
