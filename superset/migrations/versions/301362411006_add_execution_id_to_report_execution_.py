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
"""add_execution_id_to_report_execution_log_model.py

Revision ID: 301362411006
Revises: 67da9ef1ef9c
Create Date: 2021-03-23 05:23:15.641856

"""

# revision identifiers, used by Alembic.
revision = '301362411006'
down_revision = '67da9ef1ef9c'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column(
        'report_execution_log',
        sa.Column('execution_id', sa.VARCHAR(length=50), nullable=True)
    )

  
def downgrade():
    op.drop_column('report_execution_log', 'execution_id')
