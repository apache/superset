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
"""Add tmp_schema_name to the query object.

Revision ID: 72428d1ea401
Revises: 0a6f12f60c73
Create Date: 2020-02-20 08:52:22.877902

"""

# revision identifiers, used by Alembic.
revision = "72428d1ea401"
down_revision = "0a6f12f60c73"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column(
        "query", sa.Column("tmp_schema_name", sa.String(length=256), nullable=True)
    )


def downgrade():
    try:
        # sqlite doesn't like dropping the columns
        op.drop_column("query", "tmp_schema_name")
    except Exception:
        pass
