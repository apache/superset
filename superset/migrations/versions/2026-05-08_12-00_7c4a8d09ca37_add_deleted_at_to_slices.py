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
"""add deleted_at to slices for soft delete

Adds a nullable ``deleted_at`` column and index to the ``slices`` table
to support soft deletion of charts (sc-103157 / sc-106189). Companion
to the ``SoftDeleteMixin`` infrastructure shipped in sc-106188.

Revision ID: 7c4a8d09ca37
Revises: 33d7e0e21daa
Create Date: 2026-05-08 12:00:00.000000
"""

from sqlalchemy import Column, DateTime

from superset.migrations.shared.utils import (
    add_columns,
    create_index,
    drop_columns,
    drop_index,
)

# revision identifiers, used by Alembic.
revision = "7c4a8d09ca37"
down_revision = "33d7e0e21daa"

TABLE_NAME = "slices"
INDEX_NAME = f"ix_{TABLE_NAME}_deleted_at"


def upgrade() -> None:
    add_columns(TABLE_NAME, Column("deleted_at", DateTime(), nullable=True))
    create_index(TABLE_NAME, INDEX_NAME, ["deleted_at"])


def downgrade() -> None:
    drop_index(TABLE_NAME, INDEX_NAME)
    drop_columns(TABLE_NAME, "deleted_at")
