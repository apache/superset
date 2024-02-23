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
"""Fix wrong constraint on table columns

Revision ID: 1226819ee0e3
Revises: 956a063c52b3
Create Date: 2016-05-27 15:03:32.980343

"""
import logging

from alembic import op

from superset import db
from superset.utils.core import generic_find_constraint_name

# revision identifiers, used by Alembic.
revision = "1226819ee0e3"
down_revision = "956a063c52b3"


naming_convention = {
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"
}


def find_constraint_name(upgrade=True):
    cols = {"column_name"} if upgrade else {"datasource_name"}
    return generic_find_constraint_name(
        table="columns", columns=cols, referenced="datasources", database=db
    )


def upgrade():
    try:
        constraint = find_constraint_name()
        with op.batch_alter_table(
            "columns", naming_convention=naming_convention
        ) as batch_op:
            if constraint:
                batch_op.drop_constraint(constraint, type_="foreignkey")
            batch_op.create_foreign_key(
                "fk_columns_datasource_name_datasources",
                "datasources",
                ["datasource_name"],
                ["datasource_name"],
            )
    except:
        logging.warning("Could not find or drop constraint on `columns`")


def downgrade():
    constraint = find_constraint_name(False) or "fk_columns_datasource_name_datasources"
    with op.batch_alter_table(
        "columns", naming_convention=naming_convention
    ) as batch_op:
        batch_op.drop_constraint(constraint, type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_columns_column_name_datasources",
            "datasources",
            ["column_name"],
            ["datasource_name"],
        )
