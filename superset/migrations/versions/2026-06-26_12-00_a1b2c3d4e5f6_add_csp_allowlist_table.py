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
"""add csp_allowlist table

Creates the ``csp_allowlist`` table backing runtime Content Security Policy
"punched holes". Each row widens a single CSP directive (``frame-src`` by
default) to allow one additional origin. The table is only consulted when the
``CSP_RUNTIME_ALLOWLIST`` feature flag is enabled.

Revision ID: a1b2c3d4e5f6
Revises: 78a40c08b4be
Create Date: 2026-06-26 12:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_table,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "78a40c08b4be"


def upgrade() -> None:
    create_table(
        "csp_allowlist",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("uuid", UUIDType(binary=True), nullable=True, unique=True),
        sa.Column("domain", sa.String(length=255), nullable=False),
        sa.Column(
            "directive",
            sa.String(length=64),
            nullable=False,
            server_default="frame-src",
        ),
        sa.Column("description", sa.Text(), nullable=True),
        # AuditMixinNullable columns
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.UniqueConstraint(
            "domain", "directive", name="uq_csp_allowlist_domain_directive"
        ),
    )
    create_fks_for_table(
        "fk_csp_allowlist_created_by_fk_ab_user",
        "csp_allowlist",
        "ab_user",
        ["created_by_fk"],
        ["id"],
    )
    create_fks_for_table(
        "fk_csp_allowlist_changed_by_fk_ab_user",
        "csp_allowlist",
        "ab_user",
        ["changed_by_fk"],
        ["id"],
    )


def downgrade() -> None:
    drop_table("csp_allowlist")
