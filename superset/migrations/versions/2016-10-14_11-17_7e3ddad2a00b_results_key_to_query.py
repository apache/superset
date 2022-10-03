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
"""results_key to query

Revision ID: 7e3ddad2a00b
Revises: b46fa1b0b39e
Create Date: 2016-10-14 11:17:54.995156

"""

# revision identifiers, used by Alembic.
revision = "7e3ddad2a00b"
down_revision = "b46fa1b0b39e"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column(
        "query", sa.Column("results_key", sa.String(length=64), nullable=True)
    )


def downgrade():
    op.drop_column("query", "results_key")
