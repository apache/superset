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
"""Drop extension_settings table (ExtensionSettings model removed in chatbot SIP).

The active chatbot is now resolved purely from the view registry (last-loaded
wins), so the admin-pin settings table is no longer read or written.

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-06-10 00:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import create_table, drop_table

# revision identifiers, used by Alembic.
revision = "e2f3a4b5c6d7"
down_revision = "d1e2f3a4b5c6"


def upgrade() -> None:
    drop_table("extension_settings")


def downgrade() -> None:
    create_table(
        "extension_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("active_chatbot_id", sa.String(250), nullable=True),
    )
