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
"""deprecate dbs.perm column

Revision ID: a72cb0ebeb22
Revises: ea396d202291
Create Date: 2020-06-21 19:50:51.630917
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a72cb0ebeb22"
down_revision = "ea396d202291"


def upgrade():
    with op.batch_alter_table("dbs") as batch_op:
        batch_op.drop_column("perm")


def downgrade():
    with op.batch_alter_table("dbs") as batch_op:
        batch_op.add_column(sa.Column("perm", sa.String(1000), nullable=True))
