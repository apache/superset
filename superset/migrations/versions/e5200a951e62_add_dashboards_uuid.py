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
"""Adds a dashboards.uuid column.

Revision ID: e5200a951e62
Revises: e9df189e5c7e
Create Date: 2019-05-08 13:42:48.479145

"""
import uuid
from alembic import op
from sqlalchemy import Column, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy_utils.types.uuid import UUIDType

from superset import db

# revision identifiers, used by Alembic.
revision = 'e5200a951e62'
down_revision = 'e9df189e5c7e'

Base = declarative_base()


get_uuid = lambda: str(uuid.uuid4())

class Dashboard(Base):
    __tablename__ = 'dashboards'
    id = Column(Integer, primary_key=True)
    uuid = Column(UUIDType(binary=False), default=get_uuid)

class Datasource(Base):
    __tablename__ = 'datasources'
    id = Column(Integer, primary_key=True)
    uuid = Column(UUIDType(binary=False), default=get_uuid)

class Slice(Base):
    __tablename__ = 'slices'
    id = Column(Integer, primary_key=True)
    uuid = Column(UUIDType(binary=False), default=get_uuid)

class Database(Base):
    __tablename__ = 'dbs'
    id = Column(Integer, primary_key=True)
    uuid = Column(UUIDType(binary=False), default=get_uuid)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    with op.batch_alter_table('dashboards') as batch_op:
        batch_op.add_column(Column('uuid', UUIDType(binary=False), default=get_uuid))
    for d in session.query(Dashboard):
        d.uuid = get_uuid()
        session.merge(d)
    with op.batch_alter_table('dashboards') as batch_op:
        batch_op.alter_column('uuid', nullable=False)
        batch_op.create_unique_constraint('uq_uuid', 'uuid')
    session.commit()
    
    with op.batch_alter_table('datasources') as batch_op:
        batch_op.add_column(Column('uuid', UUIDType(binary=False), default=get_uuid))
    for d in session.query(Datasource):
        d.uuid = get_uuid()
        session.merge(d)
    with op.batch_alter_table('datasources') as batch_op:
        batch_op.alter_column('uuid', nullable=False)
        batch_op.create_unique_constraint('uq_uuid', 'uuid')
    session.commit()

    with op.batch_alter_table('slices') as batch_op:
        batch_op.add_column(Column('uuid', UUIDType(binary=False), default=get_uuid))
    for s in session.query(Slice):
        s.uuid = get_uuid()
        session.merge(s)
    with op.batch_alter_table('slices') as batch_op:
        batch_op.alter_column('uuid', nullable=False)
        batch_op.create_unique_constraint('uq_uuid', 'uuid')
    session.commit()

    with op.batch_alter_table('dbs') as batch_op:
        batch_op.add_column(Column('uuid', UUIDType(binary=False), default=get_uuid))
    for d in session.query(Database):
        d.uuid = get_uuid()
        session.merge(d)
    with op.batch_alter_table('slices') as batch_op:
        batch_op.alter_column('uuid', nullable=False)
        batch_op.create_unique_constraint('uq_uuid', 'uuid')
    session.commit()
    
    session.close()

def downgrade():
    with op.batch_alter_table('dashboards') as batch_op:
        batch_op.drop_column('uuid')

    with op.batch_alter_table('datasources') as batch_op:
        batch_op.drop_column('uuid')

    with op.batch_alter_table('slices') as batch_op:
        batch_op.drop_column('uuid')
    
    with op.batch_alter_table('dbs') as batch_op:
        batch_op.drop_column('uuid')
