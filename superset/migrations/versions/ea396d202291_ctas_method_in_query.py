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
"""Add ctas_method to the Query object

Revision ID: ea396d202291
Revises: e557699a813e
Create Date: 2020-05-12 12:59:26.583276

"""

# revision identifiers, used by Alembic.
revision = "ea396d202291"
down_revision = "e557699a813e"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column(
        "query", sa.Column("ctas_method", sa.String(length=16), nullable=True)
    )
    op.add_column("dbs", sa.Column("allow_cvas", sa.Boolean(), nullable=True))


def downgrade():
    op.drop_column("query", "ctas_method")
    op.drop_column("dbs", "allow_cvas")
