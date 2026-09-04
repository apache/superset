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
"""reports alter crontab size

Revision ID: ab104a954a8f
Revises: 5daced1f0e76
Create Date: 2020-12-15 09:07:24.730545

"""

# revision identifiers, used by Alembic.
revision = "ab104a954a8f"
down_revision = "e37912a26567"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    with op.batch_alter_table("report_schedule") as batch_op:
        batch_op.alter_column(
            "crontab",
            existing_type=sa.VARCHAR(length=50),
            type_=sa.VARCHAR(length=1000),
            existing_nullable=False,
        )


def downgrade():
    with op.batch_alter_table("report_schedule") as batch_op:
        batch_op.alter_column(
            "crontab",
            existing_type=sa.VARCHAR(length=1000),
            type_=sa.VARCHAR(length=50),
            existing_nullable=False,
        )
