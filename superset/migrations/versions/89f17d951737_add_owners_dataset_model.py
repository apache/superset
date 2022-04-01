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
"""add_owners_dataset_model

Revision ID: 89f17d951737
Revises: 2ed890b36b94
Create Date: 2022-03-31 22:22:43.831122

"""

# revision identifiers, used by Alembic.
revision = "89f17d951737"
down_revision = "2ed890b36b94"

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

from superset import db, security_manager

Base = declarative_base()


class User(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "ab_user"
    id = sa.Column(sa.Integer, primary_key=True)


class SqlaTable(Base):
    __tablename__ = "tables"

    id = sa.Column(sa.Integer, primary_key=True)
    owners = relationship(
        "User",
        secondary=sa.Table(
            "sqlatable_user",
            Base.metadata,
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("user_id", sa.Integer, sa.ForeignKey("ab_user.id")),
            sa.Column("table_id", sa.Integer, sa.ForeignKey("tables.id")),
        ),
        backref="tables",
    )


class Dataset(Base):
    __tablename__ = "sl_datasets"

    id = sa.Column(sa.Integer, primary_key=True)
    sqlatable_id = sa.Column(sa.Integer, nullable=True, unique=True)
    owners = relationship(
        "User",
        secondary=sa.Table(
            "sl_dataset_users",
            Base.metadata,
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("user_id", sa.ForeignKey("ab_user.id")),
            sa.Column("dataset_id", sa.ForeignKey("sl_datasets.id")),
        ),
        backref="sl_datasets",
    )


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    op.create_table(
        "sl_dataset_users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("dataset_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["sl_datasets.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["ab_user.id"],
        ),
    )

    limit = 1000
    offset = 0
    idx = 0
    while True:
        # paginating sqlatable query with offset + limit
        # trying to not pull all SqlaTable in memory at once
        query = session.query(SqlaTable).offset(offset).limit(limit).all()
        if not len(query):
            break

        # find matching new dataset
        for sqlatable in query:
            try:
                ds = (
                    session.query(Dataset)
                    .filter(Dataset.sqlatable_id == sqlatable.id)
                    .one()
                )
            except sa.orm.exc.NoResultFound:
                continue

            # set owners for new dataset
            ds.owners = sqlatable.owners

        idx += 1
        offset = idx * limit

    session.commit()
    session.close()


def downgrade():
    op.drop_table("sl_dataset_users")
