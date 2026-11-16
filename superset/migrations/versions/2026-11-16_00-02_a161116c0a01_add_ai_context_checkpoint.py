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
"""Persist server-only AI context checkpoints.

Revision ID: a161116c0a01
Revises: e1a61116c924
Create Date: 2026-11-16 00:02:00.000000
"""

import sqlalchemy as sa
from alembic import op

from superset.utils.core import MediumText

revision = "a161116c0a01"
down_revision = "e1a61116c924"


def upgrade() -> None:
    """Add an optional checkpoint without rewriting any original message."""
    with op.batch_alter_table("ai_chat_messages") as batch_op:
        batch_op.add_column(sa.Column("context_json", MediumText(), nullable=True))


def downgrade() -> None:
    """Remove derived checkpoints while retaining the original conversation."""
    with op.batch_alter_table("ai_chat_messages") as batch_op:
        batch_op.drop_column("context_json")
