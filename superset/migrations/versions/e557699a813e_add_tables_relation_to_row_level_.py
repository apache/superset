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
"""add_tables_relation_to_row_level_security

Revision ID: e557699a813e
Revises: 743a117f0d98
Create Date: 2020-04-24 10:46:24.119363

"""

# revision identifiers, used by Alembic.
revision = "e557699a813e"
down_revision = "743a117f0d98"

import sqlalchemy as sa
from alembic import op

from superset.utils.core import generic_find_fk_constraint_name


def upgrade():
    bind = op.get_bind()
    metadata = sa.MetaData(bind=bind)
    insp = sa.engine.reflection.Inspector.from_engine(bind)

    rls_filter_tables = op.create_table(
        "rls_filter_tables",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("table_id", sa.Integer(), nullable=True),
        sa.Column("rls_filter_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["rls_filter_id"], ["row_level_security_filters.id"]),
        sa.ForeignKeyConstraint(["table_id"], ["tables.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    rlsf = sa.Table("row_level_security_filters", metadata, autoload=True)
    filter_ids = sa.select([rlsf.c.id, rlsf.c.table_id])

    for row in bind.execute(filter_ids):
        move_table_id = rls_filter_tables.insert().values(
            rls_filter_id=row["id"], table_id=row["table_id"]
        )
        bind.execute(move_table_id)

    with op.batch_alter_table("row_level_security_filters") as batch_op:
        fk_constraint_name = generic_find_fk_constraint_name(
            "row_level_security_filters", {"id"}, "tables", insp
        )
        if fk_constraint_name:
            batch_op.drop_constraint(fk_constraint_name, type_="foreignkey")
        batch_op.drop_column("table_id")


def downgrade():
    bind = op.get_bind()
    metadata = sa.MetaData(bind=bind)

    op.add_column(
        "row_level_security_filters",
        sa.Column(
            "table_id",
            sa.INTEGER(),
            sa.ForeignKey("tables.id"),
            autoincrement=False,
            nullable=True,
        ),
    )

    rlsf = sa.Table("row_level_security_filters", metadata, autoload=True)
    rls_filter_tables = sa.Table("rls_filter_tables", metadata, autoload=True)
    rls_filter_roles = sa.Table("rls_filter_roles", metadata, autoload=True)

    filter_tables = sa.select([rls_filter_tables.c.rls_filter_id]).group_by(
        rls_filter_tables.c.rls_filter_id
    )

    for row in bind.execute(filter_tables):
        filters_copy_ids = []
        filter_query = rlsf.select().where(rlsf.c.id == row["rls_filter_id"])
        filter_params = dict(bind.execute(filter_query).fetchone())
        origin_id = filter_params.pop("id", None)
        table_ids = bind.execute(
            sa.select([rls_filter_tables.c.table_id]).where(
                rls_filter_tables.c.rls_filter_id == row["rls_filter_id"]
            )
        ).fetchall()
        filter_params["table_id"] = table_ids.pop(0)[0]
        move_table_id = (
            rlsf.update().where(rlsf.c.id == origin_id).values(filter_params)
        )
        bind.execute(move_table_id)
        for table_id in table_ids:
            filter_params["table_id"] = table_id[0]
            copy_filter = rlsf.insert().values(filter_params)
            copy_id = bind.execute(copy_filter).inserted_primary_key[0]
            filters_copy_ids.append(copy_id)

        roles_query = rls_filter_roles.select().where(
            rls_filter_roles.c.rls_filter_id == origin_id
        )
        for role in bind.execute(roles_query):
            for copy_id in filters_copy_ids:
                role_filter = rls_filter_roles.insert().values(
                    role_id=role["role_id"], rls_filter_id=copy_id
                )
                bind.execute(role_filter)
        filters_copy_ids.clear()

    op.alter_column("row_level_security_filters", "table_id", nullable=False)
    op.drop_table("rls_filter_tables")
