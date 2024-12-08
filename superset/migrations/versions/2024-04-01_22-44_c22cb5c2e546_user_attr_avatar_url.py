# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
# # Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""empty message

Revision ID: c22cb5c2e546
Revises: be1b217cd8cd
Create Date: 2024-04-01 22:44:40.386543

"""

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.utils import add_column_if_not_exists

# revision identifiers, used by Alembic.
revision = "c22cb5c2e546"
down_revision = "678eefb4ab44"


def upgrade():
    add_column_if_not_exists(
        "user_attribute",
        sa.Column("avatar_url", sa.String(length=100), nullable=True),
    )


def downgrade():
    op.drop_column("user_attribute", "avatar_url")
