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
"""update time_grain_sqla

Revision ID: 620241d1153f
Revises: f9a30386bd74
Create Date: 2020-04-29 09:24:04.952368

"""

# revision identifiers, used by Alembic.
revision = "620241d1153f"
down_revision = "f9a30386bd74"

import json

from alembic import op
from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db, db_engine_specs
from superset.databases.utils import make_url_safe
from superset.utils.memoized import memoized

Base = declarative_base()


class Database(Base):
    __tablename__ = "dbs"

    id = Column(Integer, primary_key=True)
    sqlalchemy_uri = Column(Text)

    def grains(self):
        url = make_url_safe(self.sqlalchemy_uri)
        backend = url.get_backend_name()
        db_engine_spec = db_engine_specs.engines.get(
            backend, db_engine_specs.BaseEngineSpec
        )
        return db_engine_spec.get_time_grains()


class Table(Base):
    __tablename__ = "tables"

    id = Column(Integer, primary_key=True)
    database_id = Column(Integer, ForeignKey("dbs.id"))


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    params = Column(Text)
    datasource_type = Column(Text)
    datasource_id = Column(Integer)


@memoized
def duration_by_name(database: Database):
    return {grain.name: grain.duration for grain in database.grains()}


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    query = (
        session.query(Slice, Database)
        .filter(Slice.datasource_type == "table")
        .filter(Slice.datasource_id == Table.id)
        .filter(Table.database_id == Database.id)
        .all()
    )

    for slc, database in query:
        try:
            params = json.loads(slc.params)
            duration_dict = duration_by_name(database)
            granularity = params.get("time_grain_sqla")
            if granularity in duration_dict:
                params["time_grain_sqla"] = duration_dict[granularity]
                slc.params = json.dumps(params, sort_keys=True)
        except Exception:
            pass

    session.commit()
    session.close()


# No downgrade because we can't know what rows were changed in the previous upgrade
def downgrade():
    pass
