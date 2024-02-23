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
"""materialize perms

Revision ID: e46f2d27a08e
Revises: c611f2b591b8
Create Date: 2016-11-14 15:23:32.594898

"""
# revision identifiers, used by Alembic.
revision = "e46f2d27a08e"
down_revision = "c611f2b591b8"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column(
        "datasources", sa.Column("perm", sa.String(length=1000), nullable=True)
    )
    op.add_column("dbs", sa.Column("perm", sa.String(length=1000), nullable=True))
    op.add_column("tables", sa.Column("perm", sa.String(length=1000), nullable=True))


def downgrade():
    op.drop_column("tables", "perm")
    op.drop_column("datasources", "perm")
    op.drop_column("dbs", "perm")
