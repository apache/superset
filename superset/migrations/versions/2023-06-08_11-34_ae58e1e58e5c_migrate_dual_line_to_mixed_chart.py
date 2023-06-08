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
"""migrate_dual_line_to_mixed_chart

Revision ID: ae58e1e58e5c
Revises: 4c5da39be729
Create Date: 2023-06-08 11:34:36.241939

"""

# revision identifiers, used by Alembic.
revision = "ae58e1e58e5c"
down_revision = "4c5da39be729"

from superset.migrations.shared.migrate_viz.processors import MigrateDualLine


def upgrade():
    MigrateDualLine.upgrade()


def downgrade():
    MigrateDualLine.downgrade()
