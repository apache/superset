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
"""Rename changed/created_on to changed/created_at

Revision ID: 009439c4ee22
Revises: f80a3b88324b
Create Date: 2020-08-28 09:39:06.541135

"""

# revision identifiers, used by Alembic.
revision = "009439c4ee22"
down_revision = "f80a3b88324b"

from datetime import datetime

import sqlalchemy as sa
from alembic import op


def modify(old: str, new: str) -> None:
    """
    Renames columns, recreates indexes, etc. in relation to renaming the changed_on and
    created_on columns to changed_at and created_at respectively (or vice versa).

    :param old: The old suffix
    :param new: The new suffix
    """

    # Audit mixin tables.
    tables = [
        "access_request",
        "annotation",
        "annotation_layer",
        "clusters",
        "columns",
        "css_templates",
        "dashboard_email_schedules",
        "dashboards",
        "datasources",
        "dbs",
        "metrics",
        "row_level_security_filters",
        "saved_query",
        "slice_email_schedules",
        "slices",
        "sql_metrics",
        "tab_state",
        "table_columns",
        "table_schema",
        "tables",
        "tag",
        "tagged_object",
        "url",
        "user_attribute",
    ]

    for table in tables:
        with op.batch_alter_table(table) as batch_op:
            for prefix in ["changed", "created"]:
                batch_op.alter_column(
                    column_name=f"{prefix}_{old}",
                    existing_nullable=True,
                    existing_server_default=datetime.now,  # Required for MySQL.
                    existing_type=sa.DateTime,
                    new_column_name=f"{prefix}_{new}",
                )

    # Special handling of the query table which utilizes indexes.
    op.drop_index(index_name=op.f(f"ti_user_id_changed_{old}"), table_name="query")

    with op.batch_alter_table("query") as batch_op:
        batch_op.alter_column(
            column_name=f"changed_{old}",
            existing_nullable=True,
            existing_server_default=datetime.now,  # Required for MySQL.
            existing_type=sa.DateTime,
            new_column_name=f"changed_{new}",
        )

    op.create_index(
        index_name=op.f(f"ti_user_id_changed_{new}"),
        table_name="query",
        columns=["user_id", f"changed_{new}"],
    )


def upgrade() -> None:
    modify("on", "at")


def downgrade() -> None:
    modify("at", "on")
