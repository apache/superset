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
"""add report schedules

Revision ID: 49b5a32daba5
Revises: 96e99fb176a0
Create Date: 2020-11-04 11:06:59.249758

"""

# revision identifiers, used by Alembic.
revision = "49b5a32daba5"
down_revision = "96e99fb176a0"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.exc import OperationalError


def upgrade():
    op.create_table(
        "report_schedule",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("context_markdown", sa.Text(), nullable=True),
        sa.Column("active", sa.Boolean(), default=True, nullable=True),
        sa.Column("crontab", sa.String(length=50), nullable=False),
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
    try:
        op.create_unique_constraint(
            "uq_report_schedule_name", "report_schedule", ["name"]
        )
    except Exception:
        # Expected to fail on SQLite
        pass
    op.create_index(
        op.f("ix_report_schedule_active"), "report_schedule", ["active"], unique=False
    )

    op.create_table(
        "report_execution_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scheduled_dttm", sa.DateTime(), nullable=False),
        sa.Column("start_dttm", sa.DateTime(), nullable=True),
        sa.Column("end_dttm", sa.DateTime(), nullable=True),
        sa.Column("value", sa.Float(), nullable=True),
        sa.Column("value_row_json", sa.Text(), nullable=True),
        sa.Column("state", sa.String(length=50), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("report_schedule_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["report_schedule_id"], ["report_schedule.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "report_recipient",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("recipient_config_json", sa.Text(), default="{}", nullable=True),
        sa.Column("report_schedule_id", sa.Integer(), nullable=False),
        # Audit Mixin
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["report_schedule_id"], ["report_schedule.id"]),
        sa.ForeignKeyConstraint(["changed_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["created_by_fk"], ["ab_user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "report_schedule_user",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("report_schedule_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["report_schedule_id"], ["report_schedule.id"],),
        sa.ForeignKeyConstraint(["user_id"], ["ab_user.id"],),
        sa.PrimaryKeyConstraint("id"),
    )


def has_unique_constraint(constraint_name: str, table_name: str) -> bool:
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    unique_constraints = inspector.get_unique_constraints(table_name)
    return constraint_name in {constraint["name"] for constraint in unique_constraints}


def downgrade():
    op.drop_index(op.f("ix_report_schedule_active"), table_name="report_schedule")
    if has_unique_constraint("uq_report_schedule_name", "report_schedule"):
        op.drop_constraint("uq_report_schedule_name", "report_schedule", type_="unique")

    op.drop_table("report_execution_log")
    op.drop_table("report_recipient")
    op.drop_table("report_schedule_user")
    op.drop_table("report_schedule")
