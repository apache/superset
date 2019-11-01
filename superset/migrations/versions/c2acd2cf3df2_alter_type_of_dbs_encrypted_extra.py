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
"""alter type of dbs encrypted_extra


Revision ID: c2acd2cf3df2
Revises: cca2f5d568c8
Create Date: 2019-11-01 09:18:36.953603

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import EncryptedType

# revision identifiers, used by Alembic.
revision = "c2acd2cf3df2"
down_revision = "cca2f5d568c8"


def upgrade():
    with op.batch_alter_table("dbs") as batch_op:
        try:
            # Postgres migration
            batch_op.alter_column(
                "encrypted_extra",
                existing_type=sa.Text(),
                type_=EncryptedType(sa.Text()),
                postgresql_using="encrypted_extra::bytea",
                existing_nullable=True,
            )
        except TypeError:
            # non-Postgres migration
            batch_op.alter_column(
                "dbs",
                "encrypted_extra",
                existing_type=sa.Text(),
                type_=EncryptedType(sa.Text()),
                existing_nullable=True,
            )


def downgrade():
    with op.batch_alter_table("dbs") as batch_op:
        batch_op.alter_column(
            "encrypted_extra",
            existing_type=EncryptedType(sa.Text()),
            type_=sa.Text(),
            existing_nullable=True,
        )
