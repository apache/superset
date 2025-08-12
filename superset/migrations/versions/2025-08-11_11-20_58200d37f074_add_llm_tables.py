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
"""add llm tables

Revision ID: 58200d37f074
Revises: cd1fb11291f2
Create Date: 2025-08-11 11:20:44.248026

"""

# revision identifiers, used by Alembic.
revision = '58200d37f074'
down_revision = 'cd1fb11291f2'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table('llm_connection',
        sa.Column('created_on', sa.DateTime(), nullable=True),
        sa.Column('changed_on', sa.DateTime(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('database_id', sa.Integer(), nullable=False),
        sa.Column('enabled', sa.Boolean(), default=False, nullable=False),
        sa.Column('provider', sa.String(length=255), nullable=False),
        sa.Column('model', sa.String(length=255), nullable=False),
        sa.Column('api_key', sa.VARCHAR(length=100), nullable=False),
        sa.Column('created_by_fk', sa.Integer(), nullable=True),
        sa.Column('changed_by_fk', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['changed_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['created_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['database_id'], ['dbs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('llm_context_options',
        sa.Column('created_on', sa.DateTime(), nullable=True),
        sa.Column('changed_on', sa.DateTime(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('database_id', sa.Integer(), nullable=True),
        sa.Column('refresh_interval', sa.Integer(), nullable=True),
        sa.Column('schemas', sa.Text().with_variant(sa.dialects.mysql.MEDIUMTEXT(), 'mysql'), nullable=True),
        sa.Column('include_indexes', sa.Boolean(), default=True),
        sa.Column('top_k', sa.Integer(), default=10, nullable=True),
        sa.Column('top_k_limit', sa.Integer(), default=50000, nullable=True),
        sa.Column('instructions', sa.Text().with_variant(sa.dialects.mysql.MEDIUMTEXT(), 'mysql'), nullable=True),
        sa.Column('created_by_fk', sa.Integer(), nullable=True),
        sa.Column('changed_by_fk', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['changed_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['created_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['database_id'], ['dbs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.drop_column('dbs', 'llm_api_key')
    op.drop_column('dbs', 'llm_context_options')
    op.drop_column('dbs', 'llm_model')
    op.drop_column('dbs', 'llm_provider')
    op.drop_column('dbs', 'llm_enabled')
    # ### end Alembic commands ###


def downgrade():
    op.add_column('dbs', sa.Column('llm_enabled', sa.BOOLEAN(), nullable=True))
    op.add_column('dbs', sa.Column('llm_provider', sa.VARCHAR(length=100), nullable=True))
    op.add_column('dbs', sa.Column('llm_model', sa.VARCHAR(length=100), nullable=True))
    op.add_column('dbs', sa.Column('llm_context_options', sa.TEXT(), nullable=True))
    op.add_column('dbs', sa.Column('llm_api_key', sa.VARCHAR(length=100), nullable=True))

    op.drop_table('llm_context_options')
    op.drop_table('llm_connection')
    # ### end Alembic commands ###
