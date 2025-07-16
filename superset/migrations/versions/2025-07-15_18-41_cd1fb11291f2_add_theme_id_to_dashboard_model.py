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
"""add theme_id to dashboard model

Revision ID: cd1fb11291f2
Revises: 3fd555e76e3d
Create Date: 2025-07-15 18:41:43.496256

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "cd1fb11291f2"
down_revision = "3fd555e76e3d"


def upgrade():
    op.add_column("dashboards", sa.Column("theme_id", sa.Integer(), nullable=True))
    op.create_foreign_key(None, "dashboards", "themes", ["theme_id"], ["id"])


def downgrade():
    op.drop_column("dashboards", "theme_id")
