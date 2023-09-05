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
"""Add outdated column to charts

Revision ID: 122965576ebd
Revises: ec54aca4c8a2
Create Date: 2023-09-05 16:44:58.627402

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "122965576ebd"
down_revision = "ec54aca4c8a2"


def upgrade():
    op.add_column(
        "slices",
        sa.Column("outdated", sa.Boolean(), nullable=True, default=False),
    )


def downgrade():
    op.drop_column("slices", "outdated")
