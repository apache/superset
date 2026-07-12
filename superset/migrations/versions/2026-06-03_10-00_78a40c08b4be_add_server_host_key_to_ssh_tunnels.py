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
"""add server_host_key to ssh_tunnels

Adds a nullable ``server_host_key`` column to the ``ssh_tunnels`` table. It stores the
expected SSH server host key in authorized-key form (e.g. "ssh-ed25519 AAAA...") so
operators can opt in to verifying the SSH server's host key before a tunnel is opened.
This is a public key and is stored in plaintext (not encrypted). The column is
nullable, so existing tunnels are unaffected.

Revision ID: 78a40c08b4be
Revises: b7c9d1e2f3a4
Create Date: 2026-06-03 10:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns

# revision identifiers, used by Alembic.
revision = "78a40c08b4be"
down_revision = "b7c9d1e2f3a4"


def upgrade() -> None:
    """Add the nullable ``server_host_key`` column to ``ssh_tunnels``."""
    add_columns(
        "ssh_tunnels",
        sa.Column("server_host_key", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Drop the ``server_host_key`` column from ``ssh_tunnels``."""
    drop_columns("ssh_tunnels", "server_host_key")
