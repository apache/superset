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
"""create widgets, widget_editors and widget_viewers tables

Revision ID: 06373bc38605
Revises: 884a2115ebd3
Create Date: 2026-10-03 12:00:00.000000

"""

from sqlalchemy import Column, DateTime, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_index,
    create_table,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "06373bc38605"
down_revision = "884a2115ebd3"

WIDGETS_TABLE = "widgets"
SUBJECTS_TABLE = "subjects"
WIDGET_EDITORS = "widget_editors"
WIDGET_VIEWERS = "widget_viewers"


def _create_junction_table(table_name: str) -> None:
    create_table(
        table_name,
        Column("id", Integer, primary_key=True),
        Column("subject_id", Integer, nullable=False),
        Column("widget_id", Integer, nullable=False),
        UniqueConstraint("subject_id", "widget_id"),
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
        foreign_key_name=f"fk_{table_name}_widget_id_widgets",
        table_name=table_name,
        referenced_table=WIDGETS_TABLE,
        local_cols=["widget_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )


def upgrade() -> None:
    create_table(
        WIDGETS_TABLE,
        Column("id", Integer, primary_key=True),
        Column("uuid", UUIDType(binary=True), nullable=False, unique=True),
        Column("widget_type", String(250), nullable=False),
        Column("schema_version", Integer, nullable=False),
        Column("name", String(250), nullable=False),
        Column("description", Text, nullable=True),
        Column("props", JSON, nullable=False),
        Column("revision", Integer, nullable=False),
        # AuditMixinNullable columns
        Column("created_on", DateTime, nullable=True),
        Column("changed_on", DateTime, nullable=True),
        Column("created_by_fk", Integer, nullable=True),
        Column("changed_by_fk", Integer, nullable=True),
    )
    create_index(WIDGETS_TABLE, "idx_widgets_widget_type", ["widget_type"])
    create_fks_for_table(
        foreign_key_name="fk_widgets_created_by_fk_ab_user",
        table_name=WIDGETS_TABLE,
        referenced_table="ab_user",
        local_cols=["created_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )
    create_fks_for_table(
        foreign_key_name="fk_widgets_changed_by_fk_ab_user",
        table_name=WIDGETS_TABLE,
        referenced_table="ab_user",
        local_cols=["changed_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )

    _create_junction_table(WIDGET_EDITORS)
    _create_junction_table(WIDGET_VIEWERS)


def downgrade() -> None:
    drop_table(WIDGET_VIEWERS)
    drop_table(WIDGET_EDITORS)
    drop_table(WIDGETS_TABLE)
