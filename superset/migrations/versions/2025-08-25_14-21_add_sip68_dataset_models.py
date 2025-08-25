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

"""add_sip68_dataset_models

Revision ID: sip68_dataset_models
Revises: c233f5365c9e
Create Date: 2025-08-25 14:21:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql, postgresql

# revision identifiers, used by Alembic.
revision = "sip68_dataset_models"
down_revision = "c233f5365c9e"


def upgrade():
    """Create new dataset models for SIP-68."""
    
    # Create the sip68_tables table
    op.create_table(
        "sip68_tables",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("database_id", sa.Integer(), nullable=False),
        sa.Column("catalog", sa.String(length=256), nullable=True),
        sa.Column("schema", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=250), nullable=False),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["database_id"],
            ["dbs.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )
    
    # Create the sip68_datasets table
    op.create_table(
        "sip68_datasets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=250), nullable=False),
        sa.Column("kind", sa.Enum("PHYSICAL", "VIRTUAL", name="datasetkind"), nullable=False),
        sa.Column("expression", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("default_endpoint", sa.Text(), nullable=True),
        sa.Column("is_featured", sa.Boolean(), nullable=True),
        sa.Column("filter_select_enabled", sa.Boolean(), nullable=True),
        sa.Column("offset", sa.Integer(), nullable=True),
        sa.Column("cache_timeout", sa.Integer(), nullable=True),
        sa.Column("params", sa.Text(), nullable=True),
        sa.Column("extra", sa.Text(), nullable=True),
        sa.Column("main_dttm_col", sa.String(length=250), nullable=True),
        sa.Column("fetch_values_predicate", sa.Text(), nullable=True),
        sa.Column("normalize_columns", sa.Boolean(), nullable=True),
        sa.Column("always_filter_main_dttm", sa.Boolean(), nullable=True),
        sa.Column("sql", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )
    
    # Create the sip68_columns table
    op.create_table(
        "sip68_columns",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=True),
        sa.Column("expression", sa.Text(), nullable=False),
        sa.Column("verbose_name", sa.String(length=1024), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("warning_text", sa.Text(), nullable=True),
        sa.Column("units", sa.String(length=128), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("is_temporal", sa.Boolean(), nullable=True),
        sa.Column("is_spatial", sa.Boolean(), nullable=True),
        sa.Column("is_partition", sa.Boolean(), nullable=True),
        sa.Column("is_aggregation", sa.Boolean(), nullable=True),
        sa.Column("is_additive", sa.Boolean(), nullable=True),
        sa.Column("groupby", sa.Boolean(), nullable=True),
        sa.Column("filterable", sa.Boolean(), nullable=True),
        sa.Column("cardinality", sa.Integer(), nullable=True),
        sa.Column("increase_good", sa.Boolean(), nullable=True),
        sa.Column("d3format", sa.String(length=128), nullable=True),
        sa.Column("currency", sa.JSON(), nullable=True),
        sa.Column("python_date_format", sa.String(length=255), nullable=True),
        sa.Column("advanced_data_type", sa.String(length=255), nullable=True),
        sa.Column("extra", sa.Text(), nullable=True),
        sa.Column("table_id", sa.Integer(), nullable=True),
        sa.Column("dataset_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
        ),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["sip68_datasets.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["table_id"],
            ["sip68_tables.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )
    
    # Create the dataset-table association table
    op.create_table(
        "sip68_dataset_table_association",
        sa.Column("dataset_id", sa.Integer(), nullable=True),
        sa.Column("table_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["sip68_datasets.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["table_id"],
            ["sip68_tables.id"],
            ondelete="CASCADE",
        ),
    )
    
    # Create the dataset-user association table (for owners)
    op.create_table(
        "sip68_dataset_user_association",
        sa.Column("dataset_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["sip68_datasets.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["ab_user.id"],
            ondelete="CASCADE",
        ),
    )
    
    # Create indexes for better performance
    op.create_index(
        "ix_sip68_tables_database_catalog_schema_name",
        "sip68_tables",
        ["database_id", "catalog", "schema", "name"],
        unique=False,
    )
    
    op.create_index(
        "ix_sip68_datasets_name_expression",
        "sip68_datasets",
        ["name", "expression"],
        unique=False,
    )
    
    op.create_index(
        "ix_sip68_columns_table_name",
        "sip68_columns",
        ["table_id", "name"],
        unique=False,
    )
    
    op.create_index(
        "ix_sip68_columns_dataset_name_aggregation",
        "sip68_columns",
        ["dataset_id", "name", "is_aggregation"],
        unique=False,
    )
    
    # Set default values for certain columns
    op.execute("UPDATE sip68_datasets SET is_featured = false WHERE is_featured IS NULL")
    op.execute("UPDATE sip68_datasets SET filter_select_enabled = true WHERE filter_select_enabled IS NULL")
    op.execute('UPDATE sip68_datasets SET "offset" = 0 WHERE "offset" IS NULL')
    op.execute("UPDATE sip68_datasets SET normalize_columns = false WHERE normalize_columns IS NULL")
    op.execute("UPDATE sip68_datasets SET always_filter_main_dttm = false WHERE always_filter_main_dttm IS NULL")
    
    op.execute("UPDATE sip68_columns SET is_active = true WHERE is_active IS NULL")
    op.execute("UPDATE sip68_columns SET is_temporal = false WHERE is_temporal IS NULL")
    op.execute("UPDATE sip68_columns SET is_spatial = false WHERE is_spatial IS NULL")
    op.execute("UPDATE sip68_columns SET is_partition = false WHERE is_partition IS NULL")
    op.execute("UPDATE sip68_columns SET is_aggregation = false WHERE is_aggregation IS NULL")
    op.execute("UPDATE sip68_columns SET is_additive = true WHERE is_additive IS NULL")
    op.execute("UPDATE sip68_columns SET groupby = true WHERE groupby IS NULL")
    op.execute("UPDATE sip68_columns SET filterable = true WHERE filterable IS NULL")
    op.execute("UPDATE sip68_columns SET increase_good = true WHERE increase_good IS NULL")


def downgrade():
    """Drop new dataset models."""
    
    # Drop indexes first
    op.drop_index("ix_sip68_columns_dataset_name_aggregation", table_name="sip68_columns")
    op.drop_index("ix_sip68_columns_table_name", table_name="sip68_columns")
    op.drop_index("ix_sip68_datasets_name_expression", table_name="sip68_datasets")
    op.drop_index("ix_sip68_tables_database_catalog_schema_name", table_name="sip68_tables")
    
    # Drop association tables
    op.drop_table("sip68_dataset_user_association")
    op.drop_table("sip68_dataset_table_association")
    
    # Drop main tables
    op.drop_table("sip68_columns")
    op.drop_table("sip68_datasets")
    op.drop_table("sip68_tables")
    
    # Drop enum type if using PostgreSQL
    try:
        op.execute("DROP TYPE datasetkind")
    except Exception:
        # Ignore errors if not PostgreSQL or type doesn't exist
        pass