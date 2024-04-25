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

from alembic.operations import Operations

naming_convention = {
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
}


def create_unique_constraint(
    op: Operations, index_id: str, table_name: str, uix_columns: list[str]
) -> None:
    with op.batch_alter_table(
        table_name, naming_convention=naming_convention
    ) as batch_op:
        batch_op.create_unique_constraint(index_id, uix_columns)


def drop_unique_constraint(op: Operations, index_id: str, table_name: str) -> None:
    dialect = op.get_bind().dialect.name

    with op.batch_alter_table(
        table_name, naming_convention=naming_convention
    ) as batch_op:
        if dialect == "mysql":
            # MySQL requires specifying the type of constraint
            batch_op.drop_constraint(index_id, type_="unique")
        else:
            # For other databases, a standard drop_constraint call is sufficient
            batch_op.drop_constraint(index_id)
