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

Immutable, content-free audit record for deletion-retention purges
(sc-111185, FR-PURGE-012 / C19). Survives the entity it names; written
write-ahead (pending -> confirmed).

Revision ID: e7d93a524ff6
Revises: a758619edf56
Create Date: 2026-06-23 13:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e7d93a524ff6"
down_revision = "a758619edf56"


def upgrade():
    op.create_table(
        "purge_audit_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("trigger", sa.String(length=16), nullable=False),
        sa.Column("actor", sa.String(length=256), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_uuid", sa.String(length=36), nullable=True),
        sa.Column("affected_referrers", sa.Text(), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=False),
        sa.Column("confirmed_on", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_purge_audit_log_entity_uuid",
        "purge_audit_log",
        ["entity_uuid"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_purge_audit_log_entity_uuid", table_name="purge_audit_log")
    op.drop_table("purge_audit_log")
