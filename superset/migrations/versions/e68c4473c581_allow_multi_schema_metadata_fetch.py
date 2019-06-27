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
"""allow_multi_schema_metadata_fetch

Revision ID: e68c4473c581
Revises: e866bd2d4976
Create Date: 2018-03-06 12:24:30.896293

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "e68c4473c581"
down_revision = "e866bd2d4976"


def upgrade():

    op.add_column(
        "dbs",
        sa.Column(
            "allow_multi_schema_metadata_fetch",
            sa.Boolean(),
            nullable=True,
            default=True,
        ),
    )


def downgrade():
    op.drop_column("dbs", "allow_multi_schema_metadata_fetch")
