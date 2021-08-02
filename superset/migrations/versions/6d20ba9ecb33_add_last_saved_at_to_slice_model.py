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
"""add_last_saved_at_to_slice_model

Revision ID: 6d20ba9ecb33
Revises: ae1ed299413b
Create Date: 2021-08-02 21:14:58.200438

"""

# revision identifiers, used by Alembic.
revision = '6d20ba9ecb33'
down_revision = 'ae1ed299413b'

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


def upgrade():
    op.add_column('slices', sa.Column('last_saved_at', sa.DateTime(), nullable=True))
    slices_table = sa.Table(
        'slices',
        sa.MetaData(),
        sa.Column('changed_on', sa.DateTime(), nullable=True),
        sa.Column('last_saved_at', sa.DateTime(), nullable=True),
    )
    conn = op.get_bind()
    conn.execute(
        slices_table.update().values(last_saved_at = slices_table.c.changed_on)
    )
    # ### end Alembic commands ###


def downgrade():
    op.drop_column('slices', 'last_saved_at')
    # ### end Alembic commands ###
