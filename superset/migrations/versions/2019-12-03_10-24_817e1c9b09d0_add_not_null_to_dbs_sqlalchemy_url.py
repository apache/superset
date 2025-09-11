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
"""add_not_null_to_dbs_sqlalchemy_url

Revision ID: 817e1c9b09d0
Revises: db4b49eb0782
Create Date: 2019-12-03 10:24:16.201580

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "817e1c9b09d0"
down_revision = "89115a40e8ea"


def upgrade():
    with op.batch_alter_table("dbs") as batch_op:
        batch_op.alter_column(
            "sqlalchemy_uri", existing_type=sa.VARCHAR(length=1024), nullable=False
        )


def downgrade():
    with op.batch_alter_table("dbs") as batch_op:
        batch_op.alter_column(
            "sqlalchemy_uri", existing_type=sa.VARCHAR(length=1024), nullable=True
        )
