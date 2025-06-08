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
"""Add index on the result key to the query table.

Revision ID: f18570e03440
Revises: 1296d28ec131
Create Date: 2017-01-24 12:40:42.494787

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "f18570e03440"
down_revision = "1296d28ec131"


def upgrade():
    op.create_index(
        op.f("ix_query_results_key"), "query", ["results_key"], unique=False
    )


def downgrade():
    op.drop_index(op.f("ix_query_results_key"), table_name="query")
