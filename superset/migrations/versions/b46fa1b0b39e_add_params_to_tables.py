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
"""Add json_metadata to the tables table.

Revision ID: b46fa1b0b39e
Revises: ef8843b41dac
Create Date: 2016-10-05 11:30:31.748238

"""

# revision identifiers, used by Alembic.
revision = "b46fa1b0b39e"
down_revision = "ef8843b41dac"

from alembic import op
import logging
import sqlalchemy as sa


def upgrade():
    op.add_column("tables", sa.Column("params", sa.Text(), nullable=True))


def downgrade():
    try:
        op.drop_column("tables", "params")
    except Exception as e:
        logging.warning(str(e))
