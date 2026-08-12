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
"""Add dynamic_dashboard_configs table

Revision ID: f1a2b3c4d5e6
Revises: b8d2f4a6c901
Create Date: 2026-08-10 12:00:00.000000

"""

from sqlalchemy import Column, DateTime, Integer, Text

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_index,
    create_table,
    drop_fks_for_table,
    drop_index,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "f1a2b3c4d5e6"
down_revision = "2d6ad72e4af6"

TABLE_NAME = "dynamic_dashboard_configs"


def upgrade() -> None:
    create_table(
        TABLE_NAME,
        Column("id", Integer, primary_key=True),
        Column("dashboard_id", Integer, nullable=False),
        Column("template", Text, nullable=False),
        Column("slots", Text, nullable=False, server_default="[]"),
        Column("drill_down_config", Text, nullable=True),
        Column("version", Integer, nullable=False, server_default="1"),
        Column("created_on", DateTime, nullable=True),
        Column("changed_on", DateTime, nullable=True),
        Column("created_by_fk", Integer, nullable=True),
        Column("changed_by_fk", Integer, nullable=True),
    )

    create_index(
        TABLE_NAME,
        "uq_dynamic_dashboard_configs_dashboard_id",
        ["dashboard_id"],
        unique=True,
    )

    create_fks_for_table(
        foreign_key_name="fk_dynamic_dashboard_configs_dashboard_id",
        table_name=TABLE_NAME,
        referenced_table="dashboards",
        local_cols=["dashboard_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )

    create_fks_for_table(
        foreign_key_name="fk_dynamic_dashboard_configs_created_by_fk",
        table_name=TABLE_NAME,
        referenced_table="ab_user",
        local_cols=["created_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )

    create_fks_for_table(
        foreign_key_name="fk_dynamic_dashboard_configs_changed_by_fk",
        table_name=TABLE_NAME,
        referenced_table="ab_user",
        local_cols=["changed_by_fk"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    drop_fks_for_table(
        TABLE_NAME,
        [
            "fk_dynamic_dashboard_configs_dashboard_id",
            "fk_dynamic_dashboard_configs_created_by_fk",
            "fk_dynamic_dashboard_configs_changed_by_fk",
        ],
    )
    drop_index(TABLE_NAME, "uq_dynamic_dashboard_configs_dashboard_id")
    drop_table(TABLE_NAME)
