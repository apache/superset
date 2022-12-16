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
"""time range

Revision ID: 1495eb914ad3
Revises: 258b5280a45e
Create Date: 2019-10-10 13:52:54.544475

"""
import json
import logging

from alembic import op
from sqlalchemy import Column, Integer, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.legacy import update_time_range

# revision identifiers, used by Alembic.
revision = "1495eb914ad3"
down_revision = "258b5280a45e"

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).all():
        try:
            form_data = json.loads(slc.params)
            update_time_range(form_data)
            slc.params = json.dumps(form_data, sort_keys=True)
        except Exception as ex:
            logging.exception(ex)

    session.commit()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).all():
        try:
            form_data = json.loads(slc.params)

            if "time_range" in form_data:

                # Note defaults and relative dates are not compatible with since/until
                # and thus the time range is persisted.
                try:
                    since, until = form_data["time_range"].split(" : ")
                    form_data["since"] = since
                    form_data["until"] = until
                    del form_data["time_range"]
                    slc.params = json.dumps(form_data, sort_keys=True)
                except ValueError:
                    pass
        except Exception as ex:
            logging.exception(ex)

    session.commit()
