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
"""add guest_token_revoked_before to embedded_dashboards

Revision ID: c8d2e3f4a5b6
Revises: 31dae2559c05
Create Date: 2026-06-01 00:10:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns

# revision identifiers, used by Alembic.
revision = "c8d2e3f4a5b6"
down_revision = "31dae2559c05"


def upgrade():
    # Epoch seconds; guest tokens for this embedded dashboard issued (iat)
    # before this value are rejected. NULL = no revocation.
    add_columns(
        "embedded_dashboards",
        sa.Column("guest_token_revoked_before", sa.Integer(), nullable=True),
    )


def downgrade():
    drop_columns("embedded_dashboards", "guest_token_revoked_before")
