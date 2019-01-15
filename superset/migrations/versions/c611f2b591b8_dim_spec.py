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
"""dim_spec

Revision ID: c611f2b591b8
Revises: ad4d656d92bc
Create Date: 2016-11-02 17:36:04.970448

"""

# revision identifiers, used by Alembic.
revision = 'c611f2b591b8'
down_revision = 'ad4d656d92bc'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('columns', sa.Column('dimension_spec_json', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('columns', 'dimension_spec_json')
