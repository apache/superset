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
"""allow_dml

Revision ID: 65903709c321
Revises: 4500485bde7d
Create Date: 2016-09-15 08:48:27.284752

"""

import logging

# revision identifiers, used by Alembic.
revision = "65903709c321"
down_revision = "4500485bde7d"

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column("dbs", sa.Column("allow_dml", sa.Boolean(), nullable=True))


def downgrade():
    try:
        op.drop_column("dbs", "allow_dml")
    except Exception as e:
        logging.exception(e)
        pass
