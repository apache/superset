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
"""update base columns

Note that the columns table was previously partially modifed by revision
f231d82b9b26.

Revision ID: 7f2635b51f5d
Revises: 937d04c16b64
Create Date: 2018-07-20 15:31:05.058050

"""

# revision identifiers, used by Alembic.
revision = "7f2635b51f5d"
down_revision = "937d04c16b64"

from alembic import op  # noqa: E402
from sqlalchemy import Column, engine, Integer, String  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402
from superset.utils.core import generic_find_uq_constraint_name  # noqa: E402

Base = declarative_base()

conv = {"uq": "uq_%(table_name)s_%(column_0_name)s"}


class BaseColumnMixin:
    id = Column(Integer, primary_key=True)


class DruidColumn(BaseColumnMixin, Base):
    __tablename__ = "columns"

    datasource_id = Column(Integer)


class TableColumn(BaseColumnMixin, Base):
    __tablename__ = "table_columns"

    table_id = Column(Integer)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    # Delete the orphaned columns records.
    for record in session.query(DruidColumn).all():
        if record.datasource_id is None:
            session.delete(record)

    session.commit()

    # Enforce that the columns.column_name column be non-nullable.
    with op.batch_alter_table("columns") as batch_op:
        batch_op.alter_column("column_name", existing_type=String(255), nullable=False)

    # Delete the orphaned table_columns records.
    for record in session.query(TableColumn).all():
        if record.table_id is None:
            session.delete(record)

    session.commit()

    # Reduce the size of the table_columns.column_name column for constraint
    # viability and enforce that it be non-nullable.
    with op.batch_alter_table("table_columns") as batch_op:
        batch_op.alter_column(
            "column_name", existing_type=String(256), nullable=False, type_=String(255)
        )

    # Add the missing uniqueness constraint to the table_columns table.
    with op.batch_alter_table("table_columns", naming_convention=conv) as batch_op:
        batch_op.create_unique_constraint(
            "uq_table_columns_column_name", ["column_name", "table_id"]
        )


def downgrade():
    bind = op.get_bind()
    insp = engine.reflection.Inspector.from_engine(bind)

    # Remove the missing uniqueness constraint from the table_columns table.
    with op.batch_alter_table("table_columns", naming_convention=conv) as batch_op:
        batch_op.drop_constraint(
            generic_find_uq_constraint_name(
                "table_columns", {"column_name", "table_id"}, insp
            )
            or "uq_table_columns_column_name",
            type_="unique",
        )

    # Restore the size of the table_columns.column_name column and forego that
    # it be non-nullable.
    with op.batch_alter_table("table_columns") as batch_op:
        batch_op.alter_column(
            "column_name", existing_type=String(255), nullable=True, type_=String(256)
        )

    # Forego that the columns.column_name be non-nullable.
    with op.batch_alter_table("columns") as batch_op:
        batch_op.alter_column("column_name", existing_type=String(255), nullable=True)
