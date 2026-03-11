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
"""empty message

Revision ID: 5a7bad26f2a7
Revises: 4e6a06bad7a8
Create Date: 2015-10-05 10:32:15.850753

"""

# revision identifiers, used by Alembic.
revision = "5a7bad26f2a7"
down_revision = "4e6a06bad7a8"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.add_column("dashboards", sa.Column("css", sa.Text(), nullable=True))
    op.add_column("dashboards", sa.Column("description", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("dashboards", "description")
    op.drop_column("dashboards", "css")
