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
"""add_json_metadata_query_obj

Revision ID: 126264a82d27
Revises: a9422eeaae74
Create Date: 2022-05-11 21:04:08.101050

"""

# revision identifiers, used by Alembic.
revision = "126264a82d27"
down_revision = "a9422eeaae74"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


def upgrade():
    op.add_column("query", sa.Column("json_metadata", sa.Text(), nullable=True))


def downgrade():
    try:
        op.drop_column("query", "json_metadata")
    except Exception:
        pass
