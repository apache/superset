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
"""drop_column_allow_multi_schema_metadata_fetch


Revision ID: 291f024254b5
Revises: 6d3c6f9d665d
Create Date: 2022-08-31 19:30:33.665025

"""

# revision identifiers, used by Alembic.
revision = "291f024254b5"
down_revision = "6d3c6f9d665d"

import sqlalchemy as sa
from alembic import op


def upgrade():
    with op.batch_alter_table("dbs") as batch_op:
        batch_op.drop_column("allow_multi_schema_metadata_fetch")


def downgrade():
    op.add_column(
        "dbs",
        sa.Column(
            "allow_multi_schema_metadata_fetch",
            sa.Boolean(),
            nullable=True,
            default=True,
        ),
    )
