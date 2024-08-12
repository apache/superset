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
"""add_certifications_columns_to_slice

Revision ID: f9847149153d
Revises: 32646df09c64
Create Date: 2021-11-03 14:07:09.905194

"""

# revision identifiers, used by Alembic.
import sqlalchemy as sa
from alembic import op

revision = "f9847149153d"
down_revision = "32646df09c64"


def upgrade():
    with op.batch_alter_table("slices") as batch_op:
        batch_op.add_column(sa.Column("certified_by", sa.Text(), nullable=True))
        batch_op.add_column(
            sa.Column("certification_details", sa.Text(), nullable=True)
        )


def downgrade():
    with op.batch_alter_table("slices") as batch_op:
        batch_op.drop_column("certified_by")
        batch_op.drop_column("certification_details")
