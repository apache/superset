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
"""add_index_to_logs

Revision ID: debf575ce1a1
Revises: a8173232b786
Create Date: 2020-11-25 17:28:39.383290

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "debf575ce1a1"
down_revision = "a8173232b786"


IDX_LOGS_ACTION = "ix_logs_action"
IDX_LOGS_USER_ID_DTTM = "ix_logs_user_id_dttm"


def upgrade():
    with op.batch_alter_table("logs") as batch_op:
        batch_op.create_index(
            op.f(IDX_LOGS_USER_ID_DTTM), ["user_id", "dttm"], unique=False,
        )
        batch_op.create_index(
            op.f(IDX_LOGS_ACTION), ["action"], unique=False,
        )


def downgrade():
    with op.batch_alter_table("logs") as batch_op:
        batch_op.drop_index(op.f(IDX_LOGS_USER_ID_DTTM))
        batch_op.drop_index(op.f(IDX_LOGS_ACTION))
