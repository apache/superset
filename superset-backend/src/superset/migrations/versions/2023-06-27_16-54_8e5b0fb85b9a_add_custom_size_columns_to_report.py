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
"""Add custom size columns to report schedule

Revision ID: 8e5b0fb85b9a
Revises: 6fbe660cac39
Create Date: 2023-06-27 16:54:57.161475

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "8e5b0fb85b9a"
down_revision = "6fbe660cac39"


def upgrade():
    op.add_column(
        "report_schedule",
        sa.Column("custom_width", sa.Integer(), nullable=True),
    )
    op.add_column(
        "report_schedule",
        sa.Column("custom_height", sa.Integer(), nullable=True),
    )


def downgrade():
    op.drop_column("report_schedule", "custom_width")
    op.drop_column("report_schedule", "custom_height")
