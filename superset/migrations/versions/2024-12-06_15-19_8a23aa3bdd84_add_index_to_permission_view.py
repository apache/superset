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
"""Add index to permission view

Revision ID: 8a23aa3bdd84
Revises: 48cbb571fa3a
Create Date: 2024-12-06 15:19:00.030588

"""

from alembic import op

from superset.migrations.shared.utils import table_has_index

# revision identifiers, used by Alembic.
revision = "8a23aa3bdd84"
down_revision = "48cbb571fa3a"

perm_table = "ab_permission_view"
perm_index_view_menu = "idx_permission_view_menu_id"
perm_index_permission_id = "idx_permission_permission_id"


def upgrade():
    if not table_has_index(perm_table, perm_index_view_menu):
        op.create_index(op.f(perm_index_view_menu), perm_table, ["view_menu_id"])

    if not table_has_index(perm_table, perm_index_permission_id):
        op.create_index(op.f(perm_index_permission_id), perm_table, ["permission_id"])


def downgrade():
    if table_has_index(perm_table, perm_index_permission_id):
        op.drop_index(op.f(perm_index_permission_id), table_name=perm_table)

    if table_has_index(perm_table, perm_index_view_menu):
        op.drop_index(op.f(perm_index_view_menu), table_name=perm_table)
