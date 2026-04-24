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
"""add_entity_version_history_tables

Create SQLAlchemy-Continuum shadow tables for Dashboards, Charts, Datasets,
TableColumns, and SqlMetrics, plus the version_transaction audit table.
These tables store the full history of changes to each entity using Continuum's
validity strategy: the current version row has end_transaction_id = NULL.

Revision ID: 56cd24c07170
Revises: ce6bd21901ab
Create Date: 2026-04-20 00:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType

revision = "56cd24c07170"
down_revision = "ce6bd21901ab"


def upgrade() -> None:
    bind = op.get_bind()

    # version_transaction — audit log for each versioning event.
    # Continuum emits `nextval('version_transaction_id_seq')` on every INSERT,
    # so the sequence must exist before the table on Postgres. SQLite/MySQL
    # ignore the explicit CREATE SEQUENCE (they auto-increment natively).
    if bind.dialect.name == "postgresql":
        op.execute("CREATE SEQUENCE IF NOT EXISTS version_transaction_id_seq")

    op.create_table(
        "version_transaction",
        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Sequence("version_transaction_id_seq"),
            primary_key=True,
            autoincrement=True,
            nullable=False,
        ),
        sa.Column("issued_at", sa.DateTime(), nullable=True),
        sa.Column("remote_addr", sa.String(50), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
    )

    if bind.dialect.name == "postgresql":
        op.execute(
            "ALTER SEQUENCE version_transaction_id_seq OWNED BY version_transaction.id"
        )

    # dashboards_version
    op.create_table(
        "dashboards_version",
        sa.Column("uuid", UUIDType(binary=True), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("dashboard_title", sa.String(500), nullable=True),
        sa.Column("position_json", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("css", sa.Text(), nullable=True),
        sa.Column("theme_id", sa.Integer(), nullable=True),
        sa.Column("certified_by", sa.Text(), nullable=True),
        sa.Column("certification_details", sa.Text(), nullable=True),
        sa.Column("json_metadata", sa.Text(), nullable=True),
        sa.Column("slug", sa.String(255), nullable=True),
        sa.Column("published", sa.Boolean(), nullable=True),
        sa.Column("is_managed_externally", sa.Boolean(), nullable=True),
        sa.Column("external_url", sa.Text(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("transaction_id", sa.BigInteger(), nullable=False),
        sa.Column("end_transaction_id", sa.BigInteger(), nullable=True),
        sa.Column("operation_type", sa.SmallInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id", "transaction_id"),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["version_transaction.id"],
            name="fk_dashboards_version_transaction_id",
        ),
        sa.ForeignKeyConstraint(
            ["end_transaction_id"],
            ["version_transaction.id"],
            name="fk_dashboards_version_end_transaction_id",
        ),
    )
    op.create_index(
        "ix_dashboards_version_end_transaction_id",
        "dashboards_version",
        ["end_transaction_id"],
    )
    op.create_index(
        "ix_dashboards_version_operation_type",
        "dashboards_version",
        ["operation_type"],
    )
    op.create_index(
        "ix_dashboards_version_transaction_id",
        "dashboards_version",
        ["transaction_id"],
    )

    # slices_version (Charts)
    op.create_table(
        "slices_version",
        sa.Column("uuid", UUIDType(binary=True), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slice_name", sa.String(250), nullable=True),
        sa.Column("datasource_id", sa.Integer(), nullable=True),
        sa.Column("datasource_type", sa.String(200), nullable=True),
        sa.Column("datasource_name", sa.String(2000), nullable=True),
        sa.Column("viz_type", sa.String(250), nullable=True),
        sa.Column("params", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cache_timeout", sa.Integer(), nullable=True),
        sa.Column("perm", sa.String(1000), nullable=True),
        sa.Column("schema_perm", sa.String(1000), nullable=True),
        sa.Column("catalog_perm", sa.String(1000), nullable=True),
        sa.Column("last_saved_at", sa.DateTime(), nullable=True),
        sa.Column("last_saved_by_fk", sa.Integer(), nullable=True),
        sa.Column("certified_by", sa.Text(), nullable=True),
        sa.Column("certification_details", sa.Text(), nullable=True),
        sa.Column("is_managed_externally", sa.Boolean(), nullable=True),
        sa.Column("external_url", sa.Text(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("transaction_id", sa.BigInteger(), nullable=False),
        sa.Column("end_transaction_id", sa.BigInteger(), nullable=True),
        sa.Column("operation_type", sa.SmallInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id", "transaction_id"),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["version_transaction.id"],
            name="fk_slices_version_transaction_id",
        ),
        sa.ForeignKeyConstraint(
            ["end_transaction_id"],
            ["version_transaction.id"],
            name="fk_slices_version_end_transaction_id",
        ),
    )
    op.create_index(
        "ix_slices_version_end_transaction_id",
        "slices_version",
        ["end_transaction_id"],
    )
    op.create_index(
        "ix_slices_version_operation_type",
        "slices_version",
        ["operation_type"],
    )
    op.create_index(
        "ix_slices_version_transaction_id",
        "slices_version",
        ["transaction_id"],
    )

    # tables_version (SqlaTable / Datasets)
    op.create_table(
        "tables_version",
        sa.Column("uuid", UUIDType(binary=True), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("default_endpoint", sa.Text(), nullable=True),
        sa.Column("is_featured", sa.Boolean(), nullable=True),
        sa.Column("filter_select_enabled", sa.Boolean(), nullable=True),
        sa.Column("offset", sa.Integer(), nullable=True),
        sa.Column("cache_timeout", sa.Integer(), nullable=True),
        sa.Column("params", sa.String(1000), nullable=True),
        sa.Column("perm", sa.String(1000), nullable=True),
        sa.Column("schema_perm", sa.String(1000), nullable=True),
        sa.Column("catalog_perm", sa.String(1000), nullable=True),
        sa.Column("is_managed_externally", sa.Boolean(), nullable=True),
        sa.Column("external_url", sa.Text(), nullable=True),
        sa.Column("table_name", sa.String(250), nullable=True),
        sa.Column("main_dttm_col", sa.String(250), nullable=True),
        sa.Column("currency_code_column", sa.String(250), nullable=True),
        sa.Column("database_id", sa.Integer(), nullable=True),
        sa.Column("fetch_values_predicate", sa.Text(), nullable=True),
        sa.Column("schema", sa.String(255), nullable=True),
        sa.Column("catalog", sa.String(256), nullable=True),
        sa.Column("sql", sa.Text(), nullable=True),
        sa.Column("is_sqllab_view", sa.Boolean(), nullable=True),
        sa.Column("template_params", sa.Text(), nullable=True),
        sa.Column("extra", sa.Text(), nullable=True),
        sa.Column("normalize_columns", sa.Boolean(), nullable=True),
        sa.Column("always_filter_main_dttm", sa.Boolean(), nullable=True),
        sa.Column("folders", sa.JSON(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("transaction_id", sa.BigInteger(), nullable=False),
        sa.Column("end_transaction_id", sa.BigInteger(), nullable=True),
        sa.Column("operation_type", sa.SmallInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id", "transaction_id"),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["version_transaction.id"],
            name="fk_tables_version_transaction_id",
        ),
        sa.ForeignKeyConstraint(
            ["end_transaction_id"],
            ["version_transaction.id"],
            name="fk_tables_version_end_transaction_id",
        ),
    )
    op.create_index(
        "ix_tables_version_end_transaction_id",
        "tables_version",
        ["end_transaction_id"],
    )
    op.create_index(
        "ix_tables_version_operation_type",
        "tables_version",
        ["operation_type"],
    )
    op.create_index(
        "ix_tables_version_transaction_id",
        "tables_version",
        ["transaction_id"],
    )

    # table_columns_version (TableColumn)
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

    # sql_metrics_version (SqlMetric)
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


def downgrade() -> None:
    op.drop_table("sql_metrics_version")
    op.drop_table("table_columns_version")
    op.drop_table("tables_version")
    op.drop_table("slices_version")
    op.drop_table("dashboards_version")
    op.drop_table("version_transaction")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP SEQUENCE IF EXISTS version_transaction_id_seq")
