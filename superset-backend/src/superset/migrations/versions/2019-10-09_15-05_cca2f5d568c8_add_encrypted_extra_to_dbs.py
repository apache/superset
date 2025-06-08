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
"""add encrypted_extra to dbs

Revision ID: cca2f5d568c8
Revises: b6fa807eac07
Create Date: 2019-10-09 15:05:06.965042

"""

# revision identifiers, used by Alembic.
revision = "cca2f5d568c8"
down_revision = "b6fa807eac07"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.add_column("dbs", sa.Column("encrypted_extra", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("dbs", "encrypted_extra")
