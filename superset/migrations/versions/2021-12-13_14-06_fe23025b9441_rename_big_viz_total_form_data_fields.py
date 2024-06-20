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
"""rename_big_viz_total_form_data_fields

Revision ID: fe23025b9441
Revises: 3ba29ecbaac5
Create Date: 2021-12-13 14:06:24.426970

"""

# revision identifiers, used by Alembic.
revision = "fe23025b9441"
down_revision = "3ba29ecbaac5"

import logging  # noqa: E402

from alembic import op  # noqa: E402
from sqlalchemy import Column, Integer, String, Text  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402
from superset.utils import json  # noqa: E402

Base = declarative_base()

logger = logging.getLogger("alembic")


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    params = Column(Text)
    viz_type = Column(String(250))


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    slices = session.query(Slice).filter(Slice.viz_type == "big_number_total").all()
    for slc in slices:
        try:
            params = json.loads(slc.params)
            header_format_selector = params.pop("header_format_selector", None)
            header_timestamp_format = params.pop("header_timestamp_format", None)
            if header_format_selector:
                params["force_timestamp_formatting"] = header_format_selector
            if header_timestamp_format:
                params["time_format"] = header_timestamp_format
            slc.params = json.dumps(params, sort_keys=True)
        except Exception:
            logger.exception(
                f"An error occurred: parsing params for slice {slc.id} failed."
                f"You need to fix it before upgrading your DB."
            )
            raise

    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    slices = session.query(Slice).filter(Slice.viz_type == "big_number_total").all()
    for slc in slices:
        try:
            params = json.loads(slc.params)
            time_format = params.pop("time_format", None)
            force_timestamp_formatting = params.pop("force_timestamp_formatting", None)
            if time_format:
                params["header_timestamp_format"] = time_format
            if force_timestamp_formatting:
                params["header_format_selector"] = force_timestamp_formatting
            slc.params = json.dumps(params, sort_keys=True)
        except Exception:
            logger.exception(
                f"An error occurred: parsing params for slice {slc.id} failed. "
                "You need to fix it before downgrading your DB."
            )
            raise

    session.commit()
    session.close()
