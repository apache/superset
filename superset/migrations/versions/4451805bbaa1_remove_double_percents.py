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
"""remove double percents

Revision ID: 4451805bbaa1
Revises: afb7730f6a9c
Create Date: 2018-06-13 10:20:35.846744

"""

# revision identifiers, used by Alembic.
revision = "4451805bbaa1"
down_revision = "bddc498dd179"


from alembic import op
import json
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, create_engine, ForeignKey, Integer, String, Text

from superset import db

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    datasource_id = Column(Integer, ForeignKey("tables.id"))
    datasource_type = Column(String(200))
    params = Column(Text)


class Table(Base):
    __tablename__ = "tables"

    id = Column(Integer, primary_key=True)
    database_id = Column(Integer, ForeignKey("dbs.id"))


class Database(Base):
    __tablename__ = "dbs"

    id = Column(Integer, primary_key=True)
    sqlalchemy_uri = Column(String(1024))


def replace(source, target):
    bind = op.get_bind()
    session = db.Session(bind=bind)

    query = (
        session.query(Slice, Database)
        .join(Table, Slice.datasource_id == Table.id)
        .join(Database, Table.database_id == Database.id)
        .filter(Slice.datasource_type == "table")
        .all()
    )

    for slc, database in query:
        try:
            engine = create_engine(database.sqlalchemy_uri)

            if engine.dialect.identifier_preparer._double_percents:
                params = json.loads(slc.params)

                if "adhoc_filters" in params:
                    for filt in params["adhoc_filters"]:
                        if "sqlExpression" in filt:
                            filt["sqlExpression"] = filt["sqlExpression"].replace(
                                source, target
                            )

                    slc.params = json.dumps(params, sort_keys=True)
        except Exception:
            pass

    session.commit()
    session.close()


def upgrade():
    replace("%%", "%")


def downgrade():
    replace("%", "%%")
