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
"""Remove path, path_no_int, and ref from logs

Revision ID: 811494c0cc23
Revises: 8ee129739cf9
Create Date: 2020-12-03 16:21:06.771684

"""

# revision identifiers, used by Alembic.
revision = "811494c0cc23"
down_revision = "8ee129739cf9"

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared import utils


def upgrade():
    with op.batch_alter_table("logs") as batch_op:
        if utils.table_has_column("logs", "path"):
            batch_op.drop_column("path")
        if utils.table_has_column("logs", "path_no_int"):
            batch_op.drop_column("path_no_int")
        if utils.table_has_column("logs", "ref"):
            batch_op.drop_column("ref")


def downgrade():
    pass
