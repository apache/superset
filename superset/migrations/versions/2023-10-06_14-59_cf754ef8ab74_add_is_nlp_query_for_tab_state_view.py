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
"""add is nlp query for tab state

Revision ID: cf754ef8ab74
Revises: 4b85906e5b91
Create Date: 2023-10-06 14:59:59.233913

"""

# revision identifiers, used by Alembic.
import sqlalchemy as sa
from alembic import op

revision = "cf754ef8ab74"
down_revision = "4b85906e5b91"


def upgrade():
    op.add_column("tab_state", sa.Column("is_nlp_query", sa.Boolean(), nullable=True))


def downgrade():
    op.drop_column("tab_state", "is_nlp_query")
