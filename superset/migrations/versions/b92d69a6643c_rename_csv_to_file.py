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
"""rename_csv_to_file

Revision ID: b92d69a6643c
Revises: 32646df09c64
Create Date: 2021-09-19 14:42:20.130368

"""

# revision identifiers, used by Alembic.
revision = "b92d69a6643c"
down_revision = "32646df09c64"

import sqlalchemy as sa
from alembic import op


def upgrade():
    with op.batch_alter_table("dbs") as batch_op:
        batch_op.alter_column(
            "allow_csv_upload",
            new_column_name="allow_file_upload",
            existing_type=sa.Boolean(),
        )


def downgrade():
    with op.batch_alter_table("dbs") as batch_op:
        batch_op.alter_column(
            "allow_file_upload",
            new_column_name="allow_csv_upload",
            existing_type=sa.Boolean(),
        )
