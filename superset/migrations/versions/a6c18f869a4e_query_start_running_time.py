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
"""query.start_running_time

Revision ID: a6c18f869a4e
Revises: 979c03af3341
Create Date: 2017-03-28 11:28:41.387182

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a6c18f869a4e"
down_revision = "979c03af3341"


def upgrade():
    op.add_column(
        "query",
        sa.Column(
            "start_running_time", sa.Numeric(precision=20, scale=6), nullable=True
        ),
    )


def downgrade():
    op.drop_column("query", "start_running_time")
