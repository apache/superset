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
"""Add slack to the schedule

Revision ID: 743a117f0d98
Revises: 620241d1153f
Create Date: 2020-05-13 21:01:26.163478

"""

# revision identifiers, used by Alembic.
revision = "743a117f0d98"
down_revision = "620241d1153f"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.add_column(
        "dashboard_email_schedules",
        sa.Column("slack_channel", sa.Text(), nullable=True),
    )
    op.add_column(
        "slice_email_schedules", sa.Column("slack_channel", sa.Text(), nullable=True)
    )


def downgrade():
    op.drop_column("dashboard_email_schedules", "slack_channel")
    op.drop_column("slice_email_schedules", "slack_channel")
