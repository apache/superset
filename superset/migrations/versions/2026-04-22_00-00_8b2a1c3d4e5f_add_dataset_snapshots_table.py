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
"""add_dataset_snapshots_table

Introduces a purpose-built snapshot table for dataset children
(``TableColumn`` and ``SqlMetric``). Each row stores a point-in-time JSON
snapshot of a dataset's columns and metrics, keyed on the Continuum
``transaction_id`` of the owning ``SqlaTable`` save. This replaces the
Continuum-shadow-table approach for child restoration, which proved
fragile against Superset's ``override_columns=True`` delete+reinsert
pattern.

Revision ID: 8b2a1c3d4e5f
Revises: 56cd24c07170
Create Date: 2026-04-22 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "8b2a1c3d4e5f"
down_revision = "56cd24c07170"


def upgrade() -> None:
    op.create_table(
        "dataset_snapshots",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "dataset_id",
            sa.Integer(),
            sa.ForeignKey("tables.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "transaction_id",
            sa.BigInteger(),
            sa.ForeignKey("version_transaction.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Reserved for future migrations that change the serialization
        # format — readers can dispatch on this to apply a transform.
        sa.Column("snapshot_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("columns_json", sa.JSON(), nullable=False),
        sa.Column("metrics_json", sa.JSON(), nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column(
            "created_by_fk",
            sa.Integer(),
            sa.ForeignKey("ab_user.id"),
            nullable=True,
        ),
        sa.UniqueConstraint(
            "dataset_id",
            "transaction_id",
            name="uq_dataset_snapshots_dataset_tx",
        ),
    )
    op.create_index(
        "ix_dataset_snapshots_dataset_id",
        "dataset_snapshots",
        ["dataset_id"],
    )
    op.create_index(
        "ix_dataset_snapshots_transaction_id",
        "dataset_snapshots",
        ["transaction_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_dataset_snapshots_transaction_id", "dataset_snapshots")
    op.drop_index("ix_dataset_snapshots_dataset_id", "dataset_snapshots")
    op.drop_table("dataset_snapshots")
