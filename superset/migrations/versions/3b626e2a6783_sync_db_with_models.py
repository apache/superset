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
"""Sync DB with the models.py.

Sqlite doesn't support alter on tables, that's why most of the operations
are surrounded with try except.

Revision ID: 3b626e2a6783
Revises: 5e4a03ef0bf0
Create Date: 2016-09-22 10:21:33.618976

"""
import logging

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

from superset import db
from superset.utils.core import generic_find_constraint_name

# revision identifiers, used by Alembic.
revision = "3b626e2a6783"
down_revision = "eca4694defa7"


def upgrade():
    # cleanup after: https://github.com/airbnb/superset/pull/1078
    try:
        slices_ibfk_1 = generic_find_constraint_name(
            table="slices",
            columns={"druid_datasource_id"},
            referenced="datasources",
            db=db,
        )
        slices_ibfk_2 = generic_find_constraint_name(
            table="slices", columns={"table_id"}, referenced="tables", db=db
        )

        with op.batch_alter_table("slices") as batch_op:
            if slices_ibfk_1:
                batch_op.drop_constraint(slices_ibfk_1, type_="foreignkey")
            if slices_ibfk_2:
                batch_op.drop_constraint(slices_ibfk_2, type_="foreignkey")
            batch_op.drop_column("druid_datasource_id")
            batch_op.drop_column("table_id")
    except Exception as ex:
        logging.warning(str(ex))

    # fixed issue: https://github.com/airbnb/superset/issues/466
    try:
        with op.batch_alter_table("columns") as batch_op:
            batch_op.create_foreign_key(
                None, "datasources", ["datasource_name"], ["datasource_name"]
            )
    except Exception as ex:
        logging.warning(str(ex))
    try:
        with op.batch_alter_table("query") as batch_op:
            batch_op.create_unique_constraint("client_id", ["client_id"])
    except Exception as ex:
        logging.warning(str(ex))

    try:
        with op.batch_alter_table("query") as batch_op:
            batch_op.drop_column("name")
    except Exception as ex:
        logging.warning(str(ex))


def downgrade():
    try:
        with op.batch_alter_table("tables") as batch_op:
            batch_op.create_index("table_name", ["table_name"], unique=True)
    except Exception as ex:
        logging.warning(str(ex))

    try:
        with op.batch_alter_table("slices") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "table_id",
                    mysql.INTEGER(display_width=11),
                    autoincrement=False,
                    nullable=True,
                )
            )
            batch_op.add_column(
                sa.Column(
                    "druid_datasource_id",
                    sa.Integer(),
                    autoincrement=False,
                    nullable=True,
                )
            )
            batch_op.create_foreign_key(
                "slices_ibfk_1", "datasources", ["druid_datasource_id"], ["id"]
            )
            batch_op.create_foreign_key("slices_ibfk_2", "tables", ["table_id"], ["id"])
    except Exception as ex:
        logging.warning(str(ex))

    try:
        fk_columns = generic_find_constraint_name(
            table="columns",
            columns={"datasource_name"},
            referenced="datasources",
            db=db,
        )
        with op.batch_alter_table("columns") as batch_op:
            batch_op.drop_constraint(fk_columns, type_="foreignkey")
    except Exception as ex:
        logging.warning(str(ex))

    op.add_column("query", sa.Column("name", sa.String(length=256), nullable=True))
    try:
        with op.batch_alter_table("query") as batch_op:
            batch_op.drop_constraint("client_id", type_="unique")
    except Exception as ex:
        logging.warning(str(ex))
