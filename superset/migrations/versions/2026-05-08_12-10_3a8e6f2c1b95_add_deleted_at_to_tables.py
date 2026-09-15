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
"""Add deleted_at column and index to tables for soft-delete.

Adds a nullable ``deleted_at`` column and an index on it to the
``tables`` table to support soft deletion of datasets. Companion to
the ``SoftDeleteMixin`` infrastructure shipped in PR #39977.

Revision ID: 3a8e6f2c1b95
Revises: 7c4a8d09ca37
Create Date: 2026-05-08 12:10:00.000000
"""

from sqlalchemy import Column, DateTime

from superset.migrations.shared.utils import (
    add_columns,
    create_index,
    drop_columns,
    drop_index,
)

# revision identifiers, used by Alembic.
revision = "3a8e6f2c1b95"
# Re-pointed onto the charts soft-delete migration (add_deleted_at_to_slices),
# the current master head, so this stacks linearly rather than forking a
# second head. The two deleted_at additions are independent; ordering is
# arbitrary, only linearity matters.
down_revision = "7c4a8d09ca37"

TABLE_NAME = "tables"
INDEX_NAME = f"ix_{TABLE_NAME}_deleted_at"


def upgrade() -> None:
    """Add the soft-delete column and its supporting index to ``tables``."""
    add_columns(TABLE_NAME, Column("deleted_at", DateTime(), nullable=True))
    create_index(TABLE_NAME, INDEX_NAME, ["deleted_at"])


def downgrade() -> None:
    """Reverse ``upgrade``: drop the index, then the column."""
    drop_index(TABLE_NAME, INDEX_NAME)
    drop_columns(TABLE_NAME, "deleted_at")
