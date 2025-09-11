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
"""fixing audit fk

Revision ID: 763d4b211ec9
Revises: d2424a248d63
Create Date: 2016-03-24 14:13:44.817723

"""

# revision identifiers, used by Alembic.
revision = "763d4b211ec9"
down_revision = "d2424a248d63"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.add_column("metrics", sa.Column("changed_by_fk", sa.Integer(), nullable=True))
    op.add_column("metrics", sa.Column("changed_on", sa.DateTime(), nullable=True))
    op.add_column("metrics", sa.Column("created_by_fk", sa.Integer(), nullable=True))
    op.add_column("metrics", sa.Column("created_on", sa.DateTime(), nullable=True))
    try:
        op.alter_column(
            "columns", "changed_on", existing_type=sa.DATETIME(), nullable=True
        )
        op.alter_column(
            "columns", "created_on", existing_type=sa.DATETIME(), nullable=True
        )
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
        op.create_foreign_key(None, "metrics", "ab_user", ["changed_by_fk"], ["id"])
        op.create_foreign_key(None, "metrics", "ab_user", ["created_by_fk"], ["id"])
    except:  # noqa: E722
        pass


def downgrade():
    op.drop_column("metrics", "created_on")
    op.drop_column("metrics", "created_by_fk")
    op.drop_column("metrics", "changed_on")
    op.drop_column("metrics", "changed_by_fk")
    try:
        op.alter_column(
            "url", "created_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "url", "changed_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "tables", "created_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "tables", "changed_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "table_columns", "created_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "table_columns", "changed_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "sql_metrics", "created_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "sql_metrics", "changed_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "slices", "created_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "slices", "changed_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.drop_constraint(None, "metrics", type_="foreignkey")
        op.drop_constraint(None, "metrics", type_="foreignkey")
        op.alter_column(
            "dbs", "created_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "dbs", "changed_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "datasources", "created_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "datasources", "created_by_fk", existing_type=sa.INTEGER(), nullable=False
        )
        op.alter_column(
            "datasources", "changed_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "datasources", "changed_by_fk", existing_type=sa.INTEGER(), nullable=False
        )
        op.alter_column(
            "dashboards", "created_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "dashboards", "changed_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "css_templates", "created_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "css_templates", "changed_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "columns", "created_on", existing_type=sa.DATETIME(), nullable=False
        )
        op.alter_column(
            "columns", "changed_on", existing_type=sa.DATETIME(), nullable=False
        )
    except:  # noqa: E722
        pass
