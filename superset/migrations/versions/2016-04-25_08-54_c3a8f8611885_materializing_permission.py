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
"""Materializing permission

Revision ID: c3a8f8611885
Revises: 4fa88fe24e94
Create Date: 2016-04-25 08:54:04.303859

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.ext.declarative import declarative_base

from superset import db

# revision identifiers, used by Alembic.
revision = "c3a8f8611885"
down_revision = "4fa88fe24e94"


Base = declarative_base()


class Slice(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    slice_name = Column(String(250))
    druid_datasource_id = Column(Integer, ForeignKey("datasources.id"))
    table_id = Column(Integer, ForeignKey("tables.id"))
    perm = Column(String(2000))


def upgrade():
    bind = op.get_bind()
    op.add_column("slices", sa.Column("perm", sa.String(length=2000), nullable=True))
    session = db.Session(bind=bind)

    # Use Slice class defined here instead of models.Slice
    for slc in session.query(Slice).all():
        if slc.datasource:
            slc.perm = slc.datasource.perm
            session.commit()
    db.session.close()


def downgrade():
    # Use batch_alter_table because dropping columns is not supported in SQLite
    with op.batch_alter_table("slices") as batch_op:
        batch_op.drop_column("perm")
