"""add_star_schema_support

Revision ID: a1b2c3d4e5f6
Revises: 363a9b1e8992
Create Date: 2025-07-01 00:00:00.000000

"""

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

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "363a9b1e8992"
branch_labels = None
depends_on = None


def upgrade():
    # Create enum type for table_type
    table_type_enum = sa.Enum("physical", "view", "fact", "dimension", name="tabletype")
    table_type_enum.create(op.get_bind(), checkfirst=True)

    # Add table_type column to tables
    op.add_column(
        "tables",
        sa.Column(
            "table_type",
            table_type_enum,
            nullable=False,
            server_default="physical",
        ),
    )
    # Remove server default after migration
    op.alter_column("tables", "table_type", server_default=None)

    # Create fact_dimension mapping table
    op.create_table(
        "fact_dimension",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "fact_table_id",
            sa.Integer,
            sa.ForeignKey("tables.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "dimension_table_id",
            sa.Integer,
            sa.ForeignKey("tables.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("fact_fk", sa.String(length=256), nullable=False),
        sa.Column("dimension_pk", sa.String(length=256), nullable=False),
    )


def downgrade():
    op.drop_table("fact_dimension")
    op.drop_column("tables", "table_type")
    sa.Enum(name="tabletype").drop(op.get_bind(), checkfirst=True)
