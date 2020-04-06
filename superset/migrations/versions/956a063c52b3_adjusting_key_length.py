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
"""adjusting key length

Revision ID: 956a063c52b3
Revises: f0fbf6129e13
Create Date: 2016-05-11 17:28:32.407340

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "956a063c52b3"
down_revision = "f0fbf6129e13"


def upgrade():
    with op.batch_alter_table("clusters", schema=None) as batch_op:
        batch_op.alter_column(
            "broker_endpoint",
            existing_type=sa.VARCHAR(length=256),
            type_=sa.String(length=255),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "broker_host",
            existing_type=sa.VARCHAR(length=256),
            type_=sa.String(length=255),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "coordinator_endpoint",
            existing_type=sa.VARCHAR(length=256),
            type_=sa.String(length=255),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "coordinator_host",
            existing_type=sa.VARCHAR(length=256),
            type_=sa.String(length=255),
            existing_nullable=True,
        )

    with op.batch_alter_table("columns", schema=None) as batch_op:
        batch_op.alter_column(
            "column_name",
            existing_type=sa.VARCHAR(length=256),
            type_=sa.String(length=255),
            existing_nullable=True,
        )

    with op.batch_alter_table("datasources", schema=None) as batch_op:
        batch_op.alter_column(
            "datasource_name",
            existing_type=sa.VARCHAR(length=256),
            type_=sa.String(length=255),
            existing_nullable=True,
        )

    with op.batch_alter_table("table_columns", schema=None) as batch_op:
        batch_op.alter_column(
            "column_name",
            existing_type=sa.VARCHAR(length=256),
            type_=sa.String(length=255),
            existing_nullable=True,
        )

    with op.batch_alter_table("tables", schema=None) as batch_op:
        batch_op.alter_column(
            "schema",
            existing_type=sa.VARCHAR(length=256),
            type_=sa.String(length=255),
            existing_nullable=True,
        )


def downgrade():
    with op.batch_alter_table("tables", schema=None) as batch_op:
        batch_op.alter_column(
            "schema",
            existing_type=sa.String(length=255),
            type_=sa.VARCHAR(length=256),
            existing_nullable=True,
        )

    with op.batch_alter_table("table_columns", schema=None) as batch_op:
        batch_op.alter_column(
            "column_name",
            existing_type=sa.String(length=255),
            type_=sa.VARCHAR(length=256),
            existing_nullable=True,
        )

    with op.batch_alter_table("datasources", schema=None) as batch_op:
        batch_op.alter_column(
            "datasource_name",
            existing_type=sa.String(length=255),
            type_=sa.VARCHAR(length=256),
            existing_nullable=True,
        )

    with op.batch_alter_table("columns", schema=None) as batch_op:
        batch_op.alter_column(
            "column_name",
            existing_type=sa.String(length=255),
            type_=sa.VARCHAR(length=256),
            existing_nullable=True,
        )

    with op.batch_alter_table("clusters", schema=None) as batch_op:
        batch_op.alter_column(
            "coordinator_host",
            existing_type=sa.String(length=255),
            type_=sa.VARCHAR(length=256),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "coordinator_endpoint",
            existing_type=sa.String(length=255),
            type_=sa.VARCHAR(length=256),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "broker_host",
            existing_type=sa.String(length=255),
            type_=sa.VARCHAR(length=256),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "broker_endpoint",
            existing_type=sa.String(length=255),
            type_=sa.VARCHAR(length=256),
            existing_nullable=True,
        )
