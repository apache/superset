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
"""slice non-nullable

Revision ID: 1be0344d4b76
Revises: c82ee8a39623
Create Date: 2019-03-25 10:02:38.055193

"""

# revision identifiers, used by Alembic.
revision = '1be0344d4b76'
down_revision = 'c82ee8a39623'

from alembic import op
from sqlalchemy import Integer, String


def upgrade():

    # Enforce that the slices.datasource_id, slices.datasource_name, and
    # slices.datasource_type columns be non-nullable.
    with op.batch_alter_table('slices') as batch_op:
        batch_op.alter_column(
            'slice_id',
            existing_type=Integer,
            nullable=False,
        )

        batch_op.alter_column(
            'datasource_name',
            existing_type=String(2000),
            nullable=False,
        )

        batch_op.alter_column(
            'datasource_type',
            existing_type=String(200),
            nullable=False,
        )


def downgrade():

    # Forego that the slices.datasource_id, slices.datasource_name, and
    # slices.datasource_type columns be non-nullable.
    with op.batch_alter_table('slices') as batch_op:
        batch_op.alter_column(
            'slice_id',
            existing_type=Integer,
            nullable=True,
        )

        batch_op.alter_column(
            'datasource_name',
            existing_type=String(2000),
            nullable=True,
        )

        batch_op.alter_column(
            'datasource_type',
            existing_type=String(200),
            nullable=True,
        )
