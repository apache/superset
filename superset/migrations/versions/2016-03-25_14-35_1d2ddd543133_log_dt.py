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
"""log dt

Revision ID: 1d2ddd543133
Revises: d2424a248d63
Create Date: 2016-03-25 14:35:44.642576

"""

# revision identifiers, used by Alembic.
revision = "1d2ddd543133"
down_revision = "d2424a248d63"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.add_column("logs", sa.Column("dt", sa.Date(), nullable=True))


def downgrade():
    op.drop_column("logs", "dt")
