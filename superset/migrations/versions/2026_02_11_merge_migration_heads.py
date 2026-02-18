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
"""Merge migration heads (tasks table + dashboard version history).

Revision ID: f6a7b8c9d0e1
Revises: 4b2a8c9d3e1f, e5f6a7b8c9d0
Create Date: 2026-02-11

"""

# revision identifiers, used by Alembic.
revision = "f6a7b8c9d0e1"
down_revision = ("4b2a8c9d3e1f", "e5f6a7b8c9d0")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
