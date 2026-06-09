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
"""Drop extension_enabled table (ExtensionEnabled model removed in chatbot SIP).

Revision ID: d1e2f3a4b5c6
Revises: b2c3d4e5f6a7
Create Date: 2026-06-09 00:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import create_table, drop_table

# revision identifiers, used by Alembic.
revision = "d1e2f3a4b5c6"
down_revision = "b2c3d4e5f6a7"


def upgrade() -> None:
    drop_table("extension_enabled")


def downgrade() -> None:
    create_table(
        "extension_enabled",
        sa.Column("extension_id", sa.String(250), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
