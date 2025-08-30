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
"""drill-through-chart-fk

Revision ID: f56ac3accfc9
Revises: cd1fb11291f2
Create Date: 2025-08-11 12:43:59.086693

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import (
    add_columns,
    create_fks_for_table,
    drop_columns,
    drop_fks_for_table,
)

# revision identifiers, used by Alembic.
revision = "f56ac3accfc9"
down_revision = "cd1fb11291f2"


def upgrade():
    # Add the drill_through_chart_id column to the tables table
    add_columns(
        "tables", sa.Column("drill_through_chart_id", sa.Integer(), nullable=True)
    )

    # Create foreign key constraint to slices table
    create_fks_for_table(
        foreign_key_name="fk_tables_drill_through_chart_id_slices",
        table_name="tables",
        referenced_table="slices",
        local_cols=["drill_through_chart_id"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )


def downgrade():
    # Drop the foreign key constraint first
    drop_fks_for_table(
        table_name="tables",
        foreign_key_names=["fk_tables_drill_through_chart_id_slices"],
    )

    # Drop the column
    drop_columns("tables", "drill_through_chart_id")
