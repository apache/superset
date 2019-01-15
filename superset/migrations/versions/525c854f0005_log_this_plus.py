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
"""log_this_plus

Revision ID: 525c854f0005
Revises: e46f2d27a08e
Create Date: 2016-12-13 16:19:02.239322

"""

# revision identifiers, used by Alembic.
revision = '525c854f0005'
down_revision = 'e46f2d27a08e'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('logs', sa.Column('duration_ms', sa.Integer(), nullable=True))
    op.add_column('logs', sa.Column('referrer', sa.String(length=1024), nullable=True))


def downgrade():
    op.drop_column('logs', 'referrer')
    op.drop_column('logs', 'duration_ms')
