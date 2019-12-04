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
"""sync_data_model

Revision ID: 9c49cfecf0de
Revises: db4b49eb0782
Create Date: 2019-12-03 13:26:12.237543

"""

# revision identifiers, used by Alembic.
revision = '9c49cfecf0de'
down_revision = 'db4b49eb0782'

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


def upgrade():
    op.alter_column('annotation', 'layer_id',
               existing_type=sa.INTEGER(),
               nullable=False)
    op.create_foreign_key(None, 'datasources', 'ab_user', ['changed_by_fk'], ['id'])
    # ### end Alembic commands ###


def downgrade():
    op.drop_constraint(None, 'datasources', type_='foreignkey')
    op.alter_column('annotation', 'layer_id',
               existing_type=sa.INTEGER(),
               nullable=True)
