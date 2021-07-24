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
"""deprecate_restricted_metrics

Revision ID: 11c737c17cc6
Revises: def97f26fdfb
Create Date: 2019-09-08 21:50:58.200229

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "11c737c17cc6"
down_revision = "def97f26fdfb"


def upgrade():
    with op.batch_alter_table("metrics") as batch_op:
        batch_op.drop_column("is_restricted")
    with op.batch_alter_table("sql_metrics") as batch_op:
        batch_op.drop_column("is_restricted")


def downgrade():
    op.add_column(
        "sql_metrics", sa.Column("is_restricted", sa.BOOLEAN(), nullable=True)
    )
    op.add_column("metrics", sa.Column("is_restricted", sa.BOOLEAN(), nullable=True))
