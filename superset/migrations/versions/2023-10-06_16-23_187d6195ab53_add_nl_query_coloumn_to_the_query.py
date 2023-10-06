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
"""add nl_query coloumn to the query

Revision ID: 187d6195ab53
Revises: cf754ef8ab74
Create Date: 2023-10-06 16:23:48.312293

"""

# revision identifiers, used by Alembic.
import sqlalchemy as sa
from alembic import op

revision = "187d6195ab53"
down_revision = "cf754ef8ab74"


def upgrade():
    op.add_column("query", sa.Column("nl_query", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("query", "nl_query")
