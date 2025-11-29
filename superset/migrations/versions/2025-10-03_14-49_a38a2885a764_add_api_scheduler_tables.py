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
"""Add API Scheduler tables

Revision ID: a38a2885a764
Revises: 363a9b1e8992
Create Date: 2025-10-03 14:49:18.737646

"""

# revision identifiers, used by Alembic.
revision = 'a38a2885a764'
down_revision = '363a9b1e8992'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# NOT: Enum tanımlarını KALDIRDIK - VARCHAR kullanacağız


def upgrade():
    # =========================================================================
    # API SCHEDULER TABLES (Ana özellik)
    # =========================================================================
    op.create_table('api_scheduler_configuration',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('target_table', sa.String(length=100), nullable=False),
        sa.Column('api_url', sa.String(length=500), nullable=False),
        sa.Column('api_method', sa.String(length=10), nullable=True),
        sa.Column('api_headers', sa.Text(), nullable=True),
        sa.Column('api_key', sa.String(length=500), nullable=True),
        sa.Column('schedule_interval', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_table('api_scheduler_execution_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('config_id', sa.Integer(), nullable=False),
        sa.Column('executed_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('records_inserted', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['config_id'], ['api_scheduler_configuration.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_api_scheduler_execution_log_executed_at'), 'api_scheduler_execution_log', ['executed_at'], unique=False)
    op.create_table('api_scheduler_field_mapping',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('config_id', sa.Integer(), nullable=False),
        sa.Column('api_field_path', sa.String(length=200), nullable=False),
        sa.Column('db_column_name', sa.String(length=100), nullable=False),
        sa.Column('db_column_type', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['config_id'], ['api_scheduler_configuration.id']),
        sa.PrimaryKeyConstraint('id')
    )



def downgrade():
    # API Scheduler tablolarını sil
    op.drop_table('api_scheduler_field_mapping')
    op.drop_index(op.f('ix_api_scheduler_execution_log_executed_at'), table_name='api_scheduler_execution_log')
    op.drop_table('api_scheduler_execution_log')
    op.drop_table('api_scheduler_configuration')