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
"""fix slices datasource type

Revision ID: 1a51759ec9f2
Revises: 67da9ef1ef9c
Create Date: 2021-05-05 11:29:23.912475

"""

# revision identifiers, used by Alembic.
revision = '1a51759ec9f2'
down_revision = '67da9ef1ef9c'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


def upgrade():
    op.alter_column('slices', 'datasource_type',
                    existing_type=mysql.VARCHAR(length=200),
                    nullable=False)


def downgrade():
    op.alter_column('slices', 'datasource_type',
                    existing_type=mysql.VARCHAR(length=200),
                    nullable=True)
