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
"""add template_params to tables

Revision ID: e502db2af7be
Revises: 5ccf602336a0
Create Date: 2018-05-09 23:45:14.296283

"""

# revision identifiers, used by Alembic.
revision = "e502db2af7be"
down_revision = "5ccf602336a0"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column("tables", sa.Column("template_params", sa.Text(), nullable=True))


def downgrade():
    try:
        op.drop_column("tables", "template_params")
    except Exception as ex:
        logging.warning(str(ex))
