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
"""Change table schema description to long text

Revision ID: 89115a40e8ea
Revises: 5afa9079866a
Create Date: 2019-12-03 13:50:24.746867

"""

# revision identifiers, used by Alembic.
revision = "89115a40e8ea"
down_revision = "5afa9079866a"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.databases import mysql
from sqlalchemy.dialects.mysql.base import MySQLDialect


def upgrade():
    bind = op.get_bind()
    if isinstance(bind.dialect, MySQLDialect):
        with op.batch_alter_table("table_schema") as batch_op:
            batch_op.alter_column(
                "description", existing_type=sa.Text, type_=mysql.LONGTEXT
            )


def downgrade():
    bind = op.get_bind()
    if isinstance(bind.dialect, MySQLDialect):
        with op.batch_alter_table("table_schema") as batch_op:
            batch_op.alter_column(
                "description", existing_type=mysql.LONGTEXT, type_=sa.Text
            )
