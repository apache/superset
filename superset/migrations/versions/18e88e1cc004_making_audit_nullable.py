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
"""making audit nullable

Revision ID: 18e88e1cc004
Revises: 430039611635
Create Date: 2016-03-13 21:30:24.833107

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "18e88e1cc004"
down_revision = "430039611635"


def upgrade():
    try:
        op.alter_column(
            "clusters", "changed_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.alter_column(
            "clusters", "created_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.drop_constraint(None, "columns", type_="foreignkey")
        op.drop_constraint(None, "columns", type_="foreignkey")
        op.drop_column("columns", "created_on")
        op.drop_column("columns", "created_by_fk")
        op.drop_column("columns", "changed_on")
        op.drop_column("columns", "changed_by_fk")
        op.alter_column(
            "css_templates", "changed_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.alter_column(
            "css_templates", "created_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.alter_column(
            "dashboards", "changed_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.alter_column(
            "dashboards", "created_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.create_unique_constraint(None, "dashboards", ["slug"])
        op.alter_column(
            "datasources", "changed_by_fk", existing_type=sa.INTEGER(), nullable=True
        )
        op.alter_column(
            "datasources", "changed_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.alter_column(
            "datasources", "created_by_fk", existing_type=sa.INTEGER(), nullable=True
        )
        op.alter_column(
            "datasources", "created_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.alter_column("dbs", "changed_on", existing_type=sa.DATETIME(), nullable=True)
        op.alter_column("dbs", "created_on", existing_type=sa.DATETIME(), nullable=True)
        op.alter_column(
            "slices", "changed_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.alter_column(
            "slices", "created_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.alter_column(
            "sql_metrics", "changed_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.alter_column(
            "sql_metrics", "created_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.alter_column(
            "table_columns", "changed_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.alter_column(
            "table_columns", "created_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.alter_column(
            "tables", "changed_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.alter_column(
            "tables", "created_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.alter_column("url", "changed_on", existing_type=sa.DATETIME(), nullable=True)
        op.alter_column("url", "created_on", existing_type=sa.DATETIME(), nullable=True)
    except Exception:
        pass


def downgrade():
    pass
