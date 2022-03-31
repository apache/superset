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
"""add_default_db_schema_dataset_model

Revision ID: d77e075540d1
Revises: 58df9d617f14
Create Date: 2022-03-29 22:03:50.533742

"""

# revision identifiers, used by Alembic.
revision = "d77e075540d1"
down_revision = "58df9d617f14"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.mysql.base import MySQLDialect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

from superset import db

Base = declarative_base()


class Database(Base):

    __tablename__ = "dbs"
    id = sa.Column(sa.Integer, primary_key=True)


class SqlaTable(Base):
    __tablename__ = "tables"

    id = sa.Column(sa.Integer, primary_key=True)
    schema = sa.Column(sa.String(255))
    database_id = sa.Column(sa.Integer, sa.ForeignKey(Database.id), nullable=False)


class Dataset(Base):
    __tablename__ = "sl_datasets"

    id = sa.Column(sa.Integer, primary_key=True)
    sqlatable_id = sa.Column(sa.Integer, nullable=True, unique=True)
    default_schema = sa.Column(sa.Text, nullable=False)
    database_id = sa.Column(sa.Integer, sa.ForeignKey("dbs.id"), nullable=False)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    # initially set value nullable too allow us to create column
    op.add_column(
        "sl_datasets",
        sa.Column(
            "default_schema",
            sa.Text(),
            nullable=True,
        ),
    )
    op.add_column(
        "sl_datasets",
        sa.Column(
            "database_id",
            sa.Integer(),
            sa.ForeignKey("dbs.id"),
            nullable=True,
        ),
    )

    # fill in columns with default values
    for sqlatable in session.query(SqlaTable).all():
        try:
            ds = (
                session.query(Dataset)
                .filter(Dataset.sqlatable_id == sqlatable.id)
                .one()
            )
        except sa.orm.exc.NoResultFound:
            continue

        ds.default_schema = sqlatable.schema
        ds.database_id = sqlatable.database_id

    # alter column to be not nullable
    op.alter_column(
        "sl_datasets",
        sa.Column(
            "default_schema",
            sa.Text(),
            nullable=False,
        ),
    )
    op.alter_column(
        "sl_datasets",
        sa.Column(
            "database_id",
            sa.Integer(),
            sa.ForeignKey("dbs.id"),
            nullable=False,
        ),
    )
    session.commit()
    session.close()


def downgrade():
    op.drop_column("sl_datasets", "default_schema")
    op.drop_column("sl_datasets", "database_id")
