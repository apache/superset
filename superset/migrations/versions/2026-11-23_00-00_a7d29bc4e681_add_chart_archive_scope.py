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
"""Persist chart archive dashboard membership.

Revision ID: a7d29bc4e681
Revises: dfa683969f48
Create Date: 2026-11-23 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    create_index,
    create_table,
    drop_table,
    has_table,
)

revision = "a7d29bc4e681"
down_revision = "dfa683969f48"


def upgrade() -> None:
    """Create empty scope storage and complete indexes on interrupted upgrades."""
    create_table(
        "version_chart_archive_scope",
        sa.Column("id", UUIDType(binary=True), nullable=False),
        sa.Column("transaction_id", sa.BigInteger, nullable=False),
        sa.Column("chart_id", sa.Integer, nullable=False),
        sa.Column("chart_uuid", UUIDType(binary=True), nullable=False),
        sa.Column("dashboard_id", sa.Integer, nullable=False),
        sa.Column("dashboard_uuid", UUIDType(binary=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["transaction_id"], ["version_transaction.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint(
            "transaction_id",
            "chart_uuid",
            "dashboard_id",
            "dashboard_uuid",
            name="uq_chart_archive_scope_identity",
        ),
    )
    create_index(
        "version_chart_archive_scope",
        "ix_chart_archive_scope_dashboard",
        ["dashboard_id", "dashboard_uuid", "transaction_id"],
    )
    create_index(
        "version_chart_archive_scope",
        "ix_chart_archive_scope_chart",
        ["chart_id", "transaction_id"],
    )


def downgrade() -> None:
    """Remove archive records while preserving content and transaction rows."""
    drop_table("version_chart_archive_scope")
    if has_table("version_changes"):
        changes = sa.table("version_changes", sa.column("kind", sa.String(32)))
        op.get_bind().execute(changes.delete().where(changes.c.kind == "__archive__"))
