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
"""add_extra_config_column_to_alerts

Revision ID: abe27eaf93db
Revises: 0ca9e5f1dacd
Create Date: 2021-12-02 12:03:20.691171

"""

# revision identifiers, used by Alembic.
revision = "abe27eaf93db"
down_revision = "0ca9e5f1dacd"

import sqlalchemy as sa
from alembic import op
from sqlalchemy import String
from sqlalchemy.sql import column, table

report_schedule = table("report_schedule", column("extra", String))


def upgrade():
    bind = op.get_bind()

    with op.batch_alter_table("report_schedule") as batch_op:
        batch_op.add_column(
            sa.Column(
                "extra",
                sa.Text(),
                nullable=True,
                default="{}",
            ),
        )
    bind.execute(report_schedule.update().values({"extra": "{}"}))
    with op.batch_alter_table("report_schedule") as batch_op:
        batch_op.alter_column("extra", existing_type=sa.Text(), nullable=False)


def downgrade():
    op.drop_column("report_schedule", "extra")
