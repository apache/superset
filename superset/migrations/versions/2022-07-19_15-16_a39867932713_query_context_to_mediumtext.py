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
"""query_context_to_mediumtext

Revision ID: a39867932713
Revises: 06e1e70058c7
Create Date: 2022-07-19 15:16:06.091961

"""

from alembic import op
from sqlalchemy.dialects.mysql.base import MySQLDialect

# revision identifiers, used by Alembic.
revision = "a39867932713"
down_revision = "06e1e70058c7"


def upgrade():
    if isinstance(op.get_bind().dialect, MySQLDialect):
        # If the columns are already MEDIUMTEXT, this is a no-op
        op.execute("ALTER TABLE slices MODIFY params MEDIUMTEXT")
        op.execute("ALTER TABLE slices MODIFY query_context MEDIUMTEXT")


def downgrade():
    # It's Okay to keep these columns as MEDIUMTEXT
    # Since some oraganizations may have already manually changed the type
    # and downgrade may loose data so we don't do it.
    pass
