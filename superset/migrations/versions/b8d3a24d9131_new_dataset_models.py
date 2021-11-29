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
Revises: aea15018d53b
Create Date: 2021-11-11 16:41:53.266965

"""

from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType

from superset import db
from superset.connectors.sqla.models import SqlaTable

# revision identifiers, used by Alembic.
revision = "b8d3a24d9131"
down_revision = "aea15018d53b"


def upgrade():
    # Create tables for the new models.
    op.create_table(
        "sl_columns",
        # AuditMixinNullable
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        # ExtraJSONMixin
        sa.Column("extra_json", sa.Text(), nullable=True),
        # ImportExportMixin
        sa.Column("uuid", UUIDType(binary=True), primary_key=False, default=uuid4),
        # Column
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("name", sa.TEXT(), nullable=False),
        sa.Column("type", sa.TEXT(), nullable=False),
        sa.Column("expression", sa.TEXT(), nullable=False),
        sa.Column("is_physical", sa.BOOLEAN(), nullable=False, default=True,),
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
    with op.batch_alter_table("sl_columns") as batch_op:
        batch_op.create_unique_constraint("uq_sl_columns_uuid", ["uuid"])

    op.create_table(
        "sl_tables",
        # AuditMixinNullable
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
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
        sa.ForeignKeyConstraint(["database_id"], ["dbs.id"], name="sl_tables_ibfk_1"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("sl_tables") as batch_op:
        batch_op.create_unique_constraint("uq_sl_tables_uuid", ["uuid"])

    op.create_table(
        "sl_table_columns",
        sa.Column("table_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column("column_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(
            ["column_id"], ["sl_columns.id"], name="sl_table_columns_ibfk_2"
        ),
        sa.ForeignKeyConstraint(
            ["table_id"], ["sl_tables.id"], name="sl_table_columns_ibfk_1"
        ),
    )

    op.create_table(
        "sl_datasets",
        # AuditMixinNullable
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        # ExtraJSONMixin
        sa.Column("extra_json", sa.Text(), nullable=True),
        # ImportExportMixin
        sa.Column("uuid", UUIDType(binary=True), primary_key=False, default=uuid4),
        # Dataset
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("sqlatable_id", sa.INTEGER(), nullable=True),
        sa.Column("name", sa.TEXT(), nullable=False),
        sa.Column("expression", sa.TEXT(), nullable=False),
        sa.Column("is_physical", sa.BOOLEAN(), nullable=False, default=False,),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("sl_datasets") as batch_op:
        batch_op.create_unique_constraint("uq_sl_datasets_uuid", ["uuid"])

    op.create_table(
        "sl_dataset_columns",
        sa.Column("dataset_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column("column_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(
            ["column_id"], ["sl_columns.id"], name="sl_dataset_columns_ibfk_2"
        ),
        sa.ForeignKeyConstraint(
            ["dataset_id"], ["sl_datasets.id"], name="sl_dataset_columns_ibfk_1"
        ),
    )

    op.create_table(
        "sl_dataset_tables",
        sa.Column("dataset_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column("table_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(
            ["dataset_id"], ["sl_datasets.id"], name="sl_dataset_tables_ibfk_1"
        ),
        sa.ForeignKeyConstraint(
            ["table_id"], ["sl_tables.id"], name="sl_dataset_tables_ibfk_2"
        ),
    )

    # migrate existing datasets to the new models
    bind = op.get_bind()
    session = db.Session(bind=bind)  # pylint: disable=no-member

    datasets = session.query(SqlaTable).all()
    for dataset in datasets:
        SqlaTable.after_insert(
            mapper=None, connection=session.connection, target=dataset,  # not needed
        )


def downgrade():
    op.drop_table("sl_dataset_columns")
    op.drop_table("sl_dataset_tables")
    op.drop_table("sl_datasets")
    op.drop_table("sl_table_columns")
    op.drop_table("sl_tables")
    op.drop_table("sl_columns")
