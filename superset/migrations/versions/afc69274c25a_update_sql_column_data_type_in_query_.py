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
"""update the sql, select_sql, and executed_sql columns in the
   query table to support larger text

Revision ID: afc69274c25a
Revises: e9df189e5c7e
Create Date: 2019-05-06 14:30:26.181449

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'afc69274c25a'
down_revision = 'e9df189e5c7e'

text_len = 2 ** 32 - 1


def upgrade():
    try:
        # Set text length if database accepts it
        with op.batch_alter_table('query') as batch_op:
            batch_op.alter_column(
                'sql', existing_type=sa.Text, type_=sa.Text(length=text_len))
            batch_op.alter_column(
                'select_sql', existing_type=sa.Text, type_=sa.Text(length=text_len))
            batch_op.alter_column(
                'executed_sql', existing_type=sa.Text, type_=sa.Text(length=text_len))
    except:
        # Many databases do not have a length on text objects
        # so skip altering for those databases
        pass


def downgrade():
    try:
        with op.batch_alter_table('query') as batch_op:
            batch_op.alter_column(
                'sql', existing_type=sa.Text(length=text_len), type_=sa.Text)
            batch_op.alter_column(
                'select_sql', existing_type=sa.Text(length=text_len), type_=sa.Text)
            batch_op.alter_column(
                'executed_sql', existing_type=sa.Text(length=text_len), type_=sa.Text)
    except:
        pass
