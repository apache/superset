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
"""Fix schema perm for datasets

Revision ID: 0769ef90fddd
Revises: ee179a490af9
Create Date: 2023-08-02 15:23:58.242396

"""

# revision identifiers, used by Alembic.
revision = "0769ef90fddd"
down_revision = "ee179a490af9"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402
from sqlalchemy.dialects.sqlite.base import SQLiteDialect  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402

Base = declarative_base()


class Dataset(Base):
    __tablename__ = "tables"

    id = sa.Column(sa.Integer, primary_key=True)
    schema = sa.Column(sa.String(255))
    schema_perm = sa.Column(sa.String(1000))
    database_id = sa.Column(sa.Integer, sa.ForeignKey("dbs.id"))


class Slice(Base):
    __tablename__ = "slices"

    id = sa.Column(sa.Integer, primary_key=True)
    schema_perm = sa.Column(sa.String(1000))
    datasource_id = sa.Column(sa.Integer)


class Database(Base):
    __tablename__ = "dbs"

    id = sa.Column(sa.Integer, primary_key=True)
    database_name = sa.Column(sa.String(250))


def fix_datasets_schema_perm(session):
    for result in (
        session.query(Dataset, Database.database_name)
        .join(Database)
        .filter(Dataset.schema.isnot(None))
        .filter(
            Dataset.schema_perm
            != sa.func.concat("[", Database.database_name, "].[", Dataset.schema, "]")
        )
    ):
        result.Dataset.schema_perm = (
            f"[{result.database_name}].[{result.Dataset.schema}]"
        )


def fix_charts_schema_perm(session):
    for result in (
        session.query(Slice, Dataset, Database.database_name)
        .join(Dataset, Slice.datasource_id == Dataset.id)
        .join(Database, Dataset.database_id == Database.id)
        .filter(Dataset.schema.isnot(None))
        .filter(
            Slice.schema_perm
            != sa.func.concat("[", Database.database_name, "].[", Dataset.schema, "]")
        )
    ):
        result.Slice.schema_perm = f"[{result.database_name}].[{result.Dataset.schema}]"


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    if isinstance(bind.dialect, SQLiteDialect):
        return  # sqlite doesn't have a concat function

    fix_datasets_schema_perm(session)
    fix_charts_schema_perm(session)

    session.commit()
    session.close()


def downgrade():
    pass
