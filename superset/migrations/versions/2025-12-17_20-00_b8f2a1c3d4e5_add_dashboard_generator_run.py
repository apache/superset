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
"""Add dashboard_generator_run table

Revision ID: b8f2a1c3d4e5
Revises: 4a032c8dbc11
Create Date: 2025-12-17 20:00:00.000000

"""

# revision identifiers, used by Alembic.
revision = "b8f2a1c3d4e5"
down_revision = "4a032c8dbc11"

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType


def upgrade():
    # Create dashboard_generator_run table
    op.create_table(
        "dashboard_generator_run",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", UUIDType(binary=True), nullable=False),
        sa.Column("celery_task_id", sa.String(256), nullable=True),
        # Input references
        sa.Column("database_report_id", sa.Integer(), nullable=True),
        sa.Column("template_dashboard_id", sa.Integer(), nullable=True),
        # Output references
        sa.Column("generated_dashboard_id", sa.Integer(), nullable=True),
        sa.Column("generated_dataset_id", sa.Integer(), nullable=True),
        # Status tracking
        sa.Column(
            "status", sa.String(50), server_default="reserved", nullable=False
        ),
        sa.Column("current_phase", sa.String(50), nullable=True),
        # Progress tracking
        sa.Column("progress_json", sa.Text(), nullable=True),
        # Mapping data
        sa.Column("column_mappings_json", sa.Text(), nullable=True),
        sa.Column("metric_mappings_json", sa.Text(), nullable=True),
        # Timing
        sa.Column("reserved_dttm", sa.DateTime(), nullable=True),
        sa.Column("start_dttm", sa.DateTime(), nullable=True),
        sa.Column("end_dttm", sa.DateTime(), nullable=True),
        # Error tracking
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("failed_items_json", sa.Text(), nullable=True),
        # Audit columns
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        # Constraints
        sa.PrimaryKeyConstraint("id", name="pk_dashboard_generator_run"),
        sa.UniqueConstraint("uuid", name="uq_dashboard_generator_run_uuid"),
        sa.UniqueConstraint(
            "celery_task_id", name="uq_dashboard_generator_run_celery_task_id"
        ),
        sa.ForeignKeyConstraint(
            ["database_report_id"],
            ["database_schema_report.id"],
            name="fk_dashboard_generator_run_database_report_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["template_dashboard_id"],
            ["dashboards.id"],
            name="fk_dashboard_generator_run_template_dashboard_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["generated_dashboard_id"],
            ["dashboards.id"],
            name="fk_dashboard_generator_run_generated_dashboard_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["generated_dataset_id"],
            ["tables.id"],
            name="fk_dashboard_generator_run_generated_dataset_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
            name="fk_dashboard_generator_run_created_by_fk",
        ),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
            name="fk_dashboard_generator_run_changed_by_fk",
        ),
        sa.CheckConstraint(
            "status IN ('reserved', 'running', 'completed', 'failed')",
            name="ck_dashboard_generator_run_status",
        ),
        sa.CheckConstraint(
            "current_phase IN ('copy_dashboard', 'build_dataset_charts', "
            "'build_dataset_filters', 'update_charts', 'update_filters', 'finalize') "
            "OR current_phase IS NULL",
            name="ck_dashboard_generator_run_phase",
        ),
    )

    # Create indexes
    op.create_index(
        "ix_dashboard_generator_run_celery_task_id",
        "dashboard_generator_run",
        ["celery_task_id"],
    )
    op.create_index(
        "ix_dashboard_generator_run_status",
        "dashboard_generator_run",
        ["status"],
    )
    op.create_index(
        "ix_dashboard_generator_run_database_report_id",
        "dashboard_generator_run",
        ["database_report_id"],
    )
    op.create_index(
        "ix_dashboard_generator_run_template_dashboard_id",
        "dashboard_generator_run",
        ["template_dashboard_id"],
    )


def downgrade():
    # Drop indexes
    op.drop_index(
        "ix_dashboard_generator_run_template_dashboard_id",
        table_name="dashboard_generator_run",
    )
    op.drop_index(
        "ix_dashboard_generator_run_database_report_id",
        table_name="dashboard_generator_run",
    )
    op.drop_index(
        "ix_dashboard_generator_run_status",
        table_name="dashboard_generator_run",
    )
    op.drop_index(
        "ix_dashboard_generator_run_celery_task_id",
        table_name="dashboard_generator_run",
    )

    # Drop table
    op.drop_table("dashboard_generator_run")
