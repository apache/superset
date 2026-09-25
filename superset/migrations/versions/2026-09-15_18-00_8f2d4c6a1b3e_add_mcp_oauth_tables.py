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
"""add_mcp_oauth_tables

Revision ID: 8f2d4c6a1b3e
Revises: 3c9e1a7b5d2f
Create Date: 2026-09-15 18:00:00.000000

"""

revision = "8f2d4c6a1b3e"
down_revision = "3c9e1a7b5d2f"

import sqlalchemy as sa  # noqa: E402
from sqlalchemy_utils import UUIDType  # noqa: E402

from superset.migrations.shared.utils import (  # noqa: E402
    create_index,
    create_table,
    drop_index,
    drop_table,
)


def upgrade() -> None:
    create_table(
        "mcp_oauth_clients",
        sa.Column("id", UUIDType(binary=True), nullable=False),
        sa.Column("client_id", sa.String(64), nullable=False),
        sa.Column("client_secret_hash", sa.String(64), nullable=True),
        sa.Column("client_name", sa.String(255), nullable=True),
        sa.Column("redirect_uris", sa.Text(), nullable=False),
        sa.Column("grant_types", sa.Text(), nullable=False),
        sa.Column("token_endpoint_auth_method", sa.String(32), nullable=False),
        sa.Column("scope", sa.Text(), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_id", name="uq_mcp_oauth_clients_client_id"),
    )
    create_table(
        "mcp_oauth_authorization_codes",
        sa.Column("id", UUIDType(binary=True), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("client_pk", UUIDType(binary=True), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("redirect_uri", sa.Text(), nullable=False),
        sa.Column("code_challenge", sa.String(128), nullable=False),
        sa.Column("resource", sa.Text(), nullable=False),
        sa.Column("scope", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["client_pk"],
            ["mcp_oauth_clients.id"],
            name="fk_mcp_oauth_authorization_codes_client_pk",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["ab_user.id"],
            name="fk_mcp_oauth_authorization_codes_user_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "code_hash", name="uq_mcp_oauth_authorization_codes_code_hash"
        ),
    )
    create_table(
        "mcp_oauth_refresh_tokens",
        sa.Column("id", UUIDType(binary=True), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("family_id", UUIDType(binary=True), nullable=False),
        sa.Column("client_pk", UUIDType(binary=True), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("resource", sa.Text(), nullable=False),
        sa.Column("scope", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["client_pk"],
            ["mcp_oauth_clients.id"],
            name="fk_mcp_oauth_refresh_tokens_client_pk",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["ab_user.id"],
            name="fk_mcp_oauth_refresh_tokens_user_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "token_hash", name="uq_mcp_oauth_refresh_tokens_token_hash"
        ),
    )
    create_index(
        "mcp_oauth_refresh_tokens",
        "ix_mcp_oauth_refresh_tokens_family_id",
        ["family_id"],
    )


def downgrade() -> None:
    drop_index("mcp_oauth_refresh_tokens", "ix_mcp_oauth_refresh_tokens_family_id")
    drop_table("mcp_oauth_refresh_tokens")
    drop_table("mcp_oauth_authorization_codes")
    drop_table("mcp_oauth_clients")
