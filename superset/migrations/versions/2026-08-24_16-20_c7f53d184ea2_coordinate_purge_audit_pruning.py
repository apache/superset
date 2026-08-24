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
"""Coordinate purge-audit writes with pruning.

Revision ID: c7f53d184ea2
Revises: a6c21e5b4d93
Create Date: 2026-08-24 16:20:00.000000

"""

from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import create_table, drop_table

revision: str = "c7f53d184ea2"
down_revision: str = "a6c21e5b4d93"

_TABLE_NAME: str = "purge_audit_coordination"
_SENTINEL_ID: UUID = UUID("a9d42a96-60ba-4bbc-b8e3-f01066f325a1")


def upgrade() -> None:
    """Create and seed the singleton audit/pruning coordination row."""
    create_table(
        _TABLE_NAME,
        sa.Column("id", UUIDType(binary=True), primary_key=True),
        sa.Column("lock_version", sa.Integer(), nullable=False),
    )
    coordination_table: sa.TableClause = sa.table(
        _TABLE_NAME,
        sa.column("id", UUIDType(binary=True)),
        sa.column("lock_version", sa.Integer()),
    )
    op.bulk_insert(
        coordination_table,
        [{"id": _SENTINEL_ID, "lock_version": 0}],
    )


def downgrade() -> None:
    """Remove the audit/pruning coordination row and table."""
    drop_table(_TABLE_NAME)
