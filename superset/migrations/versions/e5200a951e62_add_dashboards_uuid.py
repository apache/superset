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
"""Adds a dashboards.uuid column.

Revision ID: e5200a951e62
Revises: e9df189e5c7e
Create Date: 2019-05-08 13:42:48.479145

"""

# revision identifiers, used by Alembic.
revision = 'e5200a951e62'
down_revision = 'e9df189e5c7e'

from alembic import op
import sqlalchemy as sa
from sqlalchemy_utils.types.uuid import UUIDType


def upgrade():
    print('Adding columns dashboards.uuid=UUIDType')
    op.add_column('dashboards', sa.Column('uuid', UUIDType(binary=False), nullable=True))

def downgrade():
    print('Removing column dashboards.uuid=UUIDType')
    with op.batch_alter_table('dashboards') as batch_op:
        batch_op.drop_column('uuid')
