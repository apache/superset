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
"""add created_by_fk as owner

Revision ID: 409c7b420ab0
Revises: a39867932713
Create Date: 2022-07-05 15:48:06.029190

"""

from alembic import op
from sqlalchemy import and_, Column, insert, Integer
from sqlalchemy.ext.declarative import declarative_base

# revision identifiers, used by Alembic.
from superset import db

revision = "409c7b420ab0"
down_revision = "a39867932713"


Base = declarative_base()


class Dataset(Base):
    __tablename__ = "sl_datasets"

    id = Column(Integer, primary_key=True)
    created_by_fk = Column(Integer)


class DatasetUser(Base):
    __tablename__ = "sl_dataset_users"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    dataset_id = Column(Integer)


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    created_by_fk = Column(Integer)


class SliceUser(Base):
    __tablename__ = "slice_user"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    slice_id = Column(Integer)


class SqlaTable(Base):
    __tablename__ = "tables"

    id = Column(Integer, primary_key=True)
    created_by_fk = Column(Integer)


class SqlaTableUser(Base):
    __tablename__ = "sqlatable_user"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    table_id = Column(Integer)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    op.execute(
        insert(DatasetUser).from_select(
            ["user_id", "dataset_id"],
            session.query(Dataset.created_by_fk, Dataset.id)
            .outerjoin(
                DatasetUser,
                and_(
                    DatasetUser.dataset_id == Dataset.id,
                    DatasetUser.user_id == Dataset.created_by_fk,
                ),
            )
            .filter(DatasetUser.dataset_id == None, Dataset.created_by_fk != None),
        )
    )

    op.execute(
        insert(SliceUser).from_select(
            ["user_id", "slice_id"],
            session.query(Slice.created_by_fk, Slice.id)
            .outerjoin(
                SliceUser,
                and_(
                    SliceUser.slice_id == Slice.id,
                    SliceUser.user_id == Slice.created_by_fk,
                ),
            )
            .filter(SliceUser.slice_id == None),
        )
    )

    op.execute(
        insert(SqlaTableUser).from_select(
            ["user_id", "table_id"],
            session.query(SqlaTable.created_by_fk, SqlaTable.id)
            .outerjoin(
                SqlaTableUser,
                and_(
                    SqlaTableUser.table_id == SqlaTable.id,
                    SqlaTableUser.user_id == SqlaTable.created_by_fk,
                ),
            )
            .filter(SqlaTableUser.table_id == None),
        )
    )


def downgrade():
    pass
