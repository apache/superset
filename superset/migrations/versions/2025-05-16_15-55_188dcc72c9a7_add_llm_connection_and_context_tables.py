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
"""add_llm_connection_and_context_tables

Revision ID: 188dcc72c9a7
Revises: f771338a2a09
Create Date: 2025-05-16 15:55:06.414393

"""

# revision identifiers, used by Alembic.
revision = '188dcc72c9a7'
down_revision = 'f771338a2a09'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

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
        sa.Column('schemas', sa.Text().with_variant(mysql.MEDIUMTEXT(), 'mysql'), nullable=True),
        sa.Column('include_indexes', sa.Boolean(), default=True),
        sa.Column('top_k', sa.Integer(), default=10, nullable=True),
        sa.Column('top_k_limit', sa.Integer(), default=50000, nullable=True),
        sa.Column('instructions', sa.Text().with_variant(mysql.MEDIUMTEXT(), 'mysql'), nullable=True),
        sa.Column('created_by_fk', sa.Integer(), nullable=True),
        sa.Column('changed_by_fk', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['changed_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['created_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['database_id'], ['dbs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Copy the data from the old columns to the new table
    conn = op.get_bind()
    connection = conn.execution_options(autocommit=True)
    connection.execute(
        sa.text(
            """
            INSERT INTO llm_connection (created_on, changed_on, database_id, enabled, provider, model, api_key)
            SELECT created_on, changed_on, id, llm_enabled, llm_provider, llm_model, llm_api_key
            FROM dbs
            WHERE llm_provider IS NOT NULL AND llm_model IS NOT NULL and llm_api_key IS NOT NULL
            """
        )
    )
    connection.execute(
        sa.text(
            """
            INSERT INTO llm_context_options (created_on, changed_on, database_id, refresh_interval, schemas, include_indexes, top_k, top_k_limit, instructions)
            SELECT created_on, changed_on, id, llm_context_options->>'$.refresh_interval', llm_context_options->>'$.schemas', llm_context_options->>'$.include_indexes', llm_context_options->>'$.top_k', llm_context_options->>'$.top_k_limit', llm_context_options->>'$.instructions'
            FROM dbs
            WHERE llm_context_options IS NOT NULL AND llm_context_options != '{}'
            """
        )
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

    # Copy the data from the new tables back to the old columns
    conn = op.get_bind()
    connection = conn.execution_options(autocommit=True)
    connection.execute(
        sa.text(
            """
            UPDATE dbs
            SET llm_enabled = llm_connection.enabled,
                llm_provider = llm_connection.provider,
                llm_model = llm_connection.model,
                llm_api_key = llm_connection.api_key
            FROM llm_connection
            WHERE dbs.id = llm_connection.database_id
            """
        )
    )
    connection.execute(
        sa.text(
            """
            UPDATE dbs
            SET llm_context_options = 
                '{'
                || '"refresh_interval":' || COALESCE('"' || llm_context_options.refresh_interval || '"', 'null') || ','
                || '"schemas":' || llm_context_options.schemas || ','
                || '"include_indexes":' || COALESCE('"' || llm_context_options.include_indexes || '"', 'null') || ','
                || '"top_k":' || COALESCE('"' || llm_context_options.top_k || '"', 'null') || ','
                || '"top_k_limit":' || COALESCE('"' || llm_context_options.top_k_limit || '"', 'null') || ','
                || '"instructions":' || COALESCE('"' || REPLACE(REPLACE(llm_context_options.instructions, '\\', '\\\\'), '"', '\\"') || '"', 'null')
                || '}'
            FROM llm_context_options
            WHERE dbs.id = llm_context_options.database_id
            """
        )
    )

    op.drop_table('llm_context_options')
    op.drop_table('llm_connection')
    # ### end Alembic commands ###
