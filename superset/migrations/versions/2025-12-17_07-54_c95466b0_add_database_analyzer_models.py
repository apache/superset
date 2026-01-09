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
"""Add database analyzer models

Revision ID: c95466b0
Revises: 
Create Date: 2025-12-17 07:54:00.000000

"""

# revision identifiers, used by Alembic.
revision = "c95466b0"
down_revision = "a9c01ec10479"

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType


def upgrade():
    # Create database_schema_report table
    op.create_table(
        "database_schema_report",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", UUIDType(binary=True), nullable=False),
        sa.Column("database_id", sa.Integer(), nullable=False),
        sa.Column("schema_name", sa.String(256), nullable=False),
        sa.Column("celery_task_id", sa.String(256), nullable=True),
        sa.Column("status", sa.String(50), server_default="reserved", nullable=False),
        sa.Column("reserved_dttm", sa.DateTime(), nullable=True),
        sa.Column("start_dttm", sa.DateTime(), nullable=True),
        sa.Column("end_dttm", sa.DateTime(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("extra_json", sa.Text(), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_database_schema_report"),
        sa.UniqueConstraint("uuid", name="uq_database_schema_report_uuid"),
        sa.UniqueConstraint(
            "database_id",
            "schema_name",
            name="uq_database_schema_report_database_schema",
        ),
        sa.ForeignKeyConstraint(
            ["database_id"],
            ["dbs.id"],
            name="fk_database_schema_report_database_id_dbs",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
            name="fk_database_schema_report_created_by_fk_ab_user",
        ),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
            name="fk_database_schema_report_changed_by_fk_ab_user",
        ),
        sa.CheckConstraint(
            "status IN ('reserved', 'running', 'completed', 'failed')",
            name="ck_database_schema_report_status",
        ),
    )
    
    # Create indexes for database_schema_report
    op.create_index(
        "ix_database_schema_report_database_id",
        "database_schema_report",
        ["database_id"],
    )
    op.create_index(
        "ix_database_schema_report_status",
        "database_schema_report",
        ["status"],
    )
    op.create_index(
        "ix_database_schema_report_celery_task_id",
        "database_schema_report",
        ["celery_task_id"],
    )
    op.create_index(
        "ix_database_schema_report_database_schema",
        "database_schema_report",
        ["database_id", "schema_name"],
    )
    
    # Create analyzed_table table
    op.create_table(
        "analyzed_table",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", UUIDType(binary=True), nullable=False),
        sa.Column("report_id", sa.Integer(), nullable=False),
        sa.Column("table_name", sa.String(256), nullable=False),
        sa.Column("table_type", sa.String(50), nullable=False),
        sa.Column("db_comment", sa.Text(), nullable=True),
        sa.Column("ai_description", sa.Text(), nullable=True),
        sa.Column("extra_json", sa.Text(), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_analyzed_table"),
        sa.UniqueConstraint("uuid", name="uq_analyzed_table_uuid"),
        sa.UniqueConstraint(
            "report_id",
            "table_name",
            name="uq_analyzed_table_report_table",
        ),
        sa.ForeignKeyConstraint(
            ["report_id"],
            ["database_schema_report.id"],
            name="fk_analyzed_table_report_id_database_schema_report",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
            name="fk_analyzed_table_created_by_fk_ab_user",
        ),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
            name="fk_analyzed_table_changed_by_fk_ab_user",
        ),
        sa.CheckConstraint(
            "table_type IN ('table', 'view', 'materialized_view')",
            name="ck_analyzed_table_table_type",
        ),
    )
    
    # Create indexes for analyzed_table
    op.create_index(
        "ix_analyzed_table_report_id",
        "analyzed_table",
        ["report_id"],
    )
    op.create_index(
        "ix_analyzed_table_table_type",
        "analyzed_table",
        ["table_type"],
    )
    op.create_index(
        "ix_analyzed_table_report_type",
        "analyzed_table",
        ["report_id", "table_type"],
    )
    
    # Create analyzed_column table
    op.create_table(
        "analyzed_column",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", UUIDType(binary=True), nullable=False),
        sa.Column("table_id", sa.Integer(), nullable=False),
        sa.Column("column_name", sa.String(256), nullable=False),
        sa.Column("data_type", sa.String(256), nullable=False),
        sa.Column("ordinal_position", sa.Integer(), nullable=False),
        sa.Column("db_comment", sa.Text(), nullable=True),
        sa.Column("ai_description", sa.Text(), nullable=True),
        sa.Column("extra_json", sa.Text(), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_analyzed_column"),
        sa.UniqueConstraint("uuid", name="uq_analyzed_column_uuid"),
        sa.UniqueConstraint(
            "table_id",
            "column_name",
            name="uq_analyzed_column_table_column",
        ),
        sa.ForeignKeyConstraint(
            ["table_id"],
            ["analyzed_table.id"],
            name="fk_analyzed_column_table_id_analyzed_table",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
            name="fk_analyzed_column_created_by_fk_ab_user",
        ),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
            name="fk_analyzed_column_changed_by_fk_ab_user",
        ),
        sa.CheckConstraint(
            "ordinal_position >= 1",
            name="ck_analyzed_column_ordinal_position",
        ),
    )
    
    # Create indexes for analyzed_column
    op.create_index(
        "ix_analyzed_column_table_id",
        "analyzed_column",
        ["table_id"],
    )
    op.create_index(
        "ix_analyzed_column_data_type",
        "analyzed_column",
        ["data_type"],
    )
    op.create_index(
        "ix_analyzed_column_table_position",
        "analyzed_column",
        ["table_id", "ordinal_position"],
    )
    
    # Create inferred_join table
    op.create_table(
        "inferred_join",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", UUIDType(binary=True), nullable=False),
        sa.Column("report_id", sa.Integer(), nullable=False),
        sa.Column("source_table_id", sa.Integer(), nullable=False),
        sa.Column("target_table_id", sa.Integer(), nullable=False),
        sa.Column("source_columns", sa.Text(), nullable=False),
        sa.Column("target_columns", sa.Text(), nullable=False),
        sa.Column("join_type", sa.String(50), server_default="inner", nullable=False),
        sa.Column("cardinality", sa.String(50), nullable=False),
        sa.Column("semantic_context", sa.Text(), nullable=True),
        sa.Column("extra_json", sa.Text(), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_inferred_join"),
        sa.UniqueConstraint("uuid", name="uq_inferred_join_uuid"),
        sa.ForeignKeyConstraint(
            ["report_id"],
            ["database_schema_report.id"],
            name="fk_inferred_join_report_id_database_schema_report",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_table_id"],
            ["analyzed_table.id"],
            name="fk_inferred_join_source_table_id_analyzed_table",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["target_table_id"],
            ["analyzed_table.id"],
            name="fk_inferred_join_target_table_id_analyzed_table",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
            name="fk_inferred_join_created_by_fk_ab_user",
        ),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
            name="fk_inferred_join_changed_by_fk_ab_user",
        ),
        sa.CheckConstraint(
            "join_type IN ('inner', 'left', 'right', 'full', 'cross')",
            name="ck_inferred_join_join_type",
        ),
        sa.CheckConstraint(
            "cardinality IN ('1:1', '1:N', 'N:1', 'N:M')",
            name="ck_inferred_join_cardinality",
        ),
    )
    
    # Create indexes for inferred_join
    op.create_index(
        "ix_inferred_join_report_id",
        "inferred_join",
        ["report_id"],
    )
    op.create_index(
        "ix_inferred_join_source_table_id",
        "inferred_join",
        ["source_table_id"],
    )
    op.create_index(
        "ix_inferred_join_target_table_id",
        "inferred_join",
        ["target_table_id"],
    )
    op.create_index(
        "ix_inferred_join_source_target",
        "inferred_join",
        ["source_table_id", "target_table_id"],
    )
    op.create_index(
        "ix_inferred_join_join_type",
        "inferred_join",
        ["join_type"],
    )


def downgrade():
    # Drop indexes for inferred_join
    op.drop_index("ix_inferred_join_join_type", table_name="inferred_join")
    op.drop_index("ix_inferred_join_source_target", table_name="inferred_join")
    op.drop_index("ix_inferred_join_target_table_id", table_name="inferred_join")
    op.drop_index("ix_inferred_join_source_table_id", table_name="inferred_join")
    op.drop_index("ix_inferred_join_report_id", table_name="inferred_join")
    
    # Drop inferred_join table
    op.drop_table("inferred_join")
    
    # Drop indexes for analyzed_column
    op.drop_index("ix_analyzed_column_table_position", table_name="analyzed_column")
    op.drop_index("ix_analyzed_column_data_type", table_name="analyzed_column")
    op.drop_index("ix_analyzed_column_table_id", table_name="analyzed_column")
    
    # Drop analyzed_column table
    op.drop_table("analyzed_column")
    
    # Drop indexes for analyzed_table
    op.drop_index("ix_analyzed_table_report_type", table_name="analyzed_table")
    op.drop_index("ix_analyzed_table_table_type", table_name="analyzed_table")
    op.drop_index("ix_analyzed_table_report_id", table_name="analyzed_table")
    
    # Drop analyzed_table table
    op.drop_table("analyzed_table")
    
    # Drop indexes for database_schema_report
    op.drop_index("ix_database_schema_report_database_schema", table_name="database_schema_report")
    op.drop_index("ix_database_schema_report_celery_task_id", table_name="database_schema_report")
    op.drop_index("ix_database_schema_report_status", table_name="database_schema_report")
    op.drop_index("ix_database_schema_report_database_id", table_name="database_schema_report")
    
    # Drop database_schema_report table
    op.drop_table("database_schema_report")