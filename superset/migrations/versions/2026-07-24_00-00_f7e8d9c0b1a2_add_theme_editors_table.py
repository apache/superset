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
"""add theme_editors table

Revision ID: f7e8d9c0b1a2
Revises: e5f6a7b8c9d0
Create Date: 2026-07-24 00:00:00.000000

"""

from sqlalchemy import Column, Integer, UniqueConstraint

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_table,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "f7e8d9c0b1a2"
down_revision = "e5f6a7b8c9d0"

SUBJECTS_TABLE = "subjects"
THEME_EDITORS = "theme_editors"


def _create_junction_table(
    table_name: str, resource_col: str, resource_table: str
) -> None:
    create_table(
        table_name,
        Column("id", Integer, primary_key=True),
        Column("subject_id", Integer, nullable=False),
        Column(resource_col, Integer, nullable=False),
        UniqueConstraint("subject_id", resource_col),
    )
    create_fks_for_table(
        foreign_key_name=f"fk_{table_name}_subject_id_subjects",
        table_name=table_name,
        referenced_table=SUBJECTS_TABLE,
        local_cols=["subject_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name=f"fk_{table_name}_{resource_col}_{resource_table}",
        table_name=table_name,
        referenced_table=resource_table,
        local_cols=[resource_col],
        remote_cols=["id"],
        ondelete="CASCADE",
    )


def upgrade() -> None:
    # Themes never had owners, so there is no backfill: the table starts empty
    # and editors are populated going forward by the create/update commands.
    _create_junction_table(THEME_EDITORS, "theme_id", "themes")


def downgrade() -> None:
    drop_table(THEME_EDITORS)
