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
"""Add columns for external management

Revision ID: 5fd49410a97a
Revises: c53bae8f08dd
Create Date: 2022-01-19 07:34:20.594786

"""

# revision identifiers, used by Alembic.
revision = "5fd49410a97a"
down_revision = "c53bae8f08dd"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    with op.batch_alter_table("dashboards") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_managed_externally",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.add_column(sa.Column("external_url", sa.Text(), nullable=True))

    with op.batch_alter_table("datasources") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_managed_externally",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.add_column(sa.Column("external_url", sa.Text(), nullable=True))

    with op.batch_alter_table("dbs") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_managed_externally",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.add_column(sa.Column("external_url", sa.Text(), nullable=True))

    with op.batch_alter_table("slices") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_managed_externally",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.add_column(sa.Column("external_url", sa.Text(), nullable=True))

    with op.batch_alter_table("tables") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_managed_externally",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.add_column(sa.Column("external_url", sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table("tables") as batch_op:
        batch_op.drop_column("external_url")
        batch_op.drop_column("is_managed_externally")
    with op.batch_alter_table("slices") as batch_op:
        batch_op.drop_column("external_url")
        batch_op.drop_column("is_managed_externally")
    with op.batch_alter_table("dbs") as batch_op:
        batch_op.drop_column("external_url")
        batch_op.drop_column("is_managed_externally")
    with op.batch_alter_table("datasources") as batch_op:
        batch_op.drop_column("external_url")
        batch_op.drop_column("is_managed_externally")
    with op.batch_alter_table("dashboards") as batch_op:
        batch_op.drop_column("external_url")
        batch_op.drop_column("is_managed_externally")
