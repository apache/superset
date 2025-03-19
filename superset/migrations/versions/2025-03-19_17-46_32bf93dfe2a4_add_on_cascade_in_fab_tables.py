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
"""Add on cascade to foreign keys in ab_permission_view_role and ab_user_role

Revision ID: 32bf93dfe2a4
Revises: 94e7a3499973
Create Date: 2025-03-19 17:46:25.702610

"""

from alembic import op
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = "32bf93dfe2a4"
down_revision = "94e7a3499973"


def constraint_exists(table_name, constraint_name):
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    constraints = [fk["name"] for fk in inspector.get_foreign_keys(table_name)]
    return constraint_name in constraints


def upgrade():
    if constraint_exists(
        "ab_permission_view_role", "ab_permission_view_role_permission_view_id_fkey"
    ):
        op.drop_constraint(
            "ab_permission_view_role_permission_view_id_fkey",
            "ab_permission_view_role",
            type_="foreignkey",
        )
    if constraint_exists(
        "ab_permission_view_role", "ab_permission_view_role_role_id_fkey"
    ):
        op.drop_constraint(
            "ab_permission_view_role_role_id_fkey",
            "ab_permission_view_role",
            type_="foreignkey",
        )

    op.create_foreign_key(
        "ab_permission_view_role_role_id_fkey",
        "ab_permission_view_role",
        "ab_role",
        ["role_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "ab_permission_view_role_permission_view_id_fkey",
        "ab_permission_view_role",
        "ab_permission_view",
        ["permission_view_id"],
        ["id"],
        ondelete="CASCADE",
    )

    if constraint_exists("ab_user_role", "ab_user_role_user_id_fkey"):
        op.drop_constraint(
            "ab_user_role_user_id_fkey", "ab_user_role", type_="foreignkey"
        )
    if constraint_exists("ab_user_role", "ab_user_role_role_id_fkey"):
        op.drop_constraint(
            "ab_user_role_role_id_fkey", "ab_user_role", type_="foreignkey"
        )

    op.create_foreign_key(
        "ab_user_role_user_id_fkey",
        "ab_user_role",
        "ab_user",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "ab_user_role_role_id_fkey",
        "ab_user_role",
        "ab_role",
        ["role_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade():
    if constraint_exists(
        "ab_permission_view_role", "ab_permission_view_role_permission_view_id_fkey"
    ):
        op.drop_constraint(
            "ab_permission_view_role_permission_view_id_fkey",
            "ab_permission_view_role",
            type_="foreignkey",
        )
    if constraint_exists(
        "ab_permission_view_role", "ab_permission_view_role_role_id_fkey"
    ):
        op.drop_constraint(
            "ab_permission_view_role_role_id_fkey",
            "ab_permission_view_role",
            type_="foreignkey",
        )

    op.create_foreign_key(
        "ab_permission_view_role_permission_view_id_fkey",
        "ab_permission_view_role",
        "ab_permission_view",
        ["permission_view_id"],
        ["id"],
    )
    op.create_foreign_key(
        "ab_permission_view_role_role_id_fkey",
        "ab_permission_view_role",
        "ab_role",
        ["role_id"],
        ["id"],
    )
    if constraint_exists("ab_user_role", "ab_user_role_role_id_fkey"):
        op.drop_constraint(
            "ab_user_role_role_id_fkey", "ab_user_role", type_="foreignkey"
        )
    if constraint_exists("ab_user_role", "ab_user_role_user_id_fkey"):
        op.drop_constraint(
            "ab_user_role_user_id_fkey", "ab_user_role", type_="foreignkey"
        )

    op.create_foreign_key(
        "ab_user_role_user_id_fkey", "ab_user_role", "ab_user", ["user_id"], ["id"]
    )
    op.create_foreign_key(
        "ab_user_role_role_id_fkey", "ab_user_role", "ab_role", ["role_id"], ["id"]
    )
