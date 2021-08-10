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
"""change_fetch_values_predicate_to_text

Revision ID: 07071313dd52
Revises: f6196627326f
Create Date: 2021-08-09 17:32:56.204184

"""

# revision identifiers, used by Alembic.
revision = "07071313dd52"
down_revision = "f6196627326f"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


def upgrade():
    with op.batch_alter_table("tables") as batch_op:
        batch_op.alter_column(
            "fetch_values_predicate",
            existing_type=sa.String(length=1000),
            type_=sa.Text(),
            existing_nullable=True,
        )


def downgrade():
    with op.batch_alter_table("tables") as batch_op:
        batch_op.alter_column(
            "fetch_values_predicate",
            existing_type=sa.Text(),
            type_=sa.String(length=1000),
            existing_nullable=True,
        )
