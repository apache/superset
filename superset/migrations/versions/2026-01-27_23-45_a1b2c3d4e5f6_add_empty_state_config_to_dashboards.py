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
"""add_empty_state_config_to_dashboards

Revision ID: a1b2c3d4e5f6
Revises: f5b5f88d8526
Create Date: 2026-01-27 23:45:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "f5b5f88d8526"


def upgrade():
    add_columns(
        "dashboards",
        sa.Column(
            "empty_state_config",
            sa.Text(),
            nullable=True,
        ),
    )


def downgrade():
    drop_columns("dashboards", "empty_state_config")
