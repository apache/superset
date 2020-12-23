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
"""alert reports shared uniqueness

Revision ID: c878781977c6
Revises: 73fd22e742ab
Create Date: 2020-12-23 11:34:53.882200

"""

# revision identifiers, used by Alembic.
revision = "c878781977c6"
down_revision = "73fd22e742ab"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.mysql.base import MySQLDialect
from sqlalchemy.dialects.postgresql.base import PGDialect
from sqlalchemy.dialects.sqlite.base import SQLiteDialect
from sqlalchemy.engine.reflection import Inspector

from superset.utils.core import generic_find_uq_constraint_name


def upgrade():
    bind = op.get_bind()
    insp = sa.engine.reflection.Inspector.from_engine(bind)

    if not isinstance(bind.dialect, SQLiteDialect):
        op.drop_constraint("uq_report_schedule_name", "report_schedule", type_="unique")

        if isinstance(bind.dialect, MySQLDialect):
            op.drop_index(
                op.f("name"), table_name="report_schedule",
            )

        if isinstance(bind.dialect, PGDialect):
            op.drop_constraint(
                "report_schedule_name_key", "report_schedule", type_="unique"
            )
        op.create_unique_constraint(
            "uq_report_schedule_name_type", "report_schedule", ["name", "type"]
        )

    else:
        with op.batch_alter_table("report_schedule") as batch_op:
            batch_op.drop_column("name")
            batch_op.add_column(
                sa.Column("name", sa.String(length=150), nullable=False)
            )

        with op.batch_alter_table("report_schedule") as batch_op:
            batch_op.create_unique_constraint(
                "uq_report_schedule_name_type", ["name", "type"]
            )


def downgrade():
    bind = op.get_bind()
    insp = sa.engine.reflection.Inspector.from_engine(bind)

    if not isinstance(bind.dialect, SQLiteDialect):

        with op.batch_alter_table("report_schedule") as batch_op:
            batch_op.drop_constraint(
                generic_find_uq_constraint_name(
                    "report_schedule", {"name", "type"}, insp
                )
                or "uq_report_schedule_name_type",
                type_="unique",
            )
        with op.batch_alter_table("report_schedule") as batch_op:
            batch_op.create_unique_constraint("uq_report_schedule_name", ["name"])
