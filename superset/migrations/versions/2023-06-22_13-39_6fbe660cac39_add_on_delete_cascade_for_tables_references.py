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
"""add on delete cascade for tables references

Revision ID: 6fbe660cac39
Revises: 90139bf715e4
Create Date: 2023-06-22 13:39:47.989373

"""
from __future__ import annotations

# revision identifiers, used by Alembic.
revision = "6fbe660cac39"
down_revision = "90139bf715e4"

import sqlalchemy as sa
from alembic import op

from superset.utils.core import generic_find_fk_constraint_name


def migrate(ondelete: str | None) -> None:
    """
    Redefine the foreign key constraints, via a successive DROP and ADD, for all tables
    related to the `tables` table to include the ON DELETE construct for cascading
    purposes.

    :param ondelete: If set, emit ON DELETE <value> when issuing DDL for this constraint
    """

    bind = op.get_bind()
    insp = sa.engine.reflection.Inspector.from_engine(bind)

    conv = {
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    }

    for table in ("sql_metrics", "table_columns"):
        with op.batch_alter_table(table, naming_convention=conv) as batch_op:
            if constraint := generic_find_fk_constraint_name(
                table=table,
                columns={"id"},
                referenced="tables",
                insp=insp,
            ):
                batch_op.drop_constraint(constraint, type_="foreignkey")

            batch_op.create_foreign_key(
                constraint_name=f"fk_{table}_table_id_tables",
                referent_table="tables",
                local_cols=["table_id"],
                remote_cols=["id"],
                ondelete=ondelete,
            )

    with op.batch_alter_table("sqlatable_user", naming_convention=conv) as batch_op:
        for table, column in zip(("ab_user", "tables"), ("user_id", "table_id")):
            if constraint := generic_find_fk_constraint_name(
                table="sqlatable_user",
                columns={"id"},
                referenced=table,
                insp=insp,
            ):
                batch_op.drop_constraint(constraint, type_="foreignkey")

            batch_op.create_foreign_key(
                constraint_name=f"fk_sqlatable_user_{column}_{table}",
                referent_table=table,
                local_cols=[column],
                remote_cols=["id"],
                ondelete=ondelete,
            )


def upgrade():
    migrate(ondelete="CASCADE")


def downgrade():
    migrate(ondelete=None)
