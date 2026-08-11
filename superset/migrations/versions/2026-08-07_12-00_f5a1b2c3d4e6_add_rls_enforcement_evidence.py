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
"""add rls_enforcement_evidence

Append-only, governed-data-free audit of row-level-security enforcement
outcomes. Additive: creates one new table with three query indices and no
foreign keys; performs no ALTER on any existing table.

Revision ID: f5a1b2c3d4e6
Revises: e7d93a524ff6
Create Date: 2026-08-07 12:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import (
    create_index,
    create_table,
    drop_index,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "f5a1b2c3d4e6"
down_revision = "e7d93a524ff6"


def upgrade() -> None:
    create_table(
        "rls_enforcement_evidence",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("ts", sa.DateTime(), nullable=False),
        sa.Column("path", sa.String(length=32), nullable=False),
        sa.Column("identity_handle", sa.String(length=128), nullable=False),
        sa.Column("datasource_kind", sa.String(length=16), nullable=False),
        sa.Column("datasource_id", sa.BigInteger(), nullable=True),
        sa.Column("outcome", sa.String(length=8), nullable=False),
        sa.Column(
            "applied_filter_count",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column("denial_class", sa.String(length=24), nullable=True),
        sa.Column("integrity_prev_hash", sa.String(length=64), nullable=True),
        sa.Column("integrity_hash", sa.String(length=64), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    create_index(
        "rls_enforcement_evidence",
        "ix_rls_evidence_ts",
        ["ts"],
    )
    create_index(
        "rls_enforcement_evidence",
        "ix_rls_evidence_identity_ts",
        ["identity_handle", "ts"],
    )
    create_index(
        "rls_enforcement_evidence",
        "ix_rls_evidence_outcome_ts",
        ["outcome", "ts"],
    )


def downgrade() -> None:
    drop_index("rls_enforcement_evidence", "ix_rls_evidence_outcome_ts")
    drop_index("rls_enforcement_evidence", "ix_rls_evidence_identity_ts")
    drop_index("rls_enforcement_evidence", "ix_rls_evidence_ts")
    drop_table("rls_enforcement_evidence")
