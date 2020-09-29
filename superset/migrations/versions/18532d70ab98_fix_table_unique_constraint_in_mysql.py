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
"""Delete table_name unique constraint in mysql

Revision ID: 18532d70ab98
Revises: e5ef6828ac4e
Create Date: 2020-09-25 10:56:13.711182

"""

# revision identifiers, used by Alembic.
revision = "18532d70ab98"
down_revision = "e5ef6828ac4e"

from alembic import op


def upgrade():
    try:
        # index only exists in mysql db
        with op.get_context().autocommit_block():
            op.drop_constraint("table_name", "tables", type_="unique")
    except Exception as ex:
        print(ex)


def downgrade():
    pass
