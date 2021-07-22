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
"""upgrade unique constrain

Revision ID: 644c950f63d7
Revises: 030c840e3a1c
Create Date: 2021-07-22 10:50:59.302564

"""

# revision identifiers, used by Alembic.
revision = '644c950f63d7'
down_revision = '030c840e3a1c'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

def upgrade():
    try:
        op.create_unique_constraint('tables_unique', 'tables', ['table_name', 'schema', 'database_id'])
    except Exception:
        # sqlite not support
        pass


def downgrade():
    try:
        op.drop_constraint('tables_unique', 'tables', type_='unique')
    except Exception:
        # sqlite not support
        pass