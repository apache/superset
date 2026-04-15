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
"""add exec info to saved queries

Revision ID: 585b0b1a7b18
Revises: af30ca79208f
Create Date: 2020-10-20 17:28:22.857694

"""

# revision identifiers, used by Alembic.
revision = "585b0b1a7b18"
down_revision = "af30ca79208f"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.add_column("saved_query", sa.Column("last_run", sa.DateTime(), nullable=True))
    op.add_column("saved_query", sa.Column("rows", sa.Integer(), nullable=True))


def downgrade():
    op.drop_column("saved_query", "rows")
    op.drop_column("saved_query", "last_run")
