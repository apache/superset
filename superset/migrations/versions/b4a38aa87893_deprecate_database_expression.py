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
"""deprecate database expression

Revision ID: b4a38aa87893
Revises: ab8c66efdd01
Create Date: 2019-06-05 11:35:16.222519

"""

# revision identifiers, used by Alembic.
revision = "b4a38aa87893"
down_revision = "ab8c66efdd01"

from alembic import op
import sqlalchemy as sa


def upgrade():
    with op.batch_alter_table("table_columns") as batch_op:
        batch_op.drop_column("database_expression")


def downgrade():
    with op.batch_alter_table("table_columns") as batch_op:
        batch_op.add_column(sa.Column("database_expression", sa.String(255)))
