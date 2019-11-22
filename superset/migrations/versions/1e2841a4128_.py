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

Revision ID: 1e2841a4128
Revises: 5a7bad26f2a7
Create Date: 2015-10-05 22:11:00.537054

"""

# revision identifiers, used by Alembic.
revision = "1e2841a4128"
down_revision = "5a7bad26f2a7"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column("table_columns", sa.Column("expression", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("table_columns", "expression")
