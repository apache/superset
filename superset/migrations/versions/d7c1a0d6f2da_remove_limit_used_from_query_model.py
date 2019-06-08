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
"""Remove limit used from query model

Revision ID: d7c1a0d6f2da
Revises: afc69274c25a
Create Date: 2019-06-04 10:12:36.675369

"""

# revision identifiers, used by Alembic.
revision = 'd7c1a0d6f2da'
down_revision = 'afc69274c25a'

from alembic import op
import sqlalchemy as sa


def upgrade():
    with op.batch_alter_table('query') as batch_op:
        batch_op.drop_column('limit_used')


def downgrade():
    op.add_column('query', sa.Column('limit_used', sa.BOOLEAN(), nullable=True))
