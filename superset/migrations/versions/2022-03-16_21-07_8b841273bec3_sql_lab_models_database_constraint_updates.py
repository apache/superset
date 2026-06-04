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
"""sql_lab_models_database_constraint_updates

Revision ID: 8b841273bec3
Revises: 2ed890b36b94
Create Date: 2022-03-16 21:07:48.768425

"""

# revision identifiers, used by Alembic.
revision = "8b841273bec3"
down_revision = "2ed890b36b94"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402

from superset.utils.core import generic_find_fk_constraint_name  # noqa: E402


def upgrade():
    bind = op.get_bind()
    insp = sa.engine.reflection.Inspector.from_engine(bind)

    with op.batch_alter_table("tab_state") as batch_op:
        table_schema_id_constraint = generic_find_fk_constraint_name(
            "tab_state", {"id"}, "dbs", insp
        )
        if table_schema_id_constraint:
            batch_op.drop_constraint(
                table_schema_id_constraint,
                type_="foreignkey",
            )

        table_schema_id_constraint = generic_find_fk_constraint_name(
            "tab_state", {"client_id"}, "query", insp
        )
        if table_schema_id_constraint:
            batch_op.drop_constraint(
                table_schema_id_constraint,
                type_="foreignkey",
            )

        batch_op.create_foreign_key(
            "tab_state_database_id_fkey",
            "dbs",
            ["database_id"],
            ["id"],
            ondelete="CASCADE",
        )

        batch_op.create_foreign_key(
            "tab_state_latest_query_id_fkey",
            "query",
            ["latest_query_id"],
            ["client_id"],
            ondelete="SET NULL",
        )

    with op.batch_alter_table("table_schema") as batch_op:
        table_schema_id_constraint = generic_find_fk_constraint_name(
            "table_schema", {"id"}, "dbs", insp
        )
        if table_schema_id_constraint:
            batch_op.drop_constraint(
                table_schema_id_constraint,
                type_="foreignkey",
            )

        batch_op.create_foreign_key(
            "table_schema_database_id_fkey",
            "dbs",
            ["database_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade():
    bind = op.get_bind()
    insp = sa.engine.reflection.Inspector.from_engine(bind)

    with op.batch_alter_table("tab_state") as batch_op:
        table_schema_id_constraint = generic_find_fk_constraint_name(
            "tab_state", {"id"}, "dbs", insp
        )
        if table_schema_id_constraint:
            batch_op.drop_constraint(
                table_schema_id_constraint,
                type_="foreignkey",
            )

        table_schema_id_constraint = generic_find_fk_constraint_name(
            "tab_state", {"client_id"}, "query", insp
        )
        if table_schema_id_constraint:
            batch_op.drop_constraint(
                table_schema_id_constraint,
                type_="foreignkey",
            )

        batch_op.create_foreign_key(
            "tab_state_database_id_fkey", "dbs", ["database_id"], ["id"]
        )
        batch_op.create_foreign_key(
            "tab_state_latest_query_id_fkey",
            "query",
            ["latest_query_id"],
            ["client_id"],
        )

    with op.batch_alter_table("table_schema") as batch_op:
        table_schema_id_constraint = generic_find_fk_constraint_name(
            "table_schema", {"id"}, "dbs", insp
        )
        if table_schema_id_constraint:
            batch_op.drop_constraint(
                table_schema_id_constraint,
                type_="foreignkey",
            )

        batch_op.create_foreign_key(
            "table_schema_database_id_fkey", "dbs", ["database_id"], ["id"]
        )
