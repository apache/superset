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
"""update slice model

Revision ID: 33d996bcc382
Revises: 41f6a59a61f2
Create Date: 2016-09-07 23:50:59.366779

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy import Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base

from superset import db

# revision identifiers, used by Alembic.
revision = "33d996bcc382"
down_revision = "41f6a59a61f2"

Base = declarative_base()


class Slice(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    datasource_id = Column(Integer)
    druid_datasource_id = Column(Integer)
    table_id = Column(Integer)
    datasource_type = Column(String(200))


def upgrade():
    bind = op.get_bind()
    op.add_column("slices", sa.Column("datasource_id", sa.Integer()))
    session = db.Session(bind=bind)

    for slc in session.query(Slice).all():
        if slc.druid_datasource_id:
            slc.datasource_id = slc.druid_datasource_id
        if slc.table_id:
            slc.datasource_id = slc.table_id
        session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    for slc in session.query(Slice).all():
        if slc.datasource_type == "druid":
            slc.druid_datasource_id = slc.datasource_id
        if slc.datasource_type == "table":
            slc.table_id = slc.datasource_id
        session.commit()
    session.close()
    op.drop_column("slices", "datasource_id")
