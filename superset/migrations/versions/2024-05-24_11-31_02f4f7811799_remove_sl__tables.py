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
"""remove sl_ tables

Revision ID: 02f4f7811799
Revises: f7b6750b67e8
Create Date: 2024-05-24 11:31:57.115586

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "02f4f7811799"
down_revision = "f7b6750b67e8"


def upgrade():
    op.drop_table("sl_dataset_columns")
    op.drop_table("sl_table_columns")
    op.drop_table("sl_dataset_tables")
    op.drop_table("sl_columns")
    op.drop_table("sl_tables")
    op.drop_table("sl_dataset_users")
    op.drop_table("sl_datasets")


def downgrade():
    op.create_table(
        "sl_dataset_users",
        sa.Column("dataset_id", sa.INTEGER(), nullable=False),
        sa.Column("user_id", sa.INTEGER(), nullable=False),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["sl_datasets.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["ab_user.id"],
        ),
        sa.PrimaryKeyConstraint("dataset_id", "user_id"),
    )
    op.create_table(
        "sl_datasets",
        sa.Column("uuid", sa.NUMERIC(precision=16), nullable=True),
        sa.Column("created_on", sa.DATETIME(), nullable=True),
        sa.Column("changed_on", sa.DATETIME(), nullable=True),
        sa.Column("id", sa.INTEGER(), nullable=False),
        sa.Column("database_id", sa.INTEGER(), nullable=False),
        sa.Column("is_physical", sa.BOOLEAN(), nullable=True),
        sa.Column("is_managed_externally", sa.BOOLEAN(), nullable=False),
        sa.Column("name", sa.TEXT(), nullable=True),
        sa.Column("expression", sa.TEXT(), nullable=True),
        sa.Column("external_url", sa.TEXT(), nullable=True),
        sa.Column("extra_json", sa.TEXT(), nullable=True),
        sa.Column("created_by_fk", sa.INTEGER(), nullable=True),
        sa.Column("changed_by_fk", sa.INTEGER(), nullable=True),
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
    op.create_table(
        "sl_tables",
        sa.Column("uuid", sa.NUMERIC(precision=16), nullable=True),
        sa.Column("created_on", sa.DATETIME(), nullable=True),
        sa.Column("changed_on", sa.DATETIME(), nullable=True),
        sa.Column("id", sa.INTEGER(), nullable=False),
        sa.Column("database_id", sa.INTEGER(), nullable=False),
        sa.Column("is_managed_externally", sa.BOOLEAN(), nullable=False),
        sa.Column("catalog", sa.TEXT(), nullable=True),
        sa.Column("schema", sa.TEXT(), nullable=True),
        sa.Column("name", sa.TEXT(), nullable=True),
        sa.Column("external_url", sa.TEXT(), nullable=True),
        sa.Column("extra_json", sa.TEXT(), nullable=True),
        sa.Column("created_by_fk", sa.INTEGER(), nullable=True),
        sa.Column("changed_by_fk", sa.INTEGER(), nullable=True),
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
    op.create_table(
        "sl_dataset_columns",
        sa.Column("dataset_id", sa.INTEGER(), nullable=False),
        sa.Column("column_id", sa.INTEGER(), nullable=False),
        sa.ForeignKeyConstraint(
            ["column_id"],
            ["sl_columns.id"],
        ),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["sl_datasets.id"],
        ),
        sa.PrimaryKeyConstraint("dataset_id", "column_id"),
    )
    op.create_table(
        "sl_dataset_tables",
        sa.Column("dataset_id", sa.INTEGER(), nullable=False),
        sa.Column("table_id", sa.INTEGER(), nullable=False),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["sl_datasets.id"],
        ),
        sa.ForeignKeyConstraint(
            ["table_id"],
            ["sl_tables.id"],
        ),
        sa.PrimaryKeyConstraint("dataset_id", "table_id"),
    )
    op.create_table(
        "sl_table_columns",
        sa.Column("table_id", sa.INTEGER(), nullable=False),
        sa.Column("column_id", sa.INTEGER(), nullable=False),
        sa.ForeignKeyConstraint(
            ["column_id"],
            ["sl_columns.id"],
        ),
        sa.ForeignKeyConstraint(
            ["table_id"],
            ["sl_tables.id"],
        ),
        sa.PrimaryKeyConstraint("table_id", "column_id"),
    )
    op.create_table(
        "sl_columns",
        sa.Column("uuid", sa.NUMERIC(precision=16), nullable=True),
        sa.Column("created_on", sa.DATETIME(), nullable=True),
        sa.Column("changed_on", sa.DATETIME(), nullable=True),
        sa.Column("id", sa.INTEGER(), nullable=False),
        sa.Column("is_aggregation", sa.BOOLEAN(), nullable=False),
        sa.Column("is_additive", sa.BOOLEAN(), nullable=False),
        sa.Column("is_dimensional", sa.BOOLEAN(), nullable=False),
        sa.Column("is_filterable", sa.BOOLEAN(), nullable=False),
        sa.Column("is_increase_desired", sa.BOOLEAN(), nullable=False),
        sa.Column("is_managed_externally", sa.BOOLEAN(), nullable=False),
        sa.Column("is_partition", sa.BOOLEAN(), nullable=False),
        sa.Column("is_physical", sa.BOOLEAN(), nullable=False),
        sa.Column("is_temporal", sa.BOOLEAN(), nullable=False),
        sa.Column("is_spatial", sa.BOOLEAN(), nullable=False),
        sa.Column("name", sa.TEXT(), nullable=True),
        sa.Column("type", sa.TEXT(), nullable=True),
        sa.Column("unit", sa.TEXT(), nullable=True),
        sa.Column("expression", sa.TEXT(), nullable=True),
        sa.Column("description", sa.TEXT(), nullable=True),
        sa.Column("warning_text", sa.TEXT(), nullable=True),
        sa.Column("external_url", sa.TEXT(), nullable=True),
        sa.Column("extra_json", sa.TEXT(), nullable=True),
        sa.Column("created_by_fk", sa.INTEGER(), nullable=True),
        sa.Column("changed_by_fk", sa.INTEGER(), nullable=True),
        sa.Column("advanced_data_type", sa.TEXT(), nullable=True),
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
