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
"""user_id

Revision ID: 2591d77e9831
Revises: 12d55656cbca
Create Date: 2015-12-15 17:02:45.128709

"""

# revision identifiers, used by Alembic.
revision = "2591d77e9831"
down_revision = "12d55656cbca"

from alembic import op
import sqlalchemy as sa


def upgrade():
    with op.batch_alter_table("tables") as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.Integer()))
        batch_op.create_foreign_key("user_id", "ab_user", ["user_id"], ["id"])


def downgrade():
    with op.batch_alter_table("tables") as batch_op:
        batch_op.drop_constraint("user_id", type_="foreignkey")
        batch_op.drop_column("user_id")
