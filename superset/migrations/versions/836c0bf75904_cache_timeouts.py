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
"""cache_timeouts

Revision ID: 836c0bf75904
Revises: 18e88e1cc004
Create Date: 2016-03-17 08:40:03.186534

"""
# revision identifiers, used by Alembic.
revision = "836c0bf75904"
down_revision = "18e88e1cc004"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column(
        "datasources", sa.Column("cache_timeout", sa.Integer(), nullable=True)
    )
    op.add_column("dbs", sa.Column("cache_timeout", sa.Integer(), nullable=True))
    op.add_column("slices", sa.Column("cache_timeout", sa.Integer(), nullable=True))
    op.add_column("tables", sa.Column("cache_timeout", sa.Integer(), nullable=True))


def downgrade():
    op.drop_column("tables", "cache_timeout")
    op.drop_column("slices", "cache_timeout")
    op.drop_column("dbs", "cache_timeout")
    op.drop_column("datasources", "cache_timeout")
