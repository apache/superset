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
"""add partition filter mapping

Adds the four columns behind the ``PARTITION_FILTER_MAPPING`` feature:

- ``tables.partition_column`` -- the physical column the engine partitions on
- ``tables.partition_mapped_column`` -- explicit override for the column whose
  filters are mirrored; NULL means "follow ``main_dttm_col``"
- ``table_columns.partition_value_transform`` -- the ``:value`` expression
- ``table_columns.partition_transform_is_monotonic`` -- gates range operators

The Continuum shadow tables get the same columns so dataset version history and
restore keep working.

Revision ID: a7f3c2e91d84
Revises: 1072de5ed955
Create Date: 2026-08-31 22:30:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns

# revision identifiers, used by Alembic.
revision = "a7f3c2e91d84"
down_revision = "7e2c9a4f1b83"


def upgrade():
    add_columns(
        "tables",
        sa.Column("partition_column", sa.String(250), nullable=True),
        sa.Column("partition_mapped_column", sa.String(250), nullable=True),
    )
    add_columns(
        "table_columns",
        sa.Column("partition_value_transform", sa.Text(), nullable=True),
        # Nullable, like the other booleans on this table. The legacy
        # datasource editor saves through `update_from_object`, which writes
        # NULL for any field its payload omits; NOT NULL here fails that save.
        # Readers coerce with `bool(...)`, so NULL reads as "not declared" and
        # ranges stop mirroring rather than mirroring unsoundly.
        sa.Column(
            "partition_transform_is_monotonic",
            sa.Boolean(),
            nullable=True,
            server_default=sa.false(),
        ),
    )

    # Shadow tables are nullable throughout -- a version row records the state
    # of the columns that changed, so every column has to tolerate NULL.
    add_columns(
        "tables_version",
        sa.Column("partition_column", sa.String(250), nullable=True),
        sa.Column("partition_mapped_column", sa.String(250), nullable=True),
    )
    add_columns(
        "table_columns_version",
        sa.Column("partition_value_transform", sa.Text(), nullable=True),
        sa.Column("partition_transform_is_monotonic", sa.Boolean(), nullable=True),
    )


def downgrade():
    drop_columns(
        "table_columns_version",
        "partition_value_transform",
        "partition_transform_is_monotonic",
    )
    drop_columns(
        "tables_version",
        "partition_column",
        "partition_mapped_column",
    )
    drop_columns(
        "table_columns",
        "partition_value_transform",
        "partition_transform_is_monotonic",
    )
    drop_columns(
        "tables",
        "partition_column",
        "partition_mapped_column",
    )
