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
"""new dataset models

Revision ID: b8d3a24d9131
Revises: b92d69a6643c
Create Date: 2021-11-11 16:41:53.266965

"""

from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType

# revision identifiers, used by Alembic.
revision = "b8d3a24d9131"
down_revision = "b92d69a6643c"


def upgrade():
    # Rename old tables from models that will be removed in the near future, so we can
    # reuse the names. NOTE: this requires downtime when upgrading.
    op.rename_table("columns", "druid_columns")
    op.rename_table("tables", "sql_tables")
    op.rename_table("table_columns", "sql_table_columns")

    # Create tables for the new models.
    op.create_table(
        "columns",
        # AuditMixinNullable
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        # ExtraJSONMixin
        sa.Column("extra_json", sa.Text(), nullable=True),
        # ImportExportMixin
        sa.Column("uuid", UUIDType(binary=True), primary_key=False, default=uuid4),
        # Column
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("name", sa.TEXT(), nullable=False),
        sa.Column("type", sa.TEXT(), nullable=False),
        sa.Column("expression", sa.TEXT(), nullable=False),
        sa.Column("description", sa.TEXT(), nullable=True),
        sa.Column("warning_text", sa.TEXT(), nullable=True),
        sa.Column("units", sa.TEXT(), nullable=True),
        sa.Column("is_temporal", sa.BOOLEAN(), nullable=False),
        sa.Column("is_spatial", sa.BOOLEAN(), nullable=False, default=False,),
        sa.Column("is_partition", sa.BOOLEAN(), nullable=False, default=False,),
        sa.Column("is_aggregation", sa.BOOLEAN(), nullable=False, default=False,),
        sa.Column("is_additive", sa.BOOLEAN(), nullable=False, default=False,),
        sa.Column("increase_good", sa.BOOLEAN(), nullable=False, default=True,),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_unique_constraint("uq_columns_uuid", "columns", ["uuid"])

    op.create_table(
        "tables",
        # AuditMixinNullable
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        # ExtraJSONMixin
        sa.Column("extra_json", sa.Text(), nullable=True),
        # ImportExportMixin
        sa.Column("uuid", UUIDType(binary=True), primary_key=False, default=uuid4),
        # Table
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("database_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column("catalog", sa.TEXT(), nullable=True),
        sa.Column("schema", sa.TEXT(), nullable=True),
        sa.Column("name", sa.TEXT(), nullable=False),
        sa.ForeignKeyConstraint(["database_id"], ["dbs.id"], name="tables_ibfk_1"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_unique_constraint("uq_tables_uuid", "tables", ["uuid"])

    op.create_table(
        "table_columns",
        sa.Column("table_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column("column_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(
            ["column_id"], ["columns.id"], name="table_columns_ibfk_2"
        ),
        sa.ForeignKeyConstraint(
            ["table_id"], ["tables.id"], name="table_columns_ibfk_1"
        ),
    )

    op.create_table(
        "datasets",
        # AuditMixinNullable
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        # ExtraJSONMixin
        sa.Column("extra_json", sa.Text(), nullable=True),
        # ImportExportMixin
        sa.Column("uuid", UUIDType(binary=True), primary_key=False, default=uuid4),
        # Dataset
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("name", sa.TEXT(), nullable=False),
        sa.Column("expression", sa.TEXT(), nullable=False),
        sa.Column("is_physical", sa.BOOLEAN(), nullable=False, default=False,),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_unique_constraint("uq_datasets_uuid", "datasets", ["uuid"])

    op.create_table(
        "dataset_columns",
        sa.Column("dataset_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column("column_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(
            ["column_id"], ["columns.id"], name="dataset_columns_ibfk_2"
        ),
        sa.ForeignKeyConstraint(
            ["dataset_id"], ["datasets.id"], name="dataset_columns_ibfk_1"
        ),
    )

    op.create_table(
        "dataset_tables",
        sa.Column("dataset_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column("table_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(
            ["dataset_id"], ["datasets.id"], name="dataset_tables_ibfk_1"
        ),
        sa.ForeignKeyConstraint(
            ["table_id"], ["tables.id"], name="dataset_tables_ibfk_2"
        ),
    )


def downgrade():
    op.drop_table("datasets")
    op.drop_table("tables")
    op.drop_table("dataset_tables")
    op.drop_table("dataset_columns")
    op.drop_table("table_columns")
    op.drop_table("columns")

    op.rename_table("druid_columns", "columns")
    op.rename_table("sql_tables", "tables")
    op.rename_table("sql_table_columns", "table_columns")
