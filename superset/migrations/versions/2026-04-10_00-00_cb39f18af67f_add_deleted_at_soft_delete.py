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
"""add deleted_at for soft delete

Adds a nullable ``deleted_at`` column and index to the ``slices``,
``dashboards``, and ``tables`` tables to support soft deletion of
charts, dashboards, and datasets (sc-103157).

Revision ID: cb39f18af67f
Revises: ce6bd21901ab
Create Date: 2026-04-10 00:00:00.000000
"""

from sqlalchemy import Column, DateTime

from superset.migrations.shared.utils import (
    add_columns,
    create_index,
    drop_columns,
    drop_index,
)

# revision identifiers, used by Alembic.
revision = "cb39f18af67f"
down_revision = "ce6bd21901ab"

TARGET_TABLES = ("slices", "dashboards", "tables")


def upgrade() -> None:
    for table_name in TARGET_TABLES:
        add_columns(table_name, Column("deleted_at", DateTime(), nullable=True))
        create_index(
            table_name,
            f"ix_{table_name}_deleted_at",
            ["deleted_at"],
        )


def downgrade() -> None:
    for table_name in TARGET_TABLES:
        drop_index(table_name, f"ix_{table_name}_deleted_at")
        drop_columns(table_name, "deleted_at")
