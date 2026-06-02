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

Revision ID: a1b2c3d4e5f6
Revises: 31dae2559c05
Create Date: 2026-06-01 10:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "31dae2559c05"


def upgrade():
    add_columns(
        "ssh_tunnels",
        sa.Column("server_host_key", sa.Text(), nullable=True),
    )


def downgrade():
    drop_columns("ssh_tunnels", "server_host_key")
