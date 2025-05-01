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
"""Add extra column to Query

Revision ID: 0b1f1ab473c0
Revises: 55e910a74826
Create Date: 2018-11-05 08:42:56.181012

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0b1f1ab473c0"
down_revision = "55e910a74826"


def upgrade():
    with op.batch_alter_table("query") as batch_op:
        batch_op.add_column(sa.Column("extra_json", sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table("query") as batch_op:
        batch_op.drop_column("extra_json")
