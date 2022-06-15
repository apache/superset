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
"""rename_rows_column_to_row_count_in_saved_query_table

Revision ID: bb1c816bcbb1
Revises: e786798587de
Create Date: 2022-06-15 16:50:10.942445

"""

# revision identifiers, used by Alembic.
revision = 'bb1c816bcbb1'
down_revision = 'e786798587de'


from alembic import op


OLD_NAME = 'rows'
NEW_NAME = 'row_count'
TABLES = ['query', 'saved_query']


def upgrade():
    for t in TABLES:
        with op.batch_alter_table(t) as batch_op:
            try:
                batch_op.alter_column(
                    OLD_NAME, new_column_name=NEW_NAME
                )
            except TypeError as e:
                print(e.args)


def downgrade():
    for t in TABLES:
        with op.batch_alter_table(t) as batch_op:
            try:
                batch_op.alter_column(
                    NEW_NAME, new_column_name=OLD_NAME
                )
            except TypeError as e:
                print(e.args)
