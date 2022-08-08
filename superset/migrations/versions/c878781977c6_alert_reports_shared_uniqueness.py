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
"""alert reports shared uniqueness

Revision ID: c878781977c6
Revises: 73fd22e742ab
Create Date: 2020-12-23 11:34:53.882200

"""

# revision identifiers, used by Alembic.
revision = "c878781977c6"
down_revision = "73fd22e742ab"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.mysql.base import MySQLDialect
from sqlalchemy.dialects.postgresql.base import PGDialect
from sqlalchemy.dialects.sqlite.base import SQLiteDialect
from sqlalchemy.engine.reflection import Inspector

from superset.utils.core import generic_find_uq_constraint_name

report_schedule = sa.Table(
    "report_schedule",
    sa.MetaData(),
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("type", sa.String(length=50), nullable=False),
    sa.Column("name", sa.String(length=150), nullable=False),
    sa.Column("description", sa.Text(), nullable=True),
    sa.Column("context_markdown", sa.Text(), nullable=True),
    sa.Column("active", sa.Boolean(), default=True, nullable=True),
    sa.Column("crontab", sa.String(length=1000), nullable=False),
    sa.Column("sql", sa.Text(), nullable=True),
    sa.Column("chart_id", sa.Integer(), nullable=True),
    sa.Column("dashboard_id", sa.Integer(), nullable=True),
    sa.Column("database_id", sa.Integer(), nullable=True),
    sa.Column("last_eval_dttm", sa.DateTime(), nullable=True),
    sa.Column("last_state", sa.String(length=50), nullable=True),
    sa.Column("last_value", sa.Float(), nullable=True),
    sa.Column("last_value_row_json", sa.Text(), nullable=True),
    sa.Column("validator_type", sa.String(length=100), nullable=True),
    sa.Column("validator_config_json", sa.Text(), default="{}", nullable=True),
    sa.Column("log_retention", sa.Integer(), nullable=True, default=90),
    sa.Column("grace_period", sa.Integer(), nullable=True, default=60 * 60 * 4),
    sa.Column("working_timeout", sa.Integer(), nullable=True, default=60 * 60 * 1),
    # Audit Mixin
    sa.Column("created_on", sa.DateTime(), nullable=True),
    sa.Column("changed_on", sa.DateTime(), nullable=True),
    sa.Column("created_by_fk", sa.Integer(), nullable=True),
    sa.Column("changed_by_fk", sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(["chart_id"], ["slices.id"]),
    sa.ForeignKeyConstraint(["dashboard_id"], ["dashboards.id"]),
    sa.ForeignKeyConstraint(["database_id"], ["dbs.id"]),
    sa.ForeignKeyConstraint(["changed_by_fk"], ["ab_user.id"]),
    sa.ForeignKeyConstraint(["created_by_fk"], ["ab_user.id"]),
    sa.PrimaryKeyConstraint("id"),
)


def upgrade():
    bind = op.get_bind()

    if not isinstance(bind.dialect, SQLiteDialect):
        op.drop_constraint("uq_report_schedule_name", "report_schedule", type_="unique")

        if isinstance(bind.dialect, MySQLDialect):
            op.drop_index(
                op.f("name"),
                table_name="report_schedule",
            )

        if isinstance(bind.dialect, PGDialect):
            op.drop_constraint(
                "report_schedule_name_key", "report_schedule", type_="unique"
            )
        op.create_unique_constraint(
            "uq_report_schedule_name_type", "report_schedule", ["name", "type"]
        )

    else:
        with op.batch_alter_table(
            "report_schedule", copy_from=report_schedule
        ) as batch_op:
            batch_op.create_unique_constraint(
                "uq_report_schedule_name_type", ["name", "type"]
            )


def downgrade():
    pass
