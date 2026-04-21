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
"""add source to logs

Revision ID: f3a8b2c91d4e
Revises: ce6bd21901ab
Create Date: 2026-04-19 00:00:00.000000

"""

# revision identifiers, used by Alembic.
import sqlalchemy as sa
from alembic import op

revision = "f3a8b2c91d4e"
down_revision = "ce6bd21901ab"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("logs") as batch_op:
        batch_op.add_column(sa.Column("source", sa.String(length=32), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("logs") as batch_op:
        batch_op.drop_column("source")
