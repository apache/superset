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
"""resample

Revision ID: ab8c66efdd01
Revises: d7c1a0d6f2da
Create Date: 2019-06-28 13:17:59.517089

"""

# revision identifiers, used by Alembic.
revision = "ab8c66efdd01"
down_revision = "d7c1a0d6f2da"

import json
import logging

from alembic import op
from sqlalchemy import Column, Integer, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db

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
            params = json.loads(slc.params)

            # Note that the resample params could be encoded as empty strings.
            if "resample_rule" in params:
                rule = params["resample_rule"]

                # Per the old logic how takes precedence over fill-method. Note that
                # due to UI options, alongside None, empty strings were viable choices
                # hence the truthiness checks.
                if rule:
                    how = None

                    if "resample_how" in params:
                        how = params["resample_how"]

                        if how:
                            params["resample_method"] = how

                    if not how and "fill_method" in params:
                        fill_method = params["resample_fillmethod"]

                        if fill_method:
                            params["resample_method"] = fill_method

                    # Ensure that the resample logic is fully defined.
                    if not "resample_method" in params:
                        del params["resample_rule"]
                else:
                    del params["resample_rule"]

                # Finally remove any erroneous legacy fields.
                params.pop("resample_fillmethod", None)
                params.pop("resample_how", None)
                slc.params = json.dumps(params, sort_keys=True)
        except Exception as ex:
            logging.exception(ex)

    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).all():
        try:
            params = json.loads(slc.params)

            if "resample_method" in params:
                method = params["resample_method"]

                if method in ["asfreq", "bfill", "ffill"]:
                    params["resample_fillmethod"] = method
                else:
                    params["resample_how"] = method

                del params["resample_method"]
                slc.params = json.dumps(params, sort_keys=True)
        except Exception as ex:
            logging.exception(ex)

    session.commit()
    session.close()
