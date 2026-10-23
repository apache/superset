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
"""Add Teams bot installation persistence.

Revision ID: 7b9d2f8a6c31
Revises: c179af013f48
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType

revision: str = "7b9d2f8a6c31"
down_revision: str = "c179af013f48"


def upgrade() -> None:
    """Add installation metadata without changing alerts or destinations."""
    op.create_table(
        "teams_installations",
        sa.Column("id", UUIDType(binary=True), nullable=False),
        sa.Column("tenant_id", UUIDType(binary=True), nullable=False),
        sa.Column("application_id", UUIDType(binary=True), nullable=False),
        sa.Column("team_id", sa.String(255), nullable=False),
        sa.Column("service_url", sa.String(2048), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("event_at", sa.DateTime(), nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=False),
        sa.Column("changed_on", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id",
            "application_id",
            "team_id",
            name="uq_teams_installation_identity",
        ),
    )


def downgrade() -> None:
    """Remove only the installation metadata table."""
    op.drop_table("teams_installations")
