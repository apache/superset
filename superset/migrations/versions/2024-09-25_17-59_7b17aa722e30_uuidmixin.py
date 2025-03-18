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
"""UUIDMixin

Revision ID: 7b17aa722e30
Revises: 48cbb571fa3a
Create Date: 2024-09-25 17:59:21.028426

"""

import sqlalchemy as sa
import sqlalchemy_utils
from alembic import op

# revision identifiers, used by Alembic.
revision = "7b17aa722e30"
down_revision = "48cbb571fa3a"


def upgrade():
    op.add_column(
        "css_templates",
        sa.Column("uuid", sqlalchemy_utils.types.uuid.UUIDType(), nullable=True),
    )
    op.add_column(
        "favstar",
        sa.Column("uuid", sqlalchemy_utils.types.uuid.UUIDType(), nullable=True),
    )


def downgrade():
    op.drop_column("css_templates", "uuid")
    op.drop_column("favstar", "uuid")
