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
"""Add PK/FK flags to analyzed_column

Revision ID: d2a1b5c6e7f8
Revises: f2a167210763
Create Date: 2025-12-19 09:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d2a1b5c6e7f8"
# Merge after existing heads; depends on latest merged head
down_revision = "f2a167210763"


def upgrade():
    op.add_column(
        "analyzed_column",
        sa.Column(
            "is_primary_key",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "analyzed_column",
        sa.Column(
            "is_foreign_key",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade():
    op.drop_column("analyzed_column", "is_foreign_key")
    op.drop_column("analyzed_column", "is_primary_key")
