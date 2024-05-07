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
from __future__ import annotations

from dataclasses import dataclass

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector

from superset.utils.core import generic_find_fk_constraint_name

NAMING_CONVENTION = {
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
}


@dataclass(frozen=True)
class ForeignKey:
    table: str
    referent_table: str
    local_cols: list[str]
    remote_cols: list[str]

    @property
    def constraint_name(self) -> str:
        return f"fk_{self.table}_{self.local_cols[0]}_{self.referent_table}"


def redefine(
    foreign_key: ForeignKey,
    on_delete: str | None = None,
    on_update: str | None = None,
) -> None:
    """
    Redefine the foreign key constraint to include the ON DELETE and ON UPDATE
    constructs for cascading purposes.

    :params foreign_key: The foreign key constraint
    :param ondelete: If set, emit ON DELETE <value> when issuing DDL operations
    :param onupdate: If set, emit ON UPDATE <value> when issuing DDL operations
    """

    bind = op.get_bind()
    insp = Inspector.from_engine(bind)

    with op.batch_alter_table(
        foreign_key.table, naming_convention=NAMING_CONVENTION
    ) as batch_op:
        if constraint := generic_find_fk_constraint_name(
            table=foreign_key.table,
            columns=set(foreign_key.remote_cols),
            referenced=foreign_key.referent_table,
            insp=insp,
        ):
            batch_op.drop_constraint(constraint, type_="foreignkey")

        batch_op.create_foreign_key(
            constraint_name=foreign_key.constraint_name,
            referent_table=foreign_key.referent_table,
            local_cols=foreign_key.local_cols,
            remote_cols=foreign_key.remote_cols,
            ondelete=on_delete,
            onupdate=on_update,
        )


def delete_fk(table1: str, columns: set[str], table2: str) -> None:
    bind = op.get_bind()
    insp = sa.engine.reflection.Inspector.from_engine(bind)

    with op.batch_alter_table(
        "tab_state", naming_convention=NAMING_CONVENTION
    ) as batch_op:
        table_schema_id_constraint = generic_find_fk_constraint_name(
            table1, columns, table2, insp
        )
        if table_schema_id_constraint:
            batch_op.drop_constraint(
                table_schema_id_constraint,
                type_="foreignkey",
            )
