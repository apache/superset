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
"""empty message

Revision ID: 30bb17c0dc76
Revises: f231d82b9b26
Create Date: 2018-04-08 07:34:12.149910

"""

# revision identifiers, used by Alembic.
revision = "30bb17c0dc76"
down_revision = "f231d82b9b26"

from datetime import date

from alembic import op
import sqlalchemy as sa


def upgrade():
    with op.batch_alter_table("logs") as batch_op:
        batch_op.drop_column("dt")


def downgrade():
    with op.batch_alter_table("logs") as batch_op:
        batch_op.add_column(sa.Column("dt", sa.Date, default=date.today()))
