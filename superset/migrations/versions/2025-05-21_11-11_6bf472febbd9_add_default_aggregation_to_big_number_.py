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
"""add default aggregation to big number charts

Revision ID: 6bf472febbd9
Revises: f1edd4a4d4f2
Create Date: 2025-05-21 11:11:25.493144

"""

import json
import logging

import sqlalchemy as sa
from alembic import op
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session

revision = "6bf472febbd9"
down_revision = "f1edd4a4d4f2"


Base = declarative_base()
logger = logging.getLogger(__name__)


class Slice(Base):
    __tablename__ = "slices"
    id = sa.Column(sa.Integer, primary_key=True)
    slice_name = sa.Column(sa.String(250))
    params = sa.Column(sa.Text)
    viz_type = sa.Column(sa.String(250))


def do_upgrade(session: Session) -> None:
    slices = session.query(Slice).filter(Slice.viz_type.in_(["big_number"])).all()

    for slc in slices:
        try:
            params = json.loads(slc.params or "{}")
            if "aggregation" not in params:
                params["aggregation"] = "LAST_VALUE"
                params["_aggregation_added_by"] = "migration_add_last_value"
                slc.params = json.dumps(params)
        except Exception as ex:
            logger.warning(f"Skipping slice {slc.id} due to error: {ex}")
            continue


def do_downgrade(session: Session) -> None:
    slices = session.query(Slice).filter(Slice.viz_type.in_(["big_number"])).all()

    for slc in slices:
        try:
            params = json.loads(slc.params or "{}")
            if (
                params.get("aggregation") == "LAST_VALUE"
                and params.get("_aggregation_added_by") == "migration_add_last_value"
            ):
                del params["aggregation"]
                del params["_aggregation_added_by"]
                slc.params = json.dumps(params)
        except Exception as ex:
            logger.warning(f"Skipping slice {slc.id} due to error: {ex}")
            continue


def upgrade():
    bind = op.get_bind()
    session = Session(bind=bind)
    try:
        do_upgrade(session)
        session.commit()
    except SQLAlchemyError as ex:
        session.rollback()
        raise Exception(f"Upgrade failed: {ex}") from ex
    finally:
        session.close()


def downgrade():
    bind = op.get_bind()
    session = Session(bind=bind)
    try:
        do_downgrade(session)
        session.commit()
    except SQLAlchemyError as ex:
        session.rollback()
        raise Exception(f"Downgrade failed: {ex}") from ex
    finally:
        session.close()
