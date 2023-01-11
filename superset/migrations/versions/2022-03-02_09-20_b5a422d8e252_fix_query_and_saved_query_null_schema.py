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
"""fix query and saved_query null schema

Revision ID: b5a422d8e252
Revises: b8d3a24d9131
Create Date: 2022-03-02 09:20:02.919490

"""

from alembic import op
from sqlalchemy import Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base

from superset import db

# revision identifiers, used by Alembic.
revision = "b5a422d8e252"
down_revision = "b8d3a24d9131"

Base = declarative_base()


class Query(Base):
    __tablename__ = "query"

    id = Column(Integer, primary_key=True)
    schema = Column(String(256))


class SavedQuery(Base):
    __tablename__ = "saved_query"

    id = Column(Integer, primary_key=True)
    schema = Column(String(128))


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for model in (Query, SavedQuery):
        for record in session.query(model).filter(model.schema == "null"):
            record.schema = None

        session.commit()

    session.close()


def downgrade():
    pass
