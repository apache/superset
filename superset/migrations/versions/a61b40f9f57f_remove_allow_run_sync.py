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
"""remove allow_run_sync

Revision ID: a61b40f9f57f
Revises: 46f444d8b9b7
Create Date: 2018-11-27 11:53:17.512627

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a61b40f9f57f"
down_revision = "46f444d8b9b7"


def upgrade():
    with op.batch_alter_table("dbs") as batch_op:
        batch_op.drop_column("allow_run_sync")


def downgrade():
    op.add_column(
        "dbs",
        sa.Column(
            "allow_run_sync",
            sa.Integer(display_width=1),
            autoincrement=False,
            nullable=True,
        ),
    )
