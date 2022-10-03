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
"""Add user_id and dttm composite index to Log model

Revision ID: cdcf3d64daf4
Revises: 7fb8bca906d2
Create Date: 2022-04-05 13:27:06.028908

"""

# revision identifiers, used by Alembic.
revision = "cdcf3d64daf4"
down_revision = "7fb8bca906d2"


from alembic import op


def upgrade():
    op.create_index(
        op.f("ix_logs_user_id_dttm"), "logs", ["user_id", "dttm"], unique=False
    )


def downgrade():
    op.drop_index(op.f("ix_logs_user_id_dttm"), table_name="logs")
