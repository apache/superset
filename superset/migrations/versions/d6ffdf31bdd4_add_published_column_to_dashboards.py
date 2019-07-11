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
"""Add published column to dashboards

Revision ID: d6ffdf31bdd4
Revises: b4a38aa87893
Create Date: 2018-03-30 14:00:44.929483

"""

# revision identifiers, used by Alembic.
revision = "d6ffdf31bdd4"
down_revision = "b4a38aa87893"

from alembic import op
import sqlalchemy as sa


def upgrade():
    with op.batch_alter_table("dashboards") as batch_op:
        batch_op.add_column(sa.Column("published", sa.Boolean(), nullable=True))
    op.execute("UPDATE dashboards SET published='1'")


def downgrade():
    with op.batch_alter_table("dashboards") as batch_op:
        batch_op.drop_column("published")
