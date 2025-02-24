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
"""add_include_index_to_report_schedule

Revision ID: 3b86f563edbc
Revises: 74ad1125881c
Create Date: 2025-02-24 17:52:02.369467

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "3b86f563edbc"
down_revision = "74ad1125881c"


def upgrade():
    op.add_column(
        "report_schedule",
        sa.Column("include_index", sa.Boolean(), nullable=True),
    )


def downgrade():
    op.drop_column("report_schedule", "include_index")
