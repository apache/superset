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
"""empty message

Revision ID: f231d82b9b26
Revises: e68c4473c581
Create Date: 2018-03-20 19:47:54.991259

"""

import sqlalchemy as sa
from alembic import op

from superset.utils.core import generic_find_uq_constraint_name

# revision identifiers, used by Alembic.
revision = "f231d82b9b26"
down_revision = "e68c4473c581"

conv = {"uq": "uq_%(table_name)s_%(column_0_name)s"}

names = {"columns": "column_name", "metrics": "metric_name"}


def upgrade():
    # Reduce the size of the metric_name column for constraint viability.
    with op.batch_alter_table("metrics", naming_convention=conv) as batch_op:
        batch_op.alter_column(
            "metric_name",
            existing_type=sa.String(length=512),
            type_=sa.String(length=255),
            existing_nullable=True,
        )

    # Add the missing uniqueness constraints.
    for table, column in names.items():
        with op.batch_alter_table(table, naming_convention=conv) as batch_op:
            batch_op.create_unique_constraint(
                f"uq_{table}_{column}", [column, "datasource_id"]
            )


def downgrade():
    bind = op.get_bind()
    insp = sa.engine.reflection.Inspector.from_engine(bind)

    # Restore the size of the metric_name column.
    with op.batch_alter_table("metrics", naming_convention=conv) as batch_op:
        batch_op.alter_column(
            "metric_name",
            existing_type=sa.String(length=255),
            type_=sa.String(length=512),
            existing_nullable=True,
        )

    # Remove the previous missing uniqueness constraints.
    for table, column in names.items():
        with op.batch_alter_table(table, naming_convention=conv) as batch_op:
            batch_op.drop_constraint(
                generic_find_uq_constraint_name(table, {column, "datasource_id"}, insp)
                or f"uq_{table}_{column}",
                type_="unique",
            )
