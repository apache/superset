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
"""drop orphaned child version tables

Removes ``table_columns_version`` and ``sql_metrics_version``. These
were created by the initial version-history migration
(``56cd24c07170``) to version ``TableColumn`` and ``SqlMetric`` via
SQLAlchemy-Continuum's shadow-table strategy. That strategy proved
fragile against ``DatasetDAO.update``'s override-columns pattern
(delete-and-reinsert creates overlapping validity intervals); child
versioning was migrated to the JSON ``dataset_snapshots`` table in
migration ``8b2a1c3d4e5f`` (see ADR-004). Since that pivot these two
shadow tables have been unused dead weight — not written to and not
read from. This migration drops them.

The ``downgrade`` recreates them with the original schema so Alembic's
round-trip remains clean. They will be empty after downgrade, which is
consistent with their current post-migration state anyway (they are
never written to on ``head``).

Revision ID: d8e9f0a1b2c3
Revises: c9d7e21a4b3f
Create Date: 2026-04-23 16:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType

revision = "d8e9f0a1b2c3"
down_revision = "c9d7e21a4b3f"


def upgrade() -> None:
    op.drop_index(
        "ix_sql_metrics_version_transaction_id",
        table_name="sql_metrics_version",
    )
    op.drop_index(
        "ix_sql_metrics_version_operation_type",
        table_name="sql_metrics_version",
    )
    op.drop_index(
        "ix_sql_metrics_version_end_transaction_id",
        table_name="sql_metrics_version",
    )
    op.drop_table("sql_metrics_version")

    op.drop_index(
        "ix_table_columns_version_transaction_id",
        table_name="table_columns_version",
    )
    op.drop_index(
        "ix_table_columns_version_operation_type",
        table_name="table_columns_version",
    )
    op.drop_index(
        "ix_table_columns_version_end_transaction_id",
        table_name="table_columns_version",
    )
    op.drop_table("table_columns_version")


def downgrade() -> None:
    # Schema is identical to the definitions in migration 56cd24c07170
    # (``add_entity_version_history_tables``). Recreated here so the
    # migration is fully reversible; downgraded rows will be empty,
    # matching the table's effective state on head.
    op.create_table(
        "table_columns_version",
        sa.Column("uuid", UUIDType(binary=True), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("column_name", sa.String(255), nullable=True),
        sa.Column("verbose_name", sa.String(1024), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("type", sa.Text(), nullable=True),
        sa.Column("advanced_data_type", sa.String(255), nullable=True),
        sa.Column("groupby", sa.Boolean(), nullable=True),
        sa.Column("filterable", sa.Boolean(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("table_id", sa.Integer(), nullable=True),
        sa.Column("is_dttm", sa.Boolean(), nullable=True),
        sa.Column("expression", sa.Text(), nullable=True),
        sa.Column("python_date_format", sa.String(255), nullable=True),
        sa.Column("datetime_format", sa.String(100), nullable=True),
        sa.Column("extra", sa.Text(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("transaction_id", sa.BigInteger(), nullable=False),
        sa.Column("end_transaction_id", sa.BigInteger(), nullable=True),
        sa.Column("operation_type", sa.SmallInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id", "transaction_id"),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["version_transaction.id"],
            name="fk_table_columns_version_transaction_id",
        ),
        sa.ForeignKeyConstraint(
            ["end_transaction_id"],
            ["version_transaction.id"],
            name="fk_table_columns_version_end_transaction_id",
        ),
    )
    op.create_index(
        "ix_table_columns_version_end_transaction_id",
        "table_columns_version",
        ["end_transaction_id"],
    )
    op.create_index(
        "ix_table_columns_version_operation_type",
        "table_columns_version",
        ["operation_type"],
    )
    op.create_index(
        "ix_table_columns_version_transaction_id",
        "table_columns_version",
        ["transaction_id"],
    )

    op.create_table(
        "sql_metrics_version",
        sa.Column("uuid", UUIDType(binary=True), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("metric_name", sa.String(255), nullable=True),
        sa.Column("verbose_name", sa.String(1024), nullable=True),
        sa.Column("metric_type", sa.String(32), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("d3format", sa.String(128), nullable=True),
        sa.Column("currency", sa.JSON(), nullable=True),
        sa.Column("warning_text", sa.Text(), nullable=True),
        sa.Column("table_id", sa.Integer(), nullable=True),
        sa.Column("expression", sa.Text(), nullable=True),
        sa.Column("extra", sa.Text(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("transaction_id", sa.BigInteger(), nullable=False),
        sa.Column("end_transaction_id", sa.BigInteger(), nullable=True),
        sa.Column("operation_type", sa.SmallInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id", "transaction_id"),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["version_transaction.id"],
            name="fk_sql_metrics_version_transaction_id",
        ),
        sa.ForeignKeyConstraint(
            ["end_transaction_id"],
            ["version_transaction.id"],
            name="fk_sql_metrics_version_end_transaction_id",
        ),
    )
    op.create_index(
        "ix_sql_metrics_version_end_transaction_id",
        "sql_metrics_version",
        ["end_transaction_id"],
    )
    op.create_index(
        "ix_sql_metrics_version_operation_type",
        "sql_metrics_version",
        ["operation_type"],
    )
    op.create_index(
        "ix_sql_metrics_version_transaction_id",
        "sql_metrics_version",
        ["transaction_id"],
    )
