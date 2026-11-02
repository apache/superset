# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.

"""Add report execution ownership fencing.

Revision ID: 93d1b4a76c02
Revises: 60f94cd6cd11
"""

import sqlalchemy as sa
from alembic import op

revision = "93d1b4a76c02"
down_revision = "60f94cd6cd11"


def upgrade() -> None:
    """Add nullable admission fields without rewriting existing schedules."""
    existing = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("report_schedule")
    }
    with op.batch_alter_table("report_schedule") as batch_op:
        for column in (
            sa.Column("execution_owner", sa.String(36), nullable=True),
            sa.Column("execution_window", sa.DateTime(), nullable=True),
        ):
            if column.name not in existing:
                batch_op.add_column(column)


def downgrade() -> None:
    """Remove admission fields; retry configuration remains unchanged."""
    existing = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("report_schedule")
    }
    with op.batch_alter_table("report_schedule") as batch_op:
        for name in ("execution_window", "execution_owner"):
            if name in existing:
                batch_op.drop_column(name)
