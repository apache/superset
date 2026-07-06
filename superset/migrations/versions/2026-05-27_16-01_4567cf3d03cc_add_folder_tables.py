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
"""add folder tables

Revision ID: 4567cf3d03cc
Revises: 33d7e0e21daa
Create Date: 2026-05-27 16:01:44.222914

"""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_index,
    create_table,
    drop_fks_for_table,
    drop_index,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "4567cf3d03cc"
down_revision = "33d7e0e21daa"

FOLDERS_TABLE = "folders"
FOLDER_OBJECTS_TABLE = "folder_objects"
FOLDER_EDITORS_TABLE = "folder_editors"
FOLDER_VIEWERS_TABLE = "folder_viewers"
FOLDER_PINS_TABLE = "folder_pins"


def upgrade():
    # --- folders ---
    create_table(
        FOLDERS_TABLE,
        Column("id", Integer, primary_key=True),
        Column("uuid", UUIDType(binary=True), nullable=False, unique=True),
        Column("name", String(250), nullable=False),
        Column("description", Text, nullable=True),
        Column("parent_id", Integer, nullable=True),
        Column("folder_type", String(50), nullable=False, server_default="analytics"),
        Column("is_private", Boolean, nullable=False, server_default="0"),
        Column("extra", Text, nullable=True),
        Column("created_on", DateTime, nullable=True),
        Column("changed_on", DateTime, nullable=True),
        Column("created_by_fk", Integer, nullable=True),
        Column("changed_by_fk", Integer, nullable=True),
        UniqueConstraint(
            "parent_id", "name", "folder_type", name="uq_folder_parent_name_type"
        ),
    )
    create_index(FOLDERS_TABLE, "idx_folders_uuid", ["uuid"], unique=True)
    create_index(FOLDERS_TABLE, "idx_folders_parent_id", ["parent_id"])
    create_index(FOLDERS_TABLE, "idx_folders_folder_type", ["folder_type"])
    create_fks_for_table(
        foreign_key_name="fk_folders_parent_id_folders",
        table_name=FOLDERS_TABLE,
        referenced_table=FOLDERS_TABLE,
        local_cols=["parent_id"],
        remote_cols=["id"],
    )
    create_fks_for_table(
        foreign_key_name="fk_folders_created_by_fk_ab_user",
        table_name=FOLDERS_TABLE,
        referenced_table="ab_user",
        local_cols=["created_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )
    create_fks_for_table(
        foreign_key_name="fk_folders_changed_by_fk_ab_user",
        table_name=FOLDERS_TABLE,
        referenced_table="ab_user",
        local_cols=["changed_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )

    # --- folder_objects ---
    create_table(
        FOLDER_OBJECTS_TABLE,
        Column("id", Integer, primary_key=True),
        Column("folder_id", Integer, nullable=False),
        Column("dashboard_id", Integer, nullable=True),
        Column("chart_id", Integer, nullable=True),
        Column("dataset_id", Integer, nullable=True),
        Column("created_on", DateTime, nullable=True),
        CheckConstraint(
            "(CASE WHEN dashboard_id IS NOT NULL THEN 1 ELSE 0 END"
            " + CASE WHEN chart_id IS NOT NULL THEN 1 ELSE 0 END"
            " + CASE WHEN dataset_id IS NOT NULL THEN 1 ELSE 0 END) = 1",
            name="ck_folder_objects_exactly_one_fk",
        ),
    )
    create_fks_for_table(
        foreign_key_name="fk_folder_objects_folder_id_folders",
        table_name=FOLDER_OBJECTS_TABLE,
        referenced_table=FOLDERS_TABLE,
        local_cols=["folder_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="fk_folder_objects_dashboard_id_dashboards",
        table_name=FOLDER_OBJECTS_TABLE,
        referenced_table="dashboards",
        local_cols=["dashboard_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="fk_folder_objects_chart_id_slices",
        table_name=FOLDER_OBJECTS_TABLE,
        referenced_table="slices",
        local_cols=["chart_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="fk_folder_objects_dataset_id_tables",
        table_name=FOLDER_OBJECTS_TABLE,
        referenced_table="tables",
        local_cols=["dataset_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_index(
        FOLDER_OBJECTS_TABLE,
        "uq_folder_objects_dashboard",
        ["dashboard_id"],
        unique=True,
    )
    create_index(
        FOLDER_OBJECTS_TABLE, "uq_folder_objects_chart", ["chart_id"], unique=True
    )
    create_index(
        FOLDER_OBJECTS_TABLE, "uq_folder_objects_dataset", ["dataset_id"], unique=True
    )

    # --- folder_editors ---
    create_table(
        FOLDER_EDITORS_TABLE,
        Column("id", Integer, primary_key=True),
        Column("folder_id", Integer, nullable=False),
        Column("user_id", Integer, nullable=False),
        UniqueConstraint("folder_id", "user_id", name="uq_folder_editors_folder_user"),
    )
    create_fks_for_table(
        foreign_key_name="fk_folder_editors_folder_id_folders",
        table_name=FOLDER_EDITORS_TABLE,
        referenced_table=FOLDERS_TABLE,
        local_cols=["folder_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="fk_folder_editors_user_id_ab_user",
        table_name=FOLDER_EDITORS_TABLE,
        referenced_table="ab_user",
        local_cols=["user_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )

    # --- folder_viewers ---
    create_table(
        FOLDER_VIEWERS_TABLE,
        Column("id", Integer, primary_key=True),
        Column("folder_id", Integer, nullable=False),
        Column("user_id", Integer, nullable=False),
        UniqueConstraint("folder_id", "user_id", name="uq_folder_viewers_folder_user"),
    )
    create_fks_for_table(
        foreign_key_name="fk_folder_viewers_folder_id_folders",
        table_name=FOLDER_VIEWERS_TABLE,
        referenced_table=FOLDERS_TABLE,
        local_cols=["folder_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="fk_folder_viewers_user_id_ab_user",
        table_name=FOLDER_VIEWERS_TABLE,
        referenced_table="ab_user",
        local_cols=["user_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )

    # --- folder_pins ---
    create_table(
        FOLDER_PINS_TABLE,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, nullable=False),
        Column("folder_id", Integer, nullable=True),
        Column("dashboard_id", Integer, nullable=True),
        Column("chart_id", Integer, nullable=True),
        Column("position", Integer, nullable=False),
        Column("created_on", DateTime, nullable=True),
        UniqueConstraint("user_id", "position", name="uq_folder_pins_user_position"),
        CheckConstraint(
            "position >= 1 AND position <= 3",
            name="ck_folder_pins_position_range",
        ),
        CheckConstraint(
            "(CASE WHEN folder_id IS NOT NULL THEN 1 ELSE 0 END"
            " + CASE WHEN dashboard_id IS NOT NULL THEN 1 ELSE 0 END"
            " + CASE WHEN chart_id IS NOT NULL THEN 1 ELSE 0 END) = 1",
            name="ck_folder_pins_exactly_one_fk",
        ),
    )
    create_fks_for_table(
        foreign_key_name="fk_folder_pins_user_id_ab_user",
        table_name=FOLDER_PINS_TABLE,
        referenced_table="ab_user",
        local_cols=["user_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="fk_folder_pins_folder_id_folders",
        table_name=FOLDER_PINS_TABLE,
        referenced_table=FOLDERS_TABLE,
        local_cols=["folder_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="fk_folder_pins_dashboard_id_dashboards",
        table_name=FOLDER_PINS_TABLE,
        referenced_table="dashboards",
        local_cols=["dashboard_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="fk_folder_pins_chart_id_slices",
        table_name=FOLDER_PINS_TABLE,
        referenced_table="slices",
        local_cols=["chart_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_index(FOLDER_PINS_TABLE, "idx_folder_pins_user_id", ["user_id"])
    create_index(FOLDER_PINS_TABLE, "ix_folder_pins_folder_id", ["folder_id"])
    create_index(FOLDER_PINS_TABLE, "ix_folder_pins_dashboard_id", ["dashboard_id"])
    create_index(FOLDER_PINS_TABLE, "ix_folder_pins_chart_id", ["chart_id"])


def downgrade():
    drop_index(FOLDER_PINS_TABLE, "ix_folder_pins_chart_id")
    drop_index(FOLDER_PINS_TABLE, "ix_folder_pins_dashboard_id")
    drop_index(FOLDER_PINS_TABLE, "ix_folder_pins_folder_id")
    drop_index(FOLDER_PINS_TABLE, "idx_folder_pins_user_id")
    drop_fks_for_table(
        FOLDER_PINS_TABLE,
        [
            "fk_folder_pins_user_id_ab_user",
            "fk_folder_pins_folder_id_folders",
            "fk_folder_pins_dashboard_id_dashboards",
            "fk_folder_pins_chart_id_slices",
        ],
    )
    drop_table(FOLDER_PINS_TABLE)

    drop_fks_for_table(
        FOLDER_VIEWERS_TABLE,
        ["fk_folder_viewers_folder_id_folders", "fk_folder_viewers_user_id_ab_user"],
    )
    drop_table(FOLDER_VIEWERS_TABLE)

    drop_fks_for_table(
        FOLDER_EDITORS_TABLE,
        ["fk_folder_editors_folder_id_folders", "fk_folder_editors_user_id_ab_user"],
    )
    drop_table(FOLDER_EDITORS_TABLE)

    drop_index(FOLDER_OBJECTS_TABLE, "uq_folder_objects_dashboard")
    drop_index(FOLDER_OBJECTS_TABLE, "uq_folder_objects_chart")
    drop_index(FOLDER_OBJECTS_TABLE, "uq_folder_objects_dataset")
    drop_fks_for_table(
        FOLDER_OBJECTS_TABLE,
        [
            "fk_folder_objects_folder_id_folders",
            "fk_folder_objects_dashboard_id_dashboards",
            "fk_folder_objects_chart_id_slices",
            "fk_folder_objects_dataset_id_tables",
        ],
    )
    drop_table(FOLDER_OBJECTS_TABLE)

    drop_index(FOLDERS_TABLE, "idx_folders_uuid")
    drop_index(FOLDERS_TABLE, "idx_folders_parent_id")
    drop_index(FOLDERS_TABLE, "idx_folders_folder_type")
    drop_fks_for_table(
        FOLDERS_TABLE,
        [
            "fk_folders_parent_id_folders",
            "fk_folders_created_by_fk_ab_user",
            "fk_folders_changed_by_fk_ab_user",
        ],
    )
    drop_table(FOLDERS_TABLE)
